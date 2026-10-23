import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TaekwondoAIEngine } from "@/lib/ai-engine";
import { getSession, forbidden, unauthorized } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden();
  return NextResponse.json({
    success: true,
    metrics: db.retrainMetrics,
  });
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden();
  try {
    const updatedMetrics = TaekwondoAIEngine.retrainModel();

    return NextResponse.json({
      success: true,
      message: `Modelo reentrenado con éxito a la versión ${updatedMetrics.modelVersion}`,
      metrics: updatedMetrics,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Fallo durante el reentrenamiento" }, { status: 500 });
  }
}
