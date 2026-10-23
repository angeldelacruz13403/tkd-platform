import { NextResponse } from "next/server";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";

type Context = { params: { id: string } };

async function getAuthorizedVideo(request: Request, id: string) {
  const access = await authorizeFeature(request, "student-videos");
  if (isAuthorizationResponse(access)) return { response: access.response } as const;
  const client = getSupabaseClient();
  if (!client) return { response: NextResponse.json({ success: false, error: "El almacenamiento privado de vídeos requiere Supabase." }, { status: 503 }) } as const;
  const { data, error } = await client
    .from("coach_shared_videos")
    .select("id,club_id,storage_path,archived_at,coach_user_id")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ success: false, error: "No se pudo consultar el vídeo." }, { status: 503 }) } as const;
  if (!data) return { response: NextResponse.json({ success: false, error: "Vídeo no encontrado." }, { status: 404 }) } as const;
  if (access.session.role !== "ADMIN" && data.club_id !== access.clubId) return { response: forbidden() } as const;
  return { access, client, video: data } as const;
}

export async function GET(request: Request, { params }: Context) {
  const result = await getAuthorizedVideo(request, params.id);
  if ("response" in result) return result.response;
  const { data, error } = await result.client.storage
    .from("coach-shared-videos")
    .createSignedUrl(result.video.storage_path, 60);
  if (error || !data?.signedUrl) {
    console.error("[VIDEOS] No se pudo generar un enlace de lectura:", error);
    return NextResponse.json({ success: false, error: "No se pudo preparar la reproducción privada." }, { status: 503 });
  }
  return NextResponse.json({ success: true, signedUrl: data.signedUrl, expiresIn: 60 });
}

export async function DELETE(request: Request, { params }: Context) {
  const result = await getAuthorizedVideo(request, params.id);
  if ("response" in result) return result.response;
  if (result.access.session.role !== "ADMIN" && result.access.session.role !== "COACH" && result.access.session.role !== "CLUB") return forbidden();
  const { error } = await result.client
    .from("coach_shared_videos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ success: false, error: "No se pudo retirar el vídeo." }, { status: 503 });
  return NextResponse.json({ success: true });
}
