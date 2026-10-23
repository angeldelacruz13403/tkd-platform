import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { Coach } from "@/lib/types";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";

function mapCoach(row: any, clubName: string = ""): Coach {
  return {
    id: row.id,
    userId: row.user_id || "",
    fullName: row.name,
    licenseNumber: row.license_number || "",
    specialty: row.specialty || "COMBAT_KYORUGI",
    clubId: row.club_id || "",
    clubName: clubName || row.club_name || "",
    athletesCount: Number(row.assigned_athletes_count) || 0,
    yearsOfExperience: Number(row.experience_years) || 0,
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
  };
}

function toRow(body: any, id: string) {
  const safeLicense = (body.licenseNumber || id).toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    id,
    user_id: body.userId || null,
    name: body.fullName,
    dan_grade: body.danGrade || "4th_Dan",
    specialty: body.specialty || "COMBAT_KYORUGI",
    license_number: body.licenseNumber,
    club_id: body.clubId || null,
    assigned_athletes_count: Number(body.athletesCount) || 0,
    experience_years: Number(body.yearsOfExperience) || 0,
    email: body.email || `${safeLicense || "coach"}@tkdglobalhub.com`,
  };
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "coach-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const client = getSupabaseClient();
  if (client) {
    let coachQuery = client.from("coaches").select("*").order("created_at", { ascending: false });
    if (access.session.role !== "ADMIN") coachQuery = coachQuery.eq("club_id", access.clubId || "__none__");
    const [{ data: coaches, error }, { data: clubs }] = await Promise.all([
      coachQuery,
      client.from("clubs").select("id, name, director_name"),
    ]);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    
    const clubMap = new Map((clubs || []).map((c: any) => [c.id, c.name]));
    const mapped = (coaches || []).map((row: any) =>
      mapCoach(row, row.club_id ? clubMap.get(row.club_id) || "" : "")
    );
    return NextResponse.json({ success: true, total: mapped.length, data: mapped });
  }

  const scoped = db.coaches.filter((coach) => access.session.role === "ADMIN" || coach.clubId === access.clubId);
  const mapped = scoped.map((c) => {
    const club = db.clubs.find((cl) => cl.id === c.clubId || cl.name === c.clubName || cl.directorName === c.fullName);
    if (club) return { ...c, clubId: club.id, clubName: club.name };
    return c;
  });
  return NextResponse.json({ success: true, total: mapped.length, data: mapped });
}

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "coach-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  try {
    const body = await request.json();
    if (!body.fullName || !body.licenseNumber) {
      return NextResponse.json({ success: false, error: "Nombre y licencia son obligatorios" }, { status: 400 });
    }
    const id = `coach-${Date.now()}`;
    const client = getSupabaseClient();

    const clubId = access.session.role === "ADMIN" ? null : access.clubId;
    if (access.session.role !== "ADMIN" && (!clubId || (body.clubId && body.clubId !== clubId))) return forbidden();
    let clubName = "";

    if (client) {
      if (clubId) {
        const { data: foundClub } = await client.from("clubs").select("id, name").eq("id", clubId).maybeSingle();
        if (foundClub) clubName = foundClub.name;
      }

      body.clubId = clubId;
      const { data, error } = await client.from("coaches").insert(toRow(body, id)).select("*").single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 409 });

      // If assigned to a club, update club coaches count & director name
      if (clubId) {
        await client.from("clubs").update({ director_name: body.fullName }).eq("id", clubId);
      }

      return NextResponse.json({ success: true, data: mapCoach(data, clubName) });
    }

    if (clubId) {
      const found = db.clubs.find((c) => c.id === clubId);
      if (found) clubName = found.name;
    }

    const coach: Coach = {
      id,
      userId: body.userId || "",
      fullName: body.fullName,
      licenseNumber: body.licenseNumber,
      specialty: body.specialty || "COMBAT_KYORUGI",
      clubId: clubId || "",
      clubName,
      athletesCount: Number(body.athletesCount) || 0,
      yearsOfExperience: Number(body.yearsOfExperience) || 0,
      certifications: body.certifications || [],
    };
    db.coaches.push(coach);

    if (clubId) {
      const club = db.clubs.find((c) => c.id === clubId);
      if (club) {
        club.directorName = body.fullName;
        club.coachId = id;
        club.coachName = body.fullName;
        club.coachesCount = Math.max(1, club.coachesCount);
      }
    }

    return NextResponse.json({ success: true, data: coach });
  } catch {
    return NextResponse.json({ success: false, error: "Error al registrar entrenador" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const access = await authorizeFeature(request, "coach-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    const client = getSupabaseClient();

    let clubId = access.session.role === "ADMIN" ? body.clubId || null : access.clubId;
    if (!clubId || (access.session.role !== "ADMIN" && body.clubId && body.clubId !== clubId)) return forbidden();
    let clubName = "";

    if (client) {
      const { data: existing, error: lookupError } = await client.from("coaches").select("id,club_id").eq("id", body.id).maybeSingle();
      if (lookupError) return NextResponse.json({ success: false, error: "No se pudo consultar el entrenador." }, { status: 503 });
      if (!existing) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });
      if (access.session.role !== "ADMIN" && existing.club_id !== access.clubId) return forbidden();
      if (clubId) {
        const { data: foundClub } = await client.from("clubs").select("id, name").eq("id", clubId).maybeSingle();
        if (foundClub) clubName = foundClub.name;
      }

      body.clubId = clubId;
      const { id, ...updates } = body;
      const { data, error } = await client.from("coaches").update(toRow(updates, id)).eq("id", id).select("*").single();
      if (error) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });

      if (clubId) {
        await client.from("clubs").update({ director_name: body.fullName }).eq("id", clubId);
      }

      return NextResponse.json({ success: true, data: mapCoach(data, clubName) });
    }

    const index = db.coaches.findIndex((coach) => coach.id === body.id);
    if (index === -1) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });
    if (access.session.role !== "ADMIN" && db.coaches[index].clubId !== access.clubId) return forbidden();

    if (clubId) {
      const found = db.clubs.find((c) => c.id === clubId);
      if (found) clubName = found.name;
    }

    db.coaches[index] = {
      ...db.coaches[index],
      ...body,
      clubId: clubId || "",
      clubName,
    };

    if (clubId) {
      const club = db.clubs.find((c) => c.id === clubId);
      if (club) {
        club.directorName = db.coaches[index].fullName;
        club.coachId = body.id;
        club.coachName = db.coaches[index].fullName;
      }
    }

    return NextResponse.json({ success: true, data: db.coaches[index] });
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar entrenador" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const access = await authorizeFeature(request, "coach-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
  const client = getSupabaseClient();
  if (client) {
    if (access.session.role !== "ADMIN") {
      const { data: existing, error: lookupError } = await client.from("coaches").select("id,club_id").eq("id", id).maybeSingle();
      if (lookupError) return NextResponse.json({ success: false, error: "No se pudo consultar el entrenador." }, { status: 503 });
      if (!existing) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });
      if (existing.club_id !== access.clubId) return forbidden();
    }
    const { data, error } = await client.from("coaches").delete().eq("id", id).select("*").single();
    if (error) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: mapCoach(data) });
  }
  const index = db.coaches.findIndex((coach) => coach.id === id);
  if (index === -1) return NextResponse.json({ success: false, error: "Entrenador no encontrado" }, { status: 404 });
  if (access.session.role !== "ADMIN" && db.coaches[index].clubId !== access.clubId) return forbidden();
  return NextResponse.json({ success: true, data: db.coaches.splice(index, 1)[0] });
}
