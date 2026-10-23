import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";

async function requestGitHubModels(prompt: string): Promise<string | null> {
  const token = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return null;

  const endpoint = process.env.GITHUB_MODELS_ENDPOINT || "https://models.github.ai/inference/chat/completions";
  const model = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1-mini";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Eres un analista de rendimiento de taekwondo. Usa solo los datos proporcionados. No inventes métricas. Responde en español, con valoración breve y plan práctico.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      athleteId,
      round,
      currentBpm,
      trimpScore,
      scoreDiff,
      recoveryDropBpm,
      recoveryDurationSeconds,
      distanceKm,
      avgSpeedMps,
      trainingMode,
    } = body;

    if (typeof athleteId !== "string" || !athleteId.trim()) {
      return NextResponse.json({ success: false, error: "Debes indicar athleteId." }, { status: 400 });
    }
    const access = await authorizeAthlete(request, athleteId.trim(), ["ADMIN", "COACH", "CLUB"]);
    if (isAuthorizationResponse(access)) return access.response;
    const athlete = access.athlete;
    const metric = db.retrainMetrics;

    if (!Number(currentBpm) || !Number(trimpScore)) {
      return NextResponse.json(
        { success: false, error: "La IA necesita datos reales de atleta, frecuencia cardíaca y carga." },
        { status: 400 }
      );
    }

    const hasRecoveryData = Number.isFinite(Number(recoveryDropBpm)) && Number(recoveryDurationSeconds) > 0;
    const recoveryText = hasRecoveryData
      ? Number(recoveryDropBpm) >= 30
        ? "recuperación buena"
        : Number(recoveryDropBpm) >= 20
          ? "recuperación mejorable"
          : "recuperación baja"
      : "recuperación no evaluable todavía";
    const improvementPlan = hasRecoveryData
      ? Number(recoveryDropBpm) >= 30
        ? "Mantén la respiración controlada y conserva el descanso programado; aumenta la carga solo si la caída de BPM se mantiene."
        : "Añade 2 sesiones semanales de base aeróbica y respiración controlada; no reduzcas el descanso hasta mejorar la caída de BPM."
      : "Completa al menos un descanso medido de 60 o 180 segundos para obtener un plan de recuperación fiable.";

    // Lógica táctica adaptativa según FC, asalto y estado del combate
    let advice = "";
    let targetZone = "Z4";
    let tacticalFocus = "Contragolpe reactivo";

    if (Number(currentBpm) > 185) {
      targetZone = "Z5";
      tacticalFocus = "Ahorro energético y salidas laterales";
      advice = `[Alerta FC ${currentBpm} BPM]: El atleta se encuentra en umbral anaeróbico láctico extremo. En el asalto ${round}, evitar intercambios directos en la línea de choque. Neutralizar con clinch preventivo y ejecutar ${athlete.favourite_kick || "su técnica principal"} únicamente al contragolpe en salida lateral.`;
    } else if (Number(scoreDiff || 0) < 0) {
      targetZone = "Z4-Z5";
      tacticalFocus = "Presión alta y fintas a la pechera";
      advice = `[Déficit de puntuación]: Necesidad de sumar puntos de impacto claro. Presionar con corte adelantado (Step-cut) para forzar bajada de guardia y combinar con ${athlete.favourite_kick || "su técnica principal"} al tronco o cabeza en los últimos 45 segundos.`;
    } else {
      targetZone = "Z3-Z4";
      tacticalFocus = "Control de distancia y Gam-jeoms";
      advice = `[Ventaja táctica]: Mantener distancia media-larga. El modelo ${metric.modelVersion} calcula un riesgo mínimo de penalización Gam-jeom trabajando con fintas de tanteo y pateo anticipado con pierna delantera.`;
    }

    advice += `\n\nEvaluación de recuperación: ${recoveryText}.`;
    if (trainingMode === "round-races" && Number(distanceKm) > 0) {
      advice += ` Distancia registrada: ${Number(distanceKm).toFixed(2)} km.`;
    }
    if (Number(avgSpeedMps) > 0) {
      advice += ` Ritmo medio: ${(1000 / Number(avgSpeedMps)).toFixed(0)} s/km.`;
    }
    advice += `\nPlan de mejora: ${improvementPlan}`;

    const githubAdvice = await requestGitHubModels(
      JSON.stringify({
        athlete: athlete.name || "Atleta",
        round,
        currentBpm,
        trimpScore,
        scoreDiff: scoreDiff || 0,
        recoveryDropBpm: recoveryDropBpm ?? null,
        recoveryDurationSeconds: recoveryDurationSeconds ?? null,
        distanceKm: distanceKm ?? null,
        avgSpeedMps: avgSpeedMps ?? null,
        trainingMode: trainingMode || "combat",
      })
    );
    if (githubAdvice) advice = githubAdvice;

    return NextResponse.json({
      success: true,
      data: {
        advice,
        tacticalFocus,
        targetZone,
        recommendedKick: athlete.favourite_kick || "Sin técnica principal registrada",
        recoveryAssessment: recoveryText,
        improvementPlan,
        provider: githubAdvice ? "github-models" : "local-engine",
        model: githubAdvice ? process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1-mini" : metric.modelVersion,
        modelVersion: metric.modelVersion,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al generar recomendación táctica" },
      { status: 400 }
    );
  }
}
