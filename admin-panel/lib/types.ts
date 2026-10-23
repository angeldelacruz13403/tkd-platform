export type UserRole = "ADMIN" | "COACH" | "ATHLETE" | "CLUB";
export type ClubPlan = "FREE" | "SEMIPRO" | "PRO";
export type BillingInterval = "MONTH" | "YEAR";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  password: string;
  dni?: string;
  clubId?: string;
  role: UserRole;
  isClubDirector?: boolean;
  avatarUrl?: string;
  phone?: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  createdAt: string;
  lastLogin?: string;
}

export type WTCategory =
  | "SENIOR_M_54"
  | "SENIOR_M_58"
  | "SENIOR_M_63"
  | "SENIOR_M_68"
  | "SENIOR_M_74"
  | "SENIOR_M_80"
  | "SENIOR_M_87"
  | "SENIOR_M_PLUS_87"
  | "SENIOR_F_46"
  | "SENIOR_F_49"
  | "SENIOR_F_53"
  | "SENIOR_F_57"
  | "SENIOR_F_62"
  | "SENIOR_F_67"
  | "SENIOR_F_73"
  | "SENIOR_F_PLUS_73"
  | "JUNIOR_M_55"
  | "JUNIOR_F_49"
  | "CADET_M_45"
  | "CADET_F_41";

export interface Athlete {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth?: string;
  isCompetitor: boolean;
  category: WTCategory;
  beltRank: "1st_Dan" | "2nd_Dan" | "3rd_Dan" | "4th_Dan" | "Red_Black" | "Red";
  clubId: string;
  clubName: string;
  coachId: string;
  coachName: string;
  weightKg: number;
  heightCm: number;
  maxHeartRateBpm: number;
  restingHeartRateBpm: number;
  vo2MaxEstimate: number;
  readinessScore: number; // 0 - 100
  injuryStatus: "FIT" | "MINOR_STRAIN" | "RECOVERING";
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    koTkoCount: number;
    gamJeomAvg: number;
    favouriteTechnique: string;
  };
}

export interface Coach {
  id: string;
  userId: string;
  fullName: string;
  licenseNumber: string;
  specialty: "COMBAT_KYORUGI" | "POOMSAE" | "PHYSICAL_CONDITIONING" | "HIGH_PERFORMANCE";
  clubId: string;
  clubName: string;
  athletesCount: number;
  yearsOfExperience: number;
  certifications: string[];
}

export interface Club {
  id: string;
  name: string;
  dojangAddress: string;
  city: string;
  federationCode: string;
  directorName: string;
  coachId?: string;
  coachName?: string;
  athletesCount: number;
  coachesCount: number;
  activeSubscriptions: number;
  foundedYear: number;
}

export interface HeartRateZoneBreakdown {
  zone1RecoveryMin: number; // 50-60% Max HR
  zone2AerobicMin: number;   // 60-70% Max HR
  zone3TempoMin: number;     // 70-80% Max HR
  zone4ThresholdMin: number; // 80-90% Max HR
  zone5AnaerobicMin: number; // >90% Max HR (High intensity sparring)
}

export interface TrainingBlock {
  id: string;
  title: string;
  durationMinutes: number;
}

export interface TrainingBlockMetric extends TrainingBlock {
  elapsedSeconds: number;
  avgBpm: number;
  maxBpm: number;
  sampleCount: number;
  completed: boolean;
}

export interface TrainingBlockTelemetry {
  sessionId: string;
  startedAt: string;
  currentBlock: TrainingBlockMetric & { index: number; totalBlocks: number };
  blocks: TrainingBlockMetric[];
}

export interface TrainingSession {
  id: string;
  title: string;
  athleteId: string;
  athleteName: string;
  coachId: string;
  date: string;
  durationMinutes: number;
  type: "SPARRING_TACTICAL" | "HIGH_INTENSITY_INTERVALS" | "POOMSAE_TECHNICAL" | "STRENGTH_POWER" | "INTERVALS_HIGH_LOAD";
  rpeScore: number; // 1 - 10 (Rate of Perceived Exertion)
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  heartRateRecovery1Min: number; // BPM dropped in 60s post-effort
  trimpScore: number; // Training Impulse
  heartRateZones: HeartRateZoneBreakdown;
  aiFeedback: string;
  bpmSeries?: Array<{ time: number; bpm: number }>;
  blocks?: TrainingBlock[];
  blockMetrics?: TrainingBlockMetric[];
  status: "COMPLETED" | "SCHEDULED" | "MISSED" | "IN_PROGRESS";
}

export interface ClubClass {
  id: string;
  clubId: string;
  coachId: string;
  name: string;
  description: string;
  isActive: boolean;
  athleteIds: string[];
  createdAt: string;
}

export interface ClassTrainingSession {
  id: string;
  classId: string;
  coachId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  type: TrainingSession["type"];
  notes: string;
  blocks: TrainingBlock[];
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export interface ClubSubscription {
  clubId: string;
  planTier: ClubPlan;
  status: SubscriptionStatus;
  billingInterval?: BillingInterval;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  pendingPlanTier?: ClubPlan;
  pendingBillingInterval?: BillingInterval;
}

export interface ClubFinanceEntry {
  id: string;
  clubId: string;
  athleteId?: string;
  athleteName?: string;
  entryType: "STUDENT_DUE" | "INCOME" | "EXPENSE";
  status: "PENDING" | "PAID" | "CANCELLED";
  description: string;
  amount: number;
  currency: string;
  dueDate?: string;
  occurredAt: string;
  paidAt?: string;
  createdBy: string;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "BIZUM" | "DIRECT_DEBIT";
}

export interface CoachSharedVideo {
  id: string;
  clubId: string;
  coachUserId: string;
  title: string;
  description: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface GamificationAchievement {
  id: string;
  clubId?: string;
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export interface AthleteAchievement extends GamificationAchievement {
  athleteId: string;
  awardedAt: string;
  note: string;
  awardedBy: string;
}

export interface GamificationLevel {
  levelNumber: number;
  name: string;
  requiredAchievements: number;
}

export interface GuardianConsent {
  id: string;
  athleteId: string;
  clubId: string;
  guardianName: string;
  guardianEmail: string;
  status: "PENDING" | "GRANTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  consentExpiresAt?: string;
  grantedAt?: string;
}

export interface CompetitionMatch {
  id: string;
  tournamentName: string;
  tournamentId?: string;
  opponentAthleteId?: string;
  isBye?: boolean;
  isPlaceholder?: boolean;
  round?: number;
  tatamiNumber?: number;
  sourceMatchNumbers?: number[];
  advancementSources?: { athlete?: number; opponent?: number };
  matchNumber: string;
  phase: string;
  weightDivision: string;
  chongWtId: string;
  hongWtId: string;
  started: boolean;
  lastUpdatedAt: string;
  date: string;
  category: string;
  athleteId: string;
  athleteName: string;
  opponentName: string;
  opponentCountryClub: string;
  corner: "CHONG" | "HONG";
  winner?: "CHONG" | "HONG" | "PENDING" | string;
  round1Score: { athlete: number; opponent: number };
  round2Score: { athlete: number; opponent: number };
  round3Score?: { athlete: number; opponent: number };
  result?: "WIN_PTG" | "WIN_POINTS" | "WIN_KOS" | "LOSS_POINTS" | "LOSS_GAMJEOM" | "" | string;
  gamJeomsReceived: number;
  pointsByTechnique: {
    headKicks: number;     // 3 pts
    spinningHead: number;  // 5 pts
    bodyKicks: number;     // 2 pts
    spinningBody: number;  // 4 pts
    punches: number;       // 1 pt
  };
  staminaDropInRound3: boolean;
}

export type KnowledgeCategory = "EXERCISE" | "WT_RULES" | "TECHNIQUE" | "VIDEO_DRILL" | "PHYSIOLOGY_PDF";

export interface AIKnowledgeItem {
  id: string;
  title: string;
  category: KnowledgeCategory;
  description: string;
  fileType: "PDF" | "VIDEO_MP4" | "TEXT_PROTOCOL" | "URL";
  fileUrl?: string;
  sourceFileName?: string;
  sourceFileSize?: number;
  sourceMimeType?: string;
  tags: string[];
  indexedTokens: number;
  status: "INDEXED" | "PROCESSING" | "NEEDS_REVIEW";
  addedAt: string;
  addedBy: string;
}

export interface AIRetrainMetrics {
  modelVersion: string;
  trainedAt: string;
  datasetSizeRecords: number;
  heartRateSessionsAnalyzed: number;
  combatRoundsProcessed: number;
  fatiguePredictionAccuracy: number; // e.g. 94.8%
  tacticalRecommendationF1: number; // e.g. 91.2%
  learnedWeights: {
    cardioVolumeTolerance: number;
    anaerobicRecoveryRate: number;
    gamJeomRiskWeight: number;
    round3FatigueDecayFactor: number;
  };
  changelog: string;
}

export interface AIWorkoutPlan {
  id: string;
  athleteId: string;
  generatedDate: string;
  targetObjective: string;
  periodizationPhase: "PRE_COMPETITION" | "STRENGTH_BUILDING" | "TAPERING" | "RECOVERY";
  rounds: {
    roundNumber: number;
    durationSeconds: number;
    restSeconds: number;
    drills: {
      name: string;
      description: string;
      targetIntensityZone: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
      repsOrDuration: string;
      kickingTechniques: string[];
    }[];
  }[];
  aiRationale: string;
}

export interface AthleteLiveTelemetry {
  athleteId: string;
  athleteName: string;
  category?: string;
  beltRank?: string;
  clubId?: string;
  coachId?: string;
  currentBpm: number;
  maxHeartRateBpm: number;
  restingHeartRateBpm?: number;
  zone: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
  zoneName: string;
  zoneColor: string;
  trimpScore: number;
  sessionDurationSec: number;
  trainingMode: string;
  isTrainingRunning: boolean;
  blockTelemetry?: TrainingBlockTelemetry;
  batteryLevel?: number | null;
  lastUpdatedAt: string; // ISO string
  status: "LIVE" | "PAUSED" | "OFFLINE";
}

// ==========================================
// GESTIÓN DEL CLUB (DOJANG MANAGEMENT)
// ==========================================

export type AttendanceStatus = "PRESENT" | "ABSENT" | "JUSTIFIED" | "LATE" | "UNMARKED";

export interface AttendanceRecord {
  id: string;
  clubId: string;
  athleteId: string;
  athleteName: string;
  date: string; // YYYY-MM-DD
  group: string;
  status: AttendanceStatus;
  checkInTime?: string; // HH:mm
  notes?: string;
}

export type LicenseStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "PENDING_RENEWAL";

export interface ClubMemberLicense {
  id: string;
  clubId: string;
  athleteId: string;
  athleteName: string;
  category?: string;
  federationCode: string; // ej. RFET-78291
  federationRegion: string; // ej. "Federación Madrileña de Taekwondo"
  licenseExpiryDate: string; // YYYY-MM-DD
  insurancePolicy: string; // ej. "Seguro Deportivo Mapfre / RFET #99281"
  insuranceValidUntil: string;
  medicalClearanceDate: string;
  medicalClearanceValidUntil: string;
  minorConsentSigned: boolean;
  status: LicenseStatus;
  lastUpdated: string;
}

export interface BeltExamCandidate {
  athleteId: string;
  athleteName: string;
  currentBelt: string;
  targetBelt: string;
  attendedClasses: number;
  minClassesRequired: number;
  poomsaeScore?: number; // 0 a 10
  sparringScore?: number; // 0 a 10
  techniqueScore?: number; // 0 a 10
  breakingScore?: number; // 0 a 10
  passed?: boolean;
  feePaid: boolean;
  diplomaIssued: boolean;
  notes?: string;
}

export interface BeltExamEvent {
  id: string;
  clubId: string;
  title: string;
  examDate: string;
  examinerName: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  candidates: BeltExamCandidate[];
}
