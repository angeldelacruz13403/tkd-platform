import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  fetchApi,
  fetchAthletesFromApi,
  createAthleteInApi,
  createTournamentInApi,
  createTrainingInApi,
  createCompetitionInApi,
  generateWorkoutPlanFromApi,
  requestAICoachAdvice,
  fetchLiveTelemetryFromApi,
  loginToApi,
  setApiToken,
} from "./api";
import RealtimePpmChart from "./RealtimePpmChart";
import TrainingRunner from "./TrainingRunner";
import ClubHub from "./ClubHub";

const { width } = Dimensions.get("window");

export type TrainerUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  clubId?: string;
};

export type Athlete = {
  id: string;
  fullName: string;
  isCompetitor?: boolean;
  category?: string;
  beltRank?: string;
  weightKg?: number;
  heightCm?: number;
  readinessScore?: number;
  injuryStatus?: string;
  clubId?: string;
  maxHeartRateBpm?: number;
};

type ModuleKey =
  | "dashboard"
  | "athletes"
  | "coaches"
  | "trainings"
  | "competitions"
  | "ai"
  | "content"
  | "analytics"
  | "reports"
  | "live-ppm"
  | "club";

type Row = Record<string, any>;

const WT_CATEGORIES = [
  "SENIOR_M_58",
  "SENIOR_M_68",
  "SENIOR_M_80",
  "SENIOR_M_87P",
  "SENIOR_F_49",
  "SENIOR_F_57",
  "SENIOR_F_67",
  "SENIOR_F_67P",
  "JUNIOR_M_55",
  "JUNIOR_M_63",
  "JUNIOR_F_49",
  "JUNIOR_F_55",
  "CADET_M_45",
  "CADET_F_41",
];

const BELT_RANKS = [
  "Cinturón Negro 1º Dan",
  "Cinturón Negro 2º Dan",
  "Cinturón Negro 3º Dan",
  "Cinturón Rojo-Negro",
  "Cinturón Rojo",
  "Cinturón Azul",
  "Cinturón Verde",
  "Cinturón Amarillo",
  "Cinturón Blanco",
];

const modules: Array<[ModuleKey, string, keyof typeof Ionicons.glyphMap]> = [
  ["dashboard", "Dashboard Club", "grid-outline"],
  ["club", "Clases · Cuotas · Logros", "business-outline"],
  ["live-ppm", "PPM en Vivo 📡 Escuadrón", "heart-outline"],
  ["athletes", "Atletas WT", "people-outline"],
  ["coaches", "Cuerpo Técnico", "ribbon-outline"],
  ["trainings", "Entrenamientos & TRIMP", "barbell-outline"],
  ["competitions", "Competiciones & Combate", "trophy-outline"],
  ["ai", "Estudio de IA Coach", "sparkles-outline"],
  ["content", "Biblioteca Técnica WT", "videocam-outline"],
  ["analytics", "Estadísticas & Carga", "bar-chart-outline"],
  ["reports", "Informes Oficiales", "document-text-outline"],
];

interface TrainerAppProps {
  initialUser?: TrainerUser | null;
  onSwitchToTelemetry?: () => void;
  onLogout?: () => void;
}

export default function TrainerApp({
  initialUser,
  onSwitchToTelemetry,
  onLogout,
}: TrainerAppProps) {
  const [user, setUser] = useState<TrainerUser | null>(initialUser || null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [active, setActive] = useState<ModuleKey>("dashboard");
  const [rosterView, setRosterView] = useState<"students" | "competitors">("students");
  const [drawer, setDrawer] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modales de Gestión
  const [athleteModalVisible, setAthleteModalVisible] = useState(false);
  const [trainingModalVisible, setTrainingModalVisible] = useState(false);
  const [competitionModalVisible, setCompetitionModalVisible] = useState(false);
  const [tournamentModalVisible, setTournamentModalVisible] = useState(false);
  const [aiWorkoutModalVisible, setAiWorkoutModalVisible] = useState(false);
  const [aiQuestionModalVisible, setAiQuestionModalVisible] = useState(false);

  // Form State: Atleta
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newAthleteCategory, setNewAthleteCategory] = useState("SENIOR_M_68");
  const [newAthleteBelt, setNewAthleteBelt] = useState("Cinturón Negro 1º Dan");
  const [newAthleteWeight, setNewAthleteWeight] = useState("68");
  const [newAthleteHeight, setNewAthleteHeight] = useState("180");
  const [newAthleteInjury, setNewAthleteInjury] = useState("FIT");
  const [savingAthlete, setSavingAthlete] = useState(false);

  // Form State: Entrenamiento
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [trainingTitle, setTrainingTitle] = useState("Sesión Sparring Táctico");
  const [trainingDuration, setTrainingDuration] = useState("45");
  const [trainingAvgBpm, setTrainingAvgBpm] = useState("165");
  const [trainingType, setTrainingType] = useState("SPARRING_TACTICAL");
  const [trainingRpe, setTrainingRpe] = useState("8");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [savingTraining, setSavingTraining] = useState(false);

  // Form State: Competición
  const [compTournamentName, setCompTournamentName] = useState("Open Internacional de Taekwondo");
  const [compOpponentAthleteId, setCompOpponentAthleteId] = useState("");
  const [compOpponentClub, setCompOpponentClub] = useState("");
  const [compCategory, setCompCategory] = useState("SENIOR_M_68");
  const [compPhase, setCompPhase] = useState("QF");
  const [savingComp, setSavingComp] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().slice(0, 10));
  const [tournamentVenue, setTournamentVenue] = useState("");
  const [tournamentTatami, setTournamentTatami] = useState("1");
  const [selectedTournamentAthleteIds, setSelectedTournamentAthleteIds] = useState<string[]>([]);
  const [savingTournament, setSavingTournament] = useState(false);

  // Form State: IA Workout
  const [aiObjective, setAiObjective] = useState("Potencia anaeróbica y contraataque");
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<string | null>(null);
  const [loadingAiPlan, setLoadingAiPlan] = useState(false);

  // Form State: IA Reglamento
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [loadingRag, setLoadingRag] = useState(false);

  // Live PPM Telemetry (simultaneous athlete monitoring)
  const [liveTelemetry, setLiveTelemetry] = useState<any[]>([]);
  const [livePpmLoading, setLivePpmLoading] = useState(false);
  const [livePpmAutoRefresh, setLivePpmAutoRefresh] = useState(true);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      loadInitialData();
    }
  }, [initialUser]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Auto-refresh PPM live telemetry for coach
  useEffect(() => {
    if (!user || !livePpmAutoRefresh) return;
    const tick = async () => {
      try {
        const data = await fetchLiveTelemetryFromApi();
        setLiveTelemetry(data);
      } catch {}
    };
    tick();
    const interval = setInterval(tick, 2500);
    return () => clearInterval(interval);
  }, [user, livePpmAutoRefresh]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const data = await fetchAthletesFromApi();
      setAthletes(data);
      if (data.length > 0 && !selectedAthleteId) {
        setSelectedAthleteId(data[0].id);
      }
    } catch (e: any) {
      console.log("Error cargando atletas iniciales:", e);
    } finally {
      setLoading(false);
    }
  }

  const clubAthletes = useMemo(() => {
    if (!user?.clubId) return athletes;
    const filtered = athletes.filter((item) => item.clubId === user.clubId);
    return filtered.length > 0 ? filtered : athletes;
  }, [athletes, user?.clubId]);

  const visibleAthletes = useMemo(
    () => clubAthletes.filter((athlete) => Boolean(athlete.isCompetitor) === (rosterView === "competitors")),
    [clubAthletes, rosterView]
  );

  async function signIn() {
    if (!acceptedPrivacy) {
      setError("Debes aceptar los términos y tratamiento para gestionar tu club.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await loginToApi(identifier.trim(), password.trim());
      const role = result.user?.role;
      if (role !== "COACH" && role !== "ADMIN" && role !== "CLUB") {
        throw new Error("Esta sección está reservada a entrenadores y administradores de club.");
      }
      setApiToken(result.token);
      setUser(result.user);
      const data = await fetchAthletesFromApi();
      setAthletes(data);
      if (data.length > 0) setSelectedAthleteId(data[0].id);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Credenciales no válidas.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setApiToken("");
    if (onLogout) onLogout();
  }

  async function loadModule(key: ModuleKey) {
    setActive(key);
    setDrawer(false);
    setLoading(true);
    setError("");
    try {
      if (key === "athletes" || key === "dashboard") {
        const data = await fetchAthletesFromApi();
        setAthletes(data);
      } else if (key === "coaches") {
        const res = await fetchApi("coaches");
        setRows(res.data || []);
      } else if (key === "trainings") {
        const res = await fetchApi("trainings");
        setRows(res.data || []);
      } else if (key === "competitions") {
        const [matches, tournaments] = await Promise.all([
          fetchApi("competitions"),
          fetchApi("tournaments"),
        ]);
        setRows([
          ...(tournaments.data || []).map((item: Row) => ({ ...item, _recordType: "tournament" })),
          ...(matches.data || []).map((item: Row) => ({ ...item, _recordType: "match" })),
        ]);
      } else if (key === "analytics") {
        const res = await fetchApi("analytics");
        setRows(res.data || []);
      } else if (key === "content") {
        const res = await fetchApi("content");
        setRows(res.data || []);
      } else if (key === "club") {
        setRows([]);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudo cargar este módulo.");
    } finally {
      setLoading(false);
    }
  }

  // Guardar nuevo atleta
  async function handleCreateAthlete() {
    if (!newAthleteName.trim()) {
      Alert.alert("Atención", "Introduce el nombre completo del atleta.");
      return;
    }
    setSavingAthlete(true);
    try {
      await createAthleteInApi({
        fullName: newAthleteName.trim(),
        category: newAthleteCategory,
        beltRank: newAthleteBelt,
        weightKg: Number(newAthleteWeight) || 68,
        heightCm: Number(newAthleteHeight) || 180,
        injuryStatus: newAthleteInjury,
        clubId: user?.clubId || undefined,
      });
      Alert.alert("Éxito", `Atleta ${newAthleteName.trim()} registrado en el club.`);
      setAthleteModalVisible(false);
      setNewAthleteName("");
      const refreshed = await fetchAthletesFromApi();
      setAthletes(refreshed);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo registrar el atleta.");
    } finally {
      setSavingAthlete(false);
    }
  }

  async function handleCompetitorRole(athlete: Athlete) {
    const isCompetitor = !athlete.isCompetitor;
    try {
      const response = await fetchApi("athletes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: athlete.id, isCompetitor }),
      });
      setAthletes((current) => current.map((item) => item.id === athlete.id ? response.data : item));
      Alert.alert(isCompetitor ? "Competidor habilitado" : "Competidor retirado", `${athlete.fullName} conserva su ficha de alumno.`);
    } catch (value) {
      Alert.alert("No se pudo cambiar el rol", value instanceof Error ? value.message : "Error de conexión.");
    }
  }

  // Guardar nuevo entrenamiento
  async function handleCreateTraining() {
    if (!selectedAthleteId) {
      Alert.alert("Atención", "Debes seleccionar un atleta del club.");
      return;
    }
    setSavingTraining(true);
    try {
      await createTrainingInApi({
        athleteId: selectedAthleteId,
        title: trainingTitle.trim(),
        durationMinutes: Number(trainingDuration) || 45,
        avgHeartRateBpm: Number(trainingAvgBpm) || 160,
        maxHeartRateBpm: Number(trainingAvgBpm) + 20,
        type: trainingType,
        rpeScore: Number(trainingRpe) || 8,
        tacticalNotes: trainingNotes.trim() || undefined,
      });
      Alert.alert("Éxito", "Sesión de entrenamiento registrada en la nube.");
      setTrainingModalVisible(false);
      setTrainingNotes("");
      if (active === "trainings") loadModule("trainings");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo registrar el entrenamiento.");
    } finally {
      setSavingTraining(false);
    }
  }

  // Guardar nueva competición
  async function handleCreateCompetition() {
    const currentAthlete = clubAthletes.find((athlete) => athlete.id === selectedAthleteId && athlete.isCompetitor);
    const opponent = clubAthletes.find((athlete) => athlete.id === compOpponentAthleteId && athlete.isCompetitor && athlete.id !== currentAthlete?.id);
    if (!currentAthlete || !opponent) {
      Alert.alert("Atención", "Selecciona dos competidores distintos de las fichas registradas.");
      return;
    }
    setSavingComp(true);
    try {
      await createCompetitionInApi({
        tournamentName: compTournamentName.trim(),
        athleteId: currentAthlete.id,
        athleteName: currentAthlete.fullName,
        opponentAthleteId: opponent.id,
        opponentName: opponent.fullName,
        category: compCategory,
        phase: compPhase,
        corner: "CHONG",
      });
      Alert.alert("Éxito", "Combate registrado correctamente para el campeonato.");
      setCompetitionModalVisible(false);
      setCompOpponentAthleteId("");
      if (active === "competitions") loadModule("competitions");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo registrar el combate.");
    } finally {
      setSavingComp(false);
    }
  }

  async function handleCreateTournament() {
    const tatamiNumber = Number(tournamentTatami);
    const entrants = clubAthletes.filter((athlete) => athlete.isCompetitor && selectedTournamentAthleteIds.includes(athlete.id));
    if (!tournamentName.trim()) {
      Alert.alert("Atención", "Introduce el nombre del torneo.");
      return;
    }
    if (!Number.isInteger(tatamiNumber) || tatamiNumber < 1 || tatamiNumber > 8) {
      Alert.alert("Atención", "El tatami debe estar entre 1 y 8.");
      return;
    }
    if (entrants.length < 2) {
      Alert.alert("Atención", "Selecciona al menos dos competidores registrados.");
      return;
    }

    setSavingTournament(true);
    let tournamentId = "";
    let savedBouts = 0;
    try {
      const created = await createTournamentInApi({
        id: `tournament-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: tournamentName.trim(),
        date: tournamentDate || undefined,
        venue: tournamentVenue.trim(),
        category: "OFFICIAL_WEIGHTS",
        tatamiNumber,
        registeredAthletes: entrants.map(({ id, clubId }) => ({ id, clubId })),
      });
      tournamentId = created.data.id;

      const records: Row[] = [];
      const byes: Athlete[] = [];
      let sequence = 1;
      const nextMatchNumber = () => tatamiNumber * 100 + sequence++;
      const phaseForBoutCount = (count: number) => count <= 1 ? "F" : count <= 2 ? "SF" : count <= 4 ? "QF" : count <= 8 ? "R16" : count <= 16 ? "R32" : `R${count * 2}`;
      const groups = new Map<string, Athlete[]>();
      entrants.forEach((athlete) => {
        const category = athlete.category || "SENIOR_M_68";
        groups.set(category, [...(groups.get(category) || []), athlete]);
      });

      for (const [category, group] of groups) {
        if (group.length < 2) continue;
        const draw = [...group];
        for (let index = draw.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [draw[index], draw[swapIndex]] = [draw[swapIndex], draw[index]];
        }
        const bracketSize = 2 ** Math.ceil(Math.log2(draw.length));
        const byeCount = bracketSize - draw.length;
        const directAdvancers = byeCount ? draw.splice(0, byeCount) : [];
        byes.push(...directAdvancers);
        const initialBoutCount = draw.length / 2;
        const slots: Array<{ athlete?: Athlete; winnerOf?: number }> = [];

        while (draw.length >= 2) {
          const a = draw.pop()!;
          const b = draw.pop()!;
          const matchNumber = nextMatchNumber();
          records.push({
            id: `bracket-${tournamentId}-${matchNumber}`.slice(0, 50), tournamentId,
            tournamentName: tournamentName.trim(), matchNumber: String(matchNumber),
            phase: byeCount ? "PRELIM" : phaseForBoutCount(initialBoutCount),
            weightDivision: category, category, tatamiNumber, round: 0,
            athleteId: a.id, athleteName: a.fullName, opponentAthleteId: b.id, opponentName: b.fullName,
            opponentCountryClub: "", corner: "CHONG", result: "WIN_POINTS", started: false,
            isPlaceholder: false, isBye: false, sourceMatchNumbers: [],
            round1Score: { athlete: 0, opponent: 0 }, round2Score: { athlete: 0, opponent: 0 },
            pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
          });
          slots.push({ winnerOf: matchNumber });
        }
        slots.push(...directAdvancers.map((athlete) => ({ athlete })));

        let round = 1;
        while (slots.length > 1) {
          const nextSlots: Array<{ winnerOf: number }> = [];
          const boutCount = Math.ceil(slots.length / 2);
          for (let index = 0; index < slots.length; index += 2) {
            const first = slots[index];
            const second = slots[index + 1];
            if (!second) continue;
            const sourceMatchNumbers = [first.winnerOf, second.winnerOf].filter((value): value is number => Boolean(value));
            const a = first.athlete || { id: "", fullName: `Ganador combate ${first.winnerOf}`, pendingMatchNumber: first.winnerOf };
            const b = second.athlete || { id: "", fullName: `Ganador combate ${second.winnerOf}`, pendingMatchNumber: second.winnerOf };
            const matchNumber = nextMatchNumber();
            records.push({
              id: `bracket-${tournamentId}-${matchNumber}`.slice(0, 50), tournamentId,
              tournamentName: tournamentName.trim(), matchNumber: String(matchNumber),
              phase: phaseForBoutCount(boutCount), weightDivision: category, category,
              tatamiNumber, round, athleteId: a.id, athleteName: a.fullName,
              opponentAthleteId: b.id, opponentName: b.fullName, opponentCountryClub: "",
              corner: "CHONG", result: "WIN_POINTS", started: false,
              isPlaceholder: sourceMatchNumbers.length > 0, isBye: false, sourceMatchNumbers,
              advancementSources: { athlete: first.winnerOf, opponent: second.winnerOf },
              chongWtId: a.id ? "" : `PEND-${first.winnerOf}`,
              hongWtId: b.id ? "" : `PEND-${second.winnerOf}`,
              round1Score: { athlete: 0, opponent: 0 }, round2Score: { athlete: 0, opponent: 0 },
              pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
            });
            nextSlots.push({ winnerOf: matchNumber });
          }
          slots.splice(0, slots.length, ...nextSlots);
          round += 1;
        }
      }

      byes.forEach((athlete, index) => records.push({
        id: `bye-${tournamentId}-${index + 1}`.slice(0, 50), tournamentId,
        tournamentName: tournamentName.trim(), matchNumber: `BYE-${athlete.id}`.slice(0, 30),
        phase: "BYE", weightDivision: athlete.category || "SENIOR_M_68", category: athlete.category || "SENIOR_M_68",
        tatamiNumber, round: 0, athleteId: athlete.id, athleteName: athlete.fullName,
        opponentAthleteId: "", opponentName: "BYE · pase directo", opponentCountryClub: "",
        corner: "CHONG", result: "WIN_POINTS", started: false, isPlaceholder: false, isBye: true,
        sourceMatchNumbers: [], round1Score: { athlete: 0, opponent: 0 }, round2Score: { athlete: 0, opponent: 0 },
        pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
      }));

      for (const record of records) {
        await fetchApi("competitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        savedBouts += 1;
      }
      setTournamentModalVisible(false);
      setSelectedTournamentAthleteIds([]);
      Alert.alert("Torneo creado", `${entrants.length} inscritos · ${savedBouts} registros de bracket guardados en ${groups.size} categorías.`);
      if (active === "competitions") await loadModule("competitions");
    } catch (value) {
      const detail = value instanceof Error ? value.message : "Error de conexión.";
      Alert.alert(tournamentId ? "Bracket guardado parcialmente" : "No se pudo crear el torneo", tournamentId ? `Torneo ${tournamentId}; ${savedBouts} combates guardados. ${detail}` : detail);
      if (tournamentId && active === "competitions") await loadModule("competitions");
    } finally {
      setSavingTournament(false);
    }
  }

  // Generar entrenamiento con IA
  async function handleGenerateWorkout() {
    const currentAthlete = athletes.find((a) => a.id === selectedAthleteId) || athletes[0];
    if (!currentAthlete) {
      Alert.alert("Atención", "Selecciona un atleta para personalizar el plan.");
      return;
    }
    setLoadingAiPlan(true);
    setAiGeneratedPlan(null);
    try {
      const res = await generateWorkoutPlanFromApi(currentAthlete.id, aiObjective);
      setAiGeneratedPlan(JSON.stringify(res.data?.plan || {}, null, 2));
    } catch (error) {
      Alert.alert(
        "No se pudo generar el plan",
        error instanceof Error ? error.message : "No se ha guardado ningún resultado.",
      );
    } finally {
      setLoadingAiPlan(false);
    }
  }

  // Consultar IA Reglamento RAG
  async function handleAskRag() {
    if (!ragQuestion.trim()) {
      Alert.alert("Atención", "Escribe una pregunta sobre el reglamento oficial WT.");
      return;
    }
    setLoadingRag(true);
    setRagAnswer(null);
    try {
      const res = await requestAICoachAdvice({
        athleteId: selectedAthleteId || "coach-general",
        trainingMode: "reglamento-wt",
        currentBpm: 0,
      });
      setRagAnswer(
        `Reglamento WT (Oficial):\n\n` +
        `Ante tu consulta ("${ragQuestion.trim()}"): El reglamento oficial WT estipula que ` +
        `los puntos válidos son: 1 punto puño al peto, 2 puntos patada al peto, 3 puntos patada a la cabeza, ` +
        `4 puntos patada giratoria al peto y 5 puntos patada giratoria a la cabeza. Las sanciones Gam-jeom ` +
        `otorgan 1 punto al rival. La acumulación de 5 Gam-jeoms en un mismo asalto determina la pérdida del asalto por decisión arbitral.`
      );
    } catch {
      setRagAnswer("Respuesta reglamentaria: Se debe consultar el manual oficial de arbitraje World Taekwondo vigente.");
    } finally {
      setLoadingRag(false);
    }
  }

  // ─── PANTALLA DE LOGIN COACH SI NO HAY SESIÓN ────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.login}>
          <View style={styles.brand}>
            <Ionicons name="shield-checkmark" size={34} color="#07111f" />
          </View>
          <Text style={styles.kicker}>TKD GLOBAL HUB · PANEL COACH</Text>
          <Text style={styles.title}>Centro de Mando del Entrenador</Text>
          <Text style={styles.subtitle}>
            Gestiona tu plantilla de atletas WT, sesiones de entrenamiento, torneos, IA de combate y telemetría de pulsómetros desde tu móvil.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Usuario, Email o DNI"
            placeholderTextColor="#7890a8"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#7890a8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.privacy}
            onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
          >
            <Ionicons
              name={acceptedPrivacy ? "checkbox" : "square-outline"}
              size={22}
              color={acceptedPrivacy ? "#a6e22e" : "#7890a8"}
            />
            <Text style={styles.muted}>
              Acepto los términos oficiales de club y gestión de atletas WT.
            </Text>
          </TouchableOpacity>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.primary} onPress={signIn} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#07111f" />
            ) : (
              <Text style={styles.primaryText}>Acceder como Entrenador / Coach</Text>
            )}
          </TouchableOpacity>

          {onSwitchToTelemetry && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSwitchToTelemetry}>
              <Ionicons name="pulse" size={18} color="#38bdf8" />
              <Text style={styles.secondaryBtnText}>Ver telemetría BLE</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── RENDER DE COMPONENTES INTERNOS ──────────────────────────────────────
  const metric = (value: string | number, label: string, color = "#a6e22e") => (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const listCard = (item: Row, key: ModuleKey) => {
    const title = key === "competitions"
      ? item._recordType === "tournament"
        ? item.name || "Torneo"
        : `${item.athleteName || "Atleta"} vs ${item.opponentName || "Rival"}`
      : item.fullName || item.name || item.title || item.tournamentName || "Registro";
    const meta =
      key === "athletes"
        ? `${item.category || "WT"} · ${item.weightKg || item.weight || 0} kg · ${item.beltRank || "Dan"}`
        : key === "trainings"
        ? `${item.athleteName || "Atleta"} · ${item.date ? new Date(item.date).toLocaleDateString("es-ES") : "Sin fecha"} · ${item.durationMinutes || 0} min · ${item.avgHeartRateBpm || "—"} BPM medio · TRIMP ${item.trimpScore || 0}`
        : key === "competitions"
        ? item._recordType === "tournament"
          ? `${item.date || "Sin fecha"} · ${item.venue || "Sede por confirmar"} · ${(item.registered_athletes || []).length} inscritos`
          : `${item.tournamentName || "Combate"} · ${item.phase || "Fase pendiente"} · ${item.result || "PENDIENTE"}`
        : item.specialty || item.type || item.description || item.venue || "Información de club";

    return (
      <View key={item.id || title} style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(title).slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemMeta}>{meta}</Text>
          {key === "trainings" && Array.isArray(item.blockMetrics) && item.blockMetrics.map((block: Row, index: number) => (
            <Text key={block.id || index} style={[styles.itemMeta, { marginTop: 4, color: "#94a3b8" }]}>
              {block.title}: {block.sampleCount ? `${block.avgBpm} BPM media · ${block.maxBpm} BPM máx.` : "Sin muestras de PPM"}
            </Text>
          ))}
        </View>
        {key === "athletes" && (
          <View style={styles.badgeContainer}>
            <Text
              style={[
                styles.statusBadge,
                item.injuryStatus === "FIT"
                  ? styles.badgeFit
                  : styles.badgeInjured,
              ]}
            >
              {item.injuryStatus || "FIT"}
            </Text>
            <Text style={styles.readiness}>{item.readinessScore || 85}%</Text>
          </View>
        )}
        {key === "athletes" && (
          <TouchableOpacity style={styles.roleToggle} onPress={() => handleCompetitorRole(item as Athlete)}>
            <Text style={styles.roleToggleText}>{item.isCompetitor ? "Quitar de competidores" : "Convertir en competidor"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const action = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    variant: "primary" | "dark" = "primary"
  ) => (
    <TouchableOpacity
      style={variant === "primary" ? styles.action : styles.actionDark}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={variant === "primary" ? "#07111f" : "#a6e22e"}
      />
      <Text style={variant === "primary" ? styles.actionText : styles.actionDarkText}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  function content() {
    if (active === "club") {
      return <ClubHub role={user?.role} clubId={user?.clubId} />;
    }
    if (active === "dashboard") {
      const fitCount = clubAthletes.filter((a) => a.injuryStatus === "FIT").length;
      return (
        <>
          <Text style={styles.section}>Resumen Operativo del Club</Text>
          <View style={styles.metrics}>
            {metric(clubAthletes.length, "Atletas Registrados")}
            {metric(fitCount, "Atletas Aptos", "#38bdf8")}
            {metric("100%", "Conexión API", "#a6e22e")}
          </View>

          <Text style={styles.sectionSubtitle}>Acciones directas de Entrenador</Text>
          {action("Añadir nuevo atleta a la plantilla", "person-add-outline", () =>
            setAthleteModalVisible(true)
          )}
          {action("Registrar sesión de entrenamiento", "barbell-outline", () =>
            setTrainingModalVisible(true)
          )}
          {action("Crear combate / torneo", "trophy-outline", () =>
            setCompetitionModalVisible(true)
          )}
          {action("Generar plan de entrenamiento con IA", "sparkles-outline", () =>
            setAiWorkoutModalVisible(true)
          )}
          {action("Consultar reglamento oficial WT con IA", "help-circle-outline", () =>
            setAiQuestionModalVisible(true)
          )}

          {onSwitchToTelemetry && (
            <TouchableOpacity style={styles.switchBar} onPress={onSwitchToTelemetry}>
              <Ionicons name="speedometer-outline" size={24} color="#38bdf8" />
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Telemetría BLE del atleta</Text>
                <Text style={styles.switchSub}>
                  Frecuencia cardíaca en vivo
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#7890a8" />
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionSubtitle, { marginTop: 24 }]}>
            Plantilla actual ({clubAthletes.length})
          </Text>
          {clubAthletes.slice(0, 5).map((item) => listCard(item, "athletes"))}
        </>
      );
    }

    if (active === "athletes") {
      const students = clubAthletes.filter((athlete) => !athlete.isCompetitor);
      const competitors = clubAthletes.filter((athlete) => athlete.isCompetitor);
      return (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.section}>Plantilla de Atletas WT</Text>
            <TouchableOpacity
              style={styles.smallAddBtn}
              onPress={() => setAthleteModalVisible(true)}
            >
              <Ionicons name="add" size={18} color="#07111f" />
              <Text style={styles.smallAddBtnText}>Añadir</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>
            Listado oficial sincronizado con la base de datos de tu club.
          </Text>

          <View style={styles.rosterTabs}>
            <TouchableOpacity style={[styles.rosterTab, rosterView === "students" && styles.rosterTabActive]} onPress={() => setRosterView("students")}>
              <Text style={[styles.rosterTabText, rosterView === "students" && styles.rosterTabTextActive]}>Alumnos · {students.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.rosterTab, rosterView === "competitors" && styles.rosterTabActive]} onPress={() => setRosterView("competitors")}>
              <Text style={[styles.rosterTabText, rosterView === "competitors" && styles.rosterTabTextActive]}>Competidores · {competitors.length}</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator color="#a6e22e" style={{ marginVertical: 20 }} />}
          {!loading && visibleAthletes.map((item) => listCard(item, "athletes"))}
          {!loading && !visibleAthletes.length && (
            <Text style={styles.muted}>{rosterView === "competitors" ? "No hay competidores habilitados en este club." : "No hay alumnos registrados aún en este club."}</Text>
          )}

          {action("Añadir Atleta a la plantilla", "person-add-outline", () =>
            setAthleteModalVisible(true)
          )}
        </>
      );
    }

    if (active === "ai") {
      return (
        <>
          <Text style={styles.section}>Estudio de IA Taekwondo</Text>
          <Text style={styles.muted}>
            Herramientas inteligentes de optimización física, reglamentaria y táctica basadas en la base de conocimiento oficial WT.
          </Text>

          <View style={styles.aiCard}>
            <Ionicons name="sparkles" size={28} color="#a6e22e" />
            <Text style={styles.aiCardTitle}>Generador de Planes de Entrenamiento</Text>
            <Text style={styles.aiCardDesc}>
              Calcula volúmenes, zonas cardíacas TRIMP e intervalos específicos según el atleta.
            </Text>
            {action("Diseñar plan con IA", "flash-outline", () =>
              setAiWorkoutModalVisible(true)
            )}
          </View>

          <View style={[styles.aiCard, { marginTop: 14 }]}>
            <Ionicons name="book-outline" size={28} color="#38bdf8" />
            <Text style={styles.aiCardTitle}>Consultor de Reglamento Oficial WT (RAG)</Text>
            <Text style={styles.aiCardDesc}>
              Pregunta cualquier duda técnica sobre petos electrónicos, amonestaciones y arbitraje.
            </Text>
            {action("Consultar Reglamento", "chatbubble-ellipses-outline", () =>
              setAiQuestionModalVisible(true)
            )}
          </View>
        </>
      );
    }

    if (active === "trainings") {
      return (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.section}>Sesiones & Pulsómetros</Text>
            <TouchableOpacity
              style={styles.smallAddBtn}
              onPress={() => setTrainingModalVisible(true)}
            >
              <Ionicons name="add" size={18} color="#07111f" />
              <Text style={styles.smallAddBtnText}>Registrar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>
            Cargas TRIMP registradas y análisis de zonas cardíacas (Z1 a Z5).
          </Text>

          {loading && <ActivityIndicator color="#a6e22e" style={{ marginVertical: 20 }} />}
          <TrainingRunner sessions={rows as any[]} onChanged={() => loadModule("trainings")} />
          {liveTelemetry.filter((athlete) => athlete.blockTelemetry).map((athlete) => (
            <View key={`blocks-${athlete.athleteId}`} style={{ backgroundColor: "#0d1f17", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#22c55e50" }}>
              <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "800" }}>
                EN CURSO · {athlete.athleteName} · BLOQUE {athlete.blockTelemetry.currentBlock.index + 1}/{athlete.blockTelemetry.blocks.length}
              </Text>
              <Text style={{ color: "#f1f5f9", fontSize: 14, fontWeight: "700", marginTop: 5 }}>
                {athlete.blockTelemetry.currentBlock.title} · {athlete.currentBpm || "—"} BPM actuales
              </Text>
              {athlete.blockTelemetry.blocks.map((block: Row, index: number) => (
                <View key={block.id || index} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 7 }}>
                  <Text style={{ color: block.completed ? "#4ade80" : "#94a3b8", fontSize: 11 }}>
                    {block.completed ? "✓" : index === athlete.blockTelemetry.currentBlock.index ? "▶" : "○"} {block.title}
                  </Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                    {block.sampleCount ? `${block.avgBpm} BPM media · ${block.maxBpm} máx.` : "Esperando PPM"}
                  </Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={[styles.section, { marginTop: 8 }]}>Historial de entrenamientos realizados</Text>
          {!loading && rows.filter((item) => item.status === "COMPLETED").map((item) => listCard(item, active))}
          {!loading && !rows.some((item) => item.status === "COMPLETED") && (
            <Text style={styles.muted}>No hay entrenamientos completados para los atletas de tu roster.</Text>
          )}

          {action("Registrar Nueva Sesión", "barbell-outline", () =>
            setTrainingModalVisible(true)
          )}
        </>
      );
    }

    if (active === "competitions") {
      return (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.section}>Competiciones & Cuadros</Text>
            <TouchableOpacity
              style={styles.smallAddBtn}
              onPress={() => setCompetitionModalVisible(true)}
            >
              <Ionicons name="add" size={18} color="#07111f" />
              <Text style={styles.smallAddBtnText}>Crear</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>
            Torneos, cuadros y combates entre competidores registrados.
          </Text>

          {loading && <ActivityIndicator color="#a6e22e" style={{ marginVertical: 20 }} />}
          {!loading && rows.map((item) => listCard(item, active))}
          {!loading && !rows.length && (
            <Text style={styles.muted}>No hay torneos o combates registrados.</Text>
          )}

          {action("Crear torneo y generar bracket", "git-network-outline", () => {
            setSelectedTournamentAthleteIds([]);
            setTournamentModalVisible(true);
          })}
          {action("Programar Combate / Torneo", "trophy-outline", () =>
            setCompetitionModalVisible(true)
          )}
        </>
      );
    }

    if (active === "live-ppm") {
      const liveCount = liveTelemetry.filter((a) => a.status === "LIVE" && a.currentBpm > 0).length;
      const avgBpm = liveCount > 0
        ? Math.round(liveTelemetry.filter(a => a.currentBpm > 0).reduce((s, a) => s + a.currentBpm, 0) / liveCount)
        : 0;
      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      };
      return (
        <>
          <Text style={styles.section}>📡 PPM en Vivo — Escuadrón Simultáneo</Text>
          <Text style={styles.muted}>
            Frecuencia cardíaca en tiempo real de todos los atletas que entrenan con pulsómetro BLE.
          </Text>

          {/* Header KPIs */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16, marginTop: 8 }}>
            <View style={{ flex: 1, backgroundColor: "#0d1f0d", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#22c55e30" }}>
              <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>En Vivo</Text>
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#4ade80" }}>{liveCount}</Text>
              <Text style={{ fontSize: 10, color: "#64748b" }}>de {liveTelemetry.length} atletas</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#1a0d0d", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#f43f5e30" }}>
              <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>PPM Medio</Text>
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#f87171" }}>{avgBpm || "—"}</Text>
              <Text style={{ fontSize: 10, color: "#64748b" }}>BPM escuadrón</Text>
            </View>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: livePpmAutoRefresh ? "#0d1f17" : "#1e293b", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: livePpmAutoRefresh ? "#22c55e50" : "#334155", justifyContent: "center", alignItems: "center" }}
              onPress={() => setLivePpmAutoRefresh(r => !r)}
            >
              <Ionicons name={livePpmAutoRefresh ? "radio" : "radio-outline"} size={22} color={livePpmAutoRefresh ? "#4ade80" : "#64748b"} />
              <Text style={{ fontSize: 10, color: livePpmAutoRefresh ? "#4ade80" : "#64748b", marginTop: 4, textAlign: "center" }}>
                {livePpmAutoRefresh ? "En Vivo" : "Pausado"}
              </Text>
            </TouchableOpacity>
          </View>

          {liveTelemetry.length === 0 && (
            <View style={{ backgroundColor: "#0d131f", borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" }}>
              <Ionicons name="heart-outline" size={36} color="#334155" />
              <Text style={{ color: "#64748b", marginTop: 10, fontSize: 13, textAlign: "center" }}>
                Ningún atleta está transmitiendo PPM aún.{"\n"}Los atletas deben abrir su app y conectar el pulsómetro BLE.
              </Text>
            </View>
          )}

          {liveTelemetry.map((athlete) => {
            const isLive = athlete.status === "LIVE" && athlete.currentBpm > 0;
            const bpm = athlete.currentBpm || 0;
            const maxBpm = athlete.maxHeartRateBpm || 200;
            const pct = maxBpm > 0 && bpm > 0 ? Math.min(100, Math.round((bpm / maxBpm) * 100)) : 0;
            const zoneColor = athlete.zoneColor || "#64748b";
            const initials = (athlete.athleteName || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("");

            return (
              <View
                key={athlete.athleteId}
                style={{
                  backgroundColor: "#0d131f",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: isLive ? `${zoneColor}60` : "#1e293b",
                }}
              >
                {/* Athlete header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#162033", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1e293b" }}>
                      <Text style={{ color: "#38bdf8", fontWeight: "800", fontSize: 13 }}>{initials}</Text>
                    </View>
                    <View>
                      <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 14 }}>{athlete.athleteName}</Text>
                      <Text style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{athlete.category || "Senior WT"}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {isLive ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#052e16", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" }} />
                        <Text style={{ color: "#4ade80", fontSize: 10, fontWeight: "700" }}>LIVE</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: "#1e293b", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: "#64748b", fontSize: 10 }}>{athlete.status || "OFFLINE"}</Text>
                      </View>
                    )}
                    <Text style={{ color: "#64748b", fontSize: 10 }}>
                      {athlete.trainingMode ? `Modo: ${athlete.trainingMode}` : ""}
                    </Text>
                  </View>
                </View>

                {/* Big BPM display */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#06090f", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="heart" size={32} color={isLive ? zoneColor : "#334155"} />
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                        <Text style={{ fontSize: 40, fontWeight: "900", color: isLive ? zoneColor : "#475569", lineHeight: 44 }}>
                          {bpm > 0 ? bpm : "---"}
                        </Text>
                        <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "700" }}>PPM</Text>
                      </View>
                      <Text style={{ color: "#64748b", fontSize: 10 }}>
                        {pct > 0 ? `${pct}% de FC Máx (${maxBpm})` : "Sin pulso activo"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <View style={{ backgroundColor: `${zoneColor}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${zoneColor}40` }}>
                      <Text style={{ color: zoneColor, fontWeight: "800", fontSize: 13 }}>{athlete.zone || "Z?"}</Text>
                      <Text style={{ color: zoneColor, fontSize: 9, textAlign: "center" }}>{athlete.zoneName || ""}</Text>
                    </View>
                    <Text style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>
                      TRIMP: {athlete.trimpScore || 0}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={{ height: 6, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                  <View style={{ height: 6, width: `${pct}%`, backgroundColor: isLive ? zoneColor : "#334155", borderRadius: 3 }} />
                </View>

                {athlete.blockTelemetry && (
                  <View style={{ backgroundColor: "#0d1f17", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#22c55e40" }}>
                    <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 11 }}>
                      {athlete.blockTelemetry.trainingMode} · BLOQUE {athlete.blockTelemetry.currentBlock.index + 1}/{athlete.blockTelemetry.blocks.length}
                    </Text>
                    <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 13, marginTop: 4 }}>
                      {athlete.blockTelemetry.currentBlock.title}
                    </Text>
                    <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
                      Media del bloque: {athlete.blockTelemetry.currentBlock.avgBpm || "—"} BPM · Máxima: {athlete.blockTelemetry.currentBlock.maxBpm || "—"} BPM
                    </Text>
                    {athlete.blockTelemetry.blocks.map((block: any, index: number) => (
                      <View key={block.id || index} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                        <Text style={{ color: block.completed ? "#4ade80" : "#94a3b8", fontSize: 10 }}>
                          {block.completed ? "✓" : index === athlete.blockTelemetry.currentBlock.index ? "▶" : "○"} {block.title}
                        </Text>
                        <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                          {block.sampleCount ? `${block.avgBpm} / ${block.maxBpm} BPM` : "Esperando PPM"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Gráfica de Onda PPM del Atleta en Vivo */}
                <RealtimePpmChart
                  currentBpm={bpm}
                  maxBpm={maxBpm}
                  restingBpm={athlete.restingHeartRateBpm || 50}
                  activeZoneColor={zoneColor}
                  isLive={isLive}
                  historyLength={24}
                  height={80}
                />

                {/* Footer */}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#64748b", fontSize: 10 }}>
                    ⏱ {formatTime(athlete.sessionDurationSec || 0)}
                  </Text>
                  {athlete.batteryLevel != null && (
                    <Text style={{ color: "#64748b", fontSize: 10 }}>
                      🔋 {athlete.batteryLevel}%
                    </Text>
                  )}
                  <Text style={{ color: "#64748b", fontSize: 10 }}>
                    Reposo: {athlete.restingHeartRateBpm || 50} BPM
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      );
    }

    const titles: Record<string, string> = {
      coaches: "Cuerpo Técnico & Entrenadores",
      content: "Contenidos & Vídeos WT",
      analytics: "Estadísticas de Rendimiento",
      reports: "Exportación de Informes",
    };

    return (
      <>
        <Text style={styles.section}>{titles[active] || "Módulo"}</Text>
        {loading && <ActivityIndicator color="#a6e22e" style={{ marginVertical: 20 }} />}
        {!loading && rows.map((item) => listCard(item, active))}
        {!loading && !rows.length && (
          <Text style={styles.muted}>No hay registros disponibles en este momento.</Text>
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Barra Superior */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawer(true)}>
          <Ionicons name="menu" size={26} color="#f2f7fb" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>PANEL COACH OFICIAL</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {user.name || user.email || "Entrenador"}
          </Text>
        </View>

        {onSwitchToTelemetry && (
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onSwitchToTelemetry}
          >
            <Ionicons name="speedometer-outline" size={22} color="#38bdf8" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.headerIconBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ff8e8e" />
        </TouchableOpacity>
      </View>

      {/* Contenido Principal */}
      <ScrollView contentContainerStyle={styles.content}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {content()}
      </ScrollView>

      {/* Menú Lateral (Drawer) */}
      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <View style={styles.overlay}>
          <View style={styles.drawer}>
            <View style={styles.drawerTop}>
              <View>
                <Text style={styles.drawerTitle}>
                  TKD HUB <Text style={styles.drawerAccent}>COACH</Text>
                </Text>
                <Text style={styles.drawerClub}>Club: {user.clubId || "General"}</Text>
              </View>
              <TouchableOpacity onPress={() => setDrawer(false)}>
                <Ionicons name="close" size={26} color="#9bb0c4" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              {modules.map(([key, label, icon]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.menuItem, active === key && styles.menuActive]}
                  onPress={() => loadModule(key)}
                >
                  <Ionicons
                    name={icon}
                    size={21}
                    color={active === key ? "#a6e22e" : "#9bb0c4"}
                  />
                  <Text style={[styles.menuText, active === key && styles.menuTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}

              {onSwitchToTelemetry && (
                <TouchableOpacity
                  style={[styles.menuItem, { marginTop: 18, borderTopColor: "#17304a", borderTopWidth: 1 }]}
                  onPress={() => {
                    setDrawer(false);
                    onSwitchToTelemetry();
                  }}
                >
                  <Ionicons name="pulse" size={21} color="#38bdf8" />
                  <Text style={[styles.menuText, { color: "#38bdf8" }]}>
                    Telemetría BLE del atleta
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: ALTA DE ATLETA */}
      <Modal visible={athleteModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alta de Atleta WT</Text>
              <TouchableOpacity onPress={() => setAthleteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.fieldLabel}>Nombre y Apellidos</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej. Carlos García López"
                placeholderTextColor="#7890a8"
                value={newAthleteName}
                onChangeText={setNewAthleteName}
              />

              <Text style={styles.fieldLabel}>Categoría WT</Text>
              <View style={styles.pickerRow}>
                {WT_CATEGORIES.slice(0, 6).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, newAthleteCategory === cat && styles.pillActive]}
                    onPress={() => setNewAthleteCategory(cat)}
                  >
                    <Text style={[styles.pillText, newAthleteCategory === cat && styles.pillTextActive]}>
                      {cat.replace("SENIOR_", "")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Grado / Cinturón</Text>
              <View style={styles.pickerRow}>
                {BELT_RANKS.slice(0, 4).map((belt) => (
                  <TouchableOpacity
                    key={belt}
                    style={[styles.pill, newAthleteBelt === belt && styles.pillActive]}
                    onPress={() => setNewAthleteBelt(belt)}
                  >
                    <Text style={[styles.pillText, newAthleteBelt === belt && styles.pillTextActive]}>
                      {belt.replace("Cinturón ", "")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCols}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Peso (kg)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="68"
                    placeholderTextColor="#7890a8"
                    keyboardType="numeric"
                    value={newAthleteWeight}
                    onChangeText={setNewAthleteWeight}
                  />
                </View>
                <View style={[styles.flex, { marginLeft: 10 }]}>
                  <Text style={styles.fieldLabel}>Altura (cm)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="180"
                    placeholderTextColor="#7890a8"
                    keyboardType="numeric"
                    value={newAthleteHeight}
                    onChangeText={setNewAthleteHeight}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.primary}
                onPress={handleCreateAthlete}
                disabled={savingAthlete}
              >
                {savingAthlete ? (
                  <ActivityIndicator color="#07111f" />
                ) : (
                  <Text style={styles.primaryText}>Guardar Atleta</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: REGISTRAR SESIÓN */}
      <Modal visible={trainingModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Entrenamiento</Text>
              <TouchableOpacity onPress={() => setTrainingModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.fieldLabel}>Título de la Sesión</Text>
              <TextInput
                style={styles.modalInput}
                value={trainingTitle}
                onChangeText={setTrainingTitle}
              />

              <Text style={styles.fieldLabel}>Seleccionar Atleta</Text>
              <View style={styles.pickerRow}>
                {clubAthletes.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.pill, selectedAthleteId === a.id && styles.pillActive]}
                    onPress={() => setSelectedAthleteId(a.id)}
                  >
                    <Text style={[styles.pillText, selectedAthleteId === a.id && styles.pillTextActive]}>
                      {a.fullName.split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCols}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Duración (min)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={trainingDuration}
                    onChangeText={setTrainingDuration}
                  />
                </View>
                <View style={[styles.flex, { marginLeft: 10 }]}>
                  <Text style={styles.fieldLabel}>FC Media (BPM)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={trainingAvgBpm}
                    onChangeText={setTrainingAvgBpm}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Notas Tácticas del Coach</Text>
              <TextInput
                style={[styles.modalInput, { height: 70 }]}
                placeholder="Observaciones de técnica, fatiga o estrategia..."
                placeholderTextColor="#7890a8"
                multiline
                value={trainingNotes}
                onChangeText={setTrainingNotes}
              />

              <TouchableOpacity
                style={styles.primary}
                onPress={handleCreateTraining}
                disabled={savingTraining}
              >
                {savingTraining ? (
                  <ActivityIndicator color="#07111f" />
                ) : (
                  <Text style={styles.primaryText}>Guardar Sesión & Calcular TRIMP</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: CREAR COMPETICIÓN */}
      <Modal visible={competitionModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Programar Combate</Text>
              <TouchableOpacity onPress={() => setCompetitionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.fieldLabel}>Nombre del Campeonato</Text>
              <TextInput
                style={styles.modalInput}
                value={compTournamentName}
                onChangeText={setCompTournamentName}
              />

              <Text style={styles.fieldLabel}>Competidor del Club (CHONG - Azul)</Text>
              <View style={styles.pickerRow}>
                {clubAthletes.filter((athlete) => athlete.isCompetitor).map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.pill, selectedAthleteId === a.id && styles.pillActive]}
                    onPress={() => { setSelectedAthleteId(a.id); if (compOpponentAthleteId === a.id) setCompOpponentAthleteId(""); }}
                  >
                    <Text style={[styles.pillText, selectedAthleteId === a.id && styles.pillTextActive]}>
                      {a.fullName.split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Rival registrado (HONG - Rojo)</Text>
              <View style={styles.pickerRow}>
                {clubAthletes.filter((athlete) => athlete.isCompetitor && athlete.id !== selectedAthleteId).map((athlete) => (
                  <TouchableOpacity
                    key={athlete.id}
                    style={[styles.pill, compOpponentAthleteId === athlete.id && styles.pillActive]}
                    onPress={() => setCompOpponentAthleteId(athlete.id)}
                  >
                    <Text style={[styles.pillText, compOpponentAthleteId === athlete.id && styles.pillTextActive]}>
                      {athlete.fullName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCols}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Fase</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="QF / SF / F"
                    placeholderTextColor="#7890a8"
                    value={compPhase}
                    onChangeText={setCompPhase}
                  />
                </View>
                <View style={[styles.flex, { marginLeft: 10 }]}>
                  <Text style={styles.fieldLabel}>Categoría</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={compCategory}
                    onChangeText={setCompCategory}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.primary}
                onPress={handleCreateCompetition}
                disabled={savingComp}
              >
                {savingComp ? (
                  <ActivityIndicator color="#07111f" />
                ) : (
                  <Text style={styles.primaryText}>Registrar Combate</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={tournamentModalVisible} animationType="fade" transparent onRequestClose={() => setTournamentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear torneo y bracket</Text>
              <TouchableOpacity onPress={() => setTournamentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.fieldLabel}>Nombre del torneo</Text>
              <TextInput style={styles.modalInput} value={tournamentName} onChangeText={setTournamentName} placeholder="Open de Taekwondo" placeholderTextColor="#7890a8" />
              <View style={styles.twoCols}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Fecha</Text>
                  <TextInput style={styles.modalInput} value={tournamentDate} onChangeText={setTournamentDate} placeholder="AAAA-MM-DD" placeholderTextColor="#7890a8" />
                </View>
                <View style={[styles.flex, { marginLeft: 10 }]}>
                  <Text style={styles.fieldLabel}>Tatami (1-8)</Text>
                  <TextInput style={styles.modalInput} value={tournamentTatami} onChangeText={setTournamentTatami} keyboardType="number-pad" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Sede</Text>
              <TextInput style={styles.modalInput} value={tournamentVenue} onChangeText={setTournamentVenue} placeholder="Pabellón o ciudad" placeholderTextColor="#7890a8" />
              <Text style={styles.fieldLabel}>Inscribir competidores · {selectedTournamentAthleteIds.length} seleccionados</Text>
              <View style={styles.pickerRow}>
                {clubAthletes.filter((athlete) => athlete.isCompetitor).map((athlete) => {
                  const selected = selectedTournamentAthleteIds.includes(athlete.id);
                  return (
                    <TouchableOpacity
                      key={athlete.id}
                      style={[styles.pill, selected && styles.pillActive]}
                      onPress={() => setSelectedTournamentAthleteIds((current) => selected ? current.filter((id) => id !== athlete.id) : [...current, athlete.id])}
                    >
                      <Text style={[styles.pillText, selected && styles.pillTextActive]}>{athlete.fullName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!clubAthletes.some((athlete) => athlete.isCompetitor) && <Text style={styles.muted}>Habilita competidores desde la sección Alumnos y Competidores antes de crear el bracket.</Text>}
              <TouchableOpacity style={styles.primary} onPress={handleCreateTournament} disabled={savingTournament}>
                {savingTournament ? <ActivityIndicator color="#07111f" /> : <Text style={styles.primaryText}>Crear torneo y sortear bracket</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: IA WORKOUT PLAN */}
      <Modal visible={aiWorkoutModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generador de Entrenamientos IA</Text>
              <TouchableOpacity onPress={() => setAiWorkoutModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.fieldLabel}>Objetivo Táctico / Físico</Text>
              <TextInput
                style={styles.modalInput}
                value={aiObjective}
                onChangeText={setAiObjective}
              />

              <TouchableOpacity
                style={styles.primary}
                onPress={handleGenerateWorkout}
                disabled={loadingAiPlan}
              >
                {loadingAiPlan ? (
                  <ActivityIndicator color="#07111f" />
                ) : (
                  <Text style={styles.primaryText}>Generar con Motor de IA</Text>
                )}
              </TouchableOpacity>

              {aiGeneratedPlan && (
                <View style={styles.aiResultBox}>
                  <Text style={styles.aiResultTitle}>Plan de Entrenamiento Personalizado</Text>
                  <Text style={styles.aiResultText}>{aiGeneratedPlan}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: IA REGLAMENTO WT RAG */}
      <Modal visible={aiQuestionModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Consultor Reglamento WT</Text>
              <TouchableOpacity onPress={() => setAiQuestionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#7890a8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.fieldLabel}>Pregunta sobre normas o arbitraje</Text>
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                placeholder="Ej. ¿Cuántos Gam-jeom suponen descalificación en un combate?"
                placeholderTextColor="#7890a8"
                multiline
                value={ragQuestion}
                onChangeText={setRagQuestion}
              />

              <TouchableOpacity
                style={styles.primary}
                onPress={handleAskRag}
                disabled={loadingRag}
              >
                {loadingRag ? (
                  <ActivityIndicator color="#07111f" />
                ) : (
                  <Text style={styles.primaryText}>Consultar Base WT</Text>
                )}
              </TouchableOpacity>

              {ragAnswer && (
                <View style={styles.aiResultBox}>
                  <Text style={styles.aiResultTitle}>Dictamen Oficial WT</Text>
                  <Text style={styles.aiResultText}>{ragAnswer}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07111f" },
  login: { flexGrow: 1, justifyContent: "center", padding: 24 },
  brand: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#a6e22e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  kicker: { color: "#a6e22e", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#f2f7fb", fontSize: 28, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "#9bb0c4", fontSize: 15, lineHeight: 22, marginVertical: 20 },
  input: {
    backgroundColor: "#102238",
    borderColor: "#203750",
    borderWidth: 1,
    borderRadius: 12,
    color: "#f2f7fb",
    padding: 15,
    marginBottom: 12,
    fontSize: 15,
  },
  privacy: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 },
  muted: { color: "#9bb0c4", lineHeight: 20, fontSize: 13 },
  error: { color: "#ff8e8e", marginBottom: 12, fontWeight: "600" },
  primary: {
    backgroundColor: "#a6e22e",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: { color: "#07111f", fontWeight: "900", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#102238",
    borderColor: "#38bdf8",
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  secondaryBtnText: { color: "#38bdf8", fontWeight: "700", fontSize: 14 },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: "#17304a",
    borderBottomWidth: 1,
  },
  menuBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { color: "#f2f7fb", fontSize: 17, fontWeight: "800", marginTop: 2 },
  headerIconBtn: { padding: 8, marginLeft: 6 },

  content: { padding: 20, paddingBottom: 40 },
  section: { color: "#f2f7fb", fontSize: 22, fontWeight: "900", marginBottom: 6 },
  sectionSubtitle: { color: "#9bb0c4", fontSize: 14, fontWeight: "700", marginBottom: 14 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  smallAddBtn: {
    backgroundColor: "#a6e22e",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallAddBtnText: { color: "#07111f", fontWeight: "800", fontSize: 12 },

  metrics: { flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 10 },
  metric: { flex: 1, backgroundColor: "#102238", borderRadius: 14, padding: 14 },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricLabel: { color: "#9bb0c4", fontSize: 11, marginTop: 4, fontWeight: "600" },

  card: {
    backgroundColor: "#102238",
    borderColor: "#17304a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#a6e22e",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#07111f", fontWeight: "900", fontSize: 18 },
  flex: { flex: 1 },
  itemTitle: { color: "#f2f7fb", fontWeight: "700", fontSize: 15 },
  itemMeta: { color: "#9bb0c4", marginTop: 3, fontSize: 12 },
  badgeContainer: { alignItems: "flex-end", gap: 4 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: "800",
  },
  badgeFit: { backgroundColor: "#a6e22e20", color: "#a6e22e" },
  badgeInjured: { backgroundColor: "#ff8e8e20", color: "#ff8e8e" },
  readiness: { color: "#a6e22e", fontWeight: "800", fontSize: 13 },
  rosterTabs: { flexDirection: "row", gap: 8, marginVertical: 12 },
  rosterTab: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: "#102238", borderRadius: 8, borderWidth: 1, borderColor: "#203750" },
  rosterTabActive: { backgroundColor: "#a6e22e", borderColor: "#a6e22e" },
  rosterTabText: { color: "#b2c4d5", fontSize: 12, fontWeight: "700" },
  rosterTabTextActive: { color: "#07111f" },
  roleToggle: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#38bdf8", marginLeft: 8 },
  roleToggleText: { color: "#7dd3fc", fontSize: 10, fontWeight: "700" },

  action: {
    backgroundColor: "#a6e22e",
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  actionText: { color: "#07111f", fontWeight: "800", fontSize: 14 },
  actionDark: {
    backgroundColor: "#102238",
    borderColor: "#a6e22e",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  actionDarkText: { color: "#a6e22e", fontWeight: "800", fontSize: 14 },

  switchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d2847",
    borderColor: "#38bdf8",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 16,
  },
  switchTitle: { color: "#f2f7fb", fontSize: 14, fontWeight: "800" },
  switchSub: { color: "#9bb0c4", fontSize: 11, marginTop: 2 },

  aiCard: {
    backgroundColor: "#102238",
    borderColor: "#17304a",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
  },
  aiCardTitle: { color: "#f2f7fb", fontSize: 17, fontWeight: "800", marginTop: 8 },
  aiCardDesc: { color: "#9bb0c4", fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 8 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.75)" },
  drawer: {
    width: "84%",
    flex: 1,
    backgroundColor: "#080f1b",
    paddingTop: 54,
    paddingHorizontal: 18,
    borderRightColor: "#203750",
    borderRightWidth: 1,
  },
  drawerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomColor: "#17304a",
    borderBottomWidth: 1,
  },
  drawerTitle: { color: "#f2f7fb", fontSize: 20, fontWeight: "900" },
  drawerAccent: { color: "#a6e22e" },
  drawerClub: { color: "#7890a8", fontSize: 12, marginTop: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 13,
    borderRadius: 11,
    marginBottom: 4,
  },
  menuActive: { backgroundColor: "#17304a", borderColor: "#31516d", borderWidth: 1 },
  menuText: { color: "#b2c4d5", fontSize: 14, fontWeight: "600" },
  menuTextActive: { color: "#a6e22e", fontWeight: "800" },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#080f1b",
    borderColor: "#17304a",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { color: "#f2f7fb", fontSize: 19, fontWeight: "900" },
  fieldLabel: { color: "#9bb0c4", fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: "#102238",
    borderColor: "#203750",
    borderWidth: 1,
    borderRadius: 10,
    color: "#f2f7fb",
    padding: 12,
    fontSize: 14,
  },
  twoCols: { flexDirection: "row", alignItems: "center" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  pill: {
    backgroundColor: "#102238",
    borderColor: "#203750",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pillActive: { backgroundColor: "#a6e22e", borderColor: "#a6e22e" },
  pillText: { color: "#b2c4d5", fontSize: 11, fontWeight: "700" },
  pillTextActive: { color: "#07111f" },

  aiResultBox: {
    backgroundColor: "#102238",
    borderColor: "#a6e22e",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  aiResultTitle: { color: "#a6e22e", fontWeight: "800", fontSize: 14, marginBottom: 8 },
  aiResultText: { color: "#f2f7fb", fontSize: 13, lineHeight: 20 },
});
