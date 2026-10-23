import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchApi, fetchAthletesFromApi } from "./api";

type HubSection = "classes" | "finance" | "videos" | "gamification";
type HubRole = "ADMIN" | "COACH" | "CLUB" | "ATHLETE";
type HubProps = {
  athleteId?: string;
  clubId?: string;
  role?: string;
  onBack?: () => void;
};
type RecordItem = Record<string, any>;
type AthleteItem = { id: string; fullName?: string; name?: string };

const sections: Array<[HubSection, string]> = [
  ["classes", "Clases"],
  ["finance", "Cuotas"],
  ["videos", "Vídeos"],
  ["gamification", "Logros"],
];

export default function ClubHub({ athleteId, clubId, role = "ATHLETE", onBack }: HubProps) {
  const canManage = role === "ADMIN" || role === "COACH" || role === "CLUB";
  const [section, setSection] = useState<HubSection>("classes");
  const [adminClubId, setAdminClubId] = useState("");
  const [items, setItems] = useState<RecordItem[]>([]);
  const [catalog, setCatalog] = useState<RecordItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState(athleteId || "");
  const [summary, setSummary] = useState<RecordItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classTrainingTitle, setClassTrainingTitle] = useState("");
  const [classTrainingDate, setClassTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [classTrainingTime, setClassTrainingTime] = useState("18:00");
  const [classTrainingDuration, setClassTrainingDuration] = useState("60");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [financeType, setFinanceType] = useState<"STUDENT_DUE" | "INCOME" | "EXPENSE">("STUDENT_DUE");
  const [financeDescription, setFinanceDescription] = useState("");
  const [financeAmount, setFinanceAmount] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const targetClubId = role === "ADMIN" ? adminClubId.trim() || clubId : clubId;

  const selectedAthleteName = useMemo(
    () => athletes.find((athlete) => athlete.id === selectedAthleteId)?.fullName ||
      athletes.find((athlete) => athlete.id === selectedAthleteId)?.name || "Atleta",
    [athletes, selectedAthleteId],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (canManage && athletes.length === 0) {
        const roster = await fetchAthletesFromApi();
        setAthletes(roster);
        if (!selectedAthleteId && roster.length) setSelectedAthleteId(roster[0].id);
      }
      if (section === "classes") {
        const result = await fetchApi("classes");
        const classes = Array.isArray(result.data) ? result.data as RecordItem[] : [];
        const withSessions = await Promise.all(classes.map(async (clubClass) => {
          const sessions = await fetchApi(`classes/${encodeURIComponent(clubClass.id)}/trainings`);
          return { ...clubClass, sessions: Array.isArray(sessions.data) ? sessions.data : [] };
        }));
        setItems(withSessions);
        setSummary(null);
      } else if (section === "finance") {
        const result = await fetchApi("finance");
        setItems(Array.isArray(result.entries) ? result.entries : []);
        setSummary(result.summary || null);
      } else if (section === "videos") {
        const suffix = role === "ADMIN" && targetClubId ? `?clubId=${encodeURIComponent(targetClubId)}` : "";
        const result = await fetchApi(`videos${suffix}`);
        setItems(Array.isArray(result.data) ? result.data : []);
        setSummary(null);
      } else {
        const suffix = canManage && selectedAthleteId
          ? `?athleteId=${encodeURIComponent(selectedAthleteId)}`
          : "";
        const result = await fetchApi(`gamification${suffix}`);
        setItems(Array.isArray(result.achievements) ? result.achievements : []);
        setCatalog(Array.isArray(result.catalog) ? result.catalog : []);
        setSummary(result);
      }
    } catch (value) {
      setItems([]);
      setSummary(null);
      setError(value instanceof Error ? value.message : "No se pudo cargar la información del club.");
    } finally {
      setLoading(false);
    }
  }, [athletes.length, canManage, role, section, selectedAthleteId, targetClubId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveClass = async () => {
    if (!className.trim()) {
      Alert.alert("Falta el nombre", "Escribe un nombre para la clase.");
      return;
    }
    setSaving(true);
    try {
      const result = await fetchApi("classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: className.trim(),
          description: classDescription.trim(),
          athleteIds: selectedMemberIds,
          ...(role === "ADMIN" && targetClubId ? { clubId: targetClubId } : {}),
        }),
      });
      if (result.data?.id) setSelectedClassId(result.data.id);
      setClassName("");
      setClassDescription("");
      setSelectedMemberIds([]);
      await reload();
      Alert.alert("Clase creada", "La clase y sus matrículas se guardaron.");
    } catch (value) {
      Alert.alert("No se pudo crear", value instanceof Error ? value.message : "Error al guardar la clase.");
    } finally {
      setSaving(false);
    }
  };

  const saveClassTraining = async () => {
    const duration = Number(classTrainingDuration);
    const scheduledAt = new Date(`${classTrainingDate}T${classTrainingTime}:00`);
    if (!selectedClassId || !classTrainingTitle.trim() || !Number.isInteger(duration) || duration < 1 ||
      !Number.isFinite(scheduledAt.getTime())) {
      Alert.alert("Datos incompletos", "Selecciona una clase y completa título, fecha, hora y duración.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi(`classes/${encodeURIComponent(selectedClassId)}/trainings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: classTrainingTitle.trim(),
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: duration,
          type: "SPARRING_TACTICAL",
          notes: "",
          blocks: [],
        }),
      });
      setClassTrainingTitle("");
      await reload();
      Alert.alert("Entrenamiento programado", "La sesión compartida ya está asociada a la clase.");
    } catch (value) {
      Alert.alert("No se pudo programar", value instanceof Error ? value.message : "Error al guardar la sesión compartida.");
    } finally {
      setSaving(false);
    }
  };

  const saveFinanceEntry = async () => {
    const amount = Number(financeAmount);
    if (!financeDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Datos incompletos", "Indica una descripción y un importe válido.");
      return;
    }
    if (financeType === "STUDENT_DUE" && !selectedAthleteId) {
      Alert.alert("Selecciona un atleta", "Para registrar una cuota debes elegir al alumno.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi("finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: financeType,
          description: financeDescription.trim(),
          amount,
          ...(financeType === "STUDENT_DUE" ? { athleteId: selectedAthleteId } : {}),
          ...(role === "ADMIN" && targetClubId ? { clubId: targetClubId } : {}),
        }),
      });
      setFinanceDescription("");
      setFinanceAmount("");
      await reload();
      Alert.alert("Movimiento guardado", "El movimiento quedó registrado en el club.");
    } catch (value) {
      Alert.alert("No se pudo guardar", value instanceof Error ? value.message : "Error al registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  const createAchievement = async () => {
    if (!achievementTitle.trim()) {
      Alert.alert("Falta el nombre", "Escribe el nombre del logro.");
      return;
    }
    setSaving(true);
    try {
      const result = await fetchApi("gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-achievement",
          title: achievementTitle.trim(),
          ...(role === "ADMIN" && targetClubId ? { clubId: targetClubId } : {}),
        }),
      });
      setAchievementTitle("");
      await reload();
      Alert.alert("Logro creado", "El logro está disponible en el catálogo para asignarlo a un atleta.");
    } catch (value) {
      Alert.alert("No se pudo crear", value instanceof Error ? value.message : "Error al crear el logro.");
    } finally {
      setSaving(false);
    }
  };

  const setGamificationEnabled = async (enabled: boolean) => {
    if (!selectedAthleteId) {
      Alert.alert("Selecciona un atleta", "Elige un atleta para cambiar su gamificación.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi("gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-enabled", athleteId: selectedAthleteId, enabled }),
      });
      await reload();
    } catch (value) {
      Alert.alert("No se pudo actualizar", value instanceof Error ? value.message : "Error al cambiar gamificación.");
    } finally {
      setSaving(false);
    }
  };

  const requestConsent = async () => {
    if (!selectedAthleteId || !guardianName.trim() || !guardianEmail.trim()) {
      Alert.alert("Datos incompletos", "Selecciona el atleta e indica nombre y email del tutor.");
      return;
    }
    setSaving(true);
    try {
      const result = await fetchApi("gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-consent",
          athleteId: selectedAthleteId,
          guardianName: guardianName.trim(),
          guardianEmail: guardianEmail.trim(),
        }),
      });
      await reload();
      Alert.alert("Solicitud generada", `Comparte este enlace con el tutor:\n${result.consentUrl}`);
    } catch (value) {
      Alert.alert("No se pudo solicitar", value instanceof Error ? value.message : "Error al solicitar consentimiento.");
    } finally {
      setSaving(false);
    }
  };

  const assignAchievement = async (achievementId: string) => {
    if (!selectedAthleteId) {
      Alert.alert("Selecciona un atleta", "Elige el atleta que recibirá el logro.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi("gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign-achievement", athleteId: selectedAthleteId, achievementId }),
      });
      await reload();
      Alert.alert("Logro asignado", `Se asignó el logro a ${selectedAthleteName}.`);
    } catch (value) {
      Alert.alert("No se pudo asignar", value instanceof Error ? value.message : "Error al asignar el logro.");
    } finally {
      setSaving(false);
    }
  };

  const updateDue = async (id: string, status: "PAID" | "CANCELLED") => {
    setSaving(true);
    try {
      await fetchApi(`finance/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (value) {
      Alert.alert("No se pudo actualizar la cuota", value instanceof Error ? value.message : "Error al actualizar la cuota.");
    } finally {
      setSaving(false);
    }
  };

  const openVideo = async (video: RecordItem) => {
    try {
      const result = await fetchApi(`videos/${encodeURIComponent(video.id)}`);
      await Linking.openURL(result.signedUrl);
    } catch (value) {
      Alert.alert("No se pudo abrir el vídeo", value instanceof Error ? value.message : "Error al preparar el enlace privado.");
    }
  };

  const toggleMember = (id: string) => setSelectedMemberIds((current) =>
    current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id],
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.heading}>
        {onBack && <TouchableOpacity onPress={onBack}><Text style={styles.link}>‹ Volver</Text></TouchableOpacity>}
        <Text style={styles.title}>Mi club</Text>
        <Text style={styles.subtitle}>Clases, cuotas, vídeos y logros asociados a tu cuenta y club.</Text>
      </View>
      {role === "ADMIN" && (
        <TextInput value={adminClubId} onChangeText={setAdminClubId}
          placeholder={`ID del club${clubId ? ` (${clubId})` : ""}`} placeholderTextColor="#64748b"
          autoCapitalize="none" style={styles.input} />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {sections.map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setSection(key)} style={[styles.tab, section === key && styles.tabActive]}>
            <Text style={[styles.tabText, section === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {section === "gamification" && canManage && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alumno seleccionado</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {athletes.map((athlete) => (
              <TouchableOpacity key={athlete.id} onPress={() => setSelectedAthleteId(athlete.id)}
                style={[styles.choice, selectedAthleteId === athlete.id && styles.choiceActive]}>
                <Text style={styles.choiceText}>{athlete.fullName || athlete.name || athlete.id}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {section === "classes" && canManage && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Crear clase compartida</Text>
          <TextInput value={className} onChangeText={setClassName} placeholder="Nombre de la clase" placeholderTextColor="#64748b" style={styles.input} />
          <TextInput value={classDescription} onChangeText={setClassDescription} placeholder="Descripción (opcional)" placeholderTextColor="#64748b" style={styles.input} />
          <Text style={styles.label}>Alumnos (selección múltiple)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {athletes.map((athlete) => (
              <TouchableOpacity key={athlete.id} onPress={() => toggleMember(athlete.id)}
                style={[styles.choice, selectedMemberIds.includes(athlete.id) && styles.choiceActive]}>
                <Text style={styles.choiceText}>{athlete.fullName || athlete.name || athlete.id}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ActionButton label="Crear clase" onPress={saveClass} saving={saving} />
        </View>
      )}

      {section === "classes" && canManage && items.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Programar entrenamiento para toda una clase</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {items.map((clubClass) => (
              <TouchableOpacity key={clubClass.id} onPress={() => setSelectedClassId(clubClass.id)}
                style={[styles.choice, selectedClassId === clubClass.id && styles.choiceActive]}>
                <Text style={styles.choiceText}>{clubClass.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput value={classTrainingTitle} onChangeText={setClassTrainingTitle} placeholder="Título del entrenamiento" placeholderTextColor="#64748b" style={styles.input} />
          <View style={styles.row}>
            <TextInput value={classTrainingDate} onChangeText={setClassTrainingDate} placeholder="AAAA-MM-DD" placeholderTextColor="#64748b" style={[styles.input, { flex: 1 }]} />
            <TextInput value={classTrainingTime} onChangeText={setClassTrainingTime} placeholder="HH:MM" placeholderTextColor="#64748b" style={[styles.input, { flex: 1 }]} />
            <TextInput value={classTrainingDuration} onChangeText={setClassTrainingDuration} placeholder="Min" placeholderTextColor="#64748b" keyboardType="number-pad" style={[styles.input, { flex: 0.7 }]} />
          </View>
          <ActionButton label="Programar sesión compartida" onPress={saveClassTraining} saving={saving} />
        </View>
      )}

      {section === "finance" && canManage && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registrar movimiento manual</Text>
          <View style={styles.row}>
            {(["STUDENT_DUE", "INCOME", "EXPENSE"] as const).map((type) => (
              <TouchableOpacity key={type} onPress={() => setFinanceType(type)} style={[styles.choice, financeType === type && styles.choiceActive]}>
                <Text style={styles.choiceText}>{type === "STUDENT_DUE" ? "Cuota" : type === "INCOME" ? "Ingreso" : "Gasto"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {financeType === "STUDENT_DUE" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {athletes.map((athlete) => (
                <TouchableOpacity key={athlete.id} onPress={() => setSelectedAthleteId(athlete.id)}
                  style={[styles.choice, selectedAthleteId === athlete.id && styles.choiceActive]}>
                  <Text style={styles.choiceText}>{athlete.fullName || athlete.name || athlete.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput value={financeDescription} onChangeText={setFinanceDescription} placeholder="Descripción" placeholderTextColor="#64748b" style={styles.input} />
          <TextInput value={financeAmount} onChangeText={setFinanceAmount} placeholder="Importe en EUR" placeholderTextColor="#64748b" keyboardType="decimal-pad" style={styles.input} />
          <ActionButton label="Guardar movimiento" onPress={saveFinanceEntry} saving={saving} />
        </View>
      )}

      {section === "gamification" && canManage && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gamificación · {selectedAthleteName}</Text>
          <Text style={styles.body}>Estado: {summary?.enabled ? "Activada" : "No activada"}</Text>
          <ActionButton label={summary?.enabled ? "Desactivar gamificación" : "Activar gamificación"}
            onPress={() => void setGamificationEnabled(!summary?.enabled)} saving={saving} />
          <TextInput value={guardianName} onChangeText={setGuardianName} placeholder="Nombre del tutor (menores)" placeholderTextColor="#64748b" style={styles.input} />
          <TextInput value={guardianEmail} onChangeText={setGuardianEmail} placeholder="Email del tutor" placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
          <ActionButton label="Solicitar consentimiento" onPress={requestConsent} saving={saving} />
          <TextInput value={achievementTitle} onChangeText={setAchievementTitle} placeholder="Nuevo logro personalizado" placeholderTextColor="#64748b" style={styles.input} />
          <ActionButton label="Crear logro" onPress={createAchievement} saving={saving} />
        </View>
      )}

      {loading && <ActivityIndicator color="#38bdf8" style={{ marginVertical: 20 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && section === "finance" && summary && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumen mensual ({summary.month})</Text>
          <Text style={styles.body}>Ingresos: {Number(summary.income || 0).toFixed(2)} €</Text>
          <Text style={styles.body}>Gastos: {Number(summary.expenses || 0).toFixed(2)} €</Text>
          <Text style={styles.body}>Balance: {Number(summary.balance || 0).toFixed(2)} €</Text>
          {canManage && <Text style={styles.body}>Cuotas pendientes: {Number(summary.pending || 0).toFixed(2)} €</Text>}
        </View>
      )}
      {!loading && !error && section === "gamification" && summary?.consent && (
        <Text style={styles.body}>Consentimiento: {summary.consent.status}
          {summary.consent.consentExpiresAt ? ` · Vence ${new Date(summary.consent.consentExpiresAt).toLocaleDateString()}` : ""}
        </Text>
      )}
      {!loading && !error && items.map((item, index) => (
        <View key={item.id || item.achievement_id || index} style={styles.card}>
          <Text style={styles.cardTitle}>
            {section === "classes" ? item.name
              : section === "finance" ? item.description
                : section === "videos" ? item.title
                  : item.gamification_achievements?.title || item.title || item.name || "Logro"}
          </Text>
          <Text style={styles.body}>
            {section === "classes" ? `${item.athleteIds?.length || 0} alumnos · ${item.description || "Clase del club"}`
              : section === "finance" ? `${item.entryType === "STUDENT_DUE" ? "Cuota" : item.entryType === "EXPENSE" ? "Gasto" : "Ingreso"} · ${Number(item.amount || 0).toFixed(2)} € · ${item.status}`
                : section === "videos" ? `${item.description || "Vídeo compartido"} · ${Math.round(Number(item.fileSizeBytes || 0) / 1024 / 1024)} MB`
                  : item.note || item.description || ""}
          </Text>
          {section === "classes" && item.sessions?.map((session: RecordItem) => (
            <Text key={session.id} style={styles.sessionLine}>
              {new Date(session.scheduledAt).toLocaleString()} · {session.title} · {session.durationMinutes} min
            </Text>
          ))}
          {section === "videos" && (
            <ActionButton label="Abrir vídeo privado" onPress={() => void openVideo(item)} />
          )}
          {section === "finance" && canManage && item.entryType === "STUDENT_DUE" && item.status === "PENDING" && (
            <View style={styles.row}>
              <ActionButton label="Marcar pagada" onPress={() => void updateDue(item.id, "PAID")} saving={saving} />
              <TouchableOpacity onPress={() => void updateDue(item.id, "CANCELLED")} disabled={saving} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {section === "gamification" && canManage && catalog.map((achievement) => (
        <View key={achievement.id} style={styles.card}>
          <Text style={styles.cardTitle}>{achievement.title}</Text>
          {!!achievement.description && <Text style={styles.body}>{achievement.description}</Text>}
          <ActionButton label={`Asignar a ${selectedAthleteName}`} onPress={() => void assignAchievement(achievement.id)} saving={saving} />
        </View>
      ))}
      {!loading && !error && !items.length && (
        <Text style={styles.empty}>{section === "gamification" && summary && !summary.enabled
          ? "La gamificación aún no está habilitada para esta ficha."
          : "No hay registros para mostrar."}</Text>
      )}
    </ScrollView>
  );
}

function ActionButton({ label, onPress, saving = false }: { label: string; onPress: () => void; saving?: boolean }) {
  return (
    <TouchableOpacity disabled={saving} onPress={onPress} style={styles.button}>
      {saving ? <ActivityIndicator color="#06101c" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 36, gap: 12 },
  heading: { gap: 5 },
  title: { color: "#f8fafc", fontSize: 23, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  link: { color: "#38bdf8", fontSize: 14, fontWeight: "700", marginBottom: 5 },
  tabs: { gap: 8, paddingVertical: 5 },
  tab: { borderRadius: 18, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 14, paddingVertical: 9 },
  tabActive: { backgroundColor: "#0c4a6e", borderColor: "#38bdf8" },
  tabText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#e0f2fe" },
  card: { backgroundColor: "#0b1220", borderRadius: 14, borderWidth: 1, borderColor: "#1e293b", padding: 14, gap: 9 },
  cardTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "800" },
  body: { color: "#cbd5e1", fontSize: 12, lineHeight: 18 },
  sessionLine: { color: "#7dd3fc", fontSize: 11, lineHeight: 16 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  input: { backgroundColor: "#070d17", borderColor: "#26364b", borderWidth: 1, borderRadius: 9, color: "#f8fafc", paddingHorizontal: 11, paddingVertical: 10, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choice: { backgroundColor: "#111827", borderRadius: 18, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 10, paddingVertical: 8, marginRight: 6 },
  choiceActive: { borderColor: "#38bdf8", backgroundColor: "#082f49" },
  choiceText: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  button: { backgroundColor: "#38bdf8", borderRadius: 9, alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 12, paddingVertical: 10 },
  buttonText: { color: "#06101c", fontSize: 12, fontWeight: "900", textAlign: "center" },
  secondaryButton: { backgroundColor: "#1e293b", borderRadius: 9, alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: "#cbd5e1", fontSize: 12, fontWeight: "800" },
  error: { color: "#fca5a5", fontSize: 12, lineHeight: 18, padding: 10, backgroundColor: "#450a0a", borderRadius: 9 },
  empty: { color: "#94a3b8", textAlign: "center", paddingVertical: 22, fontSize: 12 },
});
