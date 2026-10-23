import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";
import { AIProviderError, parseAIJson, requestAICompletion } from "@/lib/ai-provider";
import { AIVideoAnalysisResult } from "@/lib/ai-types";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_BUCKET = "ai-combat-videos";
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30 * 60;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

export async function GET(request: Request) {
  const athleteId = new URL(request.url).searchParams.get("athleteId")?.trim();
  if (!athleteId) {
    return NextResponse.json({ success: false, error: "Debes indicar athleteId." }, { status: 400 });
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, error: "El almacenamiento de análisis no está configurado." }, { status: 503 });
  }
  const { data, error } = await client
    .from("ai_video_analyses")
    .select("id,athlete_id,competition_match_id,created_by,status,original_filename,mime_type,file_size_bytes,duration_seconds,provider,model,result,error_message,consent_recorded_at,created_at,updated_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[AI video analysis] List failed:", error);
    return NextResponse.json({ success: false, error: "No se pudieron cargar los análisis de vídeo." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: data || [] });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const analysisId = typeof body.analysisId === "string" ? body.analysisId.trim() : "";
  if (!athleteId || !analysisId || body.status !== "APPROVED") {
    return NextResponse.json({ success: false, error: "Indica atleta, análisis y el estado APPROVED." }, { status: 400 });
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, error: "El almacenamiento de análisis no está configurado." }, { status: 503 });
  }
  const { data, error } = await client
    .from("ai_video_analyses")
    .update({ status: "APPROVED", updated_at: new Date().toISOString() })
    .eq("id", analysisId)
    .eq("athlete_id", athleteId)
    .eq("status", "NEEDS_REVIEW")
    .select("id,athlete_id,competition_match_id,status,result,updated_at")
    .maybeSingle();
  if (error) {
    console.error("[AI video analysis] Review update failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo guardar la revisión del análisis." }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "El análisis no existe o ya fue revisado." }, { status: 409 });
  }
  return NextResponse.json({ success: true, data });
}

function readVideoDuration(input: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg no disponible."));
    const process = spawn(ffmpegPath, ["-hide_banner", "-i", input]);
    let output = "";
    process.stderr.on("data", (chunk) => { output += chunk.toString(); });
    process.on("error", reject);
    process.on("close", () => {
      const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (!match) return reject(new Error("No se pudo determinar la duración del vídeo."));
      resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
    });
  });
}

function extractFrames(input: string, outputPattern: string, durationSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg no disponible."));
    const process = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", input,
      "-vf", `fps=${8 / durationSeconds},scale=768:-2`,
      "-frames:v", "8",
      "-q:v", "4",
      outputPattern,
    ]);
    let error = "";
    process.stderr.on("data", (chunk) => { error += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(error || `FFmpeg terminó con código ${code}.`));
    });
  });
}

function isValidAnalysis(value: unknown, durationSeconds: number): value is AIVideoAnalysisResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const categories = new Set(["ATTACK", "DEFENSE", "DISTANCE", "TACTICS", "TECHNIQUE", "FATIGUE", "OTHER"]);
  const confidenceLevels = new Set(["LOW", "MEDIUM", "HIGH"]);
  const observations = result.observations;
  const suggestedWorks = result.suggestedCorrectiveWorks;
  const limitations = result.limitations;
  if (
    !Array.isArray(observations) ||
    !Array.isArray(suggestedWorks) ||
    !Array.isArray(limitations)
  ) return false;
  return (
    typeof result.summary === "string" &&
    limitations.every((item) => typeof item === "string") &&
    observations.every((value) => {
      if (!value || typeof value !== "object") return false;
      const observation = value as Record<string, unknown>;
      return (
        typeof observation.category === "string" &&
        categories.has(observation.category) &&
        typeof observation.description === "string" &&
        typeof observation.confidence === "string" &&
        confidenceLevels.has(observation.confidence) &&
        Array.isArray(observation.limitations) &&
        observation.limitations.every((item) => typeof item === "string") &&
        Array.isArray(observation.evidence) &&
        observation.evidence.every((item) => {
          if (!item || typeof item !== "object") return false;
          const evidence = item as Record<string, unknown>;
          return (
            typeof evidence.startSeconds === "number" &&
            Number.isFinite(evidence.startSeconds) &&
            evidence.startSeconds >= 0 &&
            evidence.startSeconds <= durationSeconds &&
            typeof evidence.endSeconds === "number" &&
            Number.isFinite(evidence.endSeconds) &&
            evidence.endSeconds >= evidence.startSeconds &&
            evidence.endSeconds <= durationSeconds &&
            typeof evidence.description === "string"
          );
        })
      );
    }) &&
    suggestedWorks.every((value) => {
      if (!value || typeof value !== "object") return false;
      const work = value as Record<string, unknown>;
      return (
        typeof work.title === "string" &&
        typeof work.objective === "string" &&
        typeof work.rationale === "string" &&
        Array.isArray(work.sourceObservationIndexes) &&
        work.sourceObservationIndexes.every((index) =>
          Number.isInteger(index) && Number(index) >= 0 && Number(index) < observations.length
        ) &&
        Array.isArray(work.exercises) &&
        work.exercises.every((exercise) => {
          if (!exercise || typeof exercise !== "object") return false;
          const item = exercise as Record<string, unknown>;
          return (
            typeof item.name === "string" &&
            typeof item.instructions === "string" &&
            Array.isArray(item.coachingCues) &&
            item.coachingCues.every((cue) => typeof cue === "string")
          );
        })
      );
    })
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "La solicitud debe ser multipart/form-data." }, { status: 400 });
  }

  const athleteId = String(form.get("athleteId") || "").trim();
  const competitionMatchId = String(form.get("competitionMatchId") || "").trim() || null;
  if (!athleteId) {
    return NextResponse.json({ success: false, error: "Debes seleccionar un atleta." }, { status: 400 });
  }
  if (form.get("consent") !== "true") {
    return NextResponse.json(
      { success: false, error: "Confirma que el atleta ha autorizado el tratamiento del vídeo." },
      { status: 400 }
    );
  }

  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;

  const video = form.get("video");
  if (!(video instanceof File) || !ALLOWED_VIDEO_TYPES.has(video.type)) {
    return NextResponse.json({ success: false, error: "Debes subir un archivo de vídeo válido." }, { status: 400 });
  }
  if (video.size <= 0 || video.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ success: false, error: "El vídeo debe pesar más de 0 y no superar 100 MB." }, { status: 400 });
  }

  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { success: false, error: "El almacenamiento privado de vídeos no está configurado." },
      { status: 503 }
    );
  }

  let recordedMatchMetrics: AIVideoAnalysisResult["recordedMatchMetrics"];
  if (competitionMatchId) {
    const { data: match, error } = await client
      .from("competition_matches")
      .select("id,chong_athlete_id,hong_athlete_id,competition_name,date,category,winner,chong_score,hong_score,chong_gamjeom,hong_gamjeom,head_kicks,spinning_head,body_kicks,spinning_body,punches,stamina_drop_round3")
      .eq("id", competitionMatchId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ success: false, error: "No se pudo verificar el combate seleccionado." }, { status: 503 });
    }
    if (match?.chong_athlete_id !== athleteId && match?.hong_athlete_id !== athleteId) {
      return NextResponse.json({ success: false, error: "El combate no corresponde al atleta seleccionado." }, { status: 400 });
    }
    if (match) {
      recordedMatchMetrics = {
        competitionName: match.competition_name || undefined,
        matchDate: match.date || undefined,
        category: match.category || undefined,
        recordedWinner: match.winner || undefined,
        chongScore: Number(match.chong_score) || 0,
        hongScore: Number(match.hong_score) || 0,
        chongGamJeom: Number(match.chong_gamjeom) || 0,
        hongGamJeom: Number(match.hong_gamjeom) || 0,
        headKicks: Number(match.head_kicks) || 0,
        spinningHeadKicks: Number(match.spinning_head) || 0,
        bodyKicks: Number(match.body_kicks) || 0,
        spinningBodyKicks: Number(match.spinning_body) || 0,
        punches: Number(match.punches) || 0,
        staminaDropRound3: Boolean(match.stamina_drop_round3),
      };
    }
  }

  const analysisId = `vid-${randomUUID()}`.slice(0, 50);
  const storagePath = `${athleteId}/${analysisId}.video`;
  const workDir = await mkdtemp(join(tmpdir(), "tkd-video-"));
  const inputPath = join(workDir, "input-video");
  const framePattern = join(workDir, "frame-%02d.jpg");
  let recordCreated = false;
  let videoUploaded = false;

  try {
    const bytes = Buffer.from(await video.arrayBuffer());
    await writeFile(inputPath, bytes);
    const durationSeconds = await readVideoDuration(inputPath);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      return NextResponse.json({ success: false, error: "El vídeo debe durar como máximo 30 minutos." }, { status: 400 });
    }

    const { error: insertError } = await client.from("ai_video_analyses").insert({
      id: analysisId,
      athlete_id: athleteId,
      competition_match_id: competitionMatchId,
      created_by: access.session.id,
      status: "PROCESSING",
      storage_bucket: VIDEO_BUCKET,
      storage_path: storagePath,
      original_filename: video.name.slice(0, 255) || "video",
      mime_type: video.type,
      file_size_bytes: video.size,
      duration_seconds: durationSeconds,
      consent_recorded_at: new Date().toISOString(),
      result: {},
    });
    if (insertError) throw new Error("No se pudo registrar el análisis en la base de datos.");
    recordCreated = true;

    const { error: uploadError } = await client.storage
      .from(VIDEO_BUCKET)
      .upload(storagePath, bytes, { contentType: video.type, upsert: false });
    if (uploadError) throw new Error("No se pudo guardar el vídeo en el almacenamiento privado.");
    videoUploaded = true;

    await extractFrames(inputPath, framePattern, durationSeconds);
    const frames: Array<{ dataUrl: string }> = [];
    const sampleTimes: number[] = [];
    for (let index = 1; index <= 8; index++) {
      const framePath = join(workDir, `frame-${String(index).padStart(2, "0")}.jpg`);
      try {
        const image = await readFile(framePath);
        frames.push({ dataUrl: `data:image/jpeg;base64,${image.toString("base64")}` });
        sampleTimes.push(Math.min(durationSeconds, (durationSeconds * index) / 8));
      } catch {
        // Some valid short clips contain fewer than eight extractable frames.
      }
    }
    if (frames.length === 0) throw new Error("No se pudieron extraer fotogramas del vídeo.");

    const completion = await requestAICompletion(
      "Eres analista de rendimiento de Taekwondo WT. Analiza solo lo visible en vídeo. Nunca presentes métricas registradas como si se observaran en los fotogramas. No infieras identidad, puntuación, métricas fisiológicas ni datos ausentes. Devuelve exclusivamente JSON válido en español.",
      `Analiza fotogramas de un combate en los tiempos aproximados ${sampleTimes.join(", ")} segundos. Devuelve JSON con summary, observations, suggestedCorrectiveWorks y limitations. En cada observación incluye categoría, descripción comprobable, evidencia temporal, confianza y limitaciones. En cada trabajo correctivo incluye objetivo, rationale, ejercicios e índices de observaciones que lo justifican. No inventes puntos, pulsaciones, identidades ni acciones no visibles. Si falta evidencia, indícalo. Contexto de métricas registradas (no inferido del vídeo): ${JSON.stringify(recordedMatchMetrics || null)}.`,
      frames
    );
    const analysis = parseAIJson<unknown>(completion.text);
    if (!isValidAnalysis(analysis, durationSeconds)) {
      throw new AIProviderError("El modelo devolvió un análisis con estructura no válida.", 502);
    }

    const result = {
      ...analysis,
      ...(recordedMatchMetrics ? { recordedMatchMetrics } : {}),
    };
    const { error: updateError } = await client
      .from("ai_video_analyses")
      .update({
        status: "NEEDS_REVIEW",
        provider: completion.provider,
        model: completion.model,
        result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
    if (updateError) throw new Error("No se pudo guardar el resultado del análisis.");

    return NextResponse.json({
      success: true,
      data: {
        id: analysisId,
        athleteId,
        competitionMatchId,
        status: "NEEDS_REVIEW",
        provider: completion.provider,
        model: completion.model,
        framesAnalyzed: frames.length,
        result,
      },
    });
  } catch (error) {
    console.error("[AI video analysis] Processing failed:", error);
    if (recordCreated) {
      const message = error instanceof Error ? error.message : "No se pudo analizar el vídeo.";
      if (videoUploaded) {
        const { error: cleanupError } = await client.storage.from(VIDEO_BUCKET).remove([storagePath]);
        if (cleanupError) {
          console.error("[AI video analysis] Failed to remove unprocessed video:", cleanupError);
        }
      }
      await client.from("ai_video_analyses").update({
        status: "FAILED",
        error_message: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", analysisId);
    }
    const status = error instanceof AIProviderError ? error.status : 502;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo analizar el vídeo." },
      { status }
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
