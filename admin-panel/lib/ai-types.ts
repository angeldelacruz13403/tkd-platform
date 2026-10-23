export type AIJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type AIVideoAnalysisStatus = AIJobStatus | "NEEDS_REVIEW" | "APPROVED";

export type AIPlanStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "ARCHIVED";

export type CorrectiveWorkStatus =
  | "PROPOSED"
  | "APPROVED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";

export type AIIntensityZone = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export interface AIVideoEvidence {
  startSeconds: number;
  endSeconds: number;
  description: string;
}

export interface AIVideoObservation {
  category:
    | "ATTACK"
    | "DEFENSE"
    | "DISTANCE"
    | "TACTICS"
    | "TECHNIQUE"
    | "FATIGUE"
    | "OTHER";
  description: string;
  evidence: AIVideoEvidence[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  limitations: string[];
}

export interface AICorrectiveWorkSuggestion {
  title: string;
  objective: string;
  rationale: string;
  exercises: Array<{
    name: string;
    instructions: string;
    sets?: number;
    repetitions?: number;
    durationSeconds?: number;
    restSeconds?: number;
    intensityZone?: AIIntensityZone;
    coachingCues: string[];
  }>;
  sourceObservationIndexes: number[];
}

export interface AIVideoAnalysisResult {
  summary: string;
  observations: AIVideoObservation[];
  suggestedCorrectiveWorks: AICorrectiveWorkSuggestion[];
  limitations: string[];
  recordedMatchMetrics?: {
    competitionName?: string;
    matchDate?: string;
    category?: string;
    recordedWinner?: string;
    chongScore?: number;
    hongScore?: number;
    chongGamJeom?: number;
    hongGamJeom?: number;
    headKicks?: number;
    spinningHeadKicks?: number;
    bodyKicks?: number;
    spinningBodyKicks?: number;
    punches?: number;
    staminaDropRound3?: boolean;
  };
}

export interface AIVideoAnalysisRecord {
  id: string;
  athleteId: string;
  competitionMatchId?: string;
  createdBy?: string;
  status: AIVideoAnalysisStatus;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  provider?: string;
  model?: string;
  result?: AIVideoAnalysisResult;
  errorMessage?: string;
  consentRecordedAt?: string;
  retentionUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIPlannedExercise {
  name: string;
  objective: string;
  instructions: string;
  sets?: number;
  repetitions?: number;
  durationMinutes?: number;
  restSeconds?: number;
  intensityZone: AIIntensityZone;
  coachingCues: string[];
  correctiveWorkIds: string[];
}

export interface AIPlannedSession {
  date: string;
  title: string;
  objective: string;
  type: string;
  durationMinutes: number;
  intensity: AIIntensityZone;
  exercises: AIPlannedExercise[];
  recoveryNotes: string[];
  optional: boolean;
}

export interface AIWeeklyPlan {
  schemaVersion: 1;
  weekStart: string;
  weekEnd: string;
  objective: string;
  periodizationPhase: string;
  athleteContext: {
    readinessScore?: number;
    injuryStatus?: string;
    competitionDate?: string;
    limitations: string[];
  };
  sessions: AIPlannedSession[];
  coachNotes: string[];
}

export interface AITrainingPlanRecord {
  id: string;
  athleteId: string;
  coachId?: string;
  createdBy?: string;
  weekStart: string;
  status: AIPlanStatus;
  objective: string;
  periodizationPhase: string;
  contextSnapshot: Record<string, unknown>;
  plan: AIWeeklyPlan;
  provider?: string;
  model?: string;
  promptVersion: string;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AICorrectiveWorkRecord {
  id: string;
  athleteId: string;
  videoAnalysisId?: string;
  trainingPlanId?: string;
  trainingSessionId?: string;
  plannedSessionDate?: string;
  createdBy?: string;
  status: CorrectiveWorkStatus;
  optional: boolean;
  title: string;
  objective: string;
  rationale: string;
  exercises: AICorrectiveWorkSuggestion["exercises"];
  sourceEvidence: AIVideoEvidence[];
  athleteFeedback?: string;
  coachNotes?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
