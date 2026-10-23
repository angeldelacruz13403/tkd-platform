import { NextResponse } from "next/server";
import { CoachAIEngine, GamePlanParams } from "@/lib/coach-ai-engine";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { athleteId, rivalProfile, tournamentContext, tacticalObjective } = body;

    if (typeof athleteId !== "string" || !athleteId.trim() || !rivalProfile) {
      return NextResponse.json(
        { success: false, error: "Identificador del atleta y perfil del rival requeridos." },
        { status: 400 }
      );
    }
    const access = await authorizeAthlete(request, athleteId.trim(), ["ADMIN", "COACH", "CLUB"]);
    if (isAuthorizationResponse(access)) return access.response;

    const gamePlan = await CoachAIEngine.generateGamePlan({
      athleteId: athleteId.trim(),
      rivalProfile: {
        name: rivalProfile.name || "Rival Anónimo",
        guard: rivalProfile.guard || "DIESTRA",
        heightRelative: rivalProfile.heightRelative || "SIMILAR",
        fightingStyle: rivalProfile.fightingStyle || "PIERNA_DELANTERA_CUT",
        keyDangerKick: rivalProfile.keyDangerKick || "",
        knownWeakness: rivalProfile.knownWeakness || "",
      },
      tournamentContext: {
        tournamentName: tournamentContext?.tournamentName || "Campeonato Oficial",
        roundPhase: tournamentContext?.roundPhase || "Eliminatoria",
        ruleSet: tournamentContext?.ruleSet || "WT_BEST_OF_THREE",
      },
      tacticalObjective: tacticalObjective || "",
    });

    return NextResponse.json({
      success: true,
      data: gamePlan,
      message: "Planteamiento táctico pre-competición generado exitosamente.",
    });
  } catch (error: any) {
    console.error("[API] Error al generar game plan con IA:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al generar el planteamiento táctico." },
      { status: 500 }
    );
  }
}
