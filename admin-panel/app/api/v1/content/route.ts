import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIKnowledgeItem } from "@/lib/types";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { forbidden } from "@/lib/api-auth";

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "content-library");
  if (isAuthorizationResponse(access)) return access.response;
  const contents = db.knowledgeBase.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description,
    fileType: item.fileType,
    fileUrl: item.fileUrl || null,
    tags: item.tags,
    status: item.status,
    addedAt: item.addedAt,
    addedBy: item.addedBy,
    indexedTokens: item.indexedTokens,
  }));

  return NextResponse.json({
    success: true,
    total: contents.length,
    data: contents,
  });
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFeature(request, "content-library");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN") return forbidden();
    const body = await request.json();

    const newContent: AIKnowledgeItem = {
      id: `content-${Date.now()}`,
      title: body.title || "Contenido sin título",
      category: body.category || "WT_RULES",
      description: body.description || "",
      fileType: body.fileType || "VIDEO_MP4",
      fileUrl: body.fileUrl || null,
      tags: Array.isArray(body.tags) ? body.tags : ["Taekwondo", "WT"],
      indexedTokens: Number(body.indexedTokens) || 2500,
      status: (body.status as any) || "INDEXED",
      addedAt: new Date().toISOString(),
      addedBy: body.addedBy || "Administrador",
    };

    db.knowledgeBase.unshift(newContent);

    return NextResponse.json({
      success: true,
      message: "Contenido multimedia registrado correctamente",
      data: newContent,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Error al registrar contenido" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const access = await authorizeFeature(request, "content-library");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN") return forbidden();
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const index = db.knowledgeBase.findIndex((k) => k.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: "Contenido no encontrado" }, { status: 404 });
    }

    db.knowledgeBase[index] = {
      ...db.knowledgeBase[index],
      ...updates,
      tags: Array.isArray(updates.tags) ? updates.tags : db.knowledgeBase[index].tags,
    };

    return NextResponse.json({
      success: true,
      message: "Contenido actualizado correctamente",
      data: db.knowledgeBase[index],
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar contenido" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await authorizeFeature(request, "content-library");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN") return forbidden();
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const index = db.knowledgeBase.findIndex((k) => k.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: "Contenido no encontrado" }, { status: 404 });
    }

    const deleted = db.knowledgeBase.splice(index, 1)[0];
    return NextResponse.json({
      success: true,
      message: "Contenido eliminado correctamente",
      data: deleted,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar contenido" }, { status: 400 });
  }
}
