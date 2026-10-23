import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { User } from "@/lib/types";
import { createApiToken } from "@/lib/api-auth";
import { hashPassword, verifyPassword } from "@/lib/password";

function mapUser(row: any): User {
  return {
    id: row.id,
    username: row.username || row.email,
    name: row.name,
    email: row.email,
    password: row.password || "",
    dni: row.dni || undefined,
    clubId: row.club_id || undefined,
    role: row.role,
    isClubDirector: row.role === "COACH" && row.is_club_director === true,
    avatarUrl: row.avatar_url || undefined,
    phone: row.phone || undefined,
    status: row.status || "ACTIVE",
    createdAt: row.created_at || new Date().toISOString(),
    lastLogin: row.last_login || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, username, password } = body;
    const rawIdentifier = (username || email || "").trim();
    const identifier = rawIdentifier.toLowerCase();
    const submittedPassword = String(password ?? "").trim();

    const client = getSupabaseClient();
    let user: User | undefined;

    if (client) {
      // Búsqueda insensible a mayúsculas/minúsculas (ilike) y por ID directo
      const result = await client
        .from("users")
        .select("*")
        .or(`email.ilike.${identifier},username.ilike.${identifier},id.eq.${rawIdentifier},dni.ilike.${identifier}`)
        .maybeSingle();

      if (result.error && !result.error.message.includes("multiple (or no) rows")) {
        // Si falla or o ilike por columnas no indexadas, intentar búsqueda secuencial segura
        for (const column of ["email", "username", "id", "dni"]) {
          const colRes = await client.from("users").select("*").ilike(column, identifier).maybeSingle();
          if (colRes.data) {
            user = mapUser(colRes.data);
            break;
          }
        }
      } else if (result.data) {
        user = mapUser(result.data);
      }

      // Si la base de datos está vacía y se intenta iniciar con 'admin', provisionar el usuario root
      if (!user && rawIdentifier.toLowerCase() === "admin") {
        const { count } = await client.from("users").select("*", { count: "exact", head: true });
        if (!count || count === 0) {
          const initialAdmin = {
            id: "usr-admin",
            name: "Administrador Global",
            username: "admin",
            email: "admin@tkdglobal.app",
            password: hashPassword(submittedPassword || "admin123"),
            role: "ADMIN" as const,
            status: "ACTIVE" as const,
          };
          const { error: provisionError } = await client.from("users").insert(initialAdmin);
          if (provisionError) {
            return NextResponse.json({ success: false, error: `No se pudo provisionar el administrador: ${provisionError.message}` }, { status: 500 });
          }
          user = {
            ...initialAdmin,
            createdAt: new Date().toISOString(),
          };
        }
      }
    } else {
      user = db.users.find((u) => {
        const userLogin = (u.username || u.email || u.id).toLowerCase().trim();
        const userEmail = (u.email || "").toLowerCase().trim();
        const userDni = (u.dni || "").toLowerCase().trim();
        return userLogin === identifier || userEmail === identifier || u.id.toLowerCase() === identifier || userDni === identifier;
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado. Verifica el nombre de usuario, email o DNI." },
        { status: 401 }
      );
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json({ success: false, error: "La cuenta está suspendida." }, { status: 403 });
    }

    const passwordCheck = verifyPassword(submittedPassword, user.password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: "Contraseña incorrecta. Comprueba la contraseña asignada al usuario." },
        { status: 401 }
      );
    }

    if (passwordCheck.needsRehash) {
      const upgradedHash = hashPassword(submittedPassword);
      if (client) {
        await client.from("users").update({ password: upgradedHash }).eq("id", user.id);
      } else {
        const storedUser = db.users.find((item) => item.id === user?.id);
        if (storedUser) storedUser.password = upgradedHash;
      }
      user.password = upgradedHash;
    }

    if (client) {
      await client.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);
    } else {
      user.lastLogin = new Date().toISOString();
    }

    let profile: Record<string, unknown> = { clubId: user.clubId || "" };
    if (client && user.role === "ATHLETE") {
      const { data } = await client.from("athletes").select("id,name,max_bpm,rest_bpm,club_id,coach_id").eq("user_id", user.id).maybeSingle();
      if (data) profile = { ...profile, athleteId: data.id, athleteName: data.name, maxHeartRateBpm: data.max_bpm, restingHeartRateBpm: data.rest_bpm, clubId: data.club_id || user.clubId || "", coachId: data.coach_id || "" };
    } else if (client && user.role === "COACH") {
      const { data } = await client.from("coaches").select("id,club_id").eq("user_id", user.id).maybeSingle();
      if (data) profile = { ...profile, coachId: data.id, clubId: data.club_id || user.clubId || "" };
    } else if (!client && user.role === "ATHLETE") {
      const athlete = db.athletes.find((item) => item.userId === user.id);
      if (athlete) profile = { ...profile, athleteId: athlete.id, athleteName: athlete.fullName, maxHeartRateBpm: athlete.maxHeartRateBpm, restingHeartRateBpm: athlete.restingHeartRateBpm, clubId: athlete.clubId, coachId: athlete.coachId };
    }
    if (typeof profile.clubId === "string" && profile.clubId) user.clubId = profile.clubId;
    const { password: _password, ...safeUser } = user;
    const token = createApiToken(user);
    const response = NextResponse.json({
      success: true,
      user: safeUser,
      profile,
      token,
    });

    response.cookies.set("tkd_token", token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error en autenticación" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    roles: ["ADMIN", "COACH", "ATHLETE", "CLUB"],
    service: "Taekwondo Hub Auth REST API",
    version: "v1.0",
  });
}
