import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "@/lib/supabase";
import { getMissingSupabaseTableMessage, isMissingSupabaseTable } from "@/lib/supabase-errors";
import { getDefaultWeightKg, getOfficialAthleteCategoryForDivision, getTournamentWeightCategories } from "@/lib/tournament-categories";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tournamentId, athleteName, clubName, category, weightKg, email, phone, dni } = body;
    const requestedCategory = String(category || "");

    if (!tournamentId || !athleteName) {
      return NextResponse.json(
        { success: false, error: "El identificador del torneo y el nombre del atleta son obligatorios." },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const athleteId = `ath-reg-${randomUUID()}`;
    const newAthleteRecord = {
      id: athleteId,
      athleteId,
      name: athleteName.trim(),
      fullName: athleteName.trim(),
      club: clubName ? clubName.trim() : "Club Independiente",
      category: requestedCategory,
      tournamentCategory: requestedCategory,
      weightKg: Number(weightKg) || getDefaultWeightKg(requestedCategory),
      email: email || "",
      phone: phone || "",
      dni: dni || "",
      registeredAt: new Date().toISOString(),
    };

    if (client) {
      // 1. Obtener el torneo existente
      const { data: tournament, error: fetchErr } = await client
        .from("competition_tournaments")
        .select("*")
        .eq("id", tournamentId)
        .maybeSingle();

      if (fetchErr || !tournament) {
        return NextResponse.json({ success: false, error: "Torneo no encontrado." }, { status: 404 });
      }

      const categoryOption = getTournamentWeightCategories(tournament.category).find((option) => option.value === requestedCategory);
      if (!categoryOption) {
        return NextResponse.json({ success: false, error: "La división seleccionada no está habilitada para este torneo." }, { status: 400 });
      }
      const measuredWeight = Number(weightKg) || categoryOption.defaultWeightKg;
      const athleteCategory = getOfficialAthleteCategoryForDivision(tournament.category, categoryOption.value, measuredWeight);
      if (!athleteCategory) {
        return NextResponse.json({ success: false, error: "El peso indicado supera el límite de la división seleccionada." }, { status: 400 });
      }
      newAthleteRecord.category = athleteCategory;
      newAthleteRecord.tournamentCategory = categoryOption.value;

      const currentList = Array.isArray(tournament.registered_athletes) ? tournament.registered_athletes : [];
      const normalizedName = athleteName.trim().toLocaleLowerCase();
      const normalizedEmail = String(email || "").trim().toLocaleLowerCase();
      const normalizedDni = String(dni || "").trim().toLocaleLowerCase();
      const normalizedClub = String(clubName || "").trim().toLocaleLowerCase();
      const normalizedCategory = categoryOption.value.trim().toLocaleLowerCase();
      const duplicate = currentList.some((registered: any) =>
        (normalizedDni && String(registered.dni || "").trim().toLocaleLowerCase() === normalizedDni) ||
        (normalizedEmail && String(registered.email || "").trim().toLocaleLowerCase() === normalizedEmail) ||
        (!normalizedDni && !normalizedEmail &&
          String(registered.name || registered.athleteName || "").trim().toLocaleLowerCase() === normalizedName &&
          String(registered.club || registered.clubName || "").trim().toLocaleLowerCase() === normalizedClub &&
          String(registered.tournamentCategory || registered.category || "").trim().toLocaleLowerCase() === normalizedCategory)
      );
      if (duplicate) {
        return NextResponse.json({ success: false, error: "Este atleta ya está inscrito en el torneo." }, { status: 409 });
      }

      const { data: clubs } = await client.from("clubs").select("id,name");
      const matchingClub = (clubs || []).find((club: any) => String(club.name || "").trim().toLocaleLowerCase() === normalizedClub);
      const categoryValue = athleteCategory;
      const { error: athleteInsertError } = await client.from("athletes").insert({
        id: athleteId,
        name: athleteName.trim(),
        is_competitor: true,
        gender: categoryValue.includes("_F_") ? "F" : "M",
        wt_category: categoryValue,
        belt: "Red",
        club_id: matchingClub?.id || null,
        weight: measuredWeight,
        height: 0,
      });
      if (athleteInsertError) {
        return NextResponse.json({ success: false, error: `No se pudo guardar la ficha del atleta: ${athleteInsertError.message}` }, { status: 500 });
      }

      const { error: linkError } = await client.from("competition_tournament_athletes").insert({
        tournament_id: tournamentId,
        athlete_id: athleteId,
        club_id: matchingClub?.id || null,
      });
      if (linkError) {
        const { error: athleteRollbackError } = await client.from("athletes").delete().eq("id", athleteId);
        if (athleteRollbackError) console.error("[TOURNAMENT REGISTER] No se pudo revertir la ficha tras fallar la inscripción:", athleteRollbackError);
        const missingTable = isMissingSupabaseTable(linkError, "competition_tournament_athletes");
        return NextResponse.json({
          success: false,
          error: missingTable
            ? getMissingSupabaseTableMessage("competition_tournament_athletes")
            : `No se pudo enlazar la inscripción: ${linkError.message}`,
        }, { status: missingTable ? 503 : 500 });
      }

      const updatedList = [...currentList, newAthleteRecord];

      // 2. Actualizar lista de inscritos
      const { data: updatedTournament, error: updateErr } = await client
        .from("competition_tournaments")
        .update({ registered_athletes: updatedList })
        .eq("id", tournamentId)
        .select("*")
        .single();

      if (updateErr) {
        const { error: registrationRollbackError } = await client.from("competition_tournament_athletes").delete().eq("tournament_id", tournamentId).eq("athlete_id", athleteId);
        if (registrationRollbackError) console.error("[TOURNAMENT REGISTER] No se pudo revertir la inscripción:", registrationRollbackError);
        const { error: athleteRollbackError } = await client.from("athletes").delete().eq("id", athleteId);
        if (athleteRollbackError) console.error("[TOURNAMENT REGISTER] No se pudo revertir la ficha:", athleteRollbackError);
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Inscripción completada exitosamente.",
        athlete: newAthleteRecord,
        tournament: updatedTournament,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Inscripción simulada completada exitosamente.",
      athlete: newAthleteRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar inscripción." },
      { status: 500 }
    );
  }
}
