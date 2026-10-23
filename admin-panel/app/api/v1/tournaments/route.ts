import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getMissingSupabaseTableMessage, isMissingSupabaseTable } from "@/lib/supabase-errors";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { forbidden } from "@/lib/api-auth";

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "competitions");
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (client) {
    let tournamentIds: string[] | null = null;
    if (access.session.role === "ATHLETE") {
      const { data: athlete, error: athleteError } = await client.from("athletes").select("id").eq("user_id", access.session.id).maybeSingle();
      if (athleteError) return NextResponse.json({ success: false, error: "No se pudo resolver el atleta." }, { status: 503 });
      if (!athlete) return NextResponse.json({ success: true, total: 0, data: [] });
      const { data: registrations, error: registrationError } = await client
        .from("competition_tournament_athletes").select("tournament_id").eq("athlete_id", athlete.id);
      if (registrationError) {
        const error = isMissingSupabaseTable(registrationError, "competition_tournament_athletes")
          ? getMissingSupabaseTableMessage("competition_tournament_athletes")
          : "No se pudieron cargar los torneos del atleta.";
        return NextResponse.json({ success: false, error }, { status: 503 });
      }
      tournamentIds = (registrations || []).map((item) => item.tournament_id);
      if (!tournamentIds.length) return NextResponse.json({ success: true, total: 0, data: [] });
    } else if (access.session.role !== "ADMIN") {
      const { data: registrations, error: registrationError } = await client
        .from("competition_tournament_athletes").select("tournament_id").eq("club_id", access.clubId || "__none__");
      if (registrationError) {
        const error = isMissingSupabaseTable(registrationError, "competition_tournament_athletes")
          ? getMissingSupabaseTableMessage("competition_tournament_athletes")
          : "No se pudieron cargar los torneos del club.";
        return NextResponse.json({ success: false, error }, { status: 503 });
      }
      const { data: clubTournaments, error: clubTournamentError } = await client
        .from("competition_tournaments").select("id").eq("club_id", access.clubId || "__none__");
      if (clubTournamentError) return NextResponse.json({ success: false, error: "No se pudieron cargar los torneos del club." }, { status: 503 });
      tournamentIds = Array.from(new Set([
        ...(registrations || []).map((item) => item.tournament_id),
        ...(clubTournaments || []).map((item) => item.id),
      ]));
      if (!tournamentIds.length) return NextResponse.json({ success: true, total: 0, data: [] });
    }
    let query = client.from("competition_tournaments").select("*").order("date", { ascending: false });
    if (tournamentIds) query = query.in("id", tournamentIds);
    const { data, error } = await query;
    if (error) {
      const missingTable = isMissingSupabaseTable(error, "competition_tournaments");
      return NextResponse.json({
        success: false,
        error: missingTable
          ? getMissingSupabaseTableMessage("competition_tournaments")
          : error.message,
      }, { status: 500 });
    }
    return NextResponse.json({ success: true, total: data.length, data });
  }
  return NextResponse.json({ success: false, error: "No hay conexión con la base de datos; no se pueden cargar torneos guardados." }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFeature(request, "competitions");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ success: false, error: "El torneo necesita al menos un nombre para crearse." }, { status: 400 });
    }
    const registeredAthletes = Array.isArray(body.registeredAthletes) ? body.registeredAthletes : [];
    const tatamiNumber = Number(body.tatamiNumber) || 1;
    if (!Number.isInteger(tatamiNumber) || tatamiNumber < 1 || tatamiNumber > 8) {
      return NextResponse.json({ success: false, error: "El tatami debe ser un número entre 1 y 8." }, { status: 400 });
    }
    const tournament = {
      id: String(body.id || `tournament-${Date.now()}`).slice(0, 50),
      name: body.name,
      date: body.date || null,
      venue: body.venue || "",
      category: body.category || "",
      tatami_number: tatamiNumber,
      club_id: access.session.role === "ADMIN" ? body.clubId || null : access.clubId,
      registered_athletes: registeredAthletes,
    };
    const client = getSupabaseClient();
    if (client) {
      if (registeredAthletes.some((athlete: any) => !athlete?.id)) {
        return NextResponse.json({ success: false, error: "Cada inscripción debe corresponder a un atleta registrado." }, { status: 400 });
      }
      const { error: registrationTableError } = await client
        .from("competition_tournament_athletes").select("tournament_id").limit(0);
      if (registrationTableError) {
        const missingTable = isMissingSupabaseTable(registrationTableError, "competition_tournament_athletes");
        return NextResponse.json({
            success: false,
            error: missingTable
              ? getMissingSupabaseTableMessage("competition_tournament_athletes")
              : `No se pudo comprobar la tabla de inscripciones: ${registrationTableError.message}`,
        }, { status: 503 });
      }
      const { data, error } = await client.from("competition_tournaments").insert(tournament).select("*").single();
      if (error) {
        const missingTable = isMissingSupabaseTable(error, "competition_tournaments");
        return NextResponse.json({
            success: false,
            error: missingTable
              ? getMissingSupabaseTableMessage("competition_tournaments")
            : error.message,
        }, { status: missingTable ? 500 : 409 });
      }
      const registrations = registeredAthletes
        .filter((athlete: any) => athlete?.id)
        .map((athlete: any) => String(athlete.id));
      if (new Set(registrations).size !== registrations.length) {
        await client.from("competition_tournaments").delete().eq("id", tournament.id);
        return NextResponse.json({ success: false, error: "No se puede inscribir dos veces al mismo atleta." }, { status: 400 });
      }
      if (registrations.length > 0) {
        let athleteQuery = client.from("athletes").select("id,club_id").in("id", registrations);
        if (access.session.role !== "ADMIN") athleteQuery = athleteQuery.eq("club_id", access.clubId || "__none__");
        const { data: athletes, error: athleteLookupError } = await athleteQuery;
        if (athleteLookupError) {
          await client.from("competition_tournaments").delete().eq("id", tournament.id);
          return NextResponse.json({ success: false, error: `No se pudieron validar los inscritos: ${athleteLookupError.message}` }, { status: 500 });
        }
        if ((athletes || []).length !== registrations.length) {
          await client.from("competition_tournaments").delete().eq("id", tournament.id);
          return forbidden();
        }
        const registrationRows = (athletes || []).map((athlete: any) => ({
          tournament_id: tournament.id,
          athlete_id: athlete.id,
          club_id: athlete.club_id || null,
        }));
        if (registrationRows.length > 0) {
          const { error: registrationError } = await client.from("competition_tournament_athletes").insert(registrationRows);
          if (registrationError) {
            const { error: rollbackError } = await client.from("competition_tournaments").delete().eq("id", tournament.id);
            if (rollbackError) console.error("[TOURNAMENT POST] No se pudo revertir el torneo tras fallar la inscripción:", rollbackError);
            const missingTable = isMissingSupabaseTable(registrationError, "competition_tournament_athletes");
            return NextResponse.json({
              success: false,
              error: missingTable
                ? getMissingSupabaseTableMessage("competition_tournament_athletes")
                : `No se pudieron guardar los inscritos: ${registrationError.message}`,
            }, { status: 503 });
          }
        }
      }
      return NextResponse.json({ success: true, data });
    }
    return NextResponse.json({ success: false, error: "No hay conexión con la base de datos; el torneo no se guardó y no se puede crear un enlace de inscripción." }, { status: 503 });
  } catch {
    return NextResponse.json({ success: false, error: "Error al crear competición" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await authorizeFeature(request, "competitions");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, error: "No hay conexión con la base de datos; no se puede eliminar el torneo." }, { status: 503 });
    }
    if (client) {
      const { data: tournament, error: tournamentLookupError } = await client
        .from("competition_tournaments").select("club_id").eq("id", id).maybeSingle();
      if (tournamentLookupError) return NextResponse.json({ success: false, error: "No se pudo validar el ámbito del torneo." }, { status: 503 });
      if (!tournament) return NextResponse.json({ success: false, error: "Torneo no encontrado." }, { status: 404 });
      const { data: registrations, error: registrationLookupError } = await client
        .from("competition_tournament_athletes").select("club_id").eq("tournament_id", id);
      if (registrationLookupError) return NextResponse.json({ success: false, error: "No se pudo validar el ámbito del torneo." }, { status: 503 });
      if (access.session.role !== "ADMIN" &&
        ((tournament.club_id && tournament.club_id !== access.clubId) ||
          (!tournament.club_id && !registrations?.length) ||
          registrations?.some((item) => item.club_id !== access.clubId))) return forbidden();
      const { error: matchError } = await client.from("competition_matches").delete().eq("tournament_id", id);
      if (matchError && matchError.code !== "PGRST205" && matchError.code !== "42P01") {
        return NextResponse.json({ success: false, error: `No se pudo eliminar el bracket: ${matchError.message}` }, { status: 500 });
      }
      const { error: registrationError } = await client.from("competition_tournament_athletes").delete().eq("tournament_id", id);
      if (registrationError && registrationError.code !== "PGRST205" && registrationError.code !== "42P01") {
        return NextResponse.json({ success: false, error: `No se pudieron eliminar las inscripciones: ${registrationError.message}` }, { status: 500 });
      }
      const { error } = await client.from("competition_tournaments").delete().eq("id", id);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: "Torneo eliminado correctamente" });
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar torneo" }, { status: 400 });
  }
}
