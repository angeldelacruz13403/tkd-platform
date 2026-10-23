import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { canAccessClub, forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";

type RouteContext = { params: { id: string } };

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getLicenseStatus(expiryDate: string): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilExpiry = (Date.parse(`${expiryDate}T00:00:00.000Z`) - todayUtc) / 86_400_000;
  if (daysUntilExpiry < 0) return "EXPIRED";
  if (daysUntilExpiry <= 30) return "EXPIRING_SOON";
  return "ACTIVE";
}

function mapLicense(row: Record<string, unknown>) {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    federationCode: row.federation_code,
    federationRegion: row.federation_region,
    licenseExpiryDate: row.license_expiry_date,
    insurancePolicy: row.insurance_policy,
    insuranceValidUntil: row.insurance_valid_until,
    medicalClearanceDate: row.medical_clearance_date,
    medicalClearanceValidUntil: row.medical_clearance_valid_until,
    minorConsentSigned: row.minor_consent_signed,
  };
}

async function authorizeAthlete(request: Request, athleteId: string) {
  const session = getSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") {
    return { response: forbidden() } as const;
  }
  const client = getSupabaseClient();
  if (!client) {
    return { response: NextResponse.json({ success: false, error: "La gestión de licencias requiere una conexión configurada con Supabase." }, { status: 503 }) } as const;
  }
  const { data: athlete, error } = await client
    .from("athletes")
    .select("id,club_id,wt_category")
    .eq("id", athleteId)
    .maybeSingle();
  if (error) {
    console.error("[ATHLETE LICENSE] No se pudo verificar el atleta:", error);
    return { response: NextResponse.json({ success: false, error: "No se pudo verificar el alumno." }, { status: 503 }) } as const;
  }
  if (!athlete) return { response: NextResponse.json({ success: false, error: "Alumno no encontrado." }, { status: 404 }) } as const;
  if (!canAccessClub(session, athlete.club_id)) return { response: forbidden() } as const;
  return { client, athlete } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const access = await authorizeAthlete(request, params.id);
  if ("response" in access) return access.response;
  const { data, error } = await access.client
    .from("club_member_licenses")
    .select("*")
    .eq("athlete_id", access.athlete.id)
    .eq("club_id", access.athlete.club_id)
    .maybeSingle();
  if (error) {
    console.error("[ATHLETE LICENSE] No se pudo consultar la licencia:", error);
    return NextResponse.json({ success: false, error: "No se pudo consultar la licencia del alumno." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: data ? mapLicense(data as Record<string, unknown>) : null });
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = await authorizeAthlete(request, params.id);
  if ("response" in access) return access.response;
  const bodyValue: unknown = await request.json().catch(() => null);
  if (!bodyValue || typeof bodyValue !== "object" || Array.isArray(bodyValue)) {
    return NextResponse.json({ success: false, error: "Los datos de licencia no son válidos." }, { status: 400 });
  }
  const body = bodyValue as Record<string, unknown>;
  const federationCode = typeof body.federationCode === "string" ? body.federationCode.trim() : "";
  const federationRegion = typeof body.federationRegion === "string" ? body.federationRegion.trim() : "";
  const insurancePolicy = typeof body.insurancePolicy === "string" ? body.insurancePolicy.trim() : "";
  const licenseExpiryDate = body.licenseExpiryDate;
  const insuranceValidUntil = body.insuranceValidUntil;
  const medicalClearanceDate = body.medicalClearanceDate;
  const medicalClearanceValidUntil = body.medicalClearanceValidUntil;
  if (!federationCode || federationCode.length > 50) {
    return NextResponse.json({ success: false, error: "El número de licencia federativa es obligatorio (máximo 50 caracteres)." }, { status: 400 });
  }
  if (!federationRegion || federationRegion.length > 255 || !insurancePolicy || insurancePolicy.length > 255) {
    return NextResponse.json({ success: false, error: "Federación, región y póliza de seguro son obligatorias y deben respetar su longitud máxima." }, { status: 400 });
  }
  if (
    !isDate(licenseExpiryDate) ||
    !isDate(insuranceValidUntil) ||
    !isDate(medicalClearanceDate) ||
    !isDate(medicalClearanceValidUntil) ||
    typeof body.minorConsentSigned !== "boolean"
  ) {
    return NextResponse.json({ success: false, error: "Completa las fechas válidas de licencia, seguro y apto médico." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await access.client
    .from("club_member_licenses")
    .select("id")
    .eq("athlete_id", access.athlete.id)
    .eq("club_id", access.athlete.club_id)
    .maybeSingle();
  if (lookupError) {
    console.error("[ATHLETE LICENSE] No se pudo buscar la licencia existente:", lookupError);
    return NextResponse.json({ success: false, error: "No se pudo consultar la licencia existente." }, { status: 503 });
  }
  const row = {
    club_id: access.athlete.club_id,
    athlete_id: access.athlete.id,
    category: access.athlete.wt_category,
    federation_code: federationCode,
    federation_region: federationRegion,
    license_expiry_date: licenseExpiryDate,
    insurance_policy: insurancePolicy,
    insurance_valid_until: insuranceValidUntil,
    medical_clearance_date: medicalClearanceDate,
    medical_clearance_valid_until: medicalClearanceValidUntil,
    minor_consent_signed: body.minorConsentSigned,
    status: getLicenseStatus(licenseExpiryDate),
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? access.client.from("club_member_licenses").update(row).eq("id", existing.id)
    : access.client.from("club_member_licenses").insert({ id: `license-${randomUUID()}`, ...row });
  const { data, error } = await query.select("*").single();
  if (error) {
    console.error("[ATHLETE LICENSE] No se pudo guardar la licencia:", error);
    return NextResponse.json({ success: false, error: "No se pudo guardar la licencia en Supabase." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: mapLicense(data as Record<string, unknown>) });
}
