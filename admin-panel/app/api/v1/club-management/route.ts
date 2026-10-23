import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import {
  AttendanceRecord,
  BeltExamCandidate,
  BeltExamEvent,
  ClubFinanceEntry,
  ClubMemberLicense,
} from "@/lib/types";

const noGroup = "Sin grupo";
const recordedAttendanceStatuses = ["PRESENT", "ABSENT", "JUSTIFIED", "LATE"] as const;
const paymentMethods = ["CASH", "CARD", "TRANSFER", "BIZUM", "DIRECT_DEBIT"] as const;

type RecordedAttendanceStatus = (typeof recordedAttendanceStatuses)[number];
type PaymentMethod = (typeof paymentMethods)[number];
type Session = NonNullable<ReturnType<typeof getSession>>;
type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

type ClubAccess = {
  client: SupabaseClient;
  session: Session;
  clubId: string | null;
};

type ClubAccessResult = ClubAccess | { response: Response };

type AthleteRow = {
  id: string;
  name: string;
  club_id: string;
  wt_category: string | null;
  belt: string | null;
  is_competitor: boolean | null;
};

type ClubClassRow = {
  id: string;
  name: string;
  club_class_athletes: Array<{ athlete_id: string }> | null;
};

type Roster = {
  athletes: AthleteRow[];
  classes: ClubClassRow[];
  memberships: Map<string, string[]>;
};

type AttendanceRow = {
  id: string;
  club_id: string;
  athlete_id: string;
  attendance_date: string;
  group_name: string | null;
  status: RecordedAttendanceStatus;
  check_in_time: string | null;
  notes: string | null;
  athletes?: { name: string } | null;
};

type FinanceRow = {
  id: string;
  club_id: string;
  athlete_id: string | null;
  entry_type: ClubFinanceEntry["entryType"];
  status: ClubFinanceEntry["status"];
  description: string;
  amount: number | string;
  currency: string | null;
  due_date: string | null;
  occurred_at: string;
  paid_at: string | null;
  created_by: string | null;
  payment_method: string | null;
  athletes?: { name: string } | null;
};

type LicenseRow = {
  id: string;
  club_id: string;
  athlete_id: string;
  category: string | null;
  federation_code: string;
  federation_region: string;
  license_expiry_date: string;
  insurance_policy: string;
  insurance_valid_until: string;
  medical_clearance_date: string;
  medical_clearance_valid_until: string;
  minor_consent_signed: boolean;
  status: ClubMemberLicense["status"];
  updated_at: string;
  athletes?: { name: string; wt_category: string | null } | null;
};

type ExamCandidateRow = {
  exam_id: string;
  athlete_id: string;
  current_belt: string;
  target_belt: string;
  attended_classes: number;
  min_classes_required: number;
  poomsae_score: number | string | null;
  sparring_score: number | string | null;
  technique_score: number | string | null;
  breaking_score: number | string | null;
  passed: boolean | null;
  fee_paid: boolean;
  diploma_issued: boolean;
  notes: string | null;
  athletes?: { name: string } | null;
};

type ExamEventRow = {
  id: string;
  club_id: string;
  title: string;
  exam_date: string;
  examiner_name: string;
  status: BeltExamEvent["status"];
  belt_exam_candidates: ExamCandidateRow[] | null;
};

type RosterResult = Roster | { error: string };

function responseError(message: string, status = 503) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
}

function isRecordedAttendanceStatus(value: unknown): value is RecordedAttendanceStatus {
  return typeof value === "string" && recordedAttendanceStatuses.includes(value as RecordedAttendanceStatus);
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && paymentMethods.includes(value as PaymentMethod);
}

async function getClubAccess(request: Request, requestedClubId?: unknown): Promise<ClubAccessResult> {
  const session = getSession(request);
  if (!session) return { response: unauthorized() };
  if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") {
    return { response: forbidden() };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      response: responseError("La gestión del club requiere una conexión configurada con Supabase."),
    };
  }

  let clubId = session.clubId || null;
  if (session.role === "ADMIN" && typeof requestedClubId === "string" && requestedClubId) {
    const { data, error } = await client.from("clubs").select("id").eq("id", requestedClubId).maybeSingle();
    if (error) return { response: responseError("No se pudo verificar el club seleccionado.") };
    if (!data) return { response: forbidden() };
    clubId = data.id;
  } else if (!clubId && session.role === "COACH") {
    const { data, error } = await client.from("coaches").select("club_id").eq("user_id", session.id).maybeSingle();
    if (error) return { response: responseError("No se pudo localizar el club del entrenador.") };
    clubId = data?.club_id || null;
  } else if (!clubId && session.role === "CLUB") {
    const { data, error } = await client.from("users").select("club_id").eq("id", session.id).maybeSingle();
    if (error) return { response: responseError("No se pudo localizar el club de la cuenta.") };
    clubId = data?.club_id || null;
  }

  if (!clubId && session.role === "ADMIN") {
    const { data, error } = await client
      .from("clubs")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return { response: responseError("No se pudo consultar el club.") };
    clubId = data?.id || null;
  }

  if (!clubId && session.role !== "ADMIN") return { response: forbidden() };
  return { client, session, clubId };
}

async function loadRoster(client: SupabaseClient, clubId: string): Promise<RosterResult> {
  const [athleteResult, classResult] = await Promise.all([
    client
      .from("athletes")
      .select("id,name,club_id,wt_category,belt,is_competitor")
      .eq("club_id", clubId)
      .order("name"),
    client
      .from("club_classes")
      .select("id,name,club_class_athletes(athlete_id)")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (athleteResult.error) {
    console.error("[CLUB MANAGEMENT] No se pudo cargar el alumnado:", athleteResult.error);
    return { error: "No se pudo consultar el alumnado del club." };
  }
  if (classResult.error) {
    console.error("[CLUB MANAGEMENT] No se pudieron cargar los grupos:", classResult.error);
    return { error: "No se pudieron consultar los grupos del club." };
  }

  const athletes = (athleteResult.data || []) as AthleteRow[];
  const classes = (classResult.data || []) as ClubClassRow[];
  const memberships = new Map<string, string[]>();
  for (const clubClass of classes) {
    for (const membership of clubClass.club_class_athletes || []) {
      const athleteGroups = memberships.get(membership.athlete_id) || [];
      athleteGroups.push(clubClass.name);
      memberships.set(membership.athlete_id, athleteGroups);
    }
  }

  return { athletes, classes, memberships };
}

function mapAttendance(row: AttendanceRow, athleteName?: string): AttendanceRecord {
  return {
    id: row.id,
    clubId: row.club_id,
    athleteId: row.athlete_id,
    athleteName: athleteName || row.athletes?.name || "",
    date: row.attendance_date,
    group: row.group_name || noGroup,
    status: row.status,
    checkInTime: row.check_in_time ? row.check_in_time.slice(0, 5) : undefined,
    notes: row.notes || undefined,
  };
}

function mapFinanceEntry(row: FinanceRow): ClubFinanceEntry {
  return {
    id: row.id,
    clubId: row.club_id,
    athleteId: row.athlete_id || undefined,
    athleteName: row.athletes?.name,
    entryType: row.entry_type,
    status: row.status,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency || "EUR",
    dueDate: row.due_date || undefined,
    occurredAt: row.occurred_at,
    paidAt: row.paid_at || undefined,
    createdBy: row.created_by || "",
    paymentMethod: isPaymentMethod(row.payment_method) ? row.payment_method : undefined,
  };
}

function mapLicense(row: LicenseRow): ClubMemberLicense {
  return {
    id: row.id,
    clubId: row.club_id,
    athleteId: row.athlete_id,
    athleteName: row.athletes?.name || "",
    category: row.category || row.athletes?.wt_category || undefined,
    federationCode: row.federation_code,
    federationRegion: row.federation_region,
    licenseExpiryDate: row.license_expiry_date,
    insurancePolicy: row.insurance_policy,
    insuranceValidUntil: row.insurance_valid_until,
    medicalClearanceDate: row.medical_clearance_date,
    medicalClearanceValidUntil: row.medical_clearance_valid_until,
    minorConsentSigned: row.minor_consent_signed,
    status: row.status,
    lastUpdated: row.updated_at,
  };
}

function optionalScore(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const score = Number(value);
  return Number.isFinite(score) ? score : undefined;
}

function mapExamCandidate(row: ExamCandidateRow): BeltExamCandidate {
  return {
    athleteId: row.athlete_id,
    athleteName: row.athletes?.name || "",
    currentBelt: row.current_belt,
    targetBelt: row.target_belt,
    attendedClasses: row.attended_classes,
    minClassesRequired: row.min_classes_required,
    poomsaeScore: optionalScore(row.poomsae_score),
    sparringScore: optionalScore(row.sparring_score),
    techniqueScore: optionalScore(row.technique_score),
    breakingScore: optionalScore(row.breaking_score),
    passed: row.passed ?? undefined,
    feePaid: row.fee_paid,
    diplomaIssued: row.diploma_issued,
    notes: row.notes || undefined,
  };
}

function mapExamEvent(row: ExamEventRow): BeltExamEvent {
  return {
    id: row.id,
    clubId: row.club_id,
    title: row.title,
    examDate: row.exam_date,
    examinerName: row.examiner_name,
    status: row.status,
    candidates: (row.belt_exam_candidates || []).map(mapExamCandidate),
  };
}

function emptyData() {
  return {
    metrics: {
      totalStudents: 0,
      presentToday: 0,
      attendanceRate: 0,
      duesCollected: 0,
      duesPending: 0,
      expiringLicenses: 0,
      readyForExam: 0,
    },
    attendances: [],
    dues: [],
    licenses: [],
    exams: [],
    groups: [],
    athletes: [],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await getClubAccess(request, url.searchParams.get("clubId") || undefined);
  if ("response" in access) return access.response;

  const dateParam = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const monthParam = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const groupParam = url.searchParams.get("group") || "ALL";
  if (!isDate(dateParam)) return responseError("La fecha debe tener formato AAAA-MM-DD.", 400);
  if (!isMonth(monthParam)) return responseError("El mes debe tener formato AAAA-MM.", 400);
  if (!access.clubId) return NextResponse.json({ success: true, data: emptyData() });

  const rosterResult = await loadRoster(access.client, access.clubId);
  if ("error" in rosterResult) return responseError(rosterResult.error);

  const monthStart = `${monthParam}-01`;
  const monthEnd = nextMonthStart(monthParam);
  const [attendanceResult, duesResult, licenseResult, examResult] = await Promise.all([
    access.client
      .from("club_attendance_records")
      .select("*,athletes(name)")
      .eq("club_id", access.clubId)
      .eq("attendance_date", dateParam)
      .order("created_at"),
    access.client
      .from("club_finance_entries")
      .select("*,athletes(name)")
      .eq("club_id", access.clubId)
      .eq("entry_type", "STUDENT_DUE")
      .gte("occurred_at", monthStart)
      .lt("occurred_at", monthEnd)
      .order("occurred_at", { ascending: false }),
    access.client
      .from("club_member_licenses")
      .select("*,athletes(name,wt_category)")
      .eq("club_id", access.clubId)
      .order("license_expiry_date"),
    access.client
      .from("belt_exam_events")
      .select("*,belt_exam_candidates(*,athletes(name))")
      .eq("club_id", access.clubId)
      .order("exam_date", { ascending: false }),
  ]);

  if (attendanceResult.error || duesResult.error || licenseResult.error || examResult.error) {
    console.error("[CLUB MANAGEMENT] Error consultando los datos del club:", {
      attendance: attendanceResult.error,
      dues: duesResult.error,
      licenses: licenseResult.error,
      exams: examResult.error,
    });
    return responseError("No se pudieron cargar todos los datos del club desde Supabase.");
  }

  const attendanceRows = (attendanceResult.data || []) as AttendanceRow[];
  const dueRows = (duesResult.data || []) as FinanceRow[];
  const licenseRows = (licenseResult.data || []) as LicenseRow[];
  const examRows = (examResult.data || []) as ExamEventRow[];
  const attendanceByAthlete = new Map(attendanceRows.map((row) => [row.athlete_id, row]));
  const groupNames = new Set(rosterResult.classes.map((clubClass) => clubClass.name));
  for (const row of attendanceRows) {
    if (row.group_name) groupNames.add(row.group_name);
  }
  if (rosterResult.athletes.some((athlete) => !(rosterResult.memberships.get(athlete.id) || []).length)) {
    groupNames.add(noGroup);
  }

  const attendances = rosterResult.athletes.flatMap((athlete) => {
    const stored = attendanceByAthlete.get(athlete.id);
    const memberships = rosterResult.memberships.get(athlete.id) || [];
    const group = stored?.group_name || memberships[0] || noGroup;
    if (groupParam !== "ALL" && groupParam !== group) return [];
    if (stored) return [mapAttendance(stored, athlete.name)];
    return [{
      id: `unmarked-${athlete.id}-${dateParam}`,
      clubId: access.clubId as string,
      athleteId: athlete.id,
      athleteName: athlete.name,
      date: dateParam,
      group,
      status: "UNMARKED" as const,
    }];
  });

  const dues = dueRows.map(mapFinanceEntry);
  const licenses = licenseRows.map(mapLicense);
  const exams = examRows.map(mapExamEvent);
  const presentToday = attendances.filter((attendance) =>
    attendance.status === "PRESENT" || attendance.status === "LATE"
  ).length;
  const expiringLicenses = licenses.filter((license) =>
    license.status === "EXPIRING_SOON" || license.status === "EXPIRED"
  ).length;

  return NextResponse.json({
    success: true,
    data: {
      metrics: {
        totalStudents: rosterResult.athletes.length,
        presentToday,
        attendanceRate: attendances.length ? Math.round((presentToday / attendances.length) * 100) : 0,
        duesCollected: dues.filter((due) => due.status === "PAID").reduce((sum, due) => sum + due.amount, 0),
        duesPending: dues.filter((due) => due.status === "PENDING").reduce((sum, due) => sum + due.amount, 0),
        expiringLicenses,
        readyForExam: exams.flatMap((exam) => exam.candidates)
          .filter((candidate) => candidate.attendedClasses >= candidate.minClassesRequired).length,
      },
      attendances,
      dues,
      licenses,
      exams,
      groups: Array.from(groupNames).sort((left, right) => left.localeCompare(right)),
      athletes: rosterResult.athletes.map((athlete) => ({
        id: athlete.id,
        fullName: athlete.name,
        category: athlete.wt_category || "",
        beltRank: athlete.belt || "",
        isCompetitor: Boolean(athlete.is_competitor),
      })),
    },
  });
}

export async function POST(request: Request) {
  const bodyValue: unknown = await request.json().catch(() => null);
  if (!bodyValue || typeof bodyValue !== "object" || Array.isArray(bodyValue)) {
    return responseError("El cuerpo de la solicitud debe ser un objeto JSON válido.", 400);
  }
  const body = bodyValue as Record<string, unknown>;
  const access = await getClubAccess(request, body.clubId);
  if ("response" in access) return access.response;
  if (!access.clubId) return responseError("No hay un club registrado o seleccionado.", 400);

  const { client, clubId, session } = access;
  switch (body.action) {
    case "UPDATE_ATTENDANCE": {
      const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
      const date = body.date;
      const status = body.status;
      if (!athleteId || !isDate(date) || !isRecordedAttendanceStatus(status)) {
        return responseError("Alumno, fecha o estado de asistencia no válidos.", 400);
      }
      if (body.group !== undefined && (typeof body.group !== "string" || body.group.length > 160)) {
        return responseError("El grupo no es válido.", 400);
      }
      if (body.notes !== undefined && body.notes !== null &&
          (typeof body.notes !== "string" || body.notes.length > 2000)) {
        return responseError("Las notas no son válidas.", 400);
      }

      const { data: athlete, error: athleteError } = await client
        .from("athletes")
        .select("id")
        .eq("id", athleteId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (athleteError) return responseError("No se pudo verificar el alumno.");
      if (!athlete) return responseError("Alumno no encontrado en este club.", 404);

      const { data: existing, error: existingError } = await client
        .from("club_attendance_records")
        .select("id,group_name,notes")
        .eq("club_id", clubId)
        .eq("athlete_id", athleteId)
        .eq("attendance_date", date)
        .maybeSingle();
      if (existingError) return responseError("No se pudo consultar la asistencia existente.");

      const checkInTime = status === "PRESENT" || status === "LATE"
        ? new Date().toTimeString().slice(0, 5)
        : null;
      const row = {
        id: existing?.id || `attendance-${randomUUID()}`,
        club_id: clubId,
        athlete_id: athleteId,
        attendance_date: date,
        group_name: typeof body.group === "string" ? body.group : existing?.group_name || noGroup,
        status,
        check_in_time: checkInTime,
        notes: body.notes === undefined ? existing?.notes || null : body.notes,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from("club_attendance_records")
        .upsert(row, { onConflict: "athlete_id,attendance_date" })
        .select("*,athletes(name)")
        .single();
      if (error) {
        console.error("[CLUB MANAGEMENT] No se pudo guardar la asistencia:", error);
        return responseError("No se pudo guardar la asistencia en Supabase.", 409);
      }
      return NextResponse.json({ success: true, data: mapAttendance(data as AttendanceRow) });
    }

    case "BATCH_MARK_ALL": {
      const date = body.date;
      const status = body.status;
      const group = typeof body.group === "string" ? body.group : "ALL";
      if (!isDate(date) || !isRecordedAttendanceStatus(status)) {
        return responseError("Fecha o estado de asistencia no válidos.", 400);
      }
      const rosterResult = await loadRoster(client, clubId);
      if ("error" in rosterResult) return responseError(rosterResult.error);
      if (group !== "ALL" && group !== noGroup && !rosterResult.classes.some((clubClass) => clubClass.name === group)) {
        return responseError("El grupo seleccionado no existe en este club.", 400);
      }
      const selectedAthletes = rosterResult.athletes.filter((athlete) => {
        const memberships = rosterResult.memberships.get(athlete.id) || [];
        return group === "ALL" ||
          (group === noGroup ? memberships.length === 0 : memberships.includes(group));
      });
      if (!selectedAthletes.length) return NextResponse.json({ success: true, count: 0 });

      const athleteIds = selectedAthletes.map((athlete) => athlete.id);
      const { data: existingRows, error: existingError } = await client
        .from("club_attendance_records")
        .select("id,athlete_id,group_name")
        .eq("club_id", clubId)
        .eq("attendance_date", date)
        .in("athlete_id", athleteIds);
      if (existingError) return responseError("No se pudieron consultar las asistencias existentes.");
      const existingByAthlete = new Map(
        ((existingRows || []) as Array<{ id: string; athlete_id: string; group_name: string | null }>)
          .map((row) => [row.athlete_id, row])
      );
      const checkInTime = status === "PRESENT" || status === "LATE"
        ? new Date().toTimeString().slice(0, 5)
        : null;
      const rows = selectedAthletes.map((athlete) => {
        const existing = existingByAthlete.get(athlete.id);
        const memberships = rosterResult.memberships.get(athlete.id) || [];
        return {
          id: existing?.id || `attendance-${randomUUID()}`,
          club_id: clubId,
          athlete_id: athlete.id,
          attendance_date: date,
          group_name: group === "ALL" ? existing?.group_name || memberships[0] || noGroup : group,
          status,
          check_in_time: checkInTime,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await client
        .from("club_attendance_records")
        .upsert(rows, { onConflict: "athlete_id,attendance_date" });
      if (error) {
        console.error("[CLUB MANAGEMENT] No se pudo guardar el pase de lista:", error);
        return responseError("No se pudo actualizar el pase de lista en Supabase.", 409);
      }
      return NextResponse.json({ success: true, count: rows.length });
    }

    case "PAY_DUE": {
      const dueId = typeof body.dueId === "string" ? body.dueId : "";
      const paymentMethod = body.paymentMethod === undefined ? "CASH" : body.paymentMethod;
      if (!dueId || !isPaymentMethod(paymentMethod)) {
        return responseError("La cuota o el método de pago no son válidos.", 400);
      }
      const { data, error } = await client
        .from("club_finance_entries")
        .update({
          status: "PAID",
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dueId)
        .eq("club_id", clubId)
        .eq("entry_type", "STUDENT_DUE")
        .select("*,athletes(name)")
        .maybeSingle();
      if (error) return responseError("No se pudo registrar el pago.");
      if (!data) return responseError("Cuota no encontrada en este club.", 404);
      return NextResponse.json({ success: true, data: mapFinanceEntry(data as FinanceRow) });
    }

    case "GENERATE_MONTHLY_DUES": {
      const month = body.month;
      const amount = Number(body.defaultAmount ?? 55);
      if (!isMonth(month) || !Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
        return responseError("Mes o importe de cuota no válido.", 400);
      }
      const rosterResult = await loadRoster(client, clubId);
      if ("error" in rosterResult) return responseError(rosterResult.error);
      if (!rosterResult.athletes.length) return NextResponse.json({ success: true, count: 0 });

      const monthStart = `${month}-01`;
      const monthEnd = nextMonthStart(month);
      const { data: existingRows, error: existingError } = await client
        .from("club_finance_entries")
        .select("athlete_id")
        .eq("club_id", clubId)
        .eq("entry_type", "STUDENT_DUE")
        .gte("occurred_at", monthStart)
        .lt("occurred_at", monthEnd);
      if (existingError) return responseError("No se pudieron consultar las cuotas del mes.");
      const existingAthleteIds = new Set(
        ((existingRows || []) as Array<{ athlete_id: string | null }>)
          .map((row) => row.athlete_id)
          .filter((id): id is string => Boolean(id))
      );
      const rows = rosterResult.athletes
        .filter((athlete) => !existingAthleteIds.has(athlete.id))
        .map((athlete) => ({
          id: `due-${randomUUID()}`,
          club_id: clubId,
          athlete_id: athlete.id,
          entry_type: "STUDENT_DUE",
          status: "PENDING",
          description: `Cuota Mensual (${month}) - ${athlete.name}`,
          amount,
          currency: "EUR",
          due_date: `${month}-05`,
          occurred_at: monthStart,
          created_by: session.id,
        }));
      if (!rows.length) return NextResponse.json({ success: true, count: 0 });
      const { error } = await client.from("club_finance_entries").insert(rows);
      if (error) {
        console.error("[CLUB MANAGEMENT] No se pudieron generar las cuotas:", error);
        return responseError("No se pudieron guardar las cuotas en Supabase.", 409);
      }
      return NextResponse.json({ success: true, count: rows.length });
    }

    case "RENEW_LICENSE": {
      const licenseId = typeof body.licenseId === "string" ? body.licenseId : "";
      const newExpiryDate = body.newExpiryDate;
      const insuranceValidUntil = body.insuranceValidUntil;
      const medicalClearanceValidUntil = body.medicalClearanceValidUntil;
      if (!licenseId ||
          (newExpiryDate !== undefined && !isDate(newExpiryDate)) ||
          (insuranceValidUntil !== undefined && !isDate(insuranceValidUntil)) ||
          (medicalClearanceValidUntil !== undefined && !isDate(medicalClearanceValidUntil))) {
        return responseError("Los datos de renovación no son válidos.", 400);
      }
      const updates: Record<string, unknown> = {
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      };
      if (newExpiryDate) updates.license_expiry_date = newExpiryDate;
      if (insuranceValidUntil) updates.insurance_valid_until = insuranceValidUntil;
      if (medicalClearanceValidUntil) updates.medical_clearance_valid_until = medicalClearanceValidUntil;
      const { data, error } = await client
        .from("club_member_licenses")
        .update(updates)
        .eq("id", licenseId)
        .eq("club_id", clubId)
        .select("*,athletes(name,wt_category)")
        .maybeSingle();
      if (error) return responseError("No se pudo guardar la renovación de licencia.");
      if (!data) return responseError("Licencia no encontrada en este club.", 404);
      return NextResponse.json({ success: true, data: mapLicense(data as LicenseRow) });
    }

    case "GRADE_EXAM_CANDIDATE": {
      const examId = typeof body.examId === "string" ? body.examId : "";
      const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
      const scores = [
        Number(body.poomsaeScore),
        Number(body.sparringScore),
        Number(body.techniqueScore),
        Number(body.breakingScore),
      ];
      if (!examId || !athleteId || scores.some((score) => !Number.isFinite(score) || score < 0 || score > 10)) {
        return responseError("Examen, alumno o calificaciones no válidos.", 400);
      }
      const { data: exam, error: examError } = await client
        .from("belt_exam_events")
        .select("id")
        .eq("id", examId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (examError) return responseError("No se pudo consultar el examen.");
      if (!exam) return responseError("Examen no encontrado en este club.", 404);
      const [poomsaeScore, sparringScore, techniqueScore, breakingScore] = scores;
      const passed = scores.reduce((total, score) => total + score, 0) / scores.length >= 5;
      const updates: Record<string, unknown> = {
        poomsae_score: poomsaeScore,
        sparring_score: sparringScore,
        technique_score: techniqueScore,
        breaking_score: breakingScore,
        passed,
      };
      if (body.notes !== undefined) {
        if (typeof body.notes !== "string" || body.notes.length > 2000) {
          return responseError("Las notas no son válidas.", 400);
        }
        updates.notes = body.notes;
      }
      const { data, error } = await client
        .from("belt_exam_candidates")
        .update(updates)
        .eq("exam_id", examId)
        .eq("athlete_id", athleteId)
        .select("*,athletes(name)")
        .maybeSingle();
      if (error) return responseError("No se pudieron guardar las calificaciones.");
      if (!data) return responseError("Candidato no encontrado en este examen.", 404);
      return NextResponse.json({ success: true, data: mapExamCandidate(data as ExamCandidateRow) });
    }

    case "ISSUE_DIPLOMA": {
      const examId = typeof body.examId === "string" ? body.examId : "";
      const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
      if (!examId || !athleteId) return responseError("Examen y alumno son obligatorios.", 400);
      const { data: exam, error: examError } = await client
        .from("belt_exam_events")
        .select("id")
        .eq("id", examId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (examError) return responseError("No se pudo consultar el examen.");
      if (!exam) return responseError("Examen no encontrado en este club.", 404);
      const { data, error } = await client
        .from("belt_exam_candidates")
        .update({ diploma_issued: true, fee_paid: true })
        .eq("exam_id", examId)
        .eq("athlete_id", athleteId)
        .select("*,athletes(name)")
        .maybeSingle();
      if (error) return responseError("No se pudo registrar la emisión del diploma.");
      if (!data) return responseError("Candidato no encontrado en este examen.", 404);
      const candidate = mapExamCandidate(data as ExamCandidateRow);
      if (candidate.passed) {
        let belt: string | null = null;
        if (candidate.targetBelt.includes("1º Dan") || candidate.targetBelt.includes("Negro")) belt = "1st_Dan";
        else if (candidate.targetBelt.includes("Rojo-Negro")) belt = "Red_Black";
        else if (candidate.targetBelt.includes("Rojo")) belt = "Red";
        if (belt) {
          const { error: beltError } = await client
            .from("athletes")
            .update({ belt })
            .eq("id", athleteId)
            .eq("club_id", clubId);
          if (beltError) return responseError("El diploma se registró, pero no se pudo actualizar el cinturón.");
        }
      }
      return NextResponse.json({ success: true, data: candidate });
    }

    case "CREATE_EXAM_EVENT": {
      const title = typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Examen de Pase de Grado Kup";
      const examinerName = typeof body.examinerName === "string" && body.examinerName.trim()
        ? body.examinerName.trim()
        : "Tribunal de Examen Dojang";
      const examDate = body.examDate === undefined
        ? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
        : body.examDate;
      if (title.length > 255 || examinerName.length > 255 || !isDate(examDate)) {
        return responseError("Los datos de la convocatoria no son válidos.", 400);
      }
      const rosterResult = await loadRoster(client, clubId);
      if ("error" in rosterResult) return responseError(rosterResult.error);

      const attendedClasses = new Map<string, number>();
      const athleteIds = rosterResult.athletes.map((athlete) => athlete.id);
      if (athleteIds.length) {
        const { data, error } = await client
          .from("club_attendance_records")
          .select("athlete_id")
          .eq("club_id", clubId)
          .in("status", ["PRESENT", "LATE"])
          .in("athlete_id", athleteIds);
        if (error) return responseError("No se pudieron consultar las asistencias para el examen.");
        for (const row of (data || []) as Array<{ athlete_id: string }>) {
          attendedClasses.set(row.athlete_id, (attendedClasses.get(row.athlete_id) || 0) + 1);
        }
      }

      const { data: event, error: eventError } = await client
        .from("belt_exam_events")
        .insert({
          id: `exam-${randomUUID()}`,
          club_id: clubId,
          title,
          exam_date: examDate,
          examiner_name: examinerName,
          status: "OPEN",
        })
        .select("*")
        .single();
      if (eventError) return responseError("No se pudo crear la convocatoria.", 409);

      const candidateRows = rosterResult.athletes.map((athlete) => {
        const count = attendedClasses.get(athlete.id) || 0;
        return {
          exam_id: event.id,
          athlete_id: athlete.id,
          current_belt: athlete.belt || "",
          target_belt: "Siguiente Grado",
          attended_classes: count,
          min_classes_required: 40,
          fee_paid: false,
          diploma_issued: false,
          notes: count >= 40 ? "Cumple requisitos de asistencia mínima." : "Faltan clases para el mínimo recomendado.",
        };
      });
      if (candidateRows.length) {
        const { data: candidates, error: candidateError } = await client
          .from("belt_exam_candidates")
          .insert(candidateRows)
          .select("*,athletes(name)");
        if (candidateError) {
          const { error: cleanupError } = await client.from("belt_exam_events").delete().eq("id", event.id);
          if (cleanupError) console.error("[CLUB MANAGEMENT] No se pudo revertir la convocatoria incompleta:", cleanupError);
          return responseError("No se pudieron registrar los candidatos del examen.", 409);
        }
        const responseData: BeltExamEvent = {
          id: event.id,
          clubId: event.club_id,
          title: event.title,
          examDate: event.exam_date,
          examinerName: event.examiner_name,
          status: event.status,
          candidates: ((candidates || []) as ExamCandidateRow[]).map(mapExamCandidate),
        };
        return NextResponse.json({ success: true, data: responseData }, { status: 201 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: event.id,
          clubId: event.club_id,
          title: event.title,
          examDate: event.exam_date,
          examinerName: event.examiner_name,
          status: event.status,
          candidates: [],
        } satisfies BeltExamEvent,
      }, { status: 201 });
    }

    default:
      return responseError("Acción no reconocida.", 400);
  }
}
