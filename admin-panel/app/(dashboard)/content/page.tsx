"use client";

import { useState, useEffect } from "react";
import { Video, FileText, Play, Download, Plus, Search, Eye, Sparkles, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";

interface MediaContent {
  id: string;
  title: string;
  category: string;
  durationOrPages?: string;
  description?: string;
  instructor?: string;
  thumbnailUrl?: string;
  fileType?: string;
  fileUrl?: string | null;
  tags: string[];
}

const initialContents: MediaContent[] = [
  {
    id: "kb-1",
    title: "Reglamento Oficial de Competición Kyorugi WT (2025/2026)",
    category: "PDF_REGLAMENTO",
    durationOrPages: "48 Páginas (PDF)",
    description: "Reglas de puntuación actualizada: 3 pts patada a la cabeza, 5 pts con giro a la cabeza.",
    instructor: "Comité de Arbitraje WT",
    thumbnailUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&auto=format&fit=crop&q=80",
    tags: ["WT", "Reglamento", "Puntos", "Gam-jeom"],
  },
  {
    id: "kb-2",
    title: "Biomecánica y Corte Anticipado con Bandal Chagui",
    category: "VIDEO_TECNICA",
    durationOrPages: "8:45 min",
    description: "Desglose biomecánico del corte con pierna delantera ante embestida.",
    instructor: "Sabonim Miguel Ángel Sánchez",
    thumbnailUrl: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=500&auto=format&fit=crop&q=80",
    tags: ["Bandal Chagui", "Peto Daedo", "Velocidad"],
  },
  {
    id: "kb-3",
    title: "Mecánica del Dwi Chagi en Contraataque",
    category: "VIDEO_TECNICA",
    durationOrPages: "12:20 min",
    description: "Ángulo de cadera óptimo a 45 grados y punto de impacto en plexo solar.",
    instructor: "Master Carlos Vega",
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80",
    tags: ["Dwi Chagi", "Giro", "Contraataque"],
  },
  {
    id: "kb-4",
    title: "Drill de Presión en Clientes de Fatiga (Simulación Asalto 3)",
    category: "DRILL_TACTICO",
    durationOrPages: "15:00 min",
    description: "Series de 10x15s a máxima frecuencia de golpeo en saco con FC > 90% FC Máx.",
    instructor: "Dra. Elena Ramos",
    thumbnailUrl: "https://images.unsplash.com/photo-1517344884509-a0c97ec11bcc?w=500&auto=format&fit=crop&q=80",
    tags: ["Cardio", "Z5", "Sparring"],
  },
];

const PAGE_SIZE = 4;

export default function ContentPage() {
  const toast = useToast();
  const [contents, setContents] = useState<MediaContent[]>(initialContents);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMedia, setActiveMedia] = useState<MediaContent | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaContent | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "VIDEO_TECNICA",
    durationOrPages: "10:00 min",
    instructor: "Sabonim Miguel Ángel Sánchez",
    description: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80",
    tagsStr: "Taekwondo, WT, Técnica",
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<MediaContent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredContents = contents.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.instructor && c.instructor.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === "ALL" || c.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalPages = Math.ceil(filteredContents.length / PAGE_SIZE) || 1;
  const paginatedContents = filteredContents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      category: "VIDEO_TECNICA",
      durationOrPages: "10:00 min",
      instructor: "Sabonim Miguel Ángel Sánchez",
      description: "",
      thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80",
      tagsStr: "Taekwondo, WT, Técnica",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: MediaContent) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      durationOrPages: item.durationOrPages || "10:00 min",
      instructor: item.instructor || "Instructor Oficial",
      description: item.description || "",
      thumbnailUrl: item.thumbnailUrl || "",
      tagsStr: item.tags.join(", "),
    });
    setIsModalOpen(true);
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.warning("Campo obligatorio", "Introduce el título del contenido.");
      return;
    }

    const tags = formData.tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingItem) {
        const res = await fetch("/api/v1/content", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            title: formData.title,
            category: formData.category,
            description: formData.description,
            tags,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setContents(
            contents.map((c) =>
              c.id === editingItem.id
                ? {
                    ...c,
                    title: formData.title,
                    category: formData.category,
                    durationOrPages: formData.durationOrPages,
                    instructor: formData.instructor,
                    description: formData.description,
                    thumbnailUrl: formData.thumbnailUrl,
                    tags,
                  }
                : c
            )
          );
          toast.success("Contenido actualizado", "Ficha multimedia guardada.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            category: formData.category,
            description: formData.description,
            tags,
            addedBy: formData.instructor,
          }),
        });
        const result = await res.json();
        if (result.success) {
          const newItem: MediaContent = {
            id: result.data.id,
            title: formData.title,
            category: formData.category,
            durationOrPages: formData.durationOrPages,
            instructor: formData.instructor,
            description: formData.description,
            thumbnailUrl: formData.thumbnailUrl,
            tags,
          };
          setContents([newItem, ...contents]);
          toast.success("Contenido subido", "Vídeo / Documento publicado con éxito.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    }
  };

  const handleDeleteContent = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/content?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setContents(contents.filter((c) => c.id !== deleteTarget.id));
        toast.success("Contenido eliminado", "Elemento eliminado de la biblioteca.");
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el contenido.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-sky-400" />
            Gestión de Contenidos Multimedia & Biblioteca WT
          </h2>
          <p className="text-xs text-slate-400">
            Vídeos técnicos de pateo, manuales oficiales de arbitraje en PDF y rutinas tácticas
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Subir Vídeo o PDF
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar contenido o instructor..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { key: "ALL", label: "Todo" },
            { key: "VIDEO_TECNICA", label: "Vídeos Técnicos" },
            { key: "PDF_REGLAMENTO", label: "Manuales PDF" },
            { key: "DRILL_TACTICO", label: "Drills Tácticos" },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCategory(cat.key);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.key
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Media */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {paginatedContents.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No se encontraron contenidos que coincidan con la búsqueda.
          </div>
        ) : (
          paginatedContents.map((item) => (
            <div
              key={item.id}
              className="glass-panel rounded-2xl border border-slate-800 overflow-hidden group hover:border-sky-500/40 transition-all shadow-xl flex flex-col justify-between"
            >
              <div>
                {/* Media Thumbnail with Overlay */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <button
                    onClick={() => setActiveMedia(item)}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-sky-500/90 hover:bg-sky-400 text-white flex items-center justify-center shadow-chong-glow transition-transform group-hover:scale-110">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </button>
                  <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/80 text-white border border-white/10">
                    {item.durationOrPages}
                  </span>
                </div>

                <div className="p-4">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                    {item.category.replace(/_/g, " ")}
                  </span>
                  <h3 className="font-bold text-white text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <p className="text-[11px] text-slate-400 mb-3">Instructor: {item.instructor}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 flex gap-2">
                <button
                  onClick={() => setActiveMedia(item)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </button>
                <button
                  onClick={() => openEditModal(item)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="Editar contenido"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                  title="Eliminar contenido"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredContents.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Video / PDF Preview Modal */}
      {activeMedia && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">{activeMedia.title}</h3>
              <button
                onClick={() => setActiveMedia(null)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center relative mb-4 border border-slate-800">
              <img
                src={activeMedia.thumbnailUrl}
                alt={activeMedia.title}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/40">
                <Play className="w-16 h-16 text-sky-400 mb-2 fill-sky-400/20" />
                <p className="text-sm font-semibold text-white">Reproductor de Streaming Seguro WT</p>
                <p className="text-xs text-slate-300 mt-1">
                  Resolución 4K 60fps con telemetría biomecánica sincronizada
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <span>Instructor: {activeMedia.instructor}</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/30 text-sky-300 border border-sky-500/40 hover:bg-sky-600/50">
                <Download className="w-3.5 h-3.5" />
                Descargar para uso offline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Content Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingItem ? "Editar Ficha de Contenido" : "Subir Nuevo Vídeo o Manual"}
            </h3>
            <form onSubmit={handleSaveContent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Título del Contenido</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ej. Análisis de Contraataque en Asalto 3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="VIDEO_TECNICA">Vídeo Técnico</option>
                    <option value="PDF_REGLAMENTO">Manual PDF Reglamento</option>
                    <option value="DRILL_TACTICO">Drill Táctico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Duración o Páginas</label>
                  <input
                    type="text"
                    value={formData.durationOrPages}
                    onChange={(e) => setFormData({ ...formData, durationOrPages: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Instructor o Ponente</label>
                <input
                  type="text"
                  value={formData.instructor}
                  onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  placeholder="Descripción del material técnico o reglamento..."
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Etiquetas (separadas por coma)</label>
                <input
                  type="text"
                  value={formData.tagsStr}
                  onChange={(e) => setFormData({ ...formData, tagsStr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-chong-glow transition-all active:scale-95"
                >
                  {editingItem ? "Guardar Cambios" : "Publicar Contenido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar contenido?"
        description={`Esta acción eliminará "${deleteTarget?.title}" de la biblioteca de recursos.`}
        confirmText="Eliminar Contenido"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteContent}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
