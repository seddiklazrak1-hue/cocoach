import { describe, expect, it } from "vitest";
import { fr } from "@/lib/i18n/fr";
import { ageOn, isMinor, toIsoDate } from "./domain";
import { formatSlot, sortSlots } from "./labels";
import {
  athleteCreateSchema,
  athleteToRaw,
  athleteUpdateSchema,
  consentSchema,
  EMPTY_ATHLETE,
  fieldErrorsOf,
  groupSchema,
  readAthleteForm,
  readGroupForm,
} from "./schemas";

const e = fr.roster.errors;
const GROUP_ID = "0b8f6a52-3c1e-4d7a-9f2b-6e5d4c3b2a10";

/** Date de naissance d'une personne qui a `years` ans aujourd'hui. */
function bornYearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return toIsoDate(date);
}

describe("ageOn / isMinor", () => {
  const today = new Date(2026, 10, 16); // 16 novembre 2026

  it("compte les années révolues", () => {
    expect(ageOn("2008-11-16", today)).toBe(18); // anniversaire aujourd'hui
    expect(ageOn("2008-11-17", today)).toBe(17); // anniversaire demain
    expect(ageOn("2000-01-01", today)).toBe(26);
  });

  it("détecte un mineur, et ne présume rien sans date de naissance", () => {
    expect(isMinor("2008-11-17", today)).toBe(true);
    expect(isMinor("2008-11-16", today)).toBe(false);
    expect(isMinor(null, today)).toBe(false);
  });
});

describe("groupSchema", () => {
  const valid = {
    name: "  Lutte adultes lundi ",
    discipline: "wrestling",
    level: "mixed",
    schedule: [{ day: 1, start: "19:00", end: "20:30" }],
  };

  it("accepte un groupe valide et nettoie le nom", () => {
    const result = groupSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Lutte adultes lundi");
  });

  it("accepte un groupe sans créneau", () => {
    expect(groupSchema.safeParse({ ...valid, schedule: [] }).success).toBe(true);
  });

  it("refuse un nom vide et une discipline inconnue", () => {
    const result = groupSchema.safeParse({
      ...valid,
      name: "   ",
      discipline: "curling",
    });
    expect(fieldErrorsOf(result.error!)).toEqual({
      name: e.nameRequired,
      discipline: e.choiceInvalid,
    });
  });

  it("refuse un créneau qui finit avant de commencer", () => {
    const result = groupSchema.safeParse({
      ...valid,
      schedule: [{ day: 3, start: "20:00", end: "19:00" }],
    });
    expect(fieldErrorsOf(result.error!)).toEqual({ schedule: e.slotOrder });
  });

  it("refuse une heure ou un jour impossibles", () => {
    for (const slot of [
      { day: 1, start: "25:00", end: "26:00" },
      { day: 8, start: "10:00", end: "11:00" },
    ]) {
      expect(groupSchema.safeParse({ ...valid, schedule: [slot] }).success).toBe(
        false,
      );
    }
  });
});

describe("readGroupForm", () => {
  it("lit les créneaux depuis le champ caché JSON", () => {
    const form = new FormData();
    form.set("name", "MMA débutants");
    form.set("discipline", "mma");
    form.set("level", "beginner");
    form.set("schedule", '[{"day":2,"start":"18:00","end":"19:00"}]');
    expect(readGroupForm(form).schedule).toEqual([
      { day: 2, start: "18:00", end: "19:00" },
    ]);
  });

  it("retombe sur une liste vide si le JSON est invalide", () => {
    const form = new FormData();
    form.set("schedule", "{pas du json");
    expect(readGroupForm(form).schedule).toEqual([]);
  });
});

describe("athleteCreateSchema", () => {
  const valid = { ...EMPTY_ATHLETE, displayName: "Sami" };

  it("accepte le strict minimum : un prénom", () => {
    const result = athleteCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      displayName: "Sami",
      discipline: null,
      weightKg: null,
      heightCm: null,
      birthDate: null,
      consent: "missing",
    });
  });

  it("convertit poids et taille, virgule décimale comprise", () => {
    const result = athleteCreateSchema.safeParse({
      ...valid,
      weightKg: "72,5",
      heightCm: " 178 ",
      groupIds: [GROUP_ID],
    });
    expect(result.data).toMatchObject({
      weightKg: 72.5,
      heightCm: 178,
      groupIds: [GROUP_ID],
    });
  });

  it("refuse des mesures hors plage ou non numériques", () => {
    const result = athleteCreateSchema.safeParse({
      ...valid,
      weightKg: "abc",
      heightCm: "20",
    });
    expect(fieldErrorsOf(result.error!)).toEqual({
      weightKg: e.weightRange,
      heightCm: e.heightRange,
    });
  });

  it("refuse une date de naissance future ou impossible", () => {
    for (const birthDate of ["2999-01-01", "2010-02-30", "16/11/2010"]) {
      const result = athleteCreateSchema.safeParse({ ...valid, birthDate });
      expect(fieldErrorsOf(result.error!), birthDate).toEqual({
        birthDate: e.birthDateInvalid,
      });
    }
  });

  it("refuse le consentement « adulte » pour un mineur", () => {
    const result = athleteCreateSchema.safeParse({
      ...valid,
      birthDate: bornYearsAgo(15),
      consent: "adult_confirmed",
    });
    expect(fieldErrorsOf(result.error!)).toEqual({
      consent: e.minorNeedsParent,
    });
  });

  it("accepte le consentement parental pour un mineur, et « adulte » pour un majeur", () => {
    expect(
      athleteCreateSchema.safeParse({
        ...valid,
        birthDate: bornYearsAgo(15),
        consent: "minor_parental_confirmed",
      }).success,
    ).toBe(true);
    expect(
      athleteCreateSchema.safeParse({
        ...valid,
        birthDate: bornYearsAgo(25),
        consent: "adult_confirmed",
      }).success,
    ).toBe(true);
  });

  it("ne permet pas de créer un athlète avec un consentement « retiré »", () => {
    expect(
      athleteCreateSchema.safeParse({ ...valid, consent: "withdrawn" }).success,
    ).toBe(false);
  });
});

describe("readAthleteForm / athleteToRaw", () => {
  it("lit toutes les cases de groupes cochées", () => {
    const form = new FormData();
    form.set("displayName", "Lina");
    form.set("level", "advanced");
    form.append("groupIds", GROUP_ID);
    form.append("groupIds", "autre");
    const raw = readAthleteForm(form);
    expect(raw.groupIds).toEqual([GROUP_ID, "autre"]);
    expect(raw.consent).toBe("missing");
    // Un identifiant de groupe qui n'est pas un UUID est refusé.
    expect(athleteUpdateSchema.safeParse(raw).success).toBe(false);
  });

  it("fait l'aller-retour base → formulaire → validation", () => {
    const raw = athleteToRaw(
      {
        id: GROUP_ID,
        display_name: "Inès",
        discipline: "bjj",
        level: "intermediate",
        weight_kg: 61.5,
        height_cm: null,
        birth_date: "2001-04-09",
        consent_status: "adult_confirmed",
        analysis_allowed: true,
        created_at: "2026-11-16T10:00:00Z",
      },
      [GROUP_ID],
    );
    expect(athleteUpdateSchema.parse(raw)).toEqual({
      displayName: "Inès",
      discipline: "bjj",
      level: "intermediate",
      weightKg: 61.5,
      heightCm: null,
      birthDate: "2001-04-09",
      groupIds: [GROUP_ID],
    });
  });
});

describe("consentSchema", () => {
  it("transforme une note vide en null", () => {
    expect(consentSchema.parse({ status: "withdrawn", note: "  " })).toEqual({
      status: "withdrawn",
      note: null,
    });
  });

  it("refuse un statut inconnu et une note trop longue", () => {
    expect(consentSchema.safeParse({ status: "ok", note: "" }).success).toBe(
      false,
    );
    expect(
      consentSchema.safeParse({ status: "missing", note: "x".repeat(501) })
        .success,
    ).toBe(false);
  });
});

describe("créneaux", () => {
  it("trie par jour puis par heure, et formate en français", () => {
    const sorted = sortSlots([
      { day: 3, start: "18:00", end: "19:00" },
      { day: 1, start: "20:00", end: "21:00" },
      { day: 1, start: "09:00", end: "10:00" },
    ]);
    expect(sorted.map(formatSlot)).toEqual([
      "Lundi 09:00–10:00",
      "Lundi 20:00–21:00",
      "Mercredi 18:00–19:00",
    ]);
  });
});
