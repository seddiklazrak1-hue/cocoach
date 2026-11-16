import { z } from "zod";
import { fr } from "@/lib/i18n/fr";
import {
  ATHLETE_LEVELS,
  CONSENT_STATUSES,
  DISCIPLINES,
  GROUP_LEVELS,
  isMinor,
  toIsoDate,
  type Athlete,
  type Group,
  type ScheduleSlot,
} from "./domain";

const e = fr.roster.errors;

/** État renvoyé par une Server Action vers son formulaire. */
export type FormState<Raw = unknown> = {
  error?: string;
  /** Premier message d'erreur par champ. */
  fieldErrors?: Record<string, string>;
  /** Saisie brute à réafficher (React vide le formulaire après une action). */
  values?: Raw;
};

/** Ne garde que le premier message d'erreur de chaque champ. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const uuidSchema = z.uuid();

// --- Groupes -----------------------------------------------------------------

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, e.timeInvalid);

const slotSchema = z
  .object({
    day: z.number().int().min(1).max(7),
    start: time,
    end: time,
  })
  .refine((slot) => slot.end > slot.start, { message: e.slotOrder });

export const groupSchema = z.object({
  name: z.string().trim().min(1, e.nameRequired).max(80, e.nameTooLong),
  discipline: z.enum(DISCIPLINES, e.choiceInvalid),
  level: z.enum(GROUP_LEVELS, e.choiceInvalid),
  schedule: z.array(slotSchema).max(14, e.tooManySlots),
});
export type GroupInput = z.infer<typeof groupSchema>;

/** Saisie brute du formulaire de groupe, avant validation. */
export type GroupRaw = {
  name: string;
  discipline: string;
  level: string;
  schedule: ScheduleSlot[];
};

export function readGroupForm(formData: FormData): GroupRaw {
  let schedule: ScheduleSlot[] = [];
  try {
    // L'éditeur de créneaux sérialise sa liste dans un champ caché.
    const parsed: unknown = JSON.parse(String(formData.get("schedule") ?? "[]"));
    if (Array.isArray(parsed)) schedule = parsed as ScheduleSlot[];
  } catch {
    // JSON invalide : on repart d'une liste vide, la validation fera le reste.
  }
  return {
    name: String(formData.get("name") ?? ""),
    discipline: String(formData.get("discipline") ?? ""),
    level: String(formData.get("level") ?? ""),
    schedule,
  };
}

// --- Athlètes ----------------------------------------------------------------

/** Champ numérique facultatif : "" devient null, la virgule décimale est acceptée. */
const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value.replace(",", "."))))
    .pipe(z.number(message).min(min, message).max(max, message).nullable());

const optionalBirthDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => {
      if (value === null) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00`);
      // Rejette les dates impossibles (30 février) et hors plage plausible.
      if (Number.isNaN(date.getTime()) || toIsoDate(date) !== value) return false;
      const today = toIsoDate(new Date());
      return value <= today && value >= "1920-01-01";
    },
    { message: e.birthDateInvalid },
  );

const athleteFields = {
  displayName: z.string().trim().min(1, e.nameRequired).max(60, e.nameTooLong),
  discipline: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.enum(DISCIPLINES, e.choiceInvalid).nullable()),
  level: z.enum(ATHLETE_LEVELS, e.choiceInvalid),
  weightKg: optionalNumber(10, 300, e.weightRange),
  heightCm: optionalNumber(80, 250, e.heightRange),
  birthDate: optionalBirthDate,
  groupIds: z.array(z.uuid(e.choiceInvalid)).max(50),
};

export const athleteUpdateSchema = z.object(athleteFields);

/** À la création, le coach peut enregistrer le consentement dans la foulée. */
export const athleteCreateSchema = z
  .object({
    ...athleteFields,
    consent: z.enum(
      ["missing", "adult_confirmed", "minor_parental_confirmed"],
      e.choiceInvalid,
    ),
  })
  .refine(
    (athlete) =>
      !(athlete.consent === "adult_confirmed" && isMinor(athlete.birthDate)),
    { message: e.minorNeedsParent, path: ["consent"] },
  );

export type AthleteUpdateInput = z.infer<typeof athleteUpdateSchema>;
export type AthleteCreateInput = z.infer<typeof athleteCreateSchema>;

/** Saisie brute du formulaire d'athlète, avant validation. */
export type AthleteRaw = {
  displayName: string;
  discipline: string;
  level: string;
  weightKg: string;
  heightCm: string;
  birthDate: string;
  groupIds: string[];
  consent: string;
};

export function readAthleteForm(formData: FormData): AthleteRaw {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    displayName: text("displayName"),
    discipline: text("discipline"),
    level: text("level"),
    weightKg: text("weightKg"),
    heightCm: text("heightCm"),
    birthDate: text("birthDate"),
    groupIds: formData.getAll("groupIds").map(String),
    consent: text("consent") || "missing",
  };
}

export const EMPTY_ATHLETE: AthleteRaw = {
  displayName: "",
  discipline: "",
  level: "beginner",
  weightKg: "",
  heightCm: "",
  birthDate: "",
  groupIds: [],
  consent: "missing",
};

/** Valeurs initiales du formulaire de modification d'un athlète. */
export function athleteToRaw(athlete: Athlete, groupIds: string[]): AthleteRaw {
  return {
    displayName: athlete.display_name,
    discipline: athlete.discipline ?? "",
    level: athlete.level,
    weightKg: athlete.weight_kg === null ? "" : String(athlete.weight_kg),
    heightCm: athlete.height_cm === null ? "" : String(athlete.height_cm),
    birthDate: athlete.birth_date ?? "",
    groupIds,
    consent: "missing",
  };
}

/** Valeurs initiales du formulaire de modification d'un groupe. */
export function groupToRaw(group: Group): GroupRaw {
  return {
    name: group.name,
    discipline: group.discipline,
    level: group.level,
    schedule: group.schedule,
  };
}

// --- Consentement ------------------------------------------------------------

export const consentSchema = z.object({
  status: z.enum(CONSENT_STATUSES, e.choiceInvalid),
  note: z
    .string()
    .trim()
    .max(500, e.noteTooLong)
    .transform((value) => (value === "" ? null : value)),
});
export type ConsentInput = z.infer<typeof consentSchema>;
