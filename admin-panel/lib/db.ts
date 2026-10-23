import {
  User,
  Athlete,
  Coach,
  Club,
  TrainingSession,
  CompetitionMatch,
  AIKnowledgeItem,
  AIRetrainMetrics,
  AthleteLiveTelemetry,
  AthleteAchievement,
  ClubClass,
  ClubSubscription,
  ClassTrainingSession,
  CoachSharedVideo,
  GamificationAchievement,
  GamificationLevel,
  GuardianConsent,
} from "./types";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

// Caché en memoria para módulos existentes; la gestión del club lee y escribe directamente en Supabase.
export class DatabaseStore {
  // Base de datos local limpia. No hay usuarios ni atletas precargados.
  users: User[] = [];
  clubs: Club[] = [];
  coaches: Coach[] = [];
  athletes: Athlete[] = [];
  trainings: TrainingSession[] = [];
  competitions: CompetitionMatch[] = [];
  knowledgeBase: AIKnowledgeItem[] = [];
  liveTelemetry: Map<string, AthleteLiveTelemetry> = new Map();
  clubClasses: ClubClass[] = [];
  classTrainingSessions: ClassTrainingSession[] = [];
  clubSubscriptions: Map<string, ClubSubscription> = new Map();
  coachSharedVideos: CoachSharedVideo[] = [];
  gamificationAchievements: GamificationAchievement[] = [];
  gamificationLevels: GamificationLevel[] = [];
  athleteAchievements: AthleteAchievement[] = [];
  enabledGamificationAthleteIds: Set<string> = new Set();
  guardianConsents: GuardianConsent[] = [];

  retrainMetrics: AIRetrainMetrics = {
    modelVersion: "v1.0-empty",
    trainedAt: new Date().toISOString(),
    datasetSizeRecords: 0,
    heartRateSessionsAnalyzed: 0,
    combatRoundsProcessed: 0,
    fatiguePredictionAccuracy: 0,
    tacticalRecommendationF1: 0,
    learnedWeights: {
      cardioVolumeTolerance: 1.0,
      anaerobicRecoveryRate: 1.0,
      gamJeomRiskWeight: 1.0,
      round3FatigueDecayFactor: 1.0,
    },
    changelog: "Sistema iniciado. Sin datos de entrenamiento aún. Añade atletas y sesiones desde el panel web.",
  };

  /**
   * Comprueba si Supabase está activo y configurado
   */
  isSupabaseActive(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * Sincroniza datos desde Supabase si las credenciales están presentes
   */
  async syncWithSupabase(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      // 1. Sincronizar Atletas
      const { data: athletesData } = await client.from("athletes").select("*");
      if (athletesData && athletesData.length > 0) {
        athletesData.forEach((row: any) => {
          const existingIdx = this.athletes.findIndex((a) => a.id === row.id);
          const mapped: Athlete = {
            id: row.id,
            userId: row.user_id || "",
            fullName: row.name,
            dateOfBirth: row.date_of_birth || undefined,
            isCompetitor: Boolean(row.is_competitor),
            category: (row.wt_category as any) || "SENIOR_M_68",
            beltRank: (row.belt as any) || "1st_Dan",
            clubId: row.club_id || "",
            clubName: row.club_name || "Club sin asignar",
            coachId: row.coach_id || "",
            coachName: row.coach_name || "Entrenador sin asignar",
            weightKg: Number(row.weight) || 0,
            heightCm: Number(row.height) || 0,
            maxHeartRateBpm: Number(row.max_bpm) || 200,
            restingHeartRateBpm: Number(row.rest_bpm) || 50,
            vo2MaxEstimate: Number(row.vo2max) || 0,
            readinessScore: Number(row.readiness_score) || 90,
            injuryStatus: (row.injury_status as any) || "FIT",
            stats: {
              matchesPlayed: (Number(row.wins) || 0) + (Number(row.losses) || 0),
              matchesWon: Number(row.wins) || 0,
              koTkoCount: Number(row.ko_tko_count) || 0,
              gamJeomAvg: Number(row.gamjeom_avg) || 0,
              favouriteTechnique: row.favourite_kick || "Bandal Chagui",
            },
          };
          if (existingIdx >= 0) {
            this.athletes[existingIdx] = mapped;
          } else {
            this.athletes.push(mapped);
          }
        });
      }

      // 2. Sincronizar Sesiones de Entrenamiento
      const { data: trainingData } = await client
        .from("training_sessions")
        .select("*")
        .order("date", { ascending: false });
      if (trainingData && trainingData.length > 0) {
        trainingData.forEach((row: any) => {
          if (!this.trainings.some((t) => t.id === row.id)) {
            const athlete = this.athletes.find((a) => a.id === row.athlete_id) || this.athletes[0];
            // Map session_type from DB to frontend type alias
            const sessionType = (row.session_type === "SPARRING_DAEDO" ? "SPARRING_TACTICAL"
              : row.session_type === "TECHNICAL_POOMSAE" ? "POOMSAE_TECHNICAL"
              : row.session_type === "RECOVERY_AEROBIC" ? "HIGH_INTENSITY_INTERVALS"
              : row.session_type) as TrainingSession["type"];
            this.trainings.unshift({
              id: row.id,
              title: row.title || "Sesión sincronizada",
              athleteId: row.athlete_id,
              athleteName: athlete?.fullName || "",
              coachId: row.coach_id || "",
              date: row.date || "",
              durationMinutes: Number(row.duration_minutes) || 0,
              type: sessionType || "SPARRING_TACTICAL",
              rpeScore: Number(row.rpe_score) || 0,
              avgHeartRateBpm: Number(row.avg_bpm) || 0,
              maxHeartRateBpm: Number(row.max_bpm) || 0,
              heartRateRecovery1Min: Number(row.hrr_1_min) || 0,
              trimpScore: Number(row.trimp_score) || 0,
              heartRateZones: {
                zone1RecoveryMin: Number(row.zone1_minutes) || 0,
                zone2AerobicMin: Number(row.zone2_minutes) || 0,
                zone3TempoMin: Number(row.zone3_minutes) || 0,
                zone4ThresholdMin: Number(row.zone4_minutes) || 0,
                zone5AnaerobicMin: Number(row.zone5_minutes) || 0,
              },
              aiFeedback: row.tactical_notes || "",
              bpmSeries: Array.isArray(row.bpm_series) ? row.bpm_series : undefined,
              status: (row.status as any) || "COMPLETED",
            });
          }
        });
      }
    } catch (error) {
      console.warn("Aviso: No se pudo conectar a Supabase, utilizando base reactiva local:", error);
    }
  }

  /**
   * Persiste un entrenamiento en Supabase si está disponible
   */
  async persistTraining(session: TrainingSession): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      // Map frontend type alias back to DB enum value
      const dbSessionType =
        session.type === "SPARRING_TACTICAL" ? "SPARRING_DAEDO"
        : session.type === "HIGH_INTENSITY_INTERVALS" ? "INTERVALS_HIGH_LOAD"
        : session.type === "POOMSAE_TECHNICAL" ? "TECHNICAL_POOMSAE"
        : session.type === "INTERVALS_HIGH_LOAD" ? "INTERVALS_HIGH_LOAD"
        : "SPARRING_DAEDO";

      const hasBlockData = Boolean(session.blocks?.length || session.blockMetrics?.length);
      const sessionNotes = session.aiFeedback || "";
      const persistedNotes = hasBlockData
        ? JSON.stringify({
            __tkdTrainingMetadata: true,
            tactical_notes: sessionNotes,
            blocks: session.blocks || [],
            blockMetrics: session.blockMetrics || [],
          })
        : sessionNotes;
      const sessionRow = {
        id: session.id,
        athlete_id: session.athleteId,
        coach_id: session.coachId || null,
        title: session.title || "Sesión de Entrenamiento",
        date: session.date,
        session_type: dbSessionType,
        duration_minutes: session.durationMinutes,
        avg_bpm: session.avgHeartRateBpm,
        max_bpm: session.maxHeartRateBpm,
        trimp_score: session.trimpScore,
        hrr_1_min: session.heartRateRecovery1Min,
        rpe_score: session.rpeScore || 0,
        zone1_minutes: session.heartRateZones.zone1RecoveryMin,
        zone2_minutes: session.heartRateZones.zone2AerobicMin,
        zone3_minutes: session.heartRateZones.zone3TempoMin,
        zone4_minutes: session.heartRateZones.zone4ThresholdMin,
        zone5_minutes: session.heartRateZones.zone5AnaerobicMin,
        tactical_notes: persistedNotes,
        status: session.status || "COMPLETED",
        bpm_series: session.bpmSeries ? JSON.stringify(session.bpmSeries) : "[]",
      };
      const { error } = await client.from("training_sessions").upsert(sessionRow);
      if (!error) return;

      const missingColumn = error.code === "42703" || error.code === "PGRST204";
      if (!missingColumn) throw error;

      const legacyNotes = JSON.stringify({
        __tkdTrainingMetadata: true,
        title: sessionRow.title,
        hrr_1_min: sessionRow.hrr_1_min,
        rpe_score: sessionRow.rpe_score,
        status: sessionRow.status,
        bpm_series: sessionRow.bpm_series,
        tactical_notes: sessionNotes,
        blocks: session.blocks || [],
        blockMetrics: session.blockMetrics || [],
      });
      const { error: legacyError } = await client.from("training_sessions").upsert({
        id: sessionRow.id,
        athlete_id: sessionRow.athlete_id,
        coach_id: sessionRow.coach_id,
        date: sessionRow.date,
        session_type: sessionRow.session_type,
        duration_minutes: sessionRow.duration_minutes,
        avg_bpm: sessionRow.avg_bpm,
        max_bpm: sessionRow.max_bpm,
        trimp_score: sessionRow.trimp_score,
        zone1_minutes: sessionRow.zone1_minutes,
        zone2_minutes: sessionRow.zone2_minutes,
        zone3_minutes: sessionRow.zone3_minutes,
        zone4_minutes: sessionRow.zone4_minutes,
        zone5_minutes: sessionRow.zone5_minutes,
        tactical_notes: legacyNotes,
      });
      if (legacyError) throw legacyError;
    } catch (e) {
      console.warn("Aviso: Error al persistir sesión en Supabase:", e);
      throw e;
    }
  }

  /**
   * Actualiza la telemetría en tiempo real recibida desde la app móvil del atleta (PPM en vivo)
   */
  async updateLiveTelemetry(payload: Partial<AthleteLiveTelemetry> & { athleteId: string; currentBpm: number }): Promise<AthleteLiveTelemetry> {
    const athlete = this.athletes.find((a) => a.id === payload.athleteId);
    const existing = this.liveTelemetry.get(payload.athleteId);

    const maxBpm = Number(payload.maxHeartRateBpm || athlete?.maxHeartRateBpm || existing?.maxHeartRateBpm || 200);
    const bpm = Number(payload.currentBpm || 0);

    // Determinar zona fisiológica automáticamente si no viene dada
    let zone: "Z1" | "Z2" | "Z3" | "Z4" | "Z5" = payload.zone || "Z1";
    let zoneName = payload.zoneName || "Recuperación";
    let zoneColor = payload.zoneColor || "#38bdf8";

    if (!payload.zone && maxBpm > 0 && bpm > 0) {
      const pct = Math.round((bpm / maxBpm) * 100);
      if (pct < 60) {
        zone = "Z1";
        zoneName = "Recuperación";
        zoneColor = "#38bdf8";
      } else if (pct < 70) {
        zone = "Z2";
        zoneName = "Aeróbico Ligero";
        zoneColor = "#34d399";
      } else if (pct < 80) {
        zone = "Z3";
        zoneName = "Tempo / Resistencia";
        zoneColor = "#fbbf24";
      } else if (pct < 90) {
        zone = "Z4";
        zoneName = "Umbral Anaeróbico";
        zoneColor = "#fb923c";
      } else {
        zone = "Z5";
        zoneName = "Anaeróbico Láctico (Asalto 3)";
        zoneColor = "#f43f5e";
      }
    }

    const updated: AthleteLiveTelemetry = {
      athleteId: payload.athleteId,
      athleteName: payload.athleteName || athlete?.fullName || existing?.athleteName || "Atleta",
      category: payload.category || athlete?.category || existing?.category,
      beltRank: payload.beltRank || athlete?.beltRank || existing?.beltRank,
      clubId: payload.clubId || athlete?.clubId || existing?.clubId,
      coachId: payload.coachId || athlete?.coachId || existing?.coachId,
      currentBpm: bpm,
      maxHeartRateBpm: maxBpm,
      restingHeartRateBpm: payload.restingHeartRateBpm || athlete?.restingHeartRateBpm || existing?.restingHeartRateBpm || 50,
      zone,
      zoneName,
      zoneColor,
      trimpScore: Number(payload.trimpScore ?? existing?.trimpScore ?? 0),
      sessionDurationSec: Number(payload.sessionDurationSec ?? existing?.sessionDurationSec ?? 0),
      trainingMode: payload.trainingMode || existing?.trainingMode || "combate",
      isTrainingRunning: Boolean(payload.isTrainingRunning ?? existing?.isTrainingRunning ?? false),
      blockTelemetry: payload.blockTelemetry,
      batteryLevel: payload.batteryLevel !== undefined ? payload.batteryLevel : (existing?.batteryLevel ?? null),
      lastUpdatedAt: new Date().toISOString(),
      status: payload.isTrainingRunning === false ? "PAUSED" : bpm > 0 ? "LIVE" : "PAUSED",
    };

    this.liveTelemetry.set(payload.athleteId, updated);

    // Persistencia opcional en Supabase si está activo
    const client = getSupabaseClient();
    if (client) {
      try {
        // Asegurar que existe la fila de atleta para evitar violación de FK
        const { data: existingAthlete } = await client
          .from("athletes")
          .select("id")
          .eq("id", updated.athleteId)
          .maybeSingle();

        if (!existingAthlete) {
          // Crear fila mínima de atleta para que la FK de telemetría no falle
          // Nota: gender, weight, height son NOT NULL en la tabla athletes
          const { error: insertAthleteErr } = await client.from("athletes").upsert({
            id: updated.athleteId,
            name: updated.athleteName || "Atleta TKD",
            gender: "M",
            wt_category: updated.category || "SENIOR_M_68",
            belt: updated.beltRank || "1st_Dan",
            club_id: updated.clubId || null,
            coach_id: updated.coachId || null,
            weight: 68,
            height: 175,
            max_bpm: updated.maxHeartRateBpm || 200,
            rest_bpm: updated.restingHeartRateBpm || 50,
          }, { onConflict: "id", ignoreDuplicates: true });
          if (insertAthleteErr) {
            console.warn("[DB] No se pudo auto-crear atleta mínimo en Supabase:", insertAthleteErr.message);
          }
        }

        const { error } = await client.from("athlete_live_telemetry").upsert({
          athlete_id: updated.athleteId,
          athlete_name: updated.athleteName,
          category: updated.category,
          belt_rank: updated.beltRank,
          club_id: updated.clubId,
          coach_id: updated.coachId,
          current_bpm: updated.currentBpm,
          max_bpm: updated.maxHeartRateBpm,
          resting_bpm: updated.restingHeartRateBpm,
          zone: updated.zone,
          zone_name: updated.zoneName,
          zone_color: updated.zoneColor,
          trimp_score: updated.trimpScore,
          session_duration_sec: updated.sessionDurationSec,
          training_mode: updated.trainingMode,
          is_running: updated.isTrainingRunning,
          battery_level: updated.batteryLevel,
          status: updated.status,
          updated_at: updated.lastUpdatedAt,
        });
        if (error) throw error;
      } catch (liveTableError: any) {
        const liveRowId = `live-${updated.athleteId}`.slice(0, 50);
        const sessionType = updated.trainingMode === "combate" || updated.trainingMode === "combat"
          ? "SPARRING_DAEDO"
          : "INTERVALS_HIGH_LOAD";
        const { error: fallbackError } = await client.from("training_sessions").upsert({
          id: liveRowId,
          athlete_id: updated.athleteId,
          coach_id: updated.coachId || null,
          date: updated.lastUpdatedAt,
          session_type: sessionType,
          duration_minutes: Math.ceil(updated.sessionDurationSec / 60),
          avg_bpm: updated.currentBpm,
          max_bpm: Math.max(updated.currentBpm, updated.maxHeartRateBpm),
          trimp_score: updated.trimpScore,
          zone1_minutes: updated.zone === "Z1" ? updated.sessionDurationSec / 60 : 0,
          zone2_minutes: updated.zone === "Z2" ? updated.sessionDurationSec / 60 : 0,
          zone3_minutes: updated.zone === "Z3" ? updated.sessionDurationSec / 60 : 0,
          zone4_minutes: updated.zone === "Z4" ? updated.sessionDurationSec / 60 : 0,
          zone5_minutes: updated.zone === "Z5" ? updated.sessionDurationSec / 60 : 0,
          tactical_notes: JSON.stringify({
            source: "LIVE_TELEMETRY",
            athleteName: updated.athleteName,
            category: updated.category,
            beltRank: updated.beltRank,
            clubId: updated.clubId,
            zone: updated.zone,
            zoneName: updated.zoneName,
            zoneColor: updated.zoneColor,
            trainingMode: updated.trainingMode,
            isTrainingRunning: updated.isTrainingRunning,
            batteryLevel: updated.batteryLevel,
            restingHeartRateBpm: updated.restingHeartRateBpm,
            updatedAt: updated.lastUpdatedAt,
          }),
        });
        if (fallbackError) {
          console.error("[DB] Falló persistencia live dedicada y fallback:", liveTableError?.message, fallbackError.message);
          throw fallbackError;
        }
      }
    }

    return updated;
  }

  /**
   * Obtiene la telemetría en vivo de todos los atletas registrados.
   * Si un atleta aún no ha transmitido datos en esta sesión, devuelve su estado base listo para conectar.
   */
  getLiveTelemetryList(filter?: { clubId?: string; coachId?: string }): AthleteLiveTelemetry[] {
    const now = Date.now();
    const result: AthleteLiveTelemetry[] = [];

    // Primero incluir los que están en liveTelemetry
    const processedIds = new Set<string>();
    for (const [athleteId, telemetry] of Array.from(this.liveTelemetry.entries())) {
      if (filter?.clubId && telemetry.clubId && telemetry.clubId !== filter.clubId) continue;
      if (filter?.coachId && telemetry.coachId && telemetry.coachId !== filter.coachId) continue;

      const elapsedMs = now - new Date(telemetry.lastUpdatedAt).getTime();
      let status: "LIVE" | "PAUSED" | "OFFLINE" = telemetry.status;
      if (elapsedMs > 60000) {
        status = "OFFLINE";
      } else if (elapsedMs > 15000) {
        status = "PAUSED";
      }

      result.push({
        ...telemetry,
        status,
      });
      processedIds.add(athleteId);
    }

    // Asegurar que todos los atletas registrados en el club/base de datos figuren en la lista simultánea
    for (const athlete of this.athletes) {
      if (processedIds.has(athlete.id)) continue;
      if (filter?.clubId && athlete.clubId && athlete.clubId !== filter.clubId) continue;
      if (filter?.coachId && athlete.coachId && athlete.coachId !== filter.coachId) continue;

      result.push({
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        category: athlete.category,
        beltRank: athlete.beltRank,
        clubId: athlete.clubId,
        coachId: athlete.coachId,
        currentBpm: 0,
        maxHeartRateBpm: athlete.maxHeartRateBpm || 200,
        restingHeartRateBpm: athlete.restingHeartRateBpm || 50,
        zone: "Z1",
        zoneName: "En espera",
        zoneColor: "#64748b",
        trimpScore: 0,
        sessionDurationSec: 0,
        trainingMode: "standby",
        isTrainingRunning: false,
        batteryLevel: null,
        lastUpdatedAt: new Date(0).toISOString(),
        status: "OFFLINE",
      });
    }

    return result;
  }

  }


// Singleton de base de datos para la aplicación
export const db = new DatabaseStore();
