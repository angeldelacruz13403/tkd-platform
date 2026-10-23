import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { User } from "@/lib/types";
import { canAccessClub, forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

function cleanUsername(fullName: string): string {
  const clean = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 18) || "atleta";
  const num = Math.floor(100 + Math.random() * 900);
  return `${clean}.${num}`;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index++) {
    code += chars.charAt(randomInt(chars.length));
  }
  return `Tkd-${code}!`;
}

export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) return unauthorized();
    if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();

    const body = await request.json();
    const { athleteId } = body;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: "ID de atleta obligatorio" }, { status: 400 });
    }

    const client = getSupabaseClient();

    if (client) {
      // 1. Obtener el atleta desde Supabase
      const { data: athlete, error: athErr } = await client
        .from("athletes")
        .select("id, name, user_id, club_id, wt_category")
        .eq("id", athleteId)
        .maybeSingle();

      if (athErr || !athlete) {
        return NextResponse.json({ success: false, error: "Atleta no encontrado" }, { status: 404 });
      }

      if (!canAccessClub(session, athlete.club_id)) {
        return forbidden();
      }

      let userId = athlete.user_id;
      let username = "";
      let email = "";
      const password = generatePassword();
      const storedPassword = hashPassword(password);
      let isNewUser = false;

      // 2. Comprobar si ya existe el usuario vinculado
      if (userId) {
        const { data: existingUser, error: lookupError } = await client
          .from("users")
          .select("id, username, email")
          .eq("id", userId)
          .maybeSingle();
        if (lookupError) {
          return NextResponse.json({ success: false, error: `No se pudo verificar el usuario existente: ${lookupError.message}` }, { status: 500 });
        }

        if (existingUser) {
          username = existingUser.username || cleanUsername(athlete.name);
          email = existingUser.email || `${username}@tkdglobal.app`;

          // Actualizar contraseña y datos del usuario existente
          const { error: updateError } = await client
            .from("users")
            .update({
              password: storedPassword,
              username,
              email,
              club_id: athlete.club_id || null,
              status: "ACTIVE",
            })
            .eq("id", existingUser.id);
          if (updateError) {
            return NextResponse.json({ success: false, error: `No se pudieron actualizar las credenciales: ${updateError.message}` }, { status: 500 });
          }
        } else {
          isNewUser = true;
        }
      } else {
        isNewUser = true;
      }

      // 3. Si no existe usuario o no se encontró, crearlo
      if (isNewUser) {
        userId = `usr-${Date.now()}`;
        username = cleanUsername(athlete.name);
        email = `${username}@tkdglobal.app`;

        const { error: insertErr } = await client.from("users").insert({
          id: userId,
          name: athlete.name,
          username,
          email,
          password: storedPassword,
          role: "ATHLETE",
          club_id: athlete.club_id || null,
          status: "ACTIVE",
        });

        if (insertErr) {
          // Reintentar con sufijo en caso de colisión de nombre de usuario/email
          username = `${username}.${Date.now().toString().slice(-4)}`;
          email = `${username}@tkdglobal.app`;

          const { error: retryErr } = await client.from("users").insert({
            id: userId,
            name: athlete.name,
            username,
            email,
            password: storedPassword,
            role: "ATHLETE",
            club_id: athlete.club_id || null,
            status: "ACTIVE",
          });

          if (retryErr) {
            return NextResponse.json({ success: false, error: `Error creando usuario: ${retryErr.message}` }, { status: 500 });
          }
        }

        // 4. Vincular el atleta con el nuevo user_id
        const { error: linkError } = await client.from("athletes").update({ user_id: userId }).eq("id", athlete.id);
        if (linkError) {
          await client.from("users").delete().eq("id", userId);
          return NextResponse.json({ success: false, error: `No se pudo vincular el acceso al atleta: ${linkError.message}` }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        message: isNewUser ? "Usuario generado y vinculado exitosamente" : "Credenciales actualizadas exitosamente",
        credentials: {
          athleteId: athlete.id,
          athleteName: athlete.name,
          userId,
          username,
          email,
          password,
          role: "ATHLETE",
          clubId: athlete.club_id,
        },
      });
    }

    // Fallback memoria
    const athleteIndex = db.athletes.findIndex((a) => a.id === athleteId);
    if (athleteIndex === -1) {
      return NextResponse.json({ success: false, error: "Atleta no encontrado" }, { status: 404 });
    }

    const athlete = db.athletes[athleteIndex];
    if (!canAccessClub(session, athlete.clubId)) {
      return forbidden();
    }

    let userId = athlete.userId;
    const password = generatePassword();
    const storedPassword = hashPassword(password);
    let username = cleanUsername(athlete.fullName);
    let email = `${username}@tkdglobal.app`;

    const existingUserIndex = db.users.findIndex((u) => u.id === userId);
    if (existingUserIndex !== -1) {
      username = db.users[existingUserIndex].username || username;
      email = db.users[existingUserIndex].email || email;
      db.users[existingUserIndex].password = storedPassword;
      db.users[existingUserIndex].clubId = athlete.clubId;
    } else {
      userId = `usr-${Date.now()}`;
      const newUser: User = {
        id: userId,
        name: athlete.fullName,
        username,
        email,
        password: storedPassword,
        role: "ATHLETE",
        clubId: athlete.clubId,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);
      athlete.userId = userId;
    }

    return NextResponse.json({
      success: true,
      message: "Usuario generado exitosamente en memoria",
      credentials: {
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        userId,
        username,
        email,
        password,
        role: "ATHLETE",
        clubId: athlete.clubId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al generar usuario para el atleta" },
      { status: 500 }
    );
  }
}
