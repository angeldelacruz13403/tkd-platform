"use client";

import { useEffect, useState } from "react";
import { Users, Search, Plus, Trash2, Edit2, ShieldCheck, Mail, Phone, Calendar, CheckCircle } from "lucide-react";
import { db } from "@/lib/db";
import { User, UserRole } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 5;

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>(db.users);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    username: string;
    dni: string;
    password: string;
    role: UserRole;
    phone: string;
    status: "ACTIVE" | "INACTIVE";
    clubId: string;
    isClubDirector: boolean;
  }>({
    name: "",
    email: "",
    username: "",
    dni: "",
    password: "",
    role: "ATHLETE",
    phone: "",
    status: "ACTIVE",
    clubId: "",
    isClubDirector: false,
  });

  // Delete Confirm Dialog state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/users").then((response) => response.json()).then((result) => { if (active && result.success) setUsers(result.data || []); }).catch(() => undefined);
    fetch("/api/v1/clubs").then((response) => response.json()).then((result) => { if (active && result.success) setClubs(result.data || []); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "ALL" || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", username: "", dni: "", password: "", role: "ATHLETE", phone: "", status: "ACTIVE", clubId: "", isClubDirector: false });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username || "",
      dni: user.dni || "",
      password: user.password || "",
      role: user.role,
      phone: user.phone || "",
      status: user.status as any,
      clubId: user.clubId || "",
      isClubDirector: user.role === "COACH" && user.isClubDirector === true,
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.warning("Campos requeridos", "Nombre y correo son obligatorios.");
      return;
    }

    try {
      if (editingUser) {
        // PUT update
        const res = await fetch("/api/v1/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingUser.id, ...formData }),
        });
        const result = await res.json();
        if (result.success) {
          setUsers(users.map((u) => (u.id === editingUser.id ? result.data : u)));
          toast.success("Usuario actualizado", `${result.data.name} ha sido modificado con éxito.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error al actualizar", result.error);
        }
      } else {
        // POST create
        const res = await fetch("/api/v1/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (result.success) {
          setUsers([...users, result.data]);
          toast.success("Usuario registrado", `${result.data.name} añadido a la plataforma.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error al crear usuario", result.error);
        }
      }
    } catch {
      toast.error("Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/users?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setUsers(users.filter((u) => u.id !== deleteTarget.id));
        toast.success("Usuario eliminado", `${deleteTarget.name} ha sido dado de baja.`);
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el usuario.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "COACH":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      case "ATHLETE":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "CLUB":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            Gestión de Usuarios & Control de Accesos
          </h2>
          <p className="text-xs text-slate-400">
            Control centralizado de cuentas, roles de federación, entrenadores, atletas y dojangs
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Usuario
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {["ALL", "ADMIN", "COACH", "ATHLETE", "CLUB"].map((role) => (
            <button
              key={role}
              onClick={() => {
                setSelectedRole(role);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedRole === role
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {role === "ALL" ? "Todos los Roles" : role}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Usuario</th>
                <th className="py-3.5 px-4">Rol en el Ecosistema</th>
                <th className="py-3.5 px-4">Contacto</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Fecha de Alta</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            user.avatarUrl ||
                            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
                          }
                          alt={user.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-white">{user.name}</div>
                          <div className="text-[11px] text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                      {user.role === "COACH" && user.isClubDirector && (
                        <span className="ml-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                          Director del club
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{user.phone || "—"}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-700/30 text-slate-400 border-slate-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === "ACTIVE" ? "bg-emerald-400" : "bg-slate-400"
                          }`}
                        />
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white border border-slate-700 transition-colors"
                          title="Editar usuario"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingUser ? "Editar Usuario" : "Registrar Nuevo Usuario"}
            </h3>
            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Club asignado</label>
                <select value={formData.clubId} onChange={(e) => setFormData({ ...formData, clubId: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500">
                  <option value="">Sin club asignado</option>
                  {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ej. Maestro Antonio García"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="ejemplo@tkd.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Usuario</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    placeholder="atleta-demo"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">DNI / Documento</label>
                  <input
                    type="text"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    placeholder="12345678A"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Contraseña</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="Dejar vacío para generar o usar el DNI si es atleta"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rol de Acceso</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setFormData({ ...formData, role, isClubDirector: role === "COACH" && formData.isClubDirector });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="ADMIN">ADMIN (Administrador)</option>
                    <option value="COACH">COACH (Entrenador)</option>
                    <option value="ATHLETE">ATHLETE (Atleta)</option>
                    <option value="CLUB">CLUB (Director Dojang)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    placeholder="+34 600 000 000"
                  />
                </div>
                {formData.role === "COACH" && (
                  <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.isClubDirector}
                      onChange={(e) => setFormData({ ...formData, isClubDirector: e.target.checked })}
                      className="mt-0.5 accent-amber-500"
                    />
                    <span>
                      <span className="block font-semibold text-amber-200">Este maestro también será director del club</span>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Mantendrá el rol COACH; esta opción solo identifica su función de dirección.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Estado de Cuenta</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="ACTIVE">ACTIVE (Activo)</option>
                  <option value="INACTIVE">INACTIVE (Inactivo)</option>
                </select>
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
                  {editingUser ? "Guardar Cambios" : "Guardar Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar usuario?"
        description={`Esta acción eliminará a "${deleteTarget?.name}" (${deleteTarget?.email}) del sistema. No se podrá recuperar.`}
        confirmText="Eliminar Usuario"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
