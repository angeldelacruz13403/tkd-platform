import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  Animated,
  FlatList,
  StatusBar as RNStatusBar,
  AppState,
  NativeModules,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getApiUrl,
  setApiUrl,
  requestAICoachAdvice,
  syncTrainingToCloud,
  streamLiveTelemetryToCloud,
  loginToApi,
  setApiToken,
  fetchAthletesFromApi,
  fetchTrainingHistoryFromApi,
  fetchPublishedAIPlans,
  fetchAssignedCorrectiveWork,
  updateAthleteCorrectiveWork,
} from './api';
import { useBleHeartRate } from './ble';
import TrainerApp from './TrainerApp';
import AdminApp from './AdminApp';
import RealtimePpmChart from './RealtimePpmChart';
import UpcomingTrainings, { LiveBlockTelemetry } from './UpcomingTrainings';
import ClubHub from './ClubHub';
import TabataTimer from './TabataTimer';

const { width } = Dimensions.get('window');
// appMode se determina automáticamente tras el login según el rol del usuario

// ─── Foreground Service helper (Android) ──────────────────────────────────────
// Keeps the process alive when the screen is off so BLE stays connected
// and JS timers keep running.
const TrainingService = NativeModules.TrainingService;

async function startForegroundService() {
  if (Platform.OS !== 'android' || !TrainingService) return;
  try { await TrainingService.startTrainingService(); } catch (e) { console.warn('[FG-Service] start failed:', e); }
}

async function stopForegroundService() {
  if (Platform.OS !== 'android' || !TrainingService) return;
  try { await TrainingService.stopTrainingService(); } catch (e) { console.warn('[FG-Service] stop failed:', e); }
}

// Data Types
type ActiveTab = 'telemetry' | 'training' | 'tabata' | 'history' | 'ai' | 'profile' | 'club';
type TrainingMode = 'physical' | 'technical' | 'tactical' | 'round-races' | 'combat';
type RacePhase = 'idle' | 'round' | 'rest' | 'long-rest' | 'ready';

const RACE_ROUND_SECONDS = 120;
const RACE_REST_SECONDS = 60;
const RACE_LONG_REST_SECONDS = 180;

const TRAINING_MODES: Array<{ key: TrainingMode; label: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'physical', label: 'Físico', description: 'Fuerza, potencia y capacidad anaeróbica', icon: 'dumbbell' },
  { key: 'technical', label: 'Técnico', description: 'Técnica, precisión y combinaciones', icon: 'karate' },
  { key: 'tactical', label: 'Táctico', description: 'Distancia, lectura y toma de decisiones', icon: 'strategy' },
  { key: 'round-races', label: 'Carreras por asaltos', description: 'Intervalos estructurados por asalto', icon: 'timer-outline' },
  { key: 'combat', label: 'Combate', description: 'Entrenamiento táctico de combate', icon: 'sword-cross' },
];

interface AthleteBio {
  id: string;
  name: string;
  category: string;
  club: string;
  belt: string;
  weight: number;
  height: number;
  maxBpm: number;
  restBpm: number;
  vo2max: number;
  readiness: number;
  favouriteKick: string;
  record: { wins: number; losses: number };
}

interface TrainingHistoryEntry {
  id: string;
  athleteId: string;
  title: string;
  date: string;
  durationMinutes: number;
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  trimpScore: number;
  type: string;
  status: string;
}

// ─── Perfil de atleta por defecto ─── Se rellena desde el panel web / Supabase
const DEFAULT_ATHLETE: AthleteBio = {
  id: 'unassigned',
  name: 'Atleta',
  category: 'Sin categoría',
  club: 'Sin club',
  belt: 'Sin grado',
  weight: 0,
  height: 0,
  maxBpm: 200,
  restBpm: 0,
  vo2max: 0,
  readiness: 0,
  favouriteKick: 'Sin definir',
  record: { wins: 0, losses: 0 },
};

export default function App() {
  useKeepAwake();

  // 'athlete' | 'coach' | 'admin' — se asigna automáticamente tras el login
  const [appMode, setAppMode] = useState<'athlete' | 'coach' | 'admin'>('athlete');
  const [currentTab, setCurrentTab] = useState<ActiveTab>('telemetry');
  const [currentAthlete, setCurrentAthlete] = useState<AthleteBio>(DEFAULT_ATHLETE);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryEntry[]>([]);
  const [trainingHistoryLoading, setTrainingHistoryLoading] = useState(false);
  const [trainingHistoryError, setTrainingHistoryError] = useState('');
  const [trainingHistoryRefresh, setTrainingHistoryRefresh] = useState(0);
  const [aiPlans, setAiPlans] = useState<any[]>([]);
  const [correctiveWorks, setCorrectiveWorks] = useState<any[]>([]);
  const [aiTrainingLoading, setAiTrainingLoading] = useState(false);
  const [aiTrainingError, setAiTrainingError] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const mapApiAthleteToBio = (athlete: any): AthleteBio => ({
    id: athlete.id || 'unknown',
    name: athlete.fullName || athlete.name || 'Atleta',
    category: athlete.category || 'Sin categoría',
    club: athlete.clubName || athlete.club || 'Sin club',
    belt: athlete.beltRank || athlete.belt || 'Sin grado',
    weight: Number(athlete.weightKg || 0),
    height: Number(athlete.heightCm || 0),
    maxBpm: Number(athlete.maxHeartRateBpm || athlete.maxBpm || 200),
    restBpm: Number(athlete.restingHeartRateBpm || athlete.restBpm || 0),
    vo2max: Number(athlete.vo2MaxEstimate || athlete.vo2max || 0),
    readiness: Number(athlete.readinessScore || athlete.readiness || 0),
    favouriteKick: athlete.stats?.favouriteTechnique || athlete.favouriteKick || 'Sin definir',
    record: {
      wins: Number(athlete.stats?.matchesWon ?? athlete.record?.wins ?? 0),
      losses: Number(
        (athlete.stats?.matchesPlayed ?? athlete.record?.losses ?? 0) -
          (athlete.stats?.matchesWon ?? athlete.record?.wins ?? 0)
      ),
    },
  });

  const loadAthleteProfile = async (nameHint?: string) => {
    try {
      const athletes = await fetchAthletesFromApi();
      if (!athletes || athletes.length === 0) {
        setCurrentAthlete(DEFAULT_ATHLETE);
        return;
      }

      const selected = athletes.find((athlete: any) => {
        const values = [
          athlete.fullName,
          athlete.name,
          athlete.userId,
          athlete.id,
          athlete.email,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        if (!nameHint) return true;
        return values.some((value) => value.includes(String(nameHint).toLowerCase()));
      }) || athletes[0];

      setCurrentAthlete(mapApiAthleteToBio(selected));
    } catch {
      setCurrentAthlete(DEFAULT_ATHLETE);
    }
  };

  const handleLogin = async () => {
    const normalizedIdentifier = loginIdentifier.trim();

    if (!normalizedIdentifier || !loginPassword.trim()) {
      setLoginError('Introduce usuario y contraseña para continuar.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const result = await loginToApi(normalizedIdentifier, loginPassword.trim());
      setApiToken(result.token);
      const user = result.user;
      setAuthenticatedUser({ ...user, profile: result.profile });
      const userRole = user?.role;
      if (userRole === 'ADMIN') {
        setAppMode('admin');
      } else if (userRole === 'COACH' || userRole === 'CLUB') {
        setAppMode('coach');
      } else {
        setAppMode('athlete');
        if (result.profile?.athleteId) {
          setCurrentAthlete((prev) => ({
            ...prev,
            id: result.profile.athleteId,
            name: result.profile.athleteName || user?.name || prev.name,
            maxBpm: Number(result.profile.maxHeartRateBpm) || prev.maxBpm,
            restBpm: Number(result.profile.restingHeartRateBpm) || prev.restBpm,
            club: result.profile.clubId || prev.club,
          }));
        }
        await loadAthleteProfile(user?.name || normalizedIdentifier);
      }
    } catch (error: any) {
      setLoginError(error?.message || 'No se pudo iniciar sesión con la API.');
      setAuthenticatedUser(null);
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (currentTab !== 'history' || !authenticatedUser || currentAthlete.id === 'unassigned') return;
    let active = true;
    setTrainingHistoryLoading(true);
    setTrainingHistoryError('');
    fetchTrainingHistoryFromApi()
      .then((records) => {
        if (active) {
          setTrainingHistory(records.filter((record: TrainingHistoryEntry) =>
            record.athleteId === currentAthlete.id && record.status === 'COMPLETED'
          ));
        }
      })
      .catch((error: unknown) => {
        if (active) setTrainingHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
      })
      .finally(() => { if (active) setTrainingHistoryLoading(false); });
    return () => { active = false; };
  }, [currentTab, authenticatedUser, currentAthlete.id, trainingHistoryRefresh]);

  useEffect(() => {
    if (currentTab !== 'ai' || !authenticatedUser || currentAthlete.id === 'unassigned') return;
    let active = true;
    setAiTrainingLoading(true);
    setAiTrainingError('');
    Promise.all([
      fetchPublishedAIPlans(currentAthlete.id),
      fetchAssignedCorrectiveWork(currentAthlete.id),
    ])
      .then(([plans, works]) => {
        if (active) {
          setAiPlans(plans);
          setCorrectiveWorks(works);
        }
      })
      .catch((error: unknown) => {
        if (active) setAiTrainingError(error instanceof Error ? error.message : 'No se pudo cargar el entrenamiento.');
      })
      .finally(() => { if (active) setAiTrainingLoading(false); });
    return () => { active = false; };
  }, [currentTab, authenticatedUser, currentAthlete.id]);

  const updateCorrectiveWorkStatus = async (workId: string, status: 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await updateAthleteCorrectiveWork({ athleteId: currentAthlete.id, workId, status });
      const works = await fetchAssignedCorrectiveWork(currentAthlete.id);
      setCorrectiveWorks(works);
    } catch (error) {
      setAiTrainingError(error instanceof Error ? error.message : 'No se pudo actualizar el trabajo.');
    }
  };

  // ─── BLE Hook ─────────────────────────────────────────────────────────────
  const ble = useBleHeartRate();
  const [bleScanModalVisible, setBleScanModalVisible] = useState(false);

  // ─── Telemetry State ──────────────────────────────────────────────────────
  const [isTelemetryRunning, setIsTelemetryRunning] = useState(false);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('physical');
  const [isTrainingRunning, setIsTrainingRunning] = useState(false);
  const [trainingElapsed, setTrainingElapsed] = useState(0);
  const trainingStartedAtRef = useRef<number | null>(null);   // timestamp when training started
  const sessionStartedAtRef = useRef<number | null>(null);    // timestamp when BLE session started
  const [racePhase, setRacePhase] = useState<RacePhase>('idle');
  const [raceRound, setRaceRound] = useState(0);
  const [raceTimeLeft, setRaceTimeLeft] = useState(0);
  const [raceDistanceMeters, setRaceDistanceMeters] = useState(0);
  const [raceSpeedMps, setRaceSpeedMps] = useState(0);
  const [raceRecoveryStartBpm, setRaceRecoveryStartBpm] = useState(0);
  const [raceRecoveryDropBpm, setRaceRecoveryDropBpm] = useState(0);
  const [raceRecoveryAssessment, setRaceRecoveryAssessment] = useState('');
  const [raceRecoveryPlan, setRaceRecoveryPlan] = useState('');
  const [trainingError, setTrainingError] = useState('');
  const raceBpmSamplesRef = useRef<number[]>([]);
  const generalBpmSamplesRef = useRef<number[]>([]);
  const raceLocationRef = useRef<Location.LocationSubscription | null>(null);
  const lastRaceLocationRef = useRef<Location.LocationObject | null>(null);
  // currentBpm viene de BLE; si no hay conexión BLE usamos null
  const currentBpm: number = ble.bpm ?? 0;
  const [sessionDuration, setSessionDuration] = useState(0); // seconds
  const [trimpScore, setTrimpScore] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // AI Assistant State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(
    'Esperando datos reales de una sesión para generar una recomendación.'
  );

  // Vercel API Config Modal State
  const [apiUrlModalVisible, setApiUrlModalVisible] = useState(false);
  const [inputApiUrl, setInputApiUrl] = useState(getApiUrl());

  // ─── Heartbeat animation — driven by real BLE BPM ─────────────────────────
  const isConnected = ble.status === 'connected';

  useEffect(() => {
    if (!isConnected || !ble.bpm) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 60000 / (ble.bpm * 2), // ritmo real del corazón
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 60000 / (ble.bpm * 2),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isConnected, ble.bpm]);

  const [isTransmittingLive, setIsTransmittingLive] = useState(false);
  const [scheduledWorkoutRunning, setScheduledWorkoutRunning] = useState(false);
  const scheduledBlockTelemetryRef = useRef<LiveBlockTelemetry | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string>('');
  const [liveTelemetryError, setLiveTelemetryError] = useState<string>('');
  const liveTelemetrySnapshotRef = useRef<any>(null);
  const telemetryRequestInFlightRef = useRef(false);

  liveTelemetrySnapshotRef.current = {
    athleteId: currentAthlete.id && currentAthlete.id !== 'unassigned'
      ? currentAthlete.id
      : authenticatedUser?.profile?.athleteId || '',
    athleteName: currentAthlete.name && currentAthlete.name !== 'Atleta'
      ? currentAthlete.name
      : authenticatedUser?.profile?.athleteName || authenticatedUser?.name || 'Atleta TKD',
    isConnected,
    isTrainingRunning: isTrainingRunning || scheduledWorkoutRunning,
    currentBpm,
    maxBpm: currentAthlete.maxBpm || 200,
    trimpScore,
    sessionDurationSec: scheduledBlockTelemetryRef.current
      ? scheduledBlockTelemetryRef.current.blocks.reduce((total, block) => total + block.elapsedSeconds, 0)
      : isTrainingRunning ? trainingElapsed : sessionDuration,
    trainingMode: scheduledBlockTelemetryRef.current?.trainingMode || trainingMode,
    batteryLevel: ble.batteryLevel,
    blockTelemetry: scheduledBlockTelemetryRef.current || undefined,
  };

  // Sesión timer — solo corre cuando BLE conectado (timestamp-based para segundo plano)
  useEffect(() => {
    if (!isConnected) {
      sessionStartedAtRef.current = null;
      return;
    }
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = Date.now() - sessionDuration * 1000;
    const interval = setInterval(() => {
      if (!sessionStartedAtRef.current) return;
      const newDuration = Math.floor((Date.now() - sessionStartedAtRef.current) / 1000);
      setSessionDuration(newDuration);
      // Actualiza TRIMP cada segundo: hr_ratio * duration_fraction
      const latest = liveTelemetrySnapshotRef.current;
      if (latest?.currentBpm && latest.maxBpm > 0) {
        const hrRatio = latest.currentBpm / latest.maxBpm;
        setTrimpScore((prev) => Math.round(prev + (1 / 60) * hrRatio * 1.92 * Math.exp(1.67 * hrRatio)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // ─── Transmisión en tiempo real de PPM al servidor (telemetría simultánea) ──
  useEffect(() => {
    let active = true;
    const transmitLatestSample = async () => {
      const sample = liveTelemetrySnapshotRef.current;
      if (!sample || telemetryRequestInFlightRef.current) return;
      if (!sample.isConnected && !sample.isTrainingRunning) {
        setIsTransmittingLive(false);
        return;
      }
      if (!sample.athleteId || sample.currentBpm <= 0) {
        setIsTransmittingLive(false);
        return;
      }

      const percentage = Math.round((sample.currentBpm / sample.maxBpm) * 100);
      const liveZone = percentage < 60 ? { zone: 'Z1', name: 'Recuperación', color: '#38bdf8' }
        : percentage < 70 ? { zone: 'Z2', name: 'Aeróbico Ligero', color: '#34d399' }
        : percentage < 80 ? { zone: 'Z3', name: 'Tempo / Resistencia', color: '#fbbf24' }
        : percentage < 90 ? { zone: 'Z4', name: 'Umbral Anaeróbico', color: '#fb923c' }
        : { zone: 'Z5', name: 'Anaeróbico Láctico', color: '#f43f5e' };

      telemetryRequestInFlightRef.current = true;
      try {
        const result = await streamLiveTelemetryToCloud({
          athleteId: sample.athleteId,
          athleteName: sample.athleteName,
          currentBpm: sample.currentBpm,
          maxHeartRateBpm: sample.maxBpm,
          zone: liveZone.zone,
          zoneName: liveZone.name,
          zoneColor: liveZone.color,
          trimpScore: sample.trimpScore,
          sessionDurationSec: sample.sessionDurationSec,
          trainingMode: sample.trainingMode,
          isTrainingRunning: sample.isTrainingRunning,
          batteryLevel: sample.batteryLevel,
          blockTelemetry: sample.blockTelemetry,
        });
        if (!active) return;
        setIsTransmittingLive(result.ok);
        if (result.ok) {
          setLastCloudSyncAt(new Date().toLocaleTimeString());
          setLiveTelemetryError('');
        } else if (result.error) {
          setLiveTelemetryError(`${result.status ? `HTTP ${result.status}: ` : ''}${result.error}`);
        }
      } finally {
        telemetryRequestInFlightRef.current = false;
      }
    };

    void transmitLatestSample();
    const interval = setInterval(() => { void transmitLatestSample(); }, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSyncSessionNow = async () => {
    const targetAthleteId = (currentAthlete.id && currentAthlete.id !== 'unassigned')
      ? currentAthlete.id
      : authenticatedUser?.profile?.athleteId || '';
    if (!targetAthleteId) {
      setSyncFeedbackMessage('⚠️ Tu usuario todavía no está vinculado a un atleta en el panel.');
      return;
    }
    const samples = [...generalBpmSamplesRef.current];
    if (currentBpm > 0 && samples[samples.length - 1] !== currentBpm) samples.push(currentBpm);
    const durationSec = trainingElapsed || sessionDuration;
    if (durationSec <= 0 || samples.length === 0) {
      setSyncFeedbackMessage('⚠️ Inicia un entrenamiento y registra PPM reales antes de sincronizar.');
      return;
    }
    const avgBpm = Math.round(samples.reduce((sum, bpm) => sum + bpm, 0) / samples.length);
    const maxBpm = Math.max(...samples);
    setSyncFeedbackMessage('Sincronizando entrenamiento y PPM con el servidor...');
    try {
      const syncResult = await syncTrainingToCloud({
        athleteId: targetAthleteId,
        title: TRAINING_MODES.find((mode) => mode.key === trainingMode)?.label || 'Entrenamiento TKD',
        durationMinutes: Math.max(1, Math.round(durationSec / 60)),
        avgHeartRateBpm: avgBpm,
        maxHeartRateBpm: maxBpm,
        type: trainingMode === 'combat' ? 'SPARRING_TACTICAL' : 'INTERVALS_HIGH_LOAD',
        heartRateRecovery1Min: raceRecoveryDropBpm,
        bpmSeries: samples.map((bpm, index) => ({ time: index, bpm })),
        tacticalNotes: `Sesión de ${trainingMode} sincronizada desde la app móvil. Carga TRIMP: ${trimpScore}.`,
      });
      if (syncResult.ok) {
        setSyncFeedbackMessage('✅ Entrenamiento y PPM guardados en el servidor correctamente.');
        setLastCloudSyncAt(new Date().toLocaleTimeString());
      } else {
        setSyncFeedbackMessage(`⚠️ No se guardó el entrenamiento${syncResult.status ? ` (HTTP ${syncResult.status})` : ""}: ${syncResult.error || "revisa la conexión y la sesión"}`);
      }
    } catch (error: any) {
      setSyncFeedbackMessage(`⚠️ No se guardó el entrenamiento: ${error?.message || "error de conexión"}`);
    }
    setTimeout(() => setSyncFeedbackMessage(''), 4500);
  };

  useEffect(() => {
    if (!isTrainingRunning) {
      trainingStartedAtRef.current = null;
      return;
    }
    if (!trainingStartedAtRef.current) trainingStartedAtRef.current = Date.now() - trainingElapsed * 1000;
    const interval = setInterval(() => {
      if (!trainingStartedAtRef.current) return;
      const newElapsed = Math.floor((Date.now() - trainingStartedAtRef.current) / 1000);
      setTrainingElapsed(newElapsed);
      const bpm = liveTelemetrySnapshotRef.current?.currentBpm || 0;
      if (bpm > 0) {
        generalBpmSamplesRef.current.push(bpm);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isTrainingRunning]);

  // ─── AppState: recalculate elapsed when returning from background ────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Recalculate training elapsed from timestamp
        if (isTrainingRunning && trainingStartedAtRef.current) {
          setTrainingElapsed(Math.floor((Date.now() - trainingStartedAtRef.current) / 1000));
        }
        // Recalculate session duration from timestamp
        if (isConnected && sessionStartedAtRef.current) {
          setSessionDuration(Math.floor((Date.now() - sessionStartedAtRef.current) / 1000));
        }
      }
    });
    return () => subscription.remove();
  }, [isTrainingRunning, isConnected]);

  useEffect(() => {
    if (trainingMode !== 'round-races' || racePhase === 'idle' || racePhase === 'ready') return;
    const interval = setInterval(() => {
      if (currentBpm > 0) raceBpmSamplesRef.current.push(currentBpm);
      setRaceTimeLeft((previous) => {
        if (previous > 1) return previous - 1;
        if (racePhase === 'round') {
          if (raceRound > 0 && raceRound % 3 === 0) {
            setRaceRecoveryStartBpm(currentBpm);
            setRacePhase('long-rest');
            return RACE_LONG_REST_SECONDS;
          }
          setRaceRecoveryStartBpm(currentBpm);
          setRacePhase('rest');
          return RACE_REST_SECONDS;
        }
        if (racePhase === 'rest') {
          setRaceRecoveryDropBpm(Math.max(0, raceRecoveryStartBpm - currentBpm));
          setRaceRound((previousRound) => previousRound + 1);
          setRacePhase('round');
          return RACE_ROUND_SECONDS;
        }
        if (racePhase === 'long-rest') {
          setRaceRecoveryDropBpm(Math.max(0, raceRecoveryStartBpm - currentBpm));
          setRaceRecoveryAssessment(
            currentBpm <= raceRecoveryStartBpm - 30 ? 'Buena recuperación' :
            currentBpm <= raceRecoveryStartBpm - 20 ? 'Recuperación mejorable' : 'Recuperación baja'
          );
          setRaceRecoveryPlan(
            currentBpm <= raceRecoveryStartBpm - 30
              ? 'Mantén el trabajo de base y conserva 3 minutos de recuperación entre bloques.'
              : 'Añade respiración controlada, carrera aeróbica suave y trabajo de recuperación entre asaltos.'
          );
          setRacePhase('ready');
          return 0;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trainingMode, racePhase, raceRound, currentBpm, raceRecoveryStartBpm]);

  const stopRaceLocation = () => {
    raceLocationRef.current?.remove();
    raceLocationRef.current = null;
    lastRaceLocationRef.current = null;
  };

  const startRaceLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      throw new Error('Se necesita permiso de ubicación para medir kilómetros y ritmo.');
    }
    raceLocationRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
      (location) => {
        const previous = lastRaceLocationRef.current;
        if (previous) {
          const latDelta = (location.coords.latitude - previous.coords.latitude) * 111320;
          const lonDelta = (location.coords.longitude - previous.coords.longitude) * 111320 * Math.cos(location.coords.latitude * Math.PI / 180);
          setRaceDistanceMeters((distance) => distance + Math.sqrt(latDelta * latDelta + lonDelta * lonDelta));
        }
        if (typeof location.coords.speed === 'number' && location.coords.speed >= 0) setRaceSpeedMps(location.coords.speed);
        lastRaceLocationRef.current = location;
      }
    );
  };

  const finishRaceBlock = async () => {
    if (racePhase !== 'ready') return;
    setIsTrainingRunning(false);
    trainingStartedAtRef.current = null;
    await stopForegroundService();
    stopRaceLocation();
    if (isConnected && currentAthlete.id !== 'unassigned') {
      const averageBpm = raceBpmSamplesRef.current.length
        ? Math.round(raceBpmSamplesRef.current.reduce((sum, bpm) => sum + bpm, 0) / raceBpmSamplesRef.current.length)
        : 0;
      await syncTrainingToCloud({
        athleteId: currentAthlete.id,
        title: `Carrera por asaltos: ${raceRound} asaltos`,
        durationMinutes: Math.round(trainingElapsed / 60),
        avgHeartRateBpm: averageBpm,
        maxHeartRateBpm: Math.max(...raceBpmSamplesRef.current, currentBpm),
        type: 'INTERVALS_HIGH_LOAD',
        heartRateRecovery1Min: raceRecoveryDropBpm,
        bpmSeries: raceBpmSamplesRef.current.map((bpm, index) => ({ time: index, bpm })),
        tacticalNotes: `Distancia: ${(raceDistanceMeters / 1000).toFixed(2)} km. Ritmo actual: ${(raceSpeedMps > 0 ? 1000 / raceSpeedMps : 0).toFixed(0)} s/km. Recuperación: ${raceRecoveryAssessment}. Plan: ${raceRecoveryPlan}`,
      });
    }
  };

  const startTraining = async () => {
    setTrainingError('');
    generalBpmSamplesRef.current = [];
    if (trainingMode === 'round-races') {
      if (!isConnected) {
        setTrainingError('Conecta el pulsómetro BLE antes de iniciar la carrera por asaltos.');
        return;
      }
      try {
        await startRaceLocation();
      } catch (error: any) {
        setTrainingError(error?.message || 'No se pudo activar el GPS.');
        return;
      }
      raceBpmSamplesRef.current = [];
      setRaceDistanceMeters(0);
      setRaceRound(1);
      setRacePhase('round');
      setRaceTimeLeft(RACE_ROUND_SECONDS);
      setTrainingElapsed(0);
      trainingStartedAtRef.current = Date.now();
      setIsTrainingRunning(true);
      await startForegroundService();
      return;
    }
    setTrainingElapsed(0);
    trainingStartedAtRef.current = Date.now();
    setIsTrainingRunning(true);
    await startForegroundService();
  };

  const toggleTraining = async () => {
    if (scheduledWorkoutRunning) return;
    if (trainingMode === 'round-races') {
      if (racePhase === 'ready') await finishRaceBlock();
      else if (racePhase === 'idle') await startTraining();
      return;
    }
    if (isTrainingRunning) {
      setIsTrainingRunning(false);
      trainingStartedAtRef.current = null;
      await stopForegroundService();
      if (trainingElapsed > 0 && isConnected && currentAthlete.id !== 'unassigned') {
        const samples = generalBpmSamplesRef.current;
        const avgBpm = samples.length > 0
          ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
          : currentBpm;
        const maxBpm = samples.length > 0
          ? Math.max(...samples)
          : (currentAthlete.maxBpm || currentBpm);

        await syncTrainingToCloud({
          athleteId: currentAthlete.id,
          title: TRAINING_MODES.find((mode) => mode.key === trainingMode)?.label || 'Entrenamiento',
          durationMinutes: Math.max(1, Math.round(trainingElapsed / 60)),
          avgHeartRateBpm: avgBpm,
          maxHeartRateBpm: maxBpm,
          type: trainingMode === 'combat' ? 'SPARRING_TACTICAL' : 'INTERVALS_HIGH_LOAD',
          bpmSeries: samples.map((bpm, index) => ({ time: index, bpm })),
        });
      }
      return;
    }
    await startTraining();
  };

  if (!authenticatedUser) {
    if (appMode === 'admin') {
      return (
        <AdminApp
          user={authenticatedUser || { id: '' }}
          onLogout={() => { setAuthenticatedUser(null); setAppMode('athlete'); setApiToken(''); }}
        />
      );
    }
    if (appMode === 'coach') {
      return (
        <TrainerApp
          onSwitchToTelemetry={() => setAppMode('athlete')}
          onLogout={() => {
            setAuthenticatedUser(null);
            setAppMode('athlete');
            setApiToken('');
          }}
        />
      );
    }

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#06090f', justifyContent: 'center' }]}> 
        <StatusBar style="light" />
        <View style={{ paddingHorizontal: 24, width: '100%' }}>
          <View style={styles.card}>
            <Text style={[styles.cardHeaderTitle, { textAlign: 'center', fontSize: 16, marginBottom: 8 }]}>TKD GLOBAL HUB</Text>
            <Text style={[styles.cardDescription, { textAlign: 'center', marginBottom: 16 }]}>Debes iniciar sesión para acceder a la app.</Text>
            <Text style={styles.detailLabel}>Usuario</Text>
            <TextInput
              style={styles.apiTextInput}
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              placeholder="Tu usuario o nombre"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.detailLabel, { marginTop: 12 }]}>Contraseña</Text>
            <TextInput
              style={styles.apiTextInput}
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="Introduce la contraseña"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loginError ? <Text style={{ color: '#fca5a5', fontSize: 12, marginTop: 12 }}>{loginError}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 18, backgroundColor: '#0284c7' }]}
              onPress={handleLogin}
              disabled={isLoggingIn}
            >
              <Ionicons name="lock-closed-outline" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>{isLoggingIn ? 'Conectando...' : 'Iniciar sesión'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderColor: '#a6e22e', borderWidth: 1, borderRadius: 10 }}
              onPress={() => setAppMode('coach')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#a6e22e" />
              <Text style={{ color: '#a6e22e', fontWeight: '700', fontSize: 13 }}>
                Entrar al Panel de Entrenador (Coach)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (appMode === 'admin') {
    return (
      <AdminApp
        user={authenticatedUser}
        onLogout={() => { setAuthenticatedUser(null); setAppMode('athlete'); setApiToken(''); }}
      />
    );
  }

  if (appMode === 'coach') {
    return (
      <TrainerApp
        initialUser={authenticatedUser}
        onSwitchToTelemetry={() => setAppMode('athlete')}
        onLogout={() => {
          setAuthenticatedUser(null);
          setAppMode('athlete');
          setApiToken('');
        }}
      />
    );
  }

  // Heart rate zones
  const getBpmZone = (bpm: number) => {
    const pct = Math.round((bpm / currentAthlete.maxBpm) * 100);
    if (pct < 60) return { zone: 'Z1', name: 'Recuperación', color: '#38bdf8' };
    if (pct < 70) return { zone: 'Z2', name: 'Aeróbico Ligero', color: '#34d399' };
    if (pct < 80) return { zone: 'Z3', name: 'Tempo / Resistencia', color: '#fbbf24' };
    if (pct < 90) return { zone: 'Z4', name: 'Umbral Anaeróbico', color: '#fb923c' };
    return { zone: 'Z5', name: 'Anaeróbico Láctico (Asalto 3)', color: '#f43f5e' };
  };

  const currentZone = getBpmZone(currentBpm);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const triggerAIRecheck = async () => {
    setAiGenerating(true);
    try {
      const res = await requestAICoachAdvice({
        athleteId: currentAthlete.id,
        round: 3,
        currentBpm,
        trimpScore,
        recoveryDropBpm: raceRecoveryDropBpm,
        recoveryDurationSeconds: trainingMode === 'round-races' ? RACE_LONG_REST_SECONDS : 0,
        distanceKm: raceDistanceMeters / 1000,
        avgSpeedMps: raceSpeedMps,
        trainingMode,
      });
      setAiAdvice(res.advice);
    } catch {
      setAiAdvice(
        `No se pudo consultar la IA.\n` +
          `• FC actual: ${currentBpm || 0} BPM\n` +
          `• TRIMP acumulado: ${trimpScore}\n` +
          `No se genera una táctica sin datos reales.`
      );
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#38bdf8" />
          </View>
          <View>
            <View style={styles.rowCenter}>
              <Text style={styles.headerTitle}>TKD GLOBAL HUB</Text>
              <View style={styles.proTag}>
                <Text style={styles.proTagText}>PRO WT</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>App Móvil • Expo Go & APK</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Athlete Switcher Button */}
          <TouchableOpacity
            style={styles.athleteSwitchBtn}
            onPress={() => {
              setCurrentAthlete((prev) => ({
                ...prev,
                name: authenticatedUser?.name ?? prev.name,
              }));
            }}
          >
            <Ionicons name="person-circle-outline" size={16} color="#38bdf8" />
            <Text style={styles.athleteSwitchText} numberOfLines={1}>
              {authenticatedUser?.name?.split(' ')[0] ?? currentAthlete.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.athleteSwitchBtn, { borderColor: '#a6e22e', backgroundColor: '#a6e22e20', marginLeft: 8 }]}
            onPress={() => setAppMode('coach')}
          >
            <Ionicons name="shield-checkmark" size={16} color="#a6e22e" />
            <Text style={[styles.athleteSwitchText, { color: '#a6e22e', fontWeight: '800' }]}>
              Panel Coach
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BLE & Vercel Telemetry Status Bar */}
      <View style={styles.statusBarWrapper}>
        {/* BLE Status Pill */}
        <TouchableOpacity
          style={[styles.statusPill,
            isConnected
              ? { backgroundColor: '#052e16' }
              : { backgroundColor: '#1c1917' }
          ]}
          onPress={() => {
            setBleScanModalVisible(true);
            if (!isConnected) ble.startScan();
          }}
        >
          <View style={[
            styles.liveIndicator,
            {
              backgroundColor:
                ble.status === 'connected' ? '#22c55e' :
                ble.status === 'scanning'  ? '#facc15' :
                ble.status === 'error'     ? '#ef4444' :
                                             '#475569',
            }
          ]} />
          <Text style={styles.statusPillText}>
            {ble.status === 'connected'   ? `♥ ${ble.deviceName || 'BLE'}` :
             ble.status === 'scanning'    ? 'Buscando...' :
             ble.status === 'connecting'  ? 'Conectando...' :
             ble.status === 'error'       ? 'Error BLE ✕' :
                                            'COOSPO HW9'}
          </Text>
        </TouchableOpacity>

        {/* Live Cloud PPM Streaming Pill */}
        <TouchableOpacity
          style={[
            styles.statusPill,
            isTransmittingLive
              ? { backgroundColor: '#052e16', borderColor: '#22c55e', borderWidth: 1 }
              : { backgroundColor: '#1e293b' }
          ]}
          onPress={handleSyncSessionNow}
        >
          <Ionicons
            name={isTransmittingLive ? "radio" : "cloud-upload-outline"}
            size={12}
            color={isTransmittingLive ? "#4ade80" : "#94a3b8"}
          />
          <Text style={[styles.statusPillText, { color: isTransmittingLive ? "#4ade80" : "#94a3b8", marginLeft: 4 }]}>
            {isTransmittingLive ? `PPM en Vivo 📡` : `PPM Servidor`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statusPill, { backgroundColor: '#022c22' }]}
          onPress={() => {
            setInputApiUrl(getApiUrl());
            setApiUrlModalVisible(true);
          }}
        >
          <Ionicons name="cloud-done-outline" size={12} color="#34d399" />
          <Text style={[styles.statusPillText, { color: '#34d399', marginLeft: 4 }]}>
            Vercel API
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen Body */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <UpcomingTrainings
          athleteId={currentAthlete.id}
          currentBpm={currentBpm}
          isConnected={isConnected}
          visible={currentTab === 'training'}
          onRunningChange={setScheduledWorkoutRunning}
          onBlockTelemetryChange={(telemetry) => {
            scheduledBlockTelemetryRef.current = telemetry;
            if (liveTelemetrySnapshotRef.current) {
              liveTelemetrySnapshotRef.current.blockTelemetry = telemetry || undefined;
              liveTelemetrySnapshotRef.current.isTrainingRunning = Boolean(telemetry) || isTrainingRunning;
              liveTelemetrySnapshotRef.current.trainingMode = telemetry?.trainingMode || trainingMode;
            }
          }}
        />
        {/* TAB 1: TELEMETRÍA CARDÍACA */}
        {currentTab === 'telemetry' && (
          <View style={styles.tabContent}>
            {/* Live BPM Circle */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardHeaderTitle}>TELEMETRÍA CARDÍACA EN VIVO</Text>
                <View
                  style={[
                    styles.zoneTag,
                    { backgroundColor: `${currentZone.color}22`, borderColor: currentZone.color },
                  ]}
                >
                  <Text style={[styles.zoneTagText, { color: currentZone.color }]}>
                    {currentZone.zone} • {currentZone.name}
                  </Text>
                </View>
              </View>

              <View style={styles.bpmDisplayContainer}>
                <Animated.View
                  style={[styles.heartIconWrapper, { transform: [{ scale: pulseAnim }] }]}
                >
                  <Ionicons
                    name="heart"
                    size={54}
                    color={isConnected ? '#f43f5e' : '#334155'}
                  />
                </Animated.View>
                <Text style={[styles.bpmNumber, !isConnected && { color: '#475569' }]}>
                  {isConnected && ble.bpm ? ble.bpm : '---'}
                </Text>
                <Text style={styles.bpmUnit}>
                  {isConnected ? 'PULSACIONES / MINUTO (BPM)' : 'SIN CONEXIÓN BLE'}
                </Text>
              </View>

              {/* BLE Connect Button — visible cuando no está conectado */}
              {!isConnected && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: '#0369a1', marginBottom: 12 }]}
                  onPress={() => {
                    setBleScanModalVisible(true);
                    ble.startScan();
                  }}
                >
                  <MaterialCommunityIcons name="bluetooth-connect" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {ble.status === 'scanning' ? 'Buscando COOSPO HW9...' : 'Conectar Pulsómetro BLE'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Error BLE */}
              {ble.status === 'error' && ble.errorMessage && (
                <View style={{ backgroundColor: '#450a0a22', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#fca5a5', fontSize: 12, lineHeight: 18 }}>
                    ⚠️ {ble.errorMessage}
                  </Text>
                </View>
              )}

              {/* Progress Bar of Max HR */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        currentBpm > 0 ? Math.round((currentBpm / currentAthlete.maxBpm) * 100) : 0
                      )}%`,
                      backgroundColor: isConnected ? currentZone.color : '#334155',
                    },
                  ]}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.statLabel}>
                  {currentBpm > 0 ? `${Math.round((currentBpm / currentAthlete.maxBpm) * 100)}% de FC Máxima` : 'Conecta el pulsómetro'}
                </Text>
                <Text style={styles.statLabel}>Máx: {currentAthlete.maxBpm} BPM</Text>
              </View>

              {/* Quick Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemLabel}>Tiempo</Text>
                  <Text style={styles.metricItemValue}>{formatTimer(sessionDuration)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemLabel}>Carga TRIMP</Text>
                  <Text style={[styles.metricItemValue, { color: '#fbbf24' }]}>
                    {trimpScore} pts
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemLabel}>Batería sensor</Text>
                  <Text style={[styles.metricItemValue, { color: '#34d399' }]}>
                    {ble.batteryLevel !== null ? `${ble.batteryLevel}%` : '—'}
                  </Text>
                </View>
              </View>

              {/* Gráfica de Pulsaciones en Tiempo Real (ECG Dinámico WT) */}
              <RealtimePpmChart
                currentBpm={currentBpm}
                maxBpm={currentAthlete.maxBpm || 200}
                restingBpm={currentAthlete.restBpm || 55}
                activeZoneColor={currentZone.color}
                isLive={isConnected}
                historyLength={32}
                height={125}
              />

              {/* Disconnect button — visible solo cuando está conectado */}
              {isConnected && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: '#1e293b' }]}
                  onPress={() => ble.disconnect()}
                >
                  <MaterialCommunityIcons name="bluetooth-off" size={16} color="#94a3b8" />
                  <Text style={[styles.primaryButtonText, { color: '#94a3b8' }]}>
                    Desconectar {ble.deviceName || 'sensor'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Estado de transmisión en vivo al servidor (PPM → Coach) */}
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: isTransmittingLive ? '#052e16' : '#1e293b',
                borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: isTransmittingLive ? '#22c55e40' : '#334155' }}>
                <Ionicons
                  name={isTransmittingLive ? 'radio' : 'cloud-upload-outline'}
                  size={16}
                  color={isTransmittingLive ? '#4ade80' : '#64748b'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700',
                    color: isTransmittingLive ? '#4ade80' : '#64748b' }}>
                    {isTransmittingLive ? 'PPM transmitiendo al entrenador en vivo' :
                      !isConnected ? 'Conecta el pulsómetro para transmitir PPM' :
                      currentBpm <= 0 ? 'Pulsómetro conectado, esperando PPM' :
                      !liveTelemetrySnapshotRef.current?.athleteId ? 'Falta vincular este usuario a un atleta' :
                      'Servidor sin confirmar la transmisión'}
                  </Text>
                  {!isTransmittingLive && liveTelemetryError ? (
                    <Text style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>
                      {liveTelemetryError}
                    </Text>
                  ) : null}
                  {lastCloudSyncAt && (
                    <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Último envío: {lastCloudSyncAt}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleSyncSessionNow}
                  style={{ backgroundColor: '#0284c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>Sync</Text>
                </TouchableOpacity>
              </View>

              {/* Feedback message de sincronización */}
              {syncFeedbackMessage ? (
                <View style={{ marginTop: 8, backgroundColor: '#0c1a2e', borderRadius: 8, padding: 8 }}>
                  <Text style={{ color: '#93c5fd', fontSize: 11, lineHeight: 16 }}>{syncFeedbackMessage}</Text>
                </View>
              ) : null}
            </View>

            {/* Physiological Zones Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>ZONAS DE CARGA DE ASALTO WT</Text>
              <Text style={styles.cardDescription}>Sin datos de una sesión real.</Text>
            </View>
          </View>
        )}

        {/* TAB 2: MODOS DE ENTRENAMIENTO */}
        {currentTab === 'training' && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>MODO DE ENTRENAMIENTO</Text>
              <Text style={styles.cardDescription}>Selecciona el tipo de sesión. El tiempo y la carga se basan en datos reales del sensor BLE.</Text>
              {scheduledWorkoutRunning && (
                <Text style={styles.trainingHint}>Hay un entrenamiento programado en curso. Se avanzará automáticamente según la duración de cada bloque.</Text>
              )}
              <View style={styles.trainingModeGrid}>
                {TRAINING_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.trainingModeCard, trainingMode === mode.key && styles.trainingModeCardActive]}
                    onPress={() => {
                      if (!isTrainingRunning) setTrainingMode(mode.key);
                    }}
                    disabled={isTrainingRunning || scheduledWorkoutRunning}
                  >
                    <MaterialCommunityIcons
                      name={mode.icon}
                      size={24}
                      color={trainingMode === mode.key ? '#38bdf8' : '#64748b'}
                    />
                    <Text style={styles.trainingModeLabel}>{mode.label}</Text>
                    <Text style={styles.trainingModeDescription}>{mode.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardHeaderTitle}>SESIÓN {TRAINING_MODES.find((mode) => mode.key === trainingMode)?.label.toUpperCase()}</Text>
                  <Text style={styles.cardDescription}>
                    {isConnected ? 'Sensor BLE conectado y listo' : 'Conecta un pulsómetro para registrar datos reales'}
                  </Text>
                </View>
                <Text style={styles.trainingTimer}>{trainingMode === 'round-races' ? formatTimer(raceTimeLeft) : formatTimer(trainingElapsed)}</Text>
              </View>
              {trainingMode === 'round-races' && (
                <View style={styles.raceProtocolBox}>
                  <Text style={styles.racePhaseLabel}>
                    {racePhase === 'round' ? `ASALTO ${raceRound} · 2:00` :
                     racePhase === 'rest' ? 'DESCANSO · 1:00' :
                     racePhase === 'long-rest' ? 'DESCANSO LARGO · 3:00' :
                     racePhase === 'ready' ? `BLOQUE DE ${raceRound} ASALTOS COMPLETADO` : 'LISTO PARA COMENZAR'}
                  </Text>
                  <Text style={styles.raceProtocolText}>Solo se puede finalizar después de completar cada bloque de 3 asaltos.</Text>
                </View>
              )}
              <View style={styles.trainingDataRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemLabel}>FC actual</Text>
                  <Text style={styles.metricItemValue}>{isConnected ? `${currentBpm} BPM` : '---'}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemLabel}>Carga TRIMP</Text>
                  <Text style={styles.metricItemValue}>{isConnected ? `${trimpScore} pts` : '---'}</Text>
                </View>
                {trainingMode === 'round-races' && (
                  <>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>Distancia</Text>
                      <Text style={styles.metricItemValue}>{(raceDistanceMeters / 1000).toFixed(2)} km</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>Ritmo</Text>
                      <Text style={styles.metricItemValue}>{raceSpeedMps > 0 ? `${Math.round(1000 / raceSpeedMps)} s/km` : '---'}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Gráfica de Esfuerzo en Tiempo Real durante el entrenamiento */}
              {isTrainingRunning && (
                <RealtimePpmChart
                  currentBpm={currentBpm}
                  maxBpm={currentAthlete.maxBpm || 200}
                  restingBpm={currentAthlete.restBpm || 55}
                  activeZoneColor={currentZone.color}
                  isLive={isConnected}
                  historyLength={32}
                  height={110}
                />
              )}
              {trainingMode === 'round-races' && (raceRecoveryAssessment || raceRecoveryPlan) && (
                <View style={styles.recoveryBox}>
                  <Text style={styles.cardHeaderTitle}>ANÁLISIS DE RECUPERACIÓN</Text>
                  <Text style={styles.recoveryValue}>{raceRecoveryAssessment} · caída de {raceRecoveryDropBpm} BPM</Text>
                  <Text style={styles.recoveryPlan}>{raceRecoveryPlan}</Text>
                </View>
              )}
              {trainingError ? <Text style={styles.trainingError}>{trainingError}</Text> : null}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: isTrainingRunning ? '#9f1239' : '#0369a1' }]}
                onPress={toggleTraining}
                disabled={scheduledWorkoutRunning || (trainingMode === 'round-races' && racePhase !== 'ready' && racePhase !== 'idle')}
              >
                <Ionicons name={isTrainingRunning ? 'stop-circle-outline' : 'play-circle-outline'} size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>{trainingMode === 'round-races' && racePhase === 'ready' ? 'Finalizar bloque y guardar' : isTrainingRunning ? 'En curso...' : 'Iniciar entrenamiento'}</Text>
              </TouchableOpacity>
              {trainingMode === 'round-races' && racePhase === 'ready' && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: '#0f766e' }]}
                  onPress={() => {
                    setRaceRound((previous) => previous + 1);
                    setRacePhase('round');
                    setRaceTimeLeft(RACE_ROUND_SECONDS);
                  }}
                >
                  <Ionicons name="play-forward-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Continuar con otros 3 asaltos</Text>
                </TouchableOpacity>
              )}
              {!isConnected && (
                <Text style={styles.trainingHint}>La sesión puede iniciar, pero no se guardará hasta que haya telemetría BLE real.</Text>
              )}
            </View>
          </View>
        )}

        {currentTab === 'tabata' && <TabataTimer />}

        {currentTab === 'history' && (
          <View style={styles.tabContent}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardHeaderTitle}>HISTORIAL DE ENTRENAMIENTOS</Text>
              <TouchableOpacity onPress={() => setTrainingHistoryRefresh((value) => value + 1)} accessibilityLabel="Actualizar historial">
                <Ionicons name="refresh" size={20} color="#38bdf8" />
              </TouchableOpacity>
            </View>
            {trainingHistoryLoading ? <Text style={styles.cardDescription}>Cargando sesiones...</Text> : null}
            {trainingHistoryError ? <Text style={styles.trainingError}>{trainingHistoryError}</Text> : null}
            {!trainingHistoryLoading && !trainingHistoryError && trainingHistory.length === 0 ? (
              <View style={styles.card}><Text style={styles.cardDescription}>Aún no hay entrenamientos guardados para tu ficha.</Text></View>
            ) : null}
            {trainingHistory.map((session) => (
              <View key={session.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardHeaderTitle}>{session.title || 'Entrenamiento'}</Text>
                  <Text style={styles.historyStatus}>{session.status || 'COMPLETED'}</Text>
                </View>
                <Text style={styles.cardDescription}>{new Date(session.date).toLocaleDateString('es-ES')} · {session.type}</Text>
                <View style={styles.historyMetrics}>
                  <Text style={styles.statLabel}>{session.durationMinutes} min</Text>
                  <Text style={styles.statLabel}>{session.avgHeartRateBpm} BPM medio</Text>
                  <Text style={styles.statLabel}>TRIMP {session.trimpScore}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 3: ASISTENTE TÁCTICO & IA */}
        {currentTab === 'ai' && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <MaterialCommunityIcons name="brain" size={22} color="#10b981" />
                  <Text style={[styles.cardHeaderTitle, { marginLeft: 8 }]}>
                    MOTOR IA v2.4 ADAPTIVE
                  </Text>
                </View>
                <View style={styles.accuracyTag}>
                  <Text style={styles.accuracyTagText}>Sin datos de entrenamiento</Text>
                </View>
              </View>

              <Text style={styles.cardDescription}>
                Consulta los planes publicados por tu entrenador y los trabajos correctivos asignados. La IA no cambia puntuaciones ni resultados de competición.
              </Text>

              {!!aiAdvice && <View style={styles.aiResultBox}><Text style={styles.aiResultText}>{aiAdvice}</Text></View>}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#059669', marginTop: 14 }]}
                onPress={triggerAIRecheck}
                disabled={aiGenerating}
              >
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  {aiGenerating ? 'Analizando rendimiento...' : 'Consultar recomendación de esfuerzo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>PLANIFICACIÓN SEMANAL</Text>
              {aiTrainingLoading && <ActivityIndicator color="#38bdf8" style={{ marginTop: 12 }} />}
              {!!aiTrainingError && <Text style={[styles.cardDescription, { color: '#fda4af' }]}>{aiTrainingError}</Text>}
              {!aiTrainingLoading && !aiPlans.length && !aiTrainingError && (
                <Text style={styles.cardDescription}>Tu entrenador aún no ha publicado un plan semanal.</Text>
              )}
              {aiPlans.map((record) => {
                const weeklyPlan = record.plan || {};
                return (
                  <View key={record.id} style={{ borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 12, paddingTop: 12 }}>
                    <Text style={styles.cardHeaderTitle}>{record.objective || weeklyPlan.objective || 'Plan semanal'}</Text>
                    <Text style={styles.cardDescription}>
                      Semana {record.week_start} · {record.periodization_phase}
                    </Text>
                    {(weeklyPlan.sessions || []).map((session: any, index: number) => (
                      <View key={`${session.date}-${index}`} style={{ marginTop: 10 }}>
                        <Text style={{ color: '#7dd3fc', fontWeight: '700', fontSize: 12 }}>
                          {session.date} · {session.title}{session.optional ? ' · Opcional' : ''} · {session.durationMinutes} min
                        </Text>
                        <Text style={styles.cardDescription}>{session.objective}</Text>
                        {(session.exercises || []).map((exercise: any, exerciseIndex: number) => (
                          <Text key={`${exercise.name}-${exerciseIndex}`} style={styles.cardDescription}>
                            • {exercise.name}: {exercise.instructions}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>TRABAJOS CORRECTIVOS Y OPCIONALES</Text>
              {!aiTrainingLoading && !correctiveWorks.length && (
                <Text style={styles.cardDescription}>No tienes trabajos correctivos asignados.</Text>
              )}
              {correctiveWorks.map((work) => (
                <View key={work.id} style={{ borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 12, paddingTop: 12 }}>
                  <Text style={styles.cardHeaderTitle}>{work.title}{work.optional ? ' · Opcional' : ''}</Text>
                  <Text style={styles.cardDescription}>{work.objective}</Text>
                  {work.planned_session_date && (
                    <Text style={[styles.cardDescription, { color: '#7dd3fc' }]}>Sesión: {work.planned_session_date}</Text>
                  )}
                  {(work.exercises || []).map((exercise: any, index: number) => (
                    <Text key={`${exercise.name}-${index}`} style={styles.cardDescription}>
                      • {exercise.name}: {exercise.instructions}
                    </Text>
                  ))}
                  {work.status === 'ASSIGNED' && (
                    <TouchableOpacity
                      style={[styles.primaryButton, { marginTop: 8 }]}
                      onPress={() => updateCorrectiveWorkStatus(work.id, 'IN_PROGRESS')}
                    >
                      <Text style={styles.primaryButtonText}>Empezar trabajo</Text>
                    </TouchableOpacity>
                  )}
                  {work.status === 'IN_PROGRESS' && (
                    <TouchableOpacity
                      style={[styles.primaryButton, { marginTop: 8 }]}
                      onPress={() => updateCorrectiveWorkStatus(work.id, 'COMPLETED')}
                    >
                      <Text style={styles.primaryButtonText}>Marcar como completado</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 4: MI FICHA & BIOMETRÍA */}
        {currentTab === 'profile' && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {currentAthlete.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{currentAthlete.name}</Text>
                  <Text style={styles.profileCategory}>{currentAthlete.category}</Text>
                  <Text style={styles.profileClub}>{currentAthlete.club}</Text>
                </View>
              </View>

              <View style={styles.bioMatrix}>
                <View style={styles.bioMatrixItem}>
                  <Text style={styles.bioMatrixLbl}>Readiness</Text>
                  <Text style={[styles.bioMatrixVal, { color: '#34d399' }]}>
                    {currentAthlete.readiness}%
                  </Text>
                </View>
                <View style={styles.bioMatrixItem}>
                  <Text style={styles.bioMatrixLbl}>VO2 Máx</Text>
                  <Text style={[styles.bioMatrixVal, { color: '#38bdf8' }]}>
                    {currentAthlete.vo2max}
                  </Text>
                </View>
                <View style={styles.bioMatrixItem}>
                  <Text style={styles.bioMatrixLbl}>FC Reposo</Text>
                  <Text style={[styles.bioMatrixVal, { color: '#f43f5e' }]}>
                    {currentAthlete.restBpm} BPM
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Grado Federativo:</Text>
                <Text style={styles.detailValue}>{currentAthlete.belt}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Peso / Altura Oficial:</Text>
                <Text style={styles.detailValue}>
                  {currentAthlete.weight} kg / {currentAthlete.height} cm
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Técnica Favorita:</Text>
                <Text style={[styles.detailValue, { color: '#38bdf8' }]}>
                  {currentAthlete.favouriteKick}
                </Text>
              </View>
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Efectividad de Combate:</Text>
                <Text style={[styles.detailValue, { color: '#fbbf24' }]}>
                  {currentAthlete.record.wins} Victorias - {currentAthlete.record.losses} Derrotas (
                  {Math.round(
                    (currentAthlete.record.wins /
                      (currentAthlete.record.wins + currentAthlete.record.losses)) *
                      100
                  )}
                  %)
                </Text>
              </View>
            </View>

            {/* Sync & Cloud Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>CONEXIÓN CON PANEL DE ADMINISTRACIÓN</Text>
              <Text style={styles.cardDescription}>
                Tus datos biométricos y de pulsometría se sincronizan en tiempo real con el Director y
                Entrenador federativo a través de la infraestructura Vercel / Edge.
              </Text>
              <View style={styles.syncStatusRow}>
                <Ionicons name="cloud-done" size={18} color="#34d399" />
                <Text style={styles.syncStatusText}>Base de datos PostgreSQL / SQLite en línea</Text>
              </View>
            </View>
          </View>
        )}

        {currentTab === 'club' && (
          <View style={styles.tabContent}>
            <ClubHub
              athleteId={currentAthlete.id === 'unassigned' ? undefined : currentAthlete.id}
              clubId={authenticatedUser?.clubId || authenticatedUser?.profile?.clubId}
              role={authenticatedUser?.role || 'ATHLETE'}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('telemetry')}
        >
          <Ionicons
            name="heart-circle"
            size={24}
            color={currentTab === 'telemetry' ? '#38bdf8' : '#64748b'}
          />
          <Text
            style={[
              styles.navItemText,
              currentTab === 'telemetry' && styles.navItemTextActive,
            ]}
          >
            Telemetría
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('training')}
        >
          <MaterialCommunityIcons
            name="dumbbell"
            size={24}
            color={currentTab === 'training' ? '#38bdf8' : '#64748b'}
          />
          <Text style={[styles.navItemText, currentTab === 'training' && styles.navItemTextActive]}>
            Entreno
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('ai')}
        >
          <MaterialCommunityIcons
            name="brain"
            size={24}
            color={currentTab === 'ai' ? '#10b981' : '#64748b'}
          />
          <Text
            style={[
              styles.navItemText,
              currentTab === 'ai' && { color: '#10b981', fontWeight: 'bold' },
            ]}
          >
            Táctica IA
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('tabata')}
        >
          <Ionicons
            name="timer-outline"
            size={22}
            color={currentTab === 'tabata' ? '#38bdf8' : '#64748b'}
          />
          <Text style={[styles.navItemText, currentTab === 'tabata' && styles.navItemTextActive]}>
            Tabata
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('history')}
        >
          <Ionicons name="time-outline" size={22} color={currentTab === 'history' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.navItemText, currentTab === 'history' && styles.navItemTextActive]}>Historial</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('profile')}
        >
          <Ionicons
            name="person"
            size={22}
            color={currentTab === 'profile' ? '#38bdf8' : '#64748b'}
          />
          <Text
            style={[
              styles.navItemText,
              currentTab === 'profile' && styles.navItemTextActive,
            ]}
          >
            Mi Ficha
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('club')}
        >
          <Ionicons name="business-outline" size={22} color={currentTab === 'club' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.navItemText, currentTab === 'club' && styles.navItemTextActive]}>Mi Club</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de pulsómetros y dispositivos BLE */}
      <Modal
        visible={bleScanModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBleScanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <MaterialCommunityIcons name="bluetooth" size={22} color="#38bdf8" />
                <Text style={[styles.cardHeaderTitle, { marginLeft: 8 }]}>PULSÓMETROS CERCANOS</Text>
              </View>
              <TouchableOpacity onPress={() => setBleScanModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.cardDescription, { marginTop: 8 }]}>Busca HW9, Polar, Garmin, Suunto, Wahoo, Xiaomi, Amazfit, bandas y cualquier sensor BLE compatible.</Text>

            {ble.status === 'scanning' && (
              <View style={styles.bleSearchStatus}>
                <Ionicons name="radio-outline" size={18} color="#facc15" />
                <Text style={styles.bleSearchStatusText}>Escaneando dispositivos...</Text>
              </View>
            )}

            {ble.nearbyDevices.length === 0 && ble.status !== 'scanning' && (
              <View style={styles.bleEmptyState}>
                <MaterialCommunityIcons name="heart-pulse" size={28} color="#475569" />
                <Text style={styles.bleEmptyTitle}>No se encontraron pulsómetros</Text>
                <Text style={styles.bleEmptyText}>Enciende el sensor, activa su modo de conexión y vuelve a buscar.</Text>
              </View>
            )}

            <ScrollView style={styles.bleDeviceList} contentContainerStyle={{ gap: 8 }}>
              {[...ble.nearbyDevices]
                .sort((a, b) => Number((b.serviceUUIDs || []).some((id) => id.toLowerCase().includes('180d'))) - Number((a.serviceUUIDs || []).some((id) => id.toLowerCase().includes('180d'))))
                .map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.bleDeviceRow}
                    onPress={async () => {
                      setBleScanModalVisible(false);
                      await ble.connect(device);
                    }}
                  >
                    <View style={styles.bleDeviceIcon}>
                      <MaterialCommunityIcons name="heart-pulse" size={20} color="#38bdf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bleDeviceName}>{device.name || device.localName || 'Dispositivo BLE sin nombre'}</Text>
                      <Text style={styles.bleDeviceId}>{device.id}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748b" />
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#0369a1' }]} onPress={() => ble.startScan()} disabled={ble.status === 'scanning'}>
                <Ionicons name="search-outline" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Buscar de nuevo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#1e293b' }]} onPress={() => setBleScanModalVisible(false)}>
                <Text style={[styles.primaryButtonText, { color: '#94a3b8' }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Conexión a Vercel & Supabase */}
      <Modal
        visible={apiUrlModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setApiUrlModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <Ionicons name="cloud-upload-outline" size={22} color="#38bdf8" />
                <Text style={[styles.cardHeaderTitle, { marginLeft: 8 }]}>CONEXIÓN API VERCEL</Text>
              </View>
              <TouchableOpacity onPress={() => setApiUrlModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.cardDescription, { marginTop: 8 }]}>
              Configura la URL de tu API en producción (Vercel con base de datos Supabase):
            </Text>

            <TextInput
              style={styles.apiTextInput}
              value={inputApiUrl}
              onChangeText={setInputApiUrl}
              placeholder="https://admin-panel-chi-khaki.vercel.app/api/v1"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1, backgroundColor: '#0284c7' }]}
                onPress={() => {
                  setApiUrl(inputApiUrl);
                  setApiUrlModalVisible(false);
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Guardar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#1e293b' }]}
                onPress={() => {
                  const def = 'https://admin-panel-chi-khaki.vercel.app/api/v1';
                  setInputApiUrl(def);
                  setApiUrl(def);
                  setApiUrlModalVisible(false);
                }}
              >
                <Text style={[styles.primaryButtonText, { color: '#94a3b8' }]}>Por Defecto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#06090f',
    paddingTop: RNStatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#080c14',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0c1929',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  proTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  proTagText: {
    color: '#f43f5e',
    fontSize: 9,
    fontWeight: 'bold',
  },
  athleteSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  athleteSwitchText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBarWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#080c14',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#082f49',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
    marginRight: 6,
  },
  statusPillText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  tabContent: {
    paddingBottom: 24,
  },
  historyStatus: { color: '#34d399', fontSize: 10, fontWeight: '700' },
  historyMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  card: {
    backgroundColor: '#0b111e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 16,
  },
  disabledScoreCard: {
    opacity: 0.55,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  cardDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    lineHeight: 18,
  },
  trainingModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  trainingModeCard: {
    width: '48%',
    minHeight: 108,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#080d17',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  trainingModeCardActive: {
    backgroundColor: '#082f49',
    borderColor: '#0284c7',
  },
  trainingModeLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  trainingModeDescription: {
    color: '#64748b',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  trainingTimer: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  trainingDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#080d17',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  trainingHint: {
    color: '#fbbf24',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  raceProtocolBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#172554',
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  racePhaseLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '900',
  },
  raceProtocolText: {
    color: '#93c5fd',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  recoveryBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#166534',
  },
  recoveryValue: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  recoveryPlan: {
    color: '#bbf7d0',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  trainingError: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  bleSearchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#854d0e',
  },
  bleSearchStatusText: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '600',
  },
  bleEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  bleEmptyTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  bleEmptyText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  bleDeviceList: {
    maxHeight: 220,
    marginTop: 12,
  },
  bleDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  bleDeviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#082f49',
  },
  bleDeviceName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  bleDeviceId: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 3,
  },
  zoneTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  zoneTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bpmDisplayContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heartIconWrapper: {
    marginBottom: 4,
  },
  bpmNumber: {
    fontSize: 58,
    fontWeight: '900',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  bpmUnit: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: -4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#080d17',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricItemLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricItemValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 85,
  },
  zoneDesc: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
  },
  zoneMin: {
    fontSize: 12,
    color: '#e2e8f0',
    fontVariant: ['tabular-nums'],
  },

  // AI Assistant styles
  accuracyTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accuracyTagText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  aiResultBox: {
    backgroundColor: '#041d14',
    borderWidth: 1,
    borderColor: '#065f46',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  aiResultText: {
    color: '#a7f3d0',
    fontSize: 12,
    lineHeight: 18,
  },
  workoutItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  workoutDay: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  workoutDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },

  // Profile styles
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileCategory: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  profileClub: {
    fontSize: 11,
    color: '#64748b',
  },
  bioMatrix: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#080d17',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  bioMatrixItem: {
    alignItems: 'center',
    flex: 1,
  },
  bioMatrixLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bioMatrixVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#022c22',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  syncStatusText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '500',
  },

  // Bottom Navigation Bar styles
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#080c14',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    paddingBottom: 12,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navItemText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  navItemTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0d131f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  apiTextInput: {
    backgroundColor: '#06090f',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginTop: 8,
  },
});
