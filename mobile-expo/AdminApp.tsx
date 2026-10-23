import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity,
  View, ActivityIndicator, RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchApi, fetchLiveTelemetryFromApi } from "./api";
import ClubHub from "./ClubHub";

export type AdminUser = { id: string; name?: string; email?: string; role?: string; };

interface PlatformStats { athletes: number; coaches: number; clubs: number; trainings: number; liveAthletes: number; }
interface LiveTelemetryRow { athleteId: string; athleteName?: string; currentBpm: number; zone?: string; zoneColor?: string; zoneName?: string; isTrainingRunning?: boolean; sessionDurationSec?: number; }

const C = { bg:"#06090f", card:"#0d1117", border:"#1e2530", accent:"#e63946", gold:"#f4a261", blue:"#4cc9f0", green:"#2dc653", text:"#e8eaf0", muted:"#8892a4", surface:"#161c27" };

function StatCard({ label, value, icon, color }: { label:string; value:string|number; icon:keyof typeof MaterialCommunityIcons.glyphMap; color:string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminApp({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [stats, setStats] = useState<PlatformStats>({ athletes:0, coaches:0, clubs:0, trainings:0, liveAthletes:0 });
  const [liveFeed, setLiveFeed] = useState<LiveTelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview"|"live"|"club"|"account">("overview");

  const loadStats = useCallback(async () => {
    try {
      const [athRes, coachRes, clubRes, trnRes, liveRes] = await Promise.allSettled([
        fetchApi("athletes"), fetchApi("coaches"), fetchApi("clubs"), fetchApi("trainings"), fetchLiveTelemetryFromApi(),
      ]);
      const n = (r: PromiseSettledResult<any>) => r.status==="fulfilled" ? (r.value?.total ?? r.value?.data?.length ?? 0) : 0;
      const live: LiveTelemetryRow[] = liveRes.status==="fulfilled" ? liveRes.value : [];
      setStats({ athletes:n(athRes), coaches:n(coachRes), clubs:n(clubRes), trainings:n(trnRes), liveAthletes: live.filter(r=>r.isTrainingRunning).length });
      setLiveFeed(live);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadStats(); const t=setInterval(loadStats,8000); return ()=>clearInterval(t); }, [loadStats]);

  const bpmColor = (b:number) => b>180?C.accent:b>160?C.gold:b>130?C.blue:C.green;
  const fmtDur = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View>
          <Text style={s.headerRole}>ADMINISTRADOR</Text>
          <Text style={s.headerName}>{user.name || user.email || "Admin"}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={22} color={C.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(["overview","live","club","account"] as const).map(tab => (
          <TouchableOpacity key={tab} style={[s.tab, activeSection===tab && s.tabActive]} onPress={()=>setActiveSection(tab)}>
            <MaterialCommunityIcons name={tab==="overview"?"view-dashboard":tab==="live"?"pulse":tab==="club"?"domain":"account-circle"} size={16} color={activeSection===tab?C.accent:C.muted} />
            <Text style={[s.tabLabel, activeSection===tab && s.tabLabelActive]}>{tab==="overview"?"Resumen":tab==="live"?"En Vivo":tab==="club"?"Mi Club":"Cuenta"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={C.accent} /><Text style={s.mutedText}>Cargando plataforma...</Text></View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{padding:16}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);loadStats();}} tintColor={C.accent} />}>
          {activeSection==="overview" && <>
            <Text style={s.sectionTitle}>📊 Estadísticas Globales</Text>
            <View style={s.grid}>
              <StatCard label="Atletas" value={stats.athletes} icon="account-multiple" color={C.blue} />
              <StatCard label="Entrenadores" value={stats.coaches} icon="whistle" color={C.gold} />
              <StatCard label="Clubs" value={stats.clubs} icon="shield-star" color={C.green} />
              <StatCard label="Entrenamientos" value={stats.trainings} icon="dumbbell" color={C.accent} />
            </View>
            <View style={s.liveCard}>
              <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                <View style={[s.dot,stats.liveAthletes>0?s.dotGreen:s.dotGrey]} />
                <Text style={s.cardTitle}>{stats.liveAthletes>0?`${stats.liveAthletes} atleta${stats.liveAthletes>1?"s":""} entrenando ahora`:"Sin sesiones activas"}</Text>
              </View>
              {stats.liveAthletes>0&&<Text style={s.cardSub}>Pulsa "En Vivo" para ver el PPM en tiempo real.</Text>}
            </View>
            <Text style={s.sectionTitle}>🔗 Acceso Rápido</Text>
            {[
              {icon:"web" as const,label:"Panel Web de Administración",sub:"tkdcore.vercel.app",color:C.blue},
              {icon:"database" as const,label:"Base de Datos Supabase",sub:"supabase.com → TKD Global Hub",color:C.gold},
              {icon:"api" as const,label:"API REST",sub:"tkdcore.vercel.app/api/v1",color:C.green},
            ].map(item=>(
              <View key={item.label} style={s.infoCard}>
                <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                <View style={{flex:1}}>
                  <Text style={s.infoCardLabel}>{item.label}</Text>
                  <Text style={s.cardSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </View>
            ))}
          </>}

          {activeSection==="live" && <>
            <Text style={s.sectionTitle}>📡 Telemetría en Vivo — {liveFeed.length} sensor{liveFeed.length!==1?"es":""}</Text>
            {liveFeed.length===0?(
              <View style={s.empty}>
                <MaterialCommunityIcons name="heart-off" size={48} color={C.muted} />
                <Text style={s.emptyTitle}>Sin señal activa</Text>
                <Text style={s.cardSub}>Los atletas aparecerán aquí cuando conecten su sensor BLE.</Text>
              </View>
            ):liveFeed.map((row,i)=>(
              <View key={row.athleteId+i} style={s.liveRow}>
                <View style={{flex:1}}>
                  <Text style={s.infoCardLabel}>{row.athleteName||row.athleteId}</Text>
                  <Text style={s.cardSub}>{row.isTrainingRunning?`🟢 Sesión · ${fmtDur(row.sessionDurationSec||0)}`:"⚪ Sin sesión"}</Text>
                </View>
                <View style={{alignItems:"flex-end"}}>
                  <Text style={[s.bpmNum,{color:bpmColor(row.currentBpm)}]}>{row.currentBpm}</Text>
                  <Text style={s.cardSub}>PPM</Text>
                </View>
              </View>
            ))}
          </>}

          {activeSection==="account" && <>
            <Text style={s.sectionTitle}>👤 Mi Cuenta</Text>
            <View style={s.profileCard}>
              {[["Rol","ADMIN"],[" Nombre",user.name||"—"],["Email",user.email||"—"],["ID",user.id]].map(([label,val])=>(
                <View key={label} style={s.profileRow}>
                  <Text style={s.cardSub}>{label}</Text>
                  {label==="Rol"?(<View style={s.badge}><Text style={s.badgeText}>ADMIN</Text></View>):(<Text style={s.infoCardLabel}>{val}</Text>)}
                </View>
              ))}
            </View>
            <TouchableOpacity style={s.logoutBlock} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={18} color={C.accent} />
              <Text style={{fontSize:15,color:C.accent,fontWeight:"700"}}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>}
          {activeSection==="club" && <ClubHub role="ADMIN" />}
          <View style={{height:40}} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},
  headerRole:{fontSize:10,color:C.accent,fontWeight:"800",letterSpacing:2},
  headerName:{fontSize:18,color:C.text,fontWeight:"700",marginTop:2},
  logoutBtn:{width:40,height:40,borderRadius:20,backgroundColor:C.surface,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.border},
  tabs:{flexDirection:"row",backgroundColor:C.card,borderBottomWidth:1,borderBottomColor:C.border},
  tab:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",paddingVertical:12,gap:5,borderBottomWidth:2,borderBottomColor:"transparent"},
  tabActive:{borderBottomColor:C.accent},
  tabLabel:{fontSize:12,color:C.muted,fontWeight:"600"},
  tabLabelActive:{color:C.accent},
  scroll:{flex:1},
  centered:{flex:1,alignItems:"center",justifyContent:"center",gap:12},
  mutedText:{color:C.muted,fontSize:14},
  sectionTitle:{fontSize:13,color:C.muted,fontWeight:"700",letterSpacing:1,marginTop:16,marginBottom:10},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:8},
  statCard:{flex:1,minWidth:"45%",backgroundColor:C.card,borderRadius:12,padding:14,borderTopWidth:3,alignItems:"center",gap:4,borderWidth:1,borderColor:C.border},
  statValue:{fontSize:26,fontWeight:"800"},
  statLabel:{fontSize:11,color:C.muted,fontWeight:"600"},
  liveCard:{backgroundColor:C.card,borderRadius:12,padding:16,marginBottom:4,borderWidth:1,borderColor:C.border},
  cardTitle:{fontSize:14,color:C.text,fontWeight:"600"},
  cardSub:{fontSize:11,color:C.muted,marginTop:4},
  dot:{width:10,height:10,borderRadius:5},
  dotGreen:{backgroundColor:C.green},
  dotGrey:{backgroundColor:C.muted},
  infoCard:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:12,padding:14,marginBottom:8,gap:12,borderWidth:1,borderColor:C.border},
  infoCardLabel:{fontSize:13,color:C.text,fontWeight:"600"},
  liveRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:C.card,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:C.border},
  bpmNum:{fontSize:28,fontWeight:"800"},
  empty:{alignItems:"center",paddingVertical:40,gap:12},
  emptyTitle:{fontSize:16,color:C.text,fontWeight:"700"},
  profileCard:{backgroundColor:C.card,borderRadius:12,padding:4,marginBottom:16,borderWidth:1,borderColor:C.border},
  profileRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:12,borderBottomWidth:1,borderBottomColor:C.border},
  badge:{backgroundColor:C.accent+"22",borderRadius:6,paddingHorizontal:10,paddingVertical:3,borderWidth:1,borderColor:C.accent+"55"},
  badgeText:{fontSize:11,color:C.accent,fontWeight:"800",letterSpacing:1},
  logoutBlock:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,backgroundColor:C.accent+"18",borderRadius:12,padding:16,borderWidth:1,borderColor:C.accent+"44"},
});
