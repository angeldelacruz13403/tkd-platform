import { NextResponse } from "next/server";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";
import { forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { authorizeFeature, isAuthorizationResponse as isEntitlementResponse } from "@/lib/entitlements";

export const runtime = "nodejs";
export const maxDuration = 60;
const maximumRequestBytes = 24 * 1024;

class RequestTooLargeError extends Error {}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length <= 2_000
  );
}

async function readRequestJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumRequestBytes) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

export async function POST(request: Request) {
  if (!process.env.TKD_API_SECRET || process.env.TKD_API_SECRET.length < 32) {
    return NextResponse.json(
      { success: false, error: "La autenticación de la plataforma no está configurada de forma segura." },
      { status: 503 },
    );
  }
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();
  const entitlement = await authorizeFeature(request, "ai-tools");
  if (isEntitlementResponse(entitlement)) return entitlement.response;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maximumRequestBytes) {
    return NextResponse.json({ success: false, error: "La solicitud supera el tamaño permitido." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await readRequestJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ success: false, error: "El cuerpo debe ser un objeto JSON." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json({ success: false, error: "La solicitud supera el tamaño permitido." }, { status: 413 });
    }
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const history = body.history;
  if (
    !prompt ||
    prompt.length > 2_000 ||
    !Array.isArray(history) ||
    history.length > 8 ||
    !history.every(isChatMessage)
  ) {
    return NextResponse.json(
      { success: false, error: "Indica un mensaje válido (máximo 2000 caracteres) y hasta 8 mensajes previos." },
      { status: 400 },
    );
  }

  let athleteContext: Record<string, unknown> | null = null;
  if (athleteId) {
    const access = await     authorizeAthlete(request, athleteId, ["ADMIN", "COACH", "CLUB"]);
    if (isAuthorizationResponse(access)) return access.response;

    const client = getSupabaseClient();
    if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: "El contexto deportivo requiere Supabase configurado en el servidor." },
        { status: 503 },
      );
    }

    const [
      { data: sessions, error: sessionsError },
      { data: chongMatches, error: chongError },
      { data: hongMatches, error: hongError },
      { data: plans, error: plansError },
      { data: correctiveWorks, error: worksError },
    ] = await Promise.all([
      client
        .from("training_sessions")
        .select("date,session_type,duration_minutes,avg_bpm,max_bpm,trimp_score,rpe_score,tactical_notes,status")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(8),
      client
        .from("competition_matches")
        .select("date,competition_name,category,winner,chong_score,hong_score,chong_gamjeom,hong_gamjeom,stamina_drop_round3")
        .eq("chong_athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(5),
      client
        .from("competition_matches")
        .select("date,competition_name,category,winner,chong_score,hong_score,chong_gamjeom,hong_gamjeom,stamina_drop_round3")
        .eq("hong_athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(5),
      client
        .from("ai_training_plans")
        .select("week_start,status,objective,periodization_phase")
        .eq("athlete_id", athleteId)
        .order("week_start", { ascending: false })
        .limit(2),
      client
        .from("ai_corrective_work")
        .select("title,objective,status,planned_session_date,optional")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (sessionsError || chongError || hongError || plansError || worksError) {
      console.error(
        "[Copilot] Athlete context query failed:",
        sessionsError || chongError || hongError || plansError || worksError,
      );
      return NextResponse.json(
        { success: false, error: "No se pudo recuperar el historial del atleta." },
        { status: 503 },
      );
    }

    const athlete = access.athlete;
    athleteContext = {
      profile: {
        name: athlete.name,
        category: athlete.wt_category,
        competitor: athlete.is_competitor,
        injuryStatus: athlete.injury_status,
        readinessScore: athlete.readiness_score,
        favouriteTechnique: athlete.favourite_kick,
      },
      recentTrainingSessions: (sessions || []).map((item) => ({
        date: item.date,
        type: item.session_type,
        durationMinutes: item.duration_minutes,
        averageBpm: item.avg_bpm,
        maximumBpm: item.max_bpm,
        trimpScore: item.trimp_score,
        rpeScore: item.rpe_score,
        tacticalNotes: typeof item.tactical_notes === "string" ? item.tactical_notes.slice(0, 300) : null,
        status: item.status,
      })),
      recentMatches: [...(chongMatches || []), ...(hongMatches || [])]
        .sort((first, second) => String(second.date).localeCompare(String(first.date)))
        .slice(0, 8)
        .map((match) => ({
          date: match.date,
          competition: typeof match.competition_name === "string" ? match.competition_name.slice(0, 100) : null,
          category: match.category,
          winner: match.winner,
          chongScore: match.chong_score,
          hongScore: match.hong_score,
          chongGamJeom: match.chong_gamjeom,
          hongGamJeom: match.hong_gamjeom,
          staminaDropRound3: match.stamina_drop_round3,
        })),
      recentPlans: plans || [],
      correctiveWorks: correctiveWorks || [],
    };
  }

  const serviceUrl = process.env.COPILOT_SERVICE_URL?.replace(/\/+$/, "");
  const serviceToken = process.env.COPILOT_SERVICE_TOKEN;
  let serviceOrigin: URL;
  try {
    if (!serviceUrl) throw new Error("Missing URL");
    serviceOrigin = new URL(serviceUrl);
  } catch {
    return NextResponse.json(
      { success: false, error: "El servicio de Copilot aún no está configurado." },
      { status: 503 },
    );
  }
  const localDevelopmentHost = ["localhost", "127.0.0.1", "[::1]"].includes(serviceOrigin.hostname);
  const secureServiceUrl =
    serviceOrigin.protocol === "https:" ||
    (serviceOrigin.protocol === "http:" && localDevelopmentHost);
  if (
    !serviceToken ||
    serviceToken.length < 32 ||
    !secureServiceUrl ||
    serviceOrigin.username ||
    serviceOrigin.password
  ) {
    return NextResponse.json(
      { success: false, error: "La conexión segura con el servicio de Copilot no está configurada." },
      { status: 503 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${serviceUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
        "User-Agent": "TKD-Global-Hub-Copilot/1.0",
      },
      body: JSON.stringify({ prompt, history, athleteContext }),
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        error: timedOut
          ? "El asistente tardó demasiado en responder."
          : "No se pudo conectar con el servicio de Copilot.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status === 503 ? 503 : 502;
    return NextResponse.json(
      { success: false, error: status === 429 ? "El asistente está ocupado; inténtalo de nuevo." : "El servicio de Copilot no está disponible." },
      { status },
    );
  }

  let result: unknown;
  try {
    result = await upstream.json();
  } catch {
    return NextResponse.json({ success: false, error: "El servicio de Copilot devolvió una respuesta no válida." }, { status: 502 });
  }

  if (
    !result ||
    typeof result !== "object" ||
    !("answer" in result) ||
    typeof result.answer !== "string" ||
    !result.answer.trim() ||
    result.answer.length > 8_000
  ) {
    return NextResponse.json({ success: false, error: "El servicio de Copilot devolvió una respuesta no válida." }, { status: 502 });
  }

  return NextResponse.json({ success: true, answer: result.answer });
}
