import { NextResponse } from "next/server";
import { TaekwondoAIEngine } from "@/lib/ai-engine";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";

export async function POST(request: Request) {
  let body: { athleteId?: unknown; objective?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  if (!athleteId || !objective || objective.length > 1000) {
    return NextResponse.json(
      { success: false, error: "Indica athleteId y un objetivo válido (máximo 1000 caracteres)." },
      { status: 400 }
    );
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;

  try {
    const plan = TaekwondoAIEngine.generateWorkout(athleteId, objective);
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("[AI legacy workout] Generation failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo generar la sesión." }, { status: 500 });
  }
}
