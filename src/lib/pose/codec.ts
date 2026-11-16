// Format de stockage d'une série de pose (un fichier par athlète et par séquence).
//
// Objectif : rester sous 1 Mo pour 5 minutes. Trois leviers :
//   1. cadence réduite à 10 Hz (fait à l'enregistrement) ;
//   2. quantification : chaque coordonnée tient sur 16 bits au lieu de 32 ;
//   3. codage par différences entre images successives, puis gzip. Un corps
//      bouge peu en 100 ms : les différences sont de petits nombres, que gzip
//      compresse très bien.
//
// Disposition du fichier (avant gzip), en little-endian :
//   "CCP1"                       4 octets, signature du format
//   longueur de l'en-tête        uint32
//   en-tête JSON (UTF-8)         métadonnées, voir `SeriesHeader`
//   présence                     frameCount × uint8 (1 = pose présente)
//   xy (différences)             frameCount × K × 2 × int16
//   visibilité                   frameCount × K × uint8
//   monde (différences)          frameCount × K × 3 × int16

import { K, LANDMARK_NAMES, type PoseSample } from "./landmarks";

export const FORMAT_VERSION = 1;
const MAGIC = "CCP1";

/** Les coordonnées image peuvent sortir du cadre : on couvre de -0,5 à 1,5. */
const XY_MIN = -0.5;
const XY_SPAN = 2;
/** Coordonnées « monde » en mètres : 1/8000 m par unité, soit ±4,09 m. */
const WORLD_SCALE = 8000;

export type SeriesHeader = {
  version: number;
  sampleRateHz: number;
  frameCount: number;
  /** Largeur / hauteur de l'image filmée. */
  aspect: number;
  startedAt: string;
  /** Noms des points, pour qu'un fichier reste lisible si la liste évolue. */
  landmarks: readonly string[];
};

export type SeriesMeta = Pick<SeriesHeader, "sampleRateHz" | "aspect" | "startedAt">;

const clampInt16 = (value: number) => Math.max(-32768, Math.min(32767, Math.round(value)));

const quantizeXY = (value: number) =>
  clampInt16(((value - XY_MIN) / XY_SPAN) * 65535 - 32768);
const restoreXY = (stored: number) => ((stored + 32768) / 65535) * XY_SPAN + XY_MIN;

const quantizeWorld = (value: number) => clampInt16(value * WORLD_SCALE);
const restoreWorld = (stored: number) => stored / WORLD_SCALE;

/** Différence entre deux int16, repliée sur 16 bits (l'addition inverse la retrouve exactement). */
const wrapInt16 = (value: number) => ((value + 32768) & 0xffff) - 32768;

/** Encode la série d'un athlète en octets (non compressés). */
export function encodeSeries(
  frames: ReadonlyArray<PoseSample | null>,
  meta: SeriesMeta,
): Uint8Array {
  const header: SeriesHeader = {
    version: FORMAT_VERSION,
    sampleRateHz: meta.sampleRateHz,
    frameCount: frames.length,
    aspect: meta.aspect,
    startedAt: meta.startedAt,
    landmarks: LANDMARK_NAMES,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const n = frames.length;
  const total = 4 + 4 + headerBytes.length + n + n * K * 2 * 2 + n * K + n * K * 3 * 2;

  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  for (let i = 0; i < 4; i++) bytes[offset++] = MAGIC.charCodeAt(i);
  view.setUint32(offset, headerBytes.length, true);
  offset += 4;
  bytes.set(headerBytes, offset);
  offset += headerBytes.length;

  for (const frame of frames) bytes[offset++] = frame ? 1 : 0;

  // xy : différence avec la dernière pose présente.
  const previousXY = new Int16Array(K * 2);
  for (const frame of frames) {
    for (let i = 0; i < K * 2; i++) {
      let delta = 0;
      if (frame) {
        const value = quantizeXY(frame.xy[i]);
        delta = wrapInt16(value - previousXY[i]);
        previousXY[i] = value;
      }
      view.setInt16(offset, delta, true);
      offset += 2;
    }
  }

  for (const frame of frames) {
    for (let i = 0; i < K; i++) {
      bytes[offset++] = frame ? Math.round(Math.max(0, Math.min(1, frame.vis[i])) * 255) : 0;
    }
  }

  const previousWorld = new Int16Array(K * 3);
  for (const frame of frames) {
    for (let i = 0; i < K * 3; i++) {
      let delta = 0;
      if (frame) {
        const value = quantizeWorld(frame.world[i]);
        delta = wrapInt16(value - previousWorld[i]);
        previousWorld[i] = value;
      }
      view.setInt16(offset, delta, true);
      offset += 2;
    }
  }

  return bytes;
}

/** Décode des octets produits par `encodeSeries`. */
export function decodeSeries(bytes: Uint8Array): {
  header: SeriesHeader;
  frames: Array<PoseSample | null>;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  let magic = "";
  for (let i = 0; i < 4; i++) magic += String.fromCharCode(bytes[offset++]);
  if (magic !== MAGIC) throw new Error("Fichier de pose invalide (signature inconnue)");

  const headerLength = view.getUint32(offset, true);
  offset += 4;
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(offset, offset + headerLength)),
  ) as SeriesHeader;
  offset += headerLength;
  if (header.version !== FORMAT_VERSION) {
    throw new Error(`Version de format non prise en charge : ${header.version}`);
  }
  if (header.landmarks.length !== K) {
    throw new Error("Fichier de pose invalide (nombre de points inattendu)");
  }

  const n = header.frameCount;
  const present = bytes.subarray(offset, offset + n);
  offset += n;

  const frames: Array<PoseSample | null> = [];
  const currentXY = new Int16Array(K * 2);
  for (let f = 0; f < n; f++) {
    if (!present[f]) {
      frames.push(null);
      offset += K * 2 * 2;
      continue;
    }
    const sample: PoseSample = {
      xy: new Float32Array(K * 2),
      vis: new Float32Array(K),
      world: new Float32Array(K * 3),
    };
    for (let i = 0; i < K * 2; i++) {
      currentXY[i] = wrapInt16(currentXY[i] + view.getInt16(offset, true));
      sample.xy[i] = restoreXY(currentXY[i]);
      offset += 2;
    }
    frames.push(sample);
  }

  for (let f = 0; f < n; f++) {
    const sample = frames[f];
    for (let i = 0; i < K; i++) {
      if (sample) sample.vis[i] = bytes[offset] / 255;
      offset++;
    }
  }

  const currentWorld = new Int16Array(K * 3);
  for (let f = 0; f < n; f++) {
    const sample = frames[f];
    if (!sample) {
      offset += K * 3 * 2;
      continue;
    }
    for (let i = 0; i < K * 3; i++) {
      currentWorld[i] = wrapInt16(currentWorld[i] + view.getInt16(offset, true));
      sample.world[i] = restoreWorld(currentWorld[i]);
      offset += 2;
    }
  }

  return { header, frames };
}

// --- Compression gzip (API standard, disponible dans les navigateurs et Node) ---

async function pipeThrough(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export const gzip = (bytes: Uint8Array) =>
  pipeThrough(bytes, new CompressionStream("gzip"));

export const gunzip = (bytes: Uint8Array) =>
  pipeThrough(bytes, new DecompressionStream("gzip"));

/** Série prête à envoyer : encodée puis compressée. */
export async function packSeries(
  frames: ReadonlyArray<PoseSample | null>,
  meta: SeriesMeta,
): Promise<Uint8Array> {
  return gzip(encodeSeries(frames, meta));
}

/** Inverse de `packSeries`. */
export async function unpackSeries(bytes: Uint8Array) {
  return decodeSeries(await gunzip(bytes));
}
