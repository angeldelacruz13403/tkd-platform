import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

interface PpmPoint {
  time: number;
  bpm: number;
  zoneColor: string;
}

interface RealtimePpmChartProps {
  currentBpm: number;
  maxBpm?: number;
  restingBpm?: number;
  activeZoneColor?: string;
  isLive?: boolean;
  historyLength?: number;
  height?: number;
}

// Cálculo de zona WT según % de FC Máx
function getZoneInfo(bpm: number, maxBpm: number) {
  if (bpm <= 0 || maxBpm <= 0) return { zone: 'Z0', color: '#64748b', name: 'Inactivo' };
  const pct = (bpm / maxBpm) * 100;
  if (pct >= 90) return { zone: 'Z5', color: '#ef4444', name: 'Máximo / Asalto Anaeróbico' };
  if (pct >= 80) return { zone: 'Z4', color: '#f97316', name: 'Umbral Anaeróbico' };
  if (pct >= 70) return { zone: 'Z3', color: '#eab308', name: 'Aeróbico Potencia' };
  if (pct >= 60) return { zone: 'Z2', color: '#22c55e', name: 'Aeróbico Base' };
  return { zone: 'Z1', color: '#38bdf8', name: 'Recuperación Activa' };
}

export default function RealtimePpmChart({
  currentBpm,
  maxBpm = 200,
  restingBpm = 55,
  activeZoneColor = '#38bdf8',
  isLive = true,
  historyLength = 30, // 30 segundos de ventana móvil
  height = 130,
}: RealtimePpmChartProps) {
  const [history, setHistory] = useState<PpmPoint[]>([]);
  const lastRecordedTime = useRef<number>(0);

  // Registro en tiempo real garantizando no duplicar en el mismo segundo y sin congelarse
  useEffect(() => {
    const now = Date.now();
    // Evitar ráfagas en menos de 900ms para mantener cadencia de 1 punto por segundo
    if (now - lastRecordedTime.current < 900) return;
    lastRecordedTime.current = now;

    const validBpm = currentBpm > 0 ? currentBpm : 0;
    const { color } = getZoneInfo(validBpm, maxBpm);

    setHistory((prev) => {
      const next = [...prev, { time: now, bpm: validBpm, zoneColor: color }];
      return next.slice(-historyLength);
    });
  }, [currentBpm, maxBpm, historyLength]);

  // Si no hay datos, inicializamos con línea base
  const samples = useMemo(() => {
    if (history.length === 0) {
      return Array.from({ length: 15 }, (_, i) => ({
        time: Date.now() - (15 - i) * 1000,
        bpm: currentBpm > 0 ? currentBpm : restingBpm,
        zoneColor: currentBpm > 0 ? activeZoneColor : '#334155',
      }));
    }
    return history;
  }, [history, currentBpm, restingBpm, activeZoneColor]);

  // Rango de escala dinámica con márgenes de seguridad para no aplastar la curva
  const activeBpmValues = samples.map((s) => s.bpm).filter((b) => b > 0);
  const minVal = Math.max(40, Math.min(restingBpm, ...(activeBpmValues.length ? activeBpmValues : [restingBpm])) - 10);
  const maxVal = Math.min(220, Math.max(maxBpm, ...(activeBpmValues.length ? activeBpmValues : [maxBpm])) + 10);
  const range = Math.max(30, maxVal - minVal);

  const avgRecentBpm =
    activeBpmValues.length > 0
      ? Math.round(activeBpmValues.reduce((a, b) => a + b, 0) / activeBpmValues.length)
      : currentBpm;

  return (
    <View style={styles.container}>
      {/* Header con indicadores */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithLive}>
          <View style={[styles.liveDot, { backgroundColor: isLive && currentBpm > 0 ? '#22c55e' : '#64748b' }]} />
          <Text style={styles.titleText}>CURVA DE PULSACIONES EN TIEMPO REAL</Text>
        </View>
        <View style={styles.statsBadge}>
          <Text style={styles.statsBadgeText}>
            Media: <Text style={{ color: '#38bdf8', fontWeight: '800' }}>{avgRecentBpm || '—'}</Text> BPM
          </Text>
        </View>
      </View>

      {/* Caja del Gráfico con Rejilla */}
      <View style={[styles.chartBox, { height }]}>
        {/* Líneas guía de Zonas Cardíacas */}
        <View style={[styles.guideline, { bottom: `${((maxBpm * 0.9 - minVal) / range) * 100}%`, borderColor: '#ef444440' }]}>
          <Text style={[styles.guidelineLabel, { color: '#ef4444' }]}>90% Z5 (Asalto)</Text>
        </View>
        <View style={[styles.guideline, { bottom: `${((maxBpm * 0.8 - minVal) / range) * 100}%`, borderColor: '#f9731630' }]}>
          <Text style={[styles.guidelineLabel, { color: '#f97316' }]}>80% Z4 (Umbral)</Text>
        </View>
        <View style={[styles.guideline, { bottom: `${((maxBpm * 0.7 - minVal) / range) * 100}%`, borderColor: '#eab30825' }]}>
          <Text style={[styles.guidelineLabel, { color: '#eab308' }]}>70% Z3</Text>
        </View>

        {/* Barras dinámicas del electrocardiograma / evolución */}
        <View style={styles.barsContainer}>
          {samples.map((point, index) => {
            const isLast = index === samples.length - 1;
            const pctHeight = Math.max(6, Math.min(100, ((point.bpm - minVal) / range) * 100));
            const barColor = point.bpm > 0 ? point.zoneColor : '#334155';

            return (
              <View key={`${point.time}-${index}`} style={styles.barCol}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${pctHeight}%`,
                      backgroundColor: barColor,
                      opacity: isLast ? 1 : 0.45 + (index / samples.length) * 0.55,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    },
                    isLast && styles.lastBarActive,
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Marcador actual flotante en el extremo derecho */}
        {currentBpm > 0 && (
          <View
            style={[
              styles.currentBpmFloat,
              {
                bottom: `${Math.max(10, Math.min(85, ((currentBpm - minVal) / range) * 100))}%`,
                backgroundColor: activeZoneColor,
              },
            ]}
          >
            <Text style={styles.currentBpmFloatText}>{currentBpm}</Text>
          </View>
        )}
      </View>

      {/* Eje de tiempo inferior */}
      <View style={styles.timeAxisRow}>
        <Text style={styles.timeAxisLabel}>-{samples.length}s</Text>
        <Text style={styles.timeAxisLabel}>-{Math.round(samples.length / 2)}s</Text>
        <Text style={[styles.timeAxisLabel, { color: '#22c55e', fontWeight: '700' }]}>AHORA (EN VIVO)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#070d18',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleWithLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  titleText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statsBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statsBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  chartBox: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#040711',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b50',
    justifyContent: 'flex-end',
  },
  guideline: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  guidelineLabel: {
    position: 'absolute',
    right: 4,
    top: -9,
    fontSize: 8,
    fontWeight: '700',
    backgroundColor: '#040711cc',
    paddingHorizontal: 3,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    width: '100%',
    paddingHorizontal: 2,
    zIndex: 2,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  barFill: {
    width: '100%',
    minHeight: 4,
  },
  lastBarActive: {
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  currentBpmFloat: {
    position: 'absolute',
    right: 6,
    zIndex: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  currentBpmFloatText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  timeAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  timeAxisLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
  },
});
