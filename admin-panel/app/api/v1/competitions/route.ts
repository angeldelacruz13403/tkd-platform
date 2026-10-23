import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { CompetitionMatch } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import {
  mapCompetitionRow,
  toCompetitionRow,
  isMissingMetadataColumn,
  advanceWinnerInBracket,
} from "@/lib/bracket-advancement";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { forbidden } from "@/lib/api-auth";

type AuthorizedFeature = Exclude<Awaited<ReturnType<typeof authorizeFeature>>, { response: Response }>;

async function getAccessibleIds(
  access: AuthorizedFeature,
  client: ReturnType<typeof getSupabaseClient>
) {
  if (access.session.role === "ADMIN") {
    return {
      athleteIds: null as Set<string> | null,
      tournamentIds: null as Set<string> | null,
      ownedTournamentIds: null as Set<string> | null,
    };
  }
  if (!client) {
    const athleteIds = new Set(db.athletes.filter((item) =>
      access.session.role === "ATHLETE" ? item.userId === access.session.id : item.clubId === access.clubId
    ).map((item) => item.id));
    const tournamentIds = new Set(
      db.competitions
        .filter((item) => athleteIds.has(item.athleteId) || athleteIds.has(item.opponentAthleteId || ""))
        .map((item) => item.tournamentId)
        .filter((id): id is string => Boolean(id))
    );
    return { athleteIds, tournamentIds, ownedTournamentIds: new Set<string>() };
  }

  let athleteQuery = client.from("athletes").select("id");
  if (access.session.role === "ATHLETE") athleteQuery = athleteQuery.eq("user_id", access.session.id);
  else athleteQuery = athleteQuery.eq("club_id", access.clubId || "__none__");
  const { data: athletes, error: athleteError } = await athleteQuery;
  if (athleteError) throw athleteError;
  const athleteIds = new Set((athletes || []).map((item) => item.id));
  const tournamentIds = new Set<string>();
  if (athleteIds.size > 0) {
    const { data: registrations, error: registrationError } = await client
      .from("competition_tournament_athletes")
      .select("tournament_id")
      .in("athlete_id", Array.from(athleteIds));
    if (registrationError) throw registrationError;
    (registrations || []).forEach((registration) => tournamentIds.add(registration.tournament_id));
  }
  const ownedTournamentIds = new Set<string>();
  if (access.session.role !== "ATHLETE") {
    const { data: clubTournaments, error: clubTournamentError } = await client
      .from("competition_tournaments")
      .select("id")
      .eq("club_id", access.clubId || "__none__");
    if (clubTournamentError) throw clubTournamentError;
    (clubTournaments || []).forEach((tournament) => {
      ownedTournamentIds.add(tournament.id);
      tournamentIds.add(tournament.id);
    });
  }
  return {
    athleteIds,
    tournamentIds,
    ownedTournamentIds,
  };
}

function canViewMatch(match: CompetitionMatch, athleteIds: Set<string> | null, tournamentIds: Set<string> | null) {
  if (!athleteIds || !tournamentIds) return true;
  return athleteIds.has(match.athleteId) ||
    athleteIds.has(match.opponentAthleteId || "") ||
    Boolean(match.tournamentId && tournamentIds.has(match.tournamentId));
}

function canManageMatch(
  match: CompetitionMatch,
  athleteIds: Set<string> | null,
  tournamentIds: Set<string> | null,
  ownedTournamentIds: Set<string> | null
) {
  if (!athleteIds || !tournamentIds) return true;
  const tournamentId = match.tournamentId || (match as CompetitionMatch & { tournament_id?: string }).tournament_id;
  return athleteIds.has(match.athleteId) ||
    Boolean(match.opponentAthleteId && athleteIds.has(match.opponentAthleteId)) ||
    Boolean(tournamentId && ownedTournamentIds?.has(tournamentId)) ||
    (!match.athleteId && Boolean(tournamentId && tournamentIds.has(tournamentId)));
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "competitions");
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  let allowedIds: Awaited<ReturnType<typeof getAccessibleIds>>;
  try {
    allowedIds = await getAccessibleIds(access, client);
  } catch (error) {
    console.error("[COMPETITIONS GET] No se pudo resolver el ámbito del usuario:", error);
    return NextResponse.json({ success: false, error: "No se pudo validar el ámbito de las competiciones." }, { status: 503 });
  }
  if (client) {
    const { data, error } = await client.from("competition_matches").select("*").order("date", { ascending: false });
    if (error) {
      return NextResponse.json({ success: false, error: `No se pudieron cargar los combates persistidos: ${error.message}` }, { status: 503 });
    }
    const matches = (data || []).map(mapCompetitionRow);
    db.competitions.splice(0, db.competitions.length, ...matches);
    const visible = matches.filter((match) => canViewMatch(match, allowedIds.athleteIds, allowedIds.tournamentIds));
    return NextResponse.json({ success: true, total: visible.length, data: visible });
  }
  const visible = db.competitions.filter((match) => canViewMatch(match, allowedIds.athleteIds, allowedIds.tournamentIds));
  return NextResponse.json({
    success: true,
    total: visible.length,
    data: visible,
  });
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFeature(request, "competitions");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
    const body = await request.json();
    const client = getSupabaseClient();
    const allowedIds = await getAccessibleIds(access, client);
    const isPlaceholder = Boolean(body.isPlaceholder);
    const isBye = Boolean(body.isBye);
    if (!body.tournamentName || !body.athleteName || !body.opponentName ||
      (!isPlaceholder && !isBye && (!body.athleteId || !body.opponentAthleteId)) ||
      (isBye && !body.athleteId)) {
      return NextResponse.json(
        { success: false, error: "El combate requiere torneo y fichas válidas para ambos participantes, o un slot pendiente explícito." },
        { status: 400 }
      );
    }
    const participantIds = [body.athleteId, body.opponentAthleteId].filter(Boolean).map(String);
    if (new Set(participantIds).size !== participantIds.length) {
      return NextResponse.json({ success: false, error: "Un competidor no puede ocupar ambas esquinas." }, { status: 400 });
    }
    if (access.session.role !== "ADMIN") {
      const tournamentId = String(body.tournamentId || "");
      const ownsTournament = Boolean(tournamentId && allowedIds.ownedTournamentIds?.has(tournamentId));
      const hasClubParticipant = participantIds.some((id) => allowedIds.athleteIds?.has(id));
      const hasExternalParticipant = participantIds.some((id) => !allowedIds.athleteIds?.has(id));
      if (!hasClubParticipant && !ownsTournament) return forbidden();
      if (hasExternalParticipant) {
        if (!ownsTournament || !client || participantIds.length === 0) return forbidden();
        const { data: registrations, error: registrationError } = await client
          .from("competition_tournament_athletes")
          .select("athlete_id")
          .eq("tournament_id", tournamentId)
          .in("athlete_id", participantIds);
        if (registrationError) {
          console.error("[COMPETITIONS POST] No se pudieron validar las inscripciones del torneo:", registrationError);
          return NextResponse.json({ success: false, error: "No se pudieron validar los inscritos del torneo." }, { status: 503 });
        }
        const registeredAthleteIds = new Set((registrations || []).map((registration) => registration.athlete_id));
        if (participantIds.some((id) => !registeredAthleteIds.has(id))) return forbidden();
      }
    }
    if (participantIds.length > 0) {
      if (client) {
        const { data: participants, error } = await client.from("athletes").select("id,is_competitor").in("id", participantIds);
        if (error) return NextResponse.json({ success: false, error: `No se pudieron validar las fichas de competidor: ${error.message}` }, { status: 503 });
        if ((participants || []).length !== participantIds.length || (participants || []).some((athlete: any) => !athlete.is_competitor)) {
          return NextResponse.json({ success: false, error: "Cada esquina debe corresponder a una ficha habilitada como competidor." }, { status: 400 });
        }
      } else if (participantIds.some((id) => !db.athletes.some((athlete) => athlete.id === id && athlete.isCompetitor))) {
        return NextResponse.json({ success: false, error: "Cada esquina debe corresponder a una ficha habilitada como competidor." }, { status: 400 });
      }
    }
    const newMatch = {
      ...body,
      id: String(body.id || `match-${randomUUID()}`).slice(0, 50),
      tournamentName: body.tournamentName,
      matchNumber: String(body.matchNumber || Date.now()),
      phase: body.phase || "PRELIMINARY",
      weightDivision: body.weightDivision || body.category || "",
      chongWtId: body.chongWtId || "",
      hongWtId: body.hongWtId || "",
      started: Boolean(body.started),
      lastUpdatedAt: new Date().toISOString(),
      date: new Date().toISOString(),
      category: body.category || "SENIOR_M_68",
      athleteId: body.athleteId || "",
      athleteName: body.athleteName,
      opponentAthleteId: body.opponentAthleteId || "",
      opponentName: body.opponentName,
      opponentCountryClub: body.opponentCountryClub || "",
      corner: body.corner || "CHONG",
      round1Score: body.round1Score || { athlete: 0, opponent: 0 },
      round2Score: body.round2Score || { athlete: 0, opponent: 0 },
      round3Score: body.round3Score,
      result: body.result || "WIN_POINTS",
      gamJeomsReceived: Number(body.gamJeomsReceived) || 0,
      pointsByTechnique: body.pointsByTechnique || {
        headKicks: 0,
        spinningHead: 0,
        bodyKicks: 0,
        spinningBody: 0,
        punches: 0,
      },
      staminaDropInRound3: Boolean(body.staminaDropInRound3),
      isPlaceholder,
      isBye,
      round: Number(body.round) || 0,
      tatamiNumber: Number(body.tatamiNumber) || 1,
      sourceMatchNumbers: Array.isArray(body.sourceMatchNumbers) ? body.sourceMatchNumbers.map(Number) : [],
    } as CompetitionMatch;

    if (client) {
      let tournamentId = body.tournamentId || null;
      if (!tournamentId && body.tournamentName) {
        const { data: tournament } = await client.from("competition_tournaments")
          .select("id")
          .eq("name", body.tournamentName)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        tournamentId = tournament?.id || null;
      }
      const isGeneratedBracketRecord = String(newMatch.id).startsWith("bracket-") || String(newMatch.id).startsWith("bye-");
      if (isGeneratedBracketRecord && tournamentId && newMatch.matchNumber) {
        const { error: duplicateError } = await client.from("competition_matches")
          .delete()
          .eq("tournament_id", tournamentId)
          .eq("match_number", String(newMatch.matchNumber))
          .neq("id", newMatch.id);
        if (duplicateError) {
          return NextResponse.json({ success: false, error: `No se pudieron sustituir números duplicados del bracket: ${duplicateError.message}` }, { status: 503 });
        }
      }
      const row = toCompetitionRow(newMatch, tournamentId);
      let { data, error } = await client.from("competition_matches")
        .upsert(row)
        .select("*")
        .single();
      if (error && isMissingMetadataColumn(error)) {
        const { match_metadata: _metadata, ...legacyRow } = row;
        const fallback = await client.from("competition_matches").upsert(legacyRow).select("*").single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) {
        return NextResponse.json({ success: false, error: `No se pudo persistir el combate. Comprueba competition_matches y match_metadata en Supabase: ${error.message}` }, { status: 503 });
      }
      const persistedMatch = mapCompetitionRow(data);
      db.competitions.unshift(persistedMatch);
      return NextResponse.json({ success: true, message: "Combate guardado correctamente", data: persistedMatch });
    }

    db.competitions.unshift(newMatch);

    return NextResponse.json({
      success: true,
      message: "Combate registrado satisfactoriamente",
      data: newMatch,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al registrar combate" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const access = await authorizeFeature(request, "competitions");
    if (isAuthorizationResponse(access)) return access.response;
    if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const index = db.competitions.findIndex((match) => match.id === id);
    let existing = index >= 0 ? db.competitions[index] : undefined;
    if (client && !existing) {
      const { data, error } = await client.from("competition_matches").select("*").eq("id", id).maybeSingle();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      if (data) existing = mapCompetitionRow(data);
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: "Combate no encontrado" }, { status: 404 });
    }
    const allowedIds = await getAccessibleIds(access, client);
    if (access.session.role !== "ADMIN" && !canManageMatch(existing, allowedIds.athleteIds, allowedIds.tournamentIds, allowedIds.ownedTournamentIds)) return forbidden();

    const updatedMatch = {
      ...existing,
      ...updates,
      lastUpdatedAt: new Date().toISOString(),
      gamJeomsReceived: updates.gamJeomsReceived !== undefined ? Number(updates.gamJeomsReceived) : existing.gamJeomsReceived,
      round1Score: updates.round1Score || existing.round1Score,
      round2Score: updates.round2Score || existing.round2Score,
      round3Score: updates.round3Score !== undefined ? updates.round3Score : existing.round3Score,
      pointsByTechnique: updates.pointsByTechnique || existing.pointsByTechnique,
    };

    const participantIds = [updatedMatch.athleteId, updatedMatch.opponentAthleteId].filter(Boolean).map(String);
    if (!updatedMatch.isPlaceholder && !updatedMatch.isBye && participantIds.length !== 2) {
      return NextResponse.json({ success: false, error: "El combate requiere dos fichas de competidor." }, { status: 400 });
    }
    if (new Set(participantIds).size !== participantIds.length) {
      return NextResponse.json({ success: false, error: "Un competidor no puede ocupar ambas esquinas." }, { status: 400 });
    }
    if (participantIds.length > 0) {
      if (client) {
        const { data: participants, error } = await client.from("athletes").select("id,is_competitor").in("id", participantIds);
        if (error) return NextResponse.json({ success: false, error: `No se pudieron validar las fichas de competidor: ${error.message}` }, { status: 503 });
        if ((participants || []).length !== participantIds.length || (participants || []).some((athlete: any) => !athlete.is_competitor)) {
          return NextResponse.json({ success: false, error: "Cada esquina debe corresponder a una ficha habilitada como competidor." }, { status: 400 });
        }
      } else if (participantIds.some((athleteId) => !db.athletes.some((athlete) => athlete.id === athleteId && athlete.isCompetitor))) {
        return NextResponse.json({ success: false, error: "Cada esquina debe corresponder a una ficha habilitada como competidor." }, { status: 400 });
      }
    }

    let resultMatch = updatedMatch as CompetitionMatch;
    if (client) {
      const tournamentId = (existing as any).tournamentId || (existing as any).tournament_id || null;
      const row = toCompetitionRow(resultMatch, tournamentId);
      let { data, error } = await client.from("competition_matches")
        .upsert(row)
        .select("*")
        .single();
      if (error && isMissingMetadataColumn(error)) {
        const { match_metadata: _metadata, ...legacyRow } = row;
        const fallback = await client.from("competition_matches").upsert(legacyRow).select("*").single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      resultMatch = mapCompetitionRow(data);
    }

    if (index >= 0) db.competitions[index] = resultMatch;
    else db.competitions.unshift(resultMatch);

    const advancement = await advanceWinnerInBracket(client, resultMatch);

    return NextResponse.json({
      success: true,
      message: advancement.error
        ? `Combate actualizado, pero no se pudieron avanzar todos los ganadores: ${advancement.error}`
        : "Combate actualizado correctamente",
      data: resultMatch,
      advancedMatches: advancement.matches,
      advancementError: advancement.error || undefined,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar combate" }, { status: 400 });
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
    const index = db.competitions.findIndex((match) => match.id === id);
    let deleted = index >= 0 ? db.competitions[index] : undefined;
    if (client) {
      const { data: row, error: lookupError } = await client.from("competition_matches").select("*").eq("id", id).maybeSingle();
      if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 503 });
      if (!row) return NextResponse.json({ success: false, error: "Combate no encontrado" }, { status: 404 });
      deleted = mapCompetitionRow(row);
      const allowedIds = await getAccessibleIds(access, client);
      if (access.session.role !== "ADMIN" && !canManageMatch(deleted, allowedIds.athleteIds, allowedIds.tournamentIds, allowedIds.ownedTournamentIds)) return forbidden();
      const { data, error } = await client.from("competition_matches").delete().eq("id", id).select("*").maybeSingle();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      if (!data) return NextResponse.json({ success: false, error: "Combate no encontrado" }, { status: 404 });
      deleted = mapCompetitionRow(data);
    }
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Combate no encontrado" }, { status: 404 });
    }
    if (!client) {
      const allowedIds = await getAccessibleIds(access, client);
      if (access.session.role !== "ADMIN" && !canManageMatch(deleted, allowedIds.athleteIds, allowedIds.tournamentIds, allowedIds.ownedTournamentIds)) return forbidden();
    }

    if (index >= 0) db.competitions.splice(index, 1);
    return NextResponse.json({
      success: true,
      message: "Combate eliminado correctamente",
      data: deleted,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar combate" }, { status: 400 });
  }
}
