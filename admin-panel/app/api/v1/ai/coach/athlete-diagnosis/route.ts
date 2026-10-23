import { NextResponse } from "next/server";
import { CoachAIEngine } from "@/lib/coach-ai-engine";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { athleteId, competitionIssues, technicalWeakness, physicalState } = body;

    if (typeof athleteId !== "string" || !athleteId.trim()) {
      return NextResponse.json(
        { success: false, error: "Identificador del atleta requerido." },
        { status: 400 }
      );
    }
    const access = await authorizeAthlete(request, athleteId.trim(), ["ADMIN", "COACH", "CLUB"]);
    if (isAuthorizationResponse(access)) return access.response;

    const diagnosis = await CoachAIEngine.diagnoseAthlete({
      athleteId: athleteId.trim(),
      competitionIssues: Array.isArray(competitionIssues) ? competitionIssues : [],
      technicalWeakness: Array.isArray(technicalWeakness) ? technicalWeakness : [],
      physicalState,
    });

    return NextResponse.json({
      success: true,
      data: diagnosis,
      message: "Diagnóstico técnico y plan de corrección de 4 semanas generado exitosamente.",
    });
  } catch (error: any) {
    console.error("[API] Error al diagnosticar atleta con IA:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al generar el diagnóstico." },
      { status: 500 }
    );
  }
}
