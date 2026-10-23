import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { CoachSharedVideo } from "@/lib/types";

const bucket = "coach-shared-videos";
const allowedMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const maxFileSize = 100 * 1024 * 1024;

function mapVideo(row: any): CoachSharedVideo {
  return {
    id: row.id,
    clubId: row.club_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    description: row.description || "",
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "student-videos");
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "El almacenamiento privado de vídeos requiere Supabase." }, { status: 503 });

  const requestedClub = new URL(request.url).searchParams.get("clubId");
  const clubId = access.session.role === "ADMIN" ? requestedClub || access.clubId : access.clubId;
  if (!clubId) return NextResponse.json({ success: false, error: "No se pudo resolver el club." }, { status: 403 });
  if (access.session.role !== "ADMIN" && requestedClub && requestedClub !== clubId) return forbidden();

  const { data, error } = await client
    .from("coach_shared_videos")
    .select("id,club_id,coach_user_id,title,description,mime_type,file_size_bytes,created_at,storage_path")
    .eq("club_id", clubId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: "No se pudieron cargar los vídeos compartidos." }, { status: 503 });
  return NextResponse.json({ success: true, data: (data || []).map(mapVideo) });
}

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "student-videos");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const mimeType = String(body.mimeType || "");
  const fileSizeBytes = Number(body.fileSizeBytes);
  if (!title || title.length > 255 || !allowedMimeTypes.has(mimeType) ||
    !Number.isInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > maxFileSize) {
    return NextResponse.json({ success: false, error: "Título, tipo de archivo o tamaño de vídeo no válido (máximo 100 MB)." }, { status: 400 });
  }
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "El almacenamiento privado de vídeos requiere Supabase." }, { status: 503 });

  const clubId = access.session.role === "ADMIN" ? body.clubId || access.clubId : access.clubId;
  if (!clubId || (access.session.role !== "ADMIN" && body.clubId && body.clubId !== clubId)) return forbidden();
  const extension = mimeType === "video/quicktime" ? "mov" : mimeType.split("/")[1];
  const id = `video-${randomUUID()}`;
  const storagePath = `${clubId}/${id}.${extension}`;
  const { data: upload, error: uploadError } = await client.storage.from(bucket).createSignedUploadUrl(storagePath, { upsert: false });
  if (uploadError || !upload) {
    console.error("[VIDEOS] No se pudo generar un enlace de subida:", uploadError);
    return NextResponse.json({ success: false, error: "No se pudo preparar la subida privada del vídeo." }, { status: 503 });
  }

  const { data, error } = await client.from("coach_shared_videos").insert({
    id,
    club_id: clubId,
    coach_user_id: access.session.id,
    title,
    description: String(body.description || "").slice(0, 2000),
    storage_path: storagePath,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
  }).select("id,club_id,coach_user_id,title,description,mime_type,file_size_bytes,created_at").single();
  if (error) {
    await client.storage.from(bucket).remove([storagePath]);
    return NextResponse.json({ success: false, error: "No se pudo registrar el vídeo." }, { status: 409 });
  }
  return NextResponse.json({
    success: true,
    data: mapVideo(data),
    upload: { signedUrl: upload.signedUrl, token: upload.token, path: upload.path },
  }, { status: 201 });
}
