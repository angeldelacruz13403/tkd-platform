import { NextResponse } from "next/server";
import { CoachAIEngine, ClassPlanParams } from "@/lib/coach-ai-engine";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "ai-tools");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  try {
    const body = await request.json();
    const { category, targetFocus, durationMinutes, athletesCount, availableMaterial, coachNotes } = body;

    if (!category || !targetFocus || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: "Categoría, objetivo y duración son requeridos." },
        { status: 400 }
      );
    }

    const plan = await CoachAIEngine.planClass({
      category,
      targetFocus,
      durationMinutes: Number(durationMinutes) || 60,
      athletesCount: Number(athletesCount) || 16,
      availableMaterial: Array.isArray(availableMaterial) ? availableMaterial : undefined,
      coachNotes: coachNotes || "",
    });

    return NextResponse.json({
      success: true,
      data: plan,
      message: "Clase de entrenamiento diseñada exitosamente por la IA.",
    });
  } catch (error: any) {
    console.error("[API] Error al generar plan de clase con IA:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al generar la clase." },
      { status: 500 }
    );
  }
}
