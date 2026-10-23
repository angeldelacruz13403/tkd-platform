import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type TabataPhase = 'ready' | 'work' | 'rest' | 'complete';

const DEFAULT_WORK_SECONDS = 20;
const DEFAULT_REST_SECONDS = 10;
const DEFAULT_ROUNDS = 8;
const SETTING_STEP_SECONDS = 5;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

interface SettingProps {
  label: string;
  value: number;
  unit: string;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}

function Setting({ label, value, unit, disabled, onDecrease, onIncrease }: SettingProps) {
  return (
    <View style={styles.setting}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingControls}>
        <TouchableOpacity
          accessibilityLabel={`Reducir ${label}`}
          style={[styles.adjustButton, disabled && styles.disabledButton]}
          onPress={onDecrease}
          disabled={disabled}
        >
          <Ionicons name="remove" size={18} color="#e2e8f0" />
        </TouchableOpacity>
        <View style={styles.settingValueWrap}>
          <Text style={styles.settingValue}>{value}</Text>
          <Text style={styles.settingUnit}>{unit}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel={`Aumentar ${label}`}
          style={[styles.adjustButton, disabled && styles.disabledButton]}
          onPress={onIncrease}
          disabled={disabled}
        >
          <Ionicons name="add" size={18} color="#e2e8f0" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabataTimer() {
  const [workSeconds, setWorkSeconds] = useState(DEFAULT_WORK_SECONDS);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [phase, setPhase] = useState<TabataPhase>('ready');
  const [currentRound, setCurrentRound] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const isConfigLocked = phase !== 'ready';

  useEffect(() => {
    if (!isRunning) return undefined;

    const deadline = Date.now() + remainingSeconds * 1000;
    deadlineRef.current = deadline;
    const interval = setInterval(() => {
      const millisecondsLeft = deadline - Date.now();
      const secondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000));
      setRemainingSeconds(secondsLeft);

      if (millisecondsLeft > 0) return;

      if (phase === 'work') {
        setPhase('rest');
        setRemainingSeconds(restSeconds);
        return;
      }

      if (currentRound >= rounds) {
        setPhase('complete');
        setIsRunning(false);
        return;
      }

      setCurrentRound((round) => round + 1);
      setPhase('work');
      setRemainingSeconds(workSeconds);
    }, 200);

    return () => clearInterval(interval);
  }, [currentRound, isRunning, phase, restSeconds, rounds, workSeconds]);

  const adjustWorkSeconds = (amount: number) => {
    const nextValue = Math.min(300, Math.max(5, workSeconds + amount));
    setWorkSeconds(nextValue);
    setRemainingSeconds(nextValue);
  };

  const adjustRestSeconds = (amount: number) => {
    setRestSeconds((seconds) => Math.min(300, Math.max(0, seconds + amount)));
  };

  const resetTimer = () => {
    setIsRunning(false);
    setPhase('ready');
    setCurrentRound(1);
    setRemainingSeconds(workSeconds);
    deadlineRef.current = null;
  };

  const toggleTimer = () => {
    if (isRunning) {
      const millisecondsLeft = (deadlineRef.current ?? Date.now()) - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(millisecondsLeft / 1000)));
      setIsRunning(false);
      return;
    }

    if (phase === 'ready') {
      setPhase('work');
      setCurrentRound(1);
      setRemainingSeconds(workSeconds);
    }
    setIsRunning(true);
  };

  const phaseLabel = phase === 'work' ? 'TRABAJO'
    : phase === 'rest' ? 'DESCANSO'
      : phase === 'complete' ? 'ENTRENAMIENTO COMPLETADO'
        : 'LISTO PARA EMPEZAR';
  const phaseColor = phase === 'work' ? '#38bdf8'
    : phase === 'rest' ? '#fbbf24'
      : phase === 'complete' ? '#34d399'
        : '#94a3b8';
  const completedRounds = phase === 'complete' ? rounds : currentRound - 1;
  const progress = Math.round((completedRounds / rounds) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <View style={styles.iconBadge}>
            <Ionicons name="timer-outline" size={23} color="#38bdf8" />
          </View>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>TABATA TIMER</Text>
            <Text style={styles.subtitle}>Intervalos de alta intensidad</Text>
          </View>
        </View>
      </View>

      <View style={styles.timerCard}>
        <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
        <Text style={styles.clock}>{formatTime(remainingSeconds)}</Text>
        <Text style={styles.roundLabel}>
          {phase === 'complete' ? `${rounds} rondas completadas` : `RONDA ${currentRound} DE ${rounds}`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: phaseColor }]} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.mainButton,
              isRunning ? styles.pauseButton : styles.startButton,
              phase === 'complete' && styles.disabledButton,
            ]}
            onPress={toggleTimer}
            disabled={phase === 'complete'}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={20} color="#fff" />
            <Text style={styles.mainButtonText}>
              {isRunning ? 'Pausar' : phase === 'ready' ? 'Iniciar Tabata' : 'Reanudar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.resetButton}
            onPress={resetTimer}
          >
            <Ionicons name="refresh" size={20} color="#cbd5e1" />
            <Text style={styles.resetButtonText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.sectionTitle}>CONFIGURACIÓN</Text>
        <Text style={styles.sectionDescription}>
          {isConfigLocked ? 'Reinicia el temporizador para modificar los intervalos.' : 'Ajusta los tiempos y las rondas.'}
        </Text>
        <Setting
          label="Trabajo"
          value={workSeconds}
          unit="seg"
          disabled={isConfigLocked}
          onDecrease={() => adjustWorkSeconds(-SETTING_STEP_SECONDS)}
          onIncrease={() => adjustWorkSeconds(SETTING_STEP_SECONDS)}
        />
        <Setting
          label="Descanso"
          value={restSeconds}
          unit="seg"
          disabled={isConfigLocked}
          onDecrease={() => adjustRestSeconds(-SETTING_STEP_SECONDS)}
          onIncrease={() => adjustRestSeconds(SETTING_STEP_SECONDS)}
        />
        <Setting
          label="Rondas"
          value={rounds}
          unit=""
          disabled={isConfigLocked}
          onDecrease={() => setRounds((value) => Math.max(1, value - 1))}
          onIncrease={() => setRounds((value) => Math.min(99, value + 1))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  intro: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#082f49',
    borderWidth: 1,
    borderColor: '#075985',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  timerCard: {
    alignItems: 'center',
    backgroundColor: '#0b111e',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 22,
    marginBottom: 16,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  clock: {
    color: '#f8fafc',
    fontSize: 76,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 92,
    marginTop: 4,
  },
  roundLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  mainButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    backgroundColor: '#0369a1',
  },
  pauseButton: {
    backgroundColor: '#b45309',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  resetButton: {
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  resetButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: '#0b111e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionDescription: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 5,
    marginBottom: 8,
  },
  setting: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  settingLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  settingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjustButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  settingValueWrap: {
    minWidth: 50,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  settingValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  settingUnit: {
    color: '#64748b',
    fontSize: 10,
  },
});
