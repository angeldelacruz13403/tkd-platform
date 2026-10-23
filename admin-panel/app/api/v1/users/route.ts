import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { User } from "@/lib/types";
import { hashPassword } from "@/lib/password";
import { forbidden, getSession, unauthorized } from "@/lib/api-auth";

function mapUser(row: any): User {
  return { id: row.id, username: row.username || row.email, name: row.name, email: row.email, password: row.password || "", dni: row.dni || undefined, clubId: row.club_id || undefined, role: row.role, isClubDirector: row.role === "COACH" && row.is_club_director === true, avatarUrl: row.avatar_url || undefined, phone: row.phone || undefined, status: row.status || "ACTIVE", createdAt: row.created_at || new Date().toISOString(), lastLogin: row.last_login || undefined };
}

function safeUser(user: User) {
  const { password: _password, ...withoutPassword } = user;
  return withoutPassword;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "usuario";
}

function toRow(user: User) {
  return { id: user.id, name: user.name, email: user.email, username: user.username, password: user.password, dni: user.dni || null, club_id: user.clubId || null, role: user.role, is_club_director: user.role === "COACH" && user.isClubDirector === true, avatar_url: user.avatarUrl || null, phone: user.phone || null, status: user.status };
}

function requireAdmin(request: Request) {
  const session = getSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (session.role !== "ADMIN") return { response: forbidden() } as const;
  return { session } as const;
}

export async function GET(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from("users").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, total: data.length, data: data.map(mapUser).map(safeUser) });
  }
  return NextResponse.json({ success: true, total: db.users.length, data: db.users.map(safeUser) });
}

export async function POST(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  try {
    const body = await request.json();
    const role = (body.role || "ATHLETE") as User["role"];
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();
    if (!name || !email || !password) return NextResponse.json({ success: false, error: "Nombre, email y contraseña son obligatorios" }, { status: 400 });
    const user: User = { id: `usr-${Date.now()}`, username: String(body.username || slugify(name)).trim(), name, email, password: hashPassword(password), dni: body.dni || undefined, clubId: body.clubId || undefined, role, isClubDirector: role === "COACH" && body.isClubDirector === true, avatarUrl: body.avatarUrl || undefined, phone: body.phone || undefined, status: body.status || "ACTIVE", createdAt: new Date().toISOString() };
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client.from("users").insert(toRow(user)).select("*").single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      return NextResponse.json({ success: true, data: safeUser(mapUser(data)) });
    }
    db.users.push(user);
    return NextResponse.json({ success: true, data: safeUser(user) });
  } catch { return NextResponse.json({ success: false, error: "Error al crear usuario" }, { status: 400 }); }
}

export async function PUT(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    const client = getSupabaseClient();
    if (client) {
      const { id, ...updates } = body;
      const rowUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        const map: Record<string, string> = { clubId: "club_id", isClubDirector: "is_club_director", avatarUrl: "avatar_url", lastLogin: "last_login" };
        rowUpdates[map[key] || key] = key === "password" && typeof value === "string" && value
          ? hashPassword(value)
          : value;
      }
      if (updates.role && updates.role !== "COACH") rowUpdates.is_club_director = false;
      if (updates.isClubDirector !== undefined) rowUpdates.is_club_director = updates.role === "COACH" && updates.isClubDirector === true;
      const { data, error } = await client.from("users").update(rowUpdates).eq("id", id).select("*").single();
      if (error) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, data: safeUser(mapUser(data)) });
    }
    const index = db.users.findIndex((user) => user.id === body.id);
    if (index === -1) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    db.users[index] = {
      ...db.users[index],
      ...body,
      isClubDirector: body.role === "COACH" && body.isClubDirector === true,
      ...(typeof body.password === "string" && body.password ? { password: hashPassword(body.password) } : {}),
    };
    return NextResponse.json({ success: true, data: safeUser(db.users[index]) });
  } catch { return NextResponse.json({ success: false, error: "Error al actualizar usuario" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from("users").delete().eq("id", id).select("*").single();
    if (error) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: safeUser(mapUser(data)) });
  }
  const index = db.users.findIndex((user) => user.id === id);
  if (index === -1) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, data: safeUser(db.users.splice(index, 1)[0]) });
}
