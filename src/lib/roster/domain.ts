// Vocabulaire métier des groupes et des athlètes.
// Les valeurs (en anglais) sont celles stockées en base : elles doivent rester
// alignées avec les contraintes CHECK des migrations SQL.

export const DISCIPLINES = [
  "wrestling",
  "mma",
  "bjj",
  "boxing",
  "kickboxing",
  "judo",
  "other",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const GROUP_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "mixed",
] as const;
export type GroupLevel = (typeof GROUP_LEVELS)[number];

export const ATHLETE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type AthleteLevel = (typeof ATHLETE_LEVELS)[number];

export const CONSENT_STATUSES = [
  "missing",
  "adult_confirmed",
  "minor_parental_confirmed",
  "withdrawn",
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/** Créneau hebdomadaire d'un groupe. `day` : 1 = lundi … 7 = dimanche. */
export type ScheduleSlot = { day: number; start: string; end: string };

export type Group = {
  id: string;
  name: string;
  discipline: Discipline;
  level: GroupLevel;
  schedule: ScheduleSlot[];
  created_at: string;
};

export type Athlete = {
  id: string;
  display_name: string;
  discipline: Discipline | null;
  level: AthleteLevel;
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  consent_status: ConsentStatus;
  analysis_allowed: boolean;
  created_at: string;
};

export type ConsentEntry = {
  id: string;
  status: ConsentStatus;
  note: string | null;
  recorded_at: string;
};

/** Âge en années révolues à la date `today` (dates au format AAAA-MM-JJ). */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Vrai si la date de naissance indique un mineur. Sans date de naissance on ne
 * sait pas : la fonction renvoie `false`, et c'est le statut de consentement
 * (par défaut « non recueilli ») qui bloque l'analyse.
 */
export function isMinor(birthDate: string | null, today: Date = new Date()) {
  return birthDate !== null && ageOn(birthDate, today) < 18;
}

/** Formate la date du jour en AAAA-MM-JJ (fuseau local). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
