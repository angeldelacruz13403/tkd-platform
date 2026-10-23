import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TaekwondoAIEngine } from "@/lib/ai-engine";
import { KnowledgeCategory } from "@/lib/types";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSession, forbidden } from "@/lib/api-auth";

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "ai-tools");
  if (isAuthorizationResponse(access)) return access.response;
  return NextResponse.json({
    success: true,
    total: db.knowledgeBase.length,
    data: db.knowledgeBase,
  });
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFeature(request, "ai-tools");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN") return forbidden();
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    let title = "";
    let category = "";
    let description = "";
    let fileType = "PDF";
    let tags: string[] = [];
    let fileUrl: string | undefined;
    let addedBy = access.session.id;
    let video: File | null = null;

    if (isMultipart) {
      const form = await request.formData();
      title = String(form.get("title") || "");
      category = String(form.get("category") || "");
      description = String(form.get("description") || "");
      fileType = String(form.get("fileType") || "VIDEO_MP4");
      tags = String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      fileUrl = String(form.get("fileUrl") || "") || undefined;
      const formVideo = form.get("video");
      video = formVideo instanceof File ? formVideo : null;
    } else {
      const body = await request.json();
      title = body.title || "";
      category = body.category || "";
      description = body.description || "";
      fileType = body.fileType || "PDF";
      tags = Array.isArray(body.tags) ? body.tags : [];
      fileUrl = body.fileUrl;
    }

    if (!title || !category) {
      return NextResponse.json(
        { success: false, error: "Título y categoría son obligatorios" },
        { status: 400 }
      );
    }

    if (fileType === "VIDEO_MP4") {
      if (!video && !fileUrl) {
        return NextResponse.json({ success: false, error: "Selecciona un vídeo o proporciona una URL" }, { status: 400 });
      }
      if (video && (!video.type.startsWith("video/") || video.size > 100 * 1024 * 1024)) {
        return NextResponse.json({ success: false, error: "El vídeo debe ser válido y no superar 100 MB" }, { status: 400 });
      }
    }

    const item = TaekwondoAIEngine.addKnowledgeItem(
      title,
      category as KnowledgeCategory,
      description,
      fileType as "PDF" | "VIDEO_MP4" | "TEXT_PROTOCOL" | "URL",
      tags.length ? tags : ["Taekwondo", category],
      addedBy,
      fileUrl,
      video ? { name: video.name, size: video.size, mimeType: video.type, status: "PROCESSING" } : undefined
    );

    return NextResponse.json({
      success: true,
      message: "Conocimiento indexado exitosamente en el sistema RAG",
      data: item,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al indexar conocimiento" }, { status: 400 });
  }
}
