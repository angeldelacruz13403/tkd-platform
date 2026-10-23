import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.json({ success: false, error: "Enlace de consentimiento no válido." }, { status: 400 });
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "El consentimiento requiere Supabase configurado." }, { status: 503 });

  const { data, error } = await client
    .from("athlete_guardian_consents")
    .select("id,guardian_name,policy_version,status,expires_at,athletes(name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "No se pudo consultar la solicitud." }, { status: 503 });
  if (!data || data.status !== "PENDING" || Date.parse(data.expires_at) <= Date.now()) {
    return NextResponse.json({ success: false, error: "La solicitud no existe, ya fue respondida o venció." }, { status: 410 });
  }
  return NextResponse.json({
    success: true,
    guardianName: data.guardian_name,
    athleteName: (data.athletes as any)?.name || "el/la atleta",
    policyVersion: data.policy_version,
    expiresAt: data.expires_at,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.json({ success: false, error: "Enlace de consentimiento no válido." }, { status: 400 });
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "El consentimiento requiere Supabase configurado." }, { status: 503 });

  const grantedAt = new Date();
  const consentExpiresAt = new Date(grantedAt);
  consentExpiresAt.setUTCFullYear(consentExpiresAt.getUTCFullYear() + 1);
  const { data, error } = await client
    .from("athlete_guardian_consents")
    .update({
      status: "GRANTED",
      granted_at: grantedAt.toISOString(),
      consent_expires_at: consentExpiresAt.toISOString(),
    })
    .eq("token_hash", hashToken(token))
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .select("id,consent_expires_at")
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "No se pudo registrar el consentimiento." }, { status: 503 });
  if (!data) return NextResponse.json({ success: false, error: "La solicitud ya fue respondida o venció." }, { status: 410 });
  return NextResponse.json({ success: true, expiresAt: data.consent_expires_at });
}
