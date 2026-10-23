import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { Club } from "@/lib/types";
import { forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { resolveClubId } from "@/lib/entitlements";

function mapClub(row: any): Club {
  return {
    id: row.id,
    name: row.name,
    dojangAddress: row.dojang_address || "",
    city: row.city || "",
    federationCode: row.federation_code || "",
    directorName: row.director_name || "",
    coachId: row.coach_id || "",
    coachName: row.director_name || "",
    athletesCount: Number(row.athletes_count) || 0,
    coachesCount: Math.max(1, Number(row.coaches_count) || 1),
    activeSubscriptions: Number(row.active_subscriptions) || 0,
    foundedYear: Number(row.founded_year) || 0,
  };
}

function toRow(body: any, id: string) {
  return {
    id,
    name: body.name,
    dojang_address: body.dojangAddress || "",
    city: body.city || "",
    federation_code: body.federationCode || `FED-${Date.now()}`,
    director_name: body.directorName || body.coachName || "",
    athletes_count: Number(body.athletesCount) || 0,
    coaches_count: Math.max(1, Number(body.coachesCount) || 1),
    active_subscriptions: Number(body.activeSubscriptions) || 0,
    founded_year: Number(body.foundedYear) || null,
  };
}

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  let scopedClubId: string | null = null;
  if (session.role !== "ADMIN") {
    try {
      scopedClubId = await resolveClubId(session.id, session.role, session.clubId);
    } catch (error) {
      console.error("[CLUBS] No se pudo resolver el club de la sesión:", error);
      return NextResponse.json({ success: false, error: "No se pudo verificar el club del usuario." }, { status: 503 });
    }
    if (!scopedClubId) return forbidden();
  }
  const client = getSupabaseClient();
  if (client) {
    let clubsQuery = client.from("clubs").select("*").order("created_at", { ascending: false });
    if (scopedClubId) clubsQuery = clubsQuery.eq("id", scopedClubId);
    const [{ data: clubsData, error: clubsError }, { data: coachesData }] = await Promise.all([
      clubsQuery,
      client.from("coaches").select("id, name, license_number, club_id"),
    ]);
    if (clubsError) return NextResponse.json({ success: false, error: clubsError.message }, { status: 500 });
    
    const coaches = coachesData || [];
    const mapped = (clubsData || []).map((row: any) => {
      const club = mapClub(row);
      const assignedCoach = coaches.find((c: any) => c.club_id === row.id);
      if (assignedCoach) {
        club.coachId = assignedCoach.id;
        club.coachName = assignedCoach.name;
        club.directorName = assignedCoach.name;
        club.coachesCount = Math.max(1, club.coachesCount);
      }
      return club;
    });
    return NextResponse.json({ success: true, total: mapped.length, data: mapped });
  }

  const mapped = db.clubs.filter((club) => !scopedClubId || club.id === scopedClubId).map((club) => {
    const assignedCoach = db.coaches.find((c) => c.clubId === club.id);
    if (assignedCoach) {
      return {
        ...club,
        coachId: assignedCoach.id,
        coachName: assignedCoach.fullName,
        directorName: assignedCoach.fullName,
        coachesCount: Math.max(1, club.coachesCount),
      };
    }
    return club;
  });
  return NextResponse.json({ success: true, total: mapped.length, data: mapped });
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden();
  try {
    const body = await request.json();
    if (!body.name || !body.coachId) {
      return NextResponse.json({ success: false, error: "El nombre del club y el entrenador responsable son obligatorios" }, { status: 400 });
    }
    const id = `club-${Date.now()}`;
    const client = getSupabaseClient();
    let coachId = body.coachId || "";
    let coachName = "";

    if (client) {
      const { data: coachData, error: coachLookupError } = await client
        .from("coaches")
        .select("id, name, user_id, club_id")
        .eq("id", coachId)
        .maybeSingle();
      if (coachLookupError) return NextResponse.json({ success: false, error: "No se pudo consultar el entrenador." }, { status: 503 });
      if (!coachData) return NextResponse.json({ success: false, error: "Entrenador no encontrado." }, { status: 404 });
      if (coachData.club_id) return NextResponse.json({ success: false, error: "El entrenador ya tiene un club asignado." }, { status: 409 });
      coachName = coachData.name;

      body.directorName = coachName;
      body.coachesCount = Math.max(1, Number(body.coachesCount) || 1);

      const { data, error } = await client.from("clubs").insert(toRow(body, id)).select("*").single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 409 });

      const { data: linkedCoach, error: linkError } = await client
        .from("coaches")
        .update({ club_id: id })
        .eq("id", coachId)
        .is("club_id", null)
        .select("id")
        .maybeSingle();
      if (linkError || !linkedCoach) {
        const { error: cleanupError } = await client.from("clubs").delete().eq("id", id);
        if (cleanupError) console.error("[CLUBS] No se pudo revertir el club tras fallar la asignación:", cleanupError);
        return NextResponse.json({ success: false, error: "No se pudo asignar el entrenador al club." }, { status: 503 });
      }

      if (coachData.user_id) {
        const { error: userLinkError } = await client
          .from("users")
          .update({ club_id: id })
          .eq("id", coachData.user_id);
        if (userLinkError) {
          const { error: coachRollbackError } = await client.from("coaches").update({ club_id: null }).eq("id", coachId);
          if (coachRollbackError) console.error("[CLUBS] No se pudo revertir la asignación del entrenador:", coachRollbackError);
          const { error: clubCleanupError } = await client.from("clubs").delete().eq("id", id);
          if (clubCleanupError) console.error("[CLUBS] No se pudo revertir el club tras fallar la asignación:", clubCleanupError);
          return NextResponse.json({ success: false, error: "No se pudo actualizar el club de la cuenta del entrenador." }, { status: 503 });
        }
      }

      const club = mapClub(data);
      club.coachId = coachId;
      club.coachName = coachName;
      return NextResponse.json({ success: true, data: club });
    }

    const coach = db.coaches.find((c) => c.id === coachId);
    if (!coach) return NextResponse.json({ success: false, error: "Entrenador no encontrado." }, { status: 404 });
    if (coach.clubId) return NextResponse.json({ success: false, error: "El entrenador ya tiene un club asignado." }, { status: 409 });
    coachName = coach.fullName;

    const club: Club = {
      id,
      name: body.name,
      dojangAddress: body.dojangAddress || "",
      city: body.city || "",
      federationCode: body.federationCode || `FED-${Date.now()}`,
      directorName: coachName,
      coachId,
      coachName,
      athletesCount: Number(body.athletesCount) || 0,
      coachesCount: Math.max(1, Number(body.coachesCount) || 1),
      activeSubscriptions: Number(body.activeSubscriptions) || 0,
      foundedYear: Number(body.foundedYear) || 0,
    };
    db.clubs.push(club);

    if (coachId) {
      const coach = db.coaches.find((c) => c.id === coachId);
      if (coach) {
        coach.clubId = id;
        coach.clubName = body.name;
      }
    }
    return NextResponse.json({ success: true, data: club });
  } catch {
    return NextResponse.json({ success: false, error: "Error al registrar club" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden();
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    const client = getSupabaseClient();

    let coachName = body.directorName || "";
    let coachId = body.coachId || "";

    if (client) {
      const { id, ...updates } = body;
      const { data: coachData, error: coachLookupError } = coachId
        ? await client.from("coaches").select("id, name, user_id, club_id").eq("id", coachId).maybeSingle()
        : { data: null, error: null };
      if (coachLookupError) return NextResponse.json({ success: false, error: "No se pudo consultar el entrenador." }, { status: 503 });
      if (coachId && !coachData) return NextResponse.json({ success: false, error: "Entrenador no encontrado." }, { status: 404 });
      if (coachData?.club_id && coachData.club_id !== id) {
        return NextResponse.json({ success: false, error: "El entrenador ya tiene otro club asignado." }, { status: 409 });
      }
      coachName = coachData?.name || "";

      updates.directorName = coachName;
      updates.coachesCount = Math.max(1, Number(updates.coachesCount) || 1);

      const { data, error } = await client.from("clubs").update(toRow(updates, id)).eq("id", id).select("*").single();
      if (error) return NextResponse.json({ success: false, error: "Club no encontrado" }, { status: 404 });

      if (coachId) {
        const { data: linkedCoach, error: linkError } = await client
          .from("coaches")
          .update({ club_id: id })
          .eq("id", coachId)
          .select("id")
          .single();
        if (linkError || !linkedCoach) {
          return NextResponse.json({ success: false, error: "No se pudo asignar el entrenador al club." }, { status: 503 });
        }
        if (coachData?.user_id) {
          const { error: userLinkError } = await client.from("users").update({ club_id: id }).eq("id", coachData.user_id);
          if (userLinkError) return NextResponse.json({ success: false, error: "No se pudo actualizar el club de la cuenta del entrenador." }, { status: 503 });
        }
      }

      const club = mapClub(data);
      club.coachId = coachId;
      club.coachName = coachName || club.directorName;
      return NextResponse.json({ success: true, data: club });
    }

    const index = db.clubs.findIndex((club) => club.id === body.id);
    if (index === -1) return NextResponse.json({ success: false, error: "Club no encontrado" }, { status: 404 });

    if (coachId && !coachName) {
      const found = db.coaches.find((c) => c.id === coachId);
      if (found) coachName = found.fullName;
    }

    db.clubs[index] = {
      ...db.clubs[index],
      ...body,
      directorName: coachName || body.directorName || db.clubs[index].directorName,
      coachId: coachId || db.clubs[index].coachId,
      coachName: coachName || db.clubs[index].coachName,
      coachesCount: Math.max(1, Number(body.coachesCount) || db.clubs[index].coachesCount || 1),
    };

    if (coachId) {
      const coach = db.coaches.find((c) => c.id === coachId);
      if (coach) {
        coach.clubId = body.id;
        coach.clubName = db.clubs[index].name;
      }
    }

    return NextResponse.json({ success: true, data: db.clubs[index] });
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar club" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
  const client = getSupabaseClient();
  if (client) {
    // Unlink coaches from this club
    await client.from("coaches").update({ club_id: null }).eq("club_id", id);
    const { data, error } = await client.from("clubs").delete().eq("id", id).select("*").single();
    if (error) return NextResponse.json({ success: false, error: "Club no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: mapClub(data) });
  }
  const index = db.clubs.findIndex((club) => club.id === id);
  if (index === -1) return NextResponse.json({ success: false, error: "Club no encontrado" }, { status: 404 });
  db.coaches.forEach((c) => {
    if (c.clubId === id) {
      c.clubId = "";
      c.clubName = "";
    }
  });
  return NextResponse.json({ success: true, data: db.clubs.splice(index, 1)[0] });
}
