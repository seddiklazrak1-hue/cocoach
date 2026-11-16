import { fr } from "@/lib/i18n/fr";
import {
  ATHLETE_LEVELS,
  DISCIPLINES,
  GROUP_LEVELS,
  type ScheduleSlot,
} from "./domain";

// Passage des valeurs stockées en base à leurs libellés français.

const t = fr.roster;

export const disciplineOptions = DISCIPLINES.map((value) => ({
  value,
  label: t.disciplines[value],
}));

export const groupLevelOptions = GROUP_LEVELS.map((value) => ({
  value,
  label: t.levels[value],
}));

export const athleteLevelOptions = ATHLETE_LEVELS.map((value) => ({
  value,
  label: t.levels[value],
}));

export const dayOptions = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
  value: String(day),
  label: t.days[day],
}));

/** « Lundi 19:00–20:30 » */
export function formatSlot(slot: ScheduleSlot): string {
  const day = t.days[slot.day as keyof typeof t.days] ?? "";
  return `${day} ${slot.start}–${slot.end}`;
}

/** Trie les créneaux par jour puis par heure de début. */
export function sortSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort(
    (a, b) => a.day - b.day || a.start.localeCompare(b.start),
  );
}

/** « 12 novembre 2026 » à partir d'une date ISO (AAAA-MM-JJ ou horodatage). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "Europe/Paris",
  }).format(new Date(iso));
}

/** « 12 nov. 2026 à 19:04 » pour le journal de consentement. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
