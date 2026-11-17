// Chargement de MediaPipe Pose Landmarker dans le navigateur.
//
// Le moteur (WebAssembly) et le modèle sont téléchargés une fois depuis leurs
// CDN officiels, puis gardés en cache par le navigateur. Aucune image n'est
// envoyée : l'inférence tourne entièrement sur l'appareil.

import type { PoseLandmarker } from "@mediapipe/tasks-vision";

/** Doit correspondre à la version installée (vérifié par un test). */
export const MEDIAPIPE_VERSION = "1.2.3";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

/** Variante « lite » (5,8 Mo) : la plus rapide, adaptée aux téléphones. */
export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Au-delà de 4 personnes, la détection devient peu fiable sur un seul téléphone. */
export const MAX_PEOPLE = 4;

let engine: Promise<PoseLandmarker> | null = null;

async function create(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
    runningMode: "VIDEO" as const,
    numPoses: MAX_PEOPLE,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    // Le GPU est bien plus rapide quand il est disponible…
    return await PoseLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    // … sinon on retombe sur le processeur.
    return PoseLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

/** Renvoie le moteur, créé une seule fois par onglet. */
export function loadPoseEngine(): Promise<PoseLandmarker> {
  engine ??= create().catch((error: unknown) => {
    engine = null; // on pourra réessayer
    throw error;
  });
  return engine;
}
