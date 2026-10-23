import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { ClubFinanceEntry } from "@/lib/types";

type FinanceRow = Record<string, any>;

function mapEntry(row: FinanceRow): ClubFinanceEntry {
  return {
    id: row.id,
    clubId: row.club_id,
    athleteId: row.athlete_id || undefined,
    entryType: row.entry_type,
    status: row.status,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency || "EUR",
    dueDate: row.due_date || undefined,
    occurredAt: row.occurred_at,
    paidAt: row.paid_at || undefined,
    createdBy: row.created_by || "",
  };
}

function summary(entries: ClubFinanceEntry[], month: string) {
  const monthly = entries.filter((entry) => entry.occurredAt.slice(0, 7) === month && entry.status !== "CANCELLED");
  const income = monthly
    .filter((entry) => entry.status === "PAID" && (entry.entryType === "INCOME" || entry.entryType === "STUDENT_DUE"))
    .reduce((total, entry) => total + entry.amount, 0);
  const expenses = monthly
    .filter((entry) => entry.status === "PAID" && entry.entryType === "EXPENSE")
    .reduce((total, entry) => total + entry.amount, 0);
  const pending = entries
    .filter((entry) => entry.entryType === "STUDENT_DUE" && entry.status === "PENDING")
    .reduce((total, entry) => total + entry.amount, 0);
  return { month, income, expenses, balance: income - expenses, pending };
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "club-finance");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ success: false, error: "El mes debe tener formato AAAA-MM." }, { status: 400 });
  }

  let entries: ClubFinanceEntry[];
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión financiera requiere una conexión configurada con Supabase." }, { status: 503 });
  if (session.role === "ATHLETE") {
    const { data: athlete, error: athleteError } = await client
      .from("athletes")
      .select("id")
      .eq("user_id", session.id)
      .maybeSingle();
    if (athleteError) return NextResponse.json({ success: false, error: "No se pudo consultar la ficha del atleta." }, { status: 503 });
    if (!athlete) return NextResponse.json({ success: true, entries: [], summary: summary([], month) });
    const { data, error } = await client
      .from("club_finance_entries")
      .select("*")
      .eq("athlete_id", athlete.id)
      .order("occurred_at", { ascending: false });
    if (error) return NextResponse.json({ success: false, error: "No se pudieron consultar las cuotas." }, { status: 503 });
    entries = (data || []).map(mapEntry);
  } else {
    let query = client.from("club_finance_entries").select("*").order("occurred_at", { ascending: false });
    if (session.role !== "ADMIN") query = query.eq("club_id", clubId || "__none__");
    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: "No se pudieron consultar las finanzas del club." }, { status: 503 });
    entries = (data || []).map(mapEntry);
  }

  return NextResponse.json({ success: true, entries, summary: summary(entries, month) });
}

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "club-finance");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();

  const body = await request.json();
  const entryType = body.entryType;
  const amount = Number(body.amount);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const occurredAt = body.occurredAt || new Date().toISOString().slice(0, 10);
  if (!["STUDENT_DUE", "INCOME", "EXPENSE"].includes(entryType) || !description || description.length > 255 ||
    !Number.isFinite(amount) || amount <= 0 || amount > 10000000 || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
    return NextResponse.json({ success: false, error: "Tipo, descripción, importe y fecha deben ser válidos." }, { status: 400 });
  }
  if (entryType === "STUDENT_DUE" && !body.athleteId) {
    return NextResponse.json({ success: false, error: "Una cuota requiere un alumno." }, { status: 400 });
  }

  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión financiera requiere una conexión configurada con Supabase." }, { status: 503 });
  const id = `finance-${randomUUID()}`;
  const clubId = access.session.role === "ADMIN" ? body.clubId || access.clubId : access.clubId;
  if (!clubId || (access.session.role !== "ADMIN" && body.clubId && body.clubId !== clubId)) return forbidden();
  const row = {
    id,
    club_id: clubId,
    athlete_id: entryType === "STUDENT_DUE" ? String(body.athleteId) : null,
    entry_type: entryType,
    status: (entryType === "STUDENT_DUE" ? "PENDING" : body.status === "PENDING" ? "PENDING" : "PAID") as ClubFinanceEntry["status"],
    description,
    amount: amount.toFixed(2),
    currency: "EUR",
    due_date: body.dueDate || null,
    occurred_at: occurredAt,
    paid_at: entryType !== "STUDENT_DUE" && body.status !== "PENDING" ? new Date().toISOString() : null,
    created_by: access.session.id,
  };

  if (row.athlete_id) {
    const { data: athlete, error: athleteError } = await client
      .from("athletes")
      .select("id")
      .eq("id", row.athlete_id)
      .eq("club_id", clubId)
      .maybeSingle();
    if (athleteError) return NextResponse.json({ success: false, error: "No se pudo validar el alumno." }, { status: 503 });
    if (!athlete) return forbidden();
  }
  const { data, error } = await client.from("club_finance_entries").insert(row).select("*").single();
  if (error) return NextResponse.json({ success: false, error: "No se pudo registrar el movimiento financiero." }, { status: 409 });
  return NextResponse.json({ success: true, data: mapEntry(data) }, { status: 201 });
}
