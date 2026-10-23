"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Play, Upload, Video } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CoachSharedVideo } from "@/lib/types";

const maxUploadSize = 100 * 1024 * 1024;

export default function VideosPage() {
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "COACH" || role === "CLUB";
  const [videos, setVideos] = useState<CoachSharedVideo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/videos");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar los vídeos.");
      setVideos(result.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los vídeos.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    if (selected && selected.size > maxUploadSize) {
      setError("El vídeo no puede superar 100 MB.");
      setFile(null);
    } else if (selected && !["video/mp4", "video/quicktime", "video/webm"].includes(selected.type)) {
      setError("Formatos admitidos: MP4, MOV y WebM.");
      setFile(null);
    } else setError("");
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Selecciona un vídeo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const createResponse = await fetch("/api/v1/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          mimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created.success) throw new Error(created.error || "No se pudo preparar la subida.");

      const uploadResponse = await fetch(created.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!uploadResponse.ok) {
        await fetch(`/api/v1/videos/${encodeURIComponent(created.data.id)}`, { method: "DELETE" });
        throw new Error("Supabase rechazó la subida del vídeo.");
      }
      setTitle("");
      setDescription("");
      setFile(null);
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el vídeo.");
    } finally {
      setBusy(false);
    }
  };

  const play = async (item: CoachSharedVideo) => {
    setError("");
    try {
      const response = await fetch(`/api/v1/videos/${encodeURIComponent(item.id)}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo preparar el vídeo.");
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : "No se pudo abrir el vídeo.");
    }
  };

  const archive = async (item: CoachSharedVideo) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/videos/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo retirar el vídeo.");
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "No se pudo retirar el vídeo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Video className="h-6 w-6 text-sky-400" /> Vídeos compartidos del entrenador</h1>
        <p className="mt-1 text-sm text-slate-400">Los enlaces son privados y solo se emiten a miembros autenticados del club.</p>
      </header>
      {error && <p role="alert" className="break-words rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {canManage && (
        <form onSubmit={(event) => void upload(event)} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2">
          <h2 className="font-semibold text-white sm:col-span-2">Compartir vídeo</h2>
          <input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción (opcional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <input required type="file" accept="video/mp4,video/quicktime,video/webm" onChange={chooseFile} className="text-sm text-slate-300 sm:col-span-2" />
          {file && <p className="text-xs text-slate-400 sm:col-span-2">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          <button disabled={busy || !file} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"><Upload className="h-4 w-4" /> Subir y compartir</button>
        </form>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {videos.map((item) => (
          <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="min-w-0"><h2 className="truncate font-semibold text-white">{item.title}</h2><p className="truncate text-xs text-slate-400">{item.description || item.mimeType} · {(item.fileSizeBytes / 1024 / 1024).toFixed(1)} MB</p></div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => void play(item)} className="rounded-lg border border-sky-800 p-2 text-sky-300" aria-label={`Reproducir ${item.title}`}><Play className="h-4 w-4" /></button>
              {canManage && <button disabled={busy} onClick={() => void archive(item)} className="rounded-lg border border-rose-900 px-3 py-2 text-xs text-rose-300 disabled:opacity-50">Retirar</button>}
            </div>
          </article>
        ))}
      </div>
      {!videos.length && <p className="rounded-xl border border-slate-800 p-6 text-center text-sm text-slate-400">No hay vídeos compartidos.</p>}
    </div>
  );
}
