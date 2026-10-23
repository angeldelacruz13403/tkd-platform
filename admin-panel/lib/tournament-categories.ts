export type TournamentWeightMode = "OLYMPIC_WEIGHTS" | "OFFICIAL_WEIGHTS";

export interface TournamentWeightCategory {
  value: string;
  label: string;
  defaultWeightKg: number;
  athleteCategories?: string[];
}

const OLYMPIC_WEIGHT_CATEGORIES: TournamentWeightCategory[] = [
  { value: "OLYMPIC_M_58", label: "Masculino -58 kg", defaultWeightKg: 58, athleteCategories: ["SENIOR_M_54", "SENIOR_M_58"] },
  { value: "OLYMPIC_M_68", label: "Masculino -68 kg", defaultWeightKg: 68, athleteCategories: ["SENIOR_M_63", "SENIOR_M_68"] },
  { value: "OLYMPIC_M_80", label: "Masculino -80 kg", defaultWeightKg: 80, athleteCategories: ["SENIOR_M_74", "SENIOR_M_80"] },
  { value: "OLYMPIC_M_PLUS_80", label: "Masculino +80 kg", defaultWeightKg: 88, athleteCategories: ["SENIOR_M_87", "SENIOR_M_PLUS_87"] },
  { value: "OLYMPIC_F_49", label: "Femenino -49 kg", defaultWeightKg: 49, athleteCategories: ["SENIOR_F_46", "SENIOR_F_49"] },
  { value: "OLYMPIC_F_57", label: "Femenino -57 kg", defaultWeightKg: 57, athleteCategories: ["SENIOR_F_53", "SENIOR_F_57"] },
  { value: "OLYMPIC_F_67", label: "Femenino -67 kg", defaultWeightKg: 67, athleteCategories: ["SENIOR_F_62", "SENIOR_F_67"] },
  { value: "OLYMPIC_F_PLUS_67", label: "Femenino +67 kg", defaultWeightKg: 74, athleteCategories: ["SENIOR_F_73", "SENIOR_F_PLUS_73"] },
];

const OFFICIAL_WEIGHT_CATEGORIES: TournamentWeightCategory[] = [
  { value: "SENIOR_M_54", label: "Masculino -54 kg", defaultWeightKg: 54 },
  { value: "SENIOR_M_58", label: "Masculino -58 kg", defaultWeightKg: 58 },
  { value: "SENIOR_M_63", label: "Masculino -63 kg", defaultWeightKg: 63 },
  { value: "SENIOR_M_68", label: "Masculino -68 kg", defaultWeightKg: 68 },
  { value: "SENIOR_M_74", label: "Masculino -74 kg", defaultWeightKg: 74 },
  { value: "SENIOR_M_80", label: "Masculino -80 kg", defaultWeightKg: 80 },
  { value: "SENIOR_M_87", label: "Masculino -87 kg", defaultWeightKg: 87 },
  { value: "SENIOR_M_PLUS_87", label: "Masculino +87 kg", defaultWeightKg: 88 },
  { value: "SENIOR_F_46", label: "Femenino -46 kg", defaultWeightKg: 46 },
  { value: "SENIOR_F_49", label: "Femenino -49 kg", defaultWeightKg: 49 },
  { value: "SENIOR_F_53", label: "Femenino -53 kg", defaultWeightKg: 53 },
  { value: "SENIOR_F_57", label: "Femenino -57 kg", defaultWeightKg: 57 },
  { value: "SENIOR_F_62", label: "Femenino -62 kg", defaultWeightKg: 62 },
  { value: "SENIOR_F_67", label: "Femenino -67 kg", defaultWeightKg: 67 },
  { value: "SENIOR_F_73", label: "Femenino -73 kg", defaultWeightKg: 73 },
  { value: "SENIOR_F_PLUS_73", label: "Femenino +73 kg", defaultWeightKg: 74 },
  { value: "JUNIOR_M_55", label: "Junior masculino -55 kg", defaultWeightKg: 55 },
  { value: "JUNIOR_F_49", label: "Junior femenino -49 kg", defaultWeightKg: 49 },
  { value: "CADET_M_45", label: "Cadete masculino -45 kg", defaultWeightKg: 45 },
  { value: "CADET_F_41", label: "Cadete femenino -41 kg", defaultWeightKg: 41 },
];

export const TKSTRIKE_WEIGHT_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  OLYMPIC_M_58: "OLYMPIC M -58KG",
  OLYMPIC_M_68: "OLYMPIC M -68KG",
  OLYMPIC_M_80: "OLYMPIC M -80KG",
  OLYMPIC_M_PLUS_80: "OLYMPIC M +80KG",
  OLYMPIC_F_49: "OLYMPIC W -49KG",
  OLYMPIC_F_57: "OLYMPIC W -57KG",
  OLYMPIC_F_67: "OLYMPIC W -67KG",
  OLYMPIC_F_PLUS_67: "OLYMPIC W +67KG",
  SENIOR_M_54: "M -54KG",
  SENIOR_M_58: "M -58KG",
  SENIOR_M_63: "M -63KG",
  SENIOR_M_68: "M -68KG",
  SENIOR_M_74: "M -74KG",
  SENIOR_M_80: "M -80KG",
  SENIOR_M_87: "M -87KG",
  SENIOR_M_PLUS_87: "M +87KG",
  SENIOR_F_46: "W -46KG",
  SENIOR_F_49: "W -49KG",
  SENIOR_F_53: "W -53KG",
  SENIOR_F_57: "W -57KG",
  SENIOR_F_62: "W -62KG",
  SENIOR_F_67: "W -67KG",
  SENIOR_F_73: "W -73KG",
  SENIOR_F_PLUS_73: "W +73KG",
  JUNIOR_M_55: "JUNIOR M -55KG",
  JUNIOR_F_49: "JUNIOR W -49KG",
  CADET_M_45: "CADET M -45KG",
  CADET_F_41: "CADET W -41KG",
};

const TKSTRIKE_SENSOR_THRESHOLDS: Record<string, { body: number; head: number }> = {
  SENIOR_M_54: { body: 17, head: 5 },
  SENIOR_M_58: { body: 18, head: 5 },
  SENIOR_M_63: { body: 19, head: 5 },
  SENIOR_M_68: { body: 20, head: 5 },
  SENIOR_M_74: { body: 21, head: 5 },
  SENIOR_M_80: { body: 22, head: 5 },
  SENIOR_M_87: { body: 22, head: 5 },
  SENIOR_M_PLUS_87: { body: 23, head: 5 },
  SENIOR_F_46: { body: 15, head: 5 },
  SENIOR_F_49: { body: 16, head: 5 },
  SENIOR_F_53: { body: 17, head: 5 },
  SENIOR_F_57: { body: 18, head: 5 },
  SENIOR_F_62: { body: 19, head: 5 },
  SENIOR_F_67: { body: 19, head: 5 },
  SENIOR_F_73: { body: 20, head: 5 },
  SENIOR_F_PLUS_73: { body: 21, head: 5 },
};

const TKSTRIKE_EVENT_PREFIXES: Readonly<Record<string, string>> = {
  OLYMPIC: "OLY",
  SENIOR: "SEN",
  JUNIOR: "JUN",
  CADET: "CAD",
};

export function getTkStrikeWeightCategoryLabel(category: string): string | undefined {
  return TKSTRIKE_WEIGHT_CATEGORY_LABELS[category];
}

export function getTkStrikeEventGender(category: string): "MALE" | "FEMALE" {
  return category.includes("_F_") ? "FEMALE" : "MALE";
}

export function getTkStrikeEventAbbreviation(category: string): string | undefined {
  const match = category.match(/^(OLYMPIC|SENIOR|JUNIOR|CADET)_([MF])_(PLUS_)?(\d+)$/);
  if (!match) return undefined;
  const [, division, gender, plus, weight] = match;
  return `${TKSTRIKE_EVENT_PREFIXES[division]}-${gender}${plus ? "+" : ""}${weight}`;
}

export function getTkStrikeEventDivision(category: string): "SENIORS" | "JUNIORS" | "CADETS" {
  if (category.startsWith("JUNIOR_")) return "JUNIORS";
  if (category.startsWith("CADET_")) return "CADETS";
  return "SENIORS";
}

export function getTkStrikeSensorThresholds(category: string): { body: number; head: number } {
  return TKSTRIKE_SENSOR_THRESHOLDS[category] || { body: 20, head: 5 };
}

export function getTournamentWeightCategories(mode?: string): TournamentWeightCategory[] {
  return mode === "OLYMPIC_WEIGHTS"
    ? OLYMPIC_WEIGHT_CATEGORIES
    : OFFICIAL_WEIGHT_CATEGORIES.map((category) => ({ ...category, athleteCategories: [category.value] }));
}

export function getTournamentDivisionForAthlete(mode: string | undefined, athleteCategory: string): TournamentWeightCategory | undefined {
  return getTournamentWeightCategories(mode).find((division) => division.athleteCategories?.includes(athleteCategory));
}

export function getOfficialAthleteCategoryForDivision(mode: string | undefined, division: string, weightKg: number): string | undefined {
  const selectedDivision = getTournamentWeightCategories(mode).find((category) => category.value === division);
  if (!selectedDivision) return undefined;
  if (mode !== "OLYMPIC_WEIGHTS") return division;

  const cutoffs: Record<string, { upperCategory: string; upperLimit: number; overallLimit?: number }> = {
    OLYMPIC_M_58: { upperCategory: "SENIOR_M_58", upperLimit: 54, overallLimit: 58 },
    OLYMPIC_M_68: { upperCategory: "SENIOR_M_68", upperLimit: 63, overallLimit: 68 },
    OLYMPIC_M_80: { upperCategory: "SENIOR_M_80", upperLimit: 74, overallLimit: 80 },
    OLYMPIC_M_PLUS_80: { upperCategory: "SENIOR_M_PLUS_87", upperLimit: 87 },
    OLYMPIC_F_49: { upperCategory: "SENIOR_F_49", upperLimit: 46, overallLimit: 49 },
    OLYMPIC_F_57: { upperCategory: "SENIOR_F_57", upperLimit: 53, overallLimit: 57 },
    OLYMPIC_F_67: { upperCategory: "SENIOR_F_67", upperLimit: 62, overallLimit: 67 },
    OLYMPIC_F_PLUS_67: { upperCategory: "SENIOR_F_PLUS_73", upperLimit: 73 },
  };
  const range = cutoffs[division];
  if (!range || (range.overallLimit && weightKg > range.overallLimit)) return undefined;
  return weightKg <= range.upperLimit ? selectedDivision.athleteCategories?.[0] : range.upperCategory;
}

export function getTournamentWeightModeLabel(mode?: string): string {
  return mode === "OLYMPIC_WEIGHTS" ? "Pesos olímpicos" : "Pesos oficiales";
}

export function getDefaultWeightKg(category: string): number {
  return OFFICIAL_WEIGHT_CATEGORIES.find((item) => item.value === category)?.defaultWeightKg
    ?? OLYMPIC_WEIGHT_CATEGORIES.find((item) => item.value === category)?.defaultWeightKg
    ?? 68;
}