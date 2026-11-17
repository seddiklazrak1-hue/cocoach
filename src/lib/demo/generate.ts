// Données de démonstration, fabriquées avec le même pipeline que les vraies
// séances : des squelettes synthétiques (angles connus) passent par
// `analyzeAthlete`, donc les métriques, fiabilités et signaux sont réels au
// sens du code. Seule la source des images change : aucune vidéo, aucun
// athlète réel. Déterministe : même seed, mêmes données.

import { analyzeAthlete } from "@/lib/metrics/analyze";
import type { AthleteAnalysis, ClipSeries } from "@/lib/metrics/types";
import type { Discipline } from "@/lib/roster/domain";
import { skeletonPose, withNoise, type SkeletonParams } from "@/lib/pose/skeleton";
import { seededRandom } from "@/lib/pose/synthetic";

/** Préfixe de tous les noms de démo : c'est lui qui permet de tout effacer, et rien d'autre. */
export const DEMO_PREFIX = "Démo · ";

const RATE = 10;
const ASPECT = 16 / 9;

export type DemoProfile = {
  /** Angle moyen du genou (180 = tendu). */
  knee: number;
  /** Angle moyen du coude pendant les frappes. */
  elbow: number;
  /** Inclinaison moyenne du tronc, en degrés. */
  trunkLean: number;
  /** Valgus moyen (degrés). Plus il est grand, plus le signal « à surveiller » est probable. */
  valgus: number;
  /** Amélioration (ou dérive) de `valgus` entre deux séances, en degrés. */
  drift: number;
};

export type DemoAthlete = {
  name: string;
  level: "beginner" | "intermediate" | "advanced";
  birthDate: string;
  consent: "adult_confirmed" | "minor_parental_confirmed";
  profile: DemoProfile;
};

export type DemoGroup = {
  name: string;
  discipline: Discipline;
  athletes: DemoAthlete[];
};

const adult = (name: string, level: DemoAthlete["level"], profile: DemoProfile): DemoAthlete => ({
  name,
  level,
  birthDate: "1995-04-12",
  consent: "adult_confirmed",
  profile,
});

/** Trois groupes, douze athlètes. Un mineur (avec accord parental) pour montrer l'adaptation. */
export const DEMO_GROUPS: DemoGroup[] = [
  {
    name: `${DEMO_PREFIX}Boxe`,
    discipline: "boxing",
    athletes: [
      adult(`${DEMO_PREFIX}Léo`, "intermediate", { knee: 150, elbow: 70, trunkLean: 6, valgus: 4, drift: 0 }),
      adult(`${DEMO_PREFIX}Inès`, "beginner", { knee: 140, elbow: 80, trunkLean: 10, valgus: 30, drift: -4 }),
      adult(`${DEMO_PREFIX}Hugo`, "advanced", { knee: 158, elbow: 65, trunkLean: 4, valgus: 2, drift: 0 }),
      adult(`${DEMO_PREFIX}Sami`, "intermediate", { knee: 152, elbow: 72, trunkLean: 7, valgus: 5, drift: -1 }),
    ],
  },
  {
    name: `${DEMO_PREFIX}MMA`,
    discipline: "mma",
    athletes: [
      adult(`${DEMO_PREFIX}Maya`, "intermediate", { knee: 148, elbow: 75, trunkLean: 8, valgus: 6, drift: -1 }),
      {
        name: `${DEMO_PREFIX}Tom`,
        level: "beginner",
        birthDate: "2011-05-14",
        consent: "minor_parental_confirmed",
        profile: { knee: 145, elbow: 80, trunkLean: 9, valgus: 7, drift: 0 },
      },
      adult(`${DEMO_PREFIX}Sara`, "advanced", { knee: 160, elbow: 62, trunkLean: 3, valgus: 2, drift: 0 }),
      adult(`${DEMO_PREFIX}Nabil`, "beginner", { knee: 142, elbow: 85, trunkLean: 12, valgus: 24, drift: -3 }),
    ],
  },
  {
    name: `${DEMO_PREFIX}Lutte`,
    discipline: "wrestling",
    athletes: [
      adult(`${DEMO_PREFIX}Karim`, "advanced", { knee: 120, elbow: 90, trunkLean: 22, valgus: 3, drift: 0 }),
      adult(`${DEMO_PREFIX}Lila`, "intermediate", { knee: 125, elbow: 88, trunkLean: 18, valgus: 5, drift: -1 }),
      adult(`${DEMO_PREFIX}Théo`, "beginner", { knee: 130, elbow: 92, trunkLean: 20, valgus: 8, drift: 0 }),
      adult(`${DEMO_PREFIX}Clara`, "intermediate", { knee: 122, elbow: 86, trunkLean: 16, valgus: 4, drift: 0 }),
    ],
  },
];

/** Trois séances par groupe, la plus récente à J-1 (le calendrier reste plausible). */
export const SESSIONS_PER_GROUP = 3;
export const SESSION_KINDS = ["technique", "drill", "sparring"] as const;

/** Pose à l'instant `t` : garde qui s'ajuste, frappes périodiques, léger balancement. */
function paramsAt(profile: DemoProfile, session: number, t: number): SkeletonParams {
  const valgus = profile.valgus + profile.drift * session;
  return {
    knee: profile.knee + 10 * Math.sin((2 * Math.PI * t) / 6),
    elbow: profile.elbow - 30 * Math.max(0, Math.sin(2 * Math.PI * t * 1.5)),
    trunkLean: profile.trunkLean + 2 * Math.sin((2 * Math.PI * t) / 4),
    valgus,
    facing: 5 * Math.sin((2 * Math.PI * t) / 9),
    groundY: 0.92,
    imageX: 0.5,
    pixelsPerMeter: 0.34,
    aspect: ASPECT,
    visibility: 0.92,
  };
}

/**
 * Une séquence de `seconds` secondes pour un athlète à une séance donnée.
 * Quelques images « absent » (3 %), comme une détection réelle.
 */
export function demoClip(profile: DemoProfile, session: number, seconds = 60, seed = 1): ClipSeries {
  const random = seededRandom(seed);
  const frames = Array.from({ length: Math.round(seconds * RATE) }, (_, i) => {
    if (random() < 0.03) return null;
    const t = i / RATE;
    return withNoise(skeletonPose(paramsAt(profile, session, t)), 0.004, random);
  });
  return { frames, sampleRateHz: RATE, aspect: ASPECT };
}

/** Analyse complète d'un athlète pour une séance : même fonction que le vrai pipeline. */
export function demoAnalysis(athlete: DemoAthlete, discipline: Discipline, session: number, seed: number): AthleteAnalysis {
  return analyzeAthlete([demoClip(athlete.profile, session, 60, seed)], discipline);
}
