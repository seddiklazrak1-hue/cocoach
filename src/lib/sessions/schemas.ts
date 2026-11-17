import { z } from "zod";
import { fr } from "@/lib/i18n/fr";
import { MAX_CLIP_SECONDS, SAMPLE_RATE_HZ } from "@/lib/pose/recording";
import { toIsoDate } from "@/lib/roster/domain";
import { SESSION_KINDS } from "./domain";

const e = fr.sessions.errors;
const re = fr.roster.errors;

export const sessionSchema = z.object({
  groupId: z.uuid(re.choiceInvalid),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, e.dateInvalid)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00`);
      return !Number.isNaN(date.getTime()) && toIsoDate(date) === value && value >= "2020-01-01";
    }, e.dateInvalid),
  kind: z.enum(SESSION_KINDS, re.choiceInvalid),
  durationMin: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number(e.durationRange).int(e.durationRange).min(1, e.durationRange).max(600, e.durationRange).nullable()),
});

export type SessionRaw = {
  groupId: string;
  date: string;
  kind: string;
  durationMin: string;
};

export function readSessionForm(formData: FormData): SessionRaw {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    groupId: text("groupId"),
    date: text("date"),
    kind: text("kind"),
    durationMin: text("durationMin"),
  };
}

/** Ce que le navigateur déclare après avoir envoyé les fichiers d'une séquence. */
export const clipSchema = z.object({
  sessionId: z.uuid(),
  clipId: z.uuid(),
  startedAt: z.iso.datetime(),
  entries: z
    .array(
      z.object({
        athleteId: z.uuid(),
        storagePath: z.string().min(1).max(300),
        sampleRateHz: z.number().positive().max(60),
        frameCount: z
          .number()
          .int()
          .min(1)
          .max(MAX_CLIP_SECONDS * SAMPLE_RATE_HZ + 10),
        durationS: z.number().min(0).max(MAX_CLIP_SECONDS + 5),
        meanConfidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(8),
});

export type ClipInput = z.infer<typeof clipSchema>;
