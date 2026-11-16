// Qui est qui : lien entre une piste du tracker et un athlète.
//
// La règle de base est MANUELLE : le coach touche un squelette et choisit
// l'athlète. Aucune reconnaissance de visage ou de silhouette.
//
// Une seule aide automatique, volontairement prudente : quand un athlète
// disparaît un court instant (occlusion) puis qu'une nouvelle piste apparaît au
// même endroit, on la lui réattribue, en la marquant « auto » pour que le coach
// puisse la vérifier dans le replay.

import type { TrackedPose } from "./tracker";

export type Assignment = {
  athleteId: string;
  /** Vrai si l'assignation vient de l'aide automatique, pas d'un geste du coach. */
  auto: boolean;
};

type LastSeen = {
  trackId: number;
  center: { x: number; y: number };
  size: number;
  tMs: number;
};

/** Fenêtre pendant laquelle un athlète perdu peut être retrouvé automatiquement. */
const REACQUIRE_WINDOW_MS = 4000;
/** Distance max (en tailles de corps) entre la disparition et la réapparition. */
const REACQUIRE_MAX_DISTANCE = 1.2;

export class IdentityBook {
  private byTrack = new Map<number, Assignment>();
  private lastSeen = new Map<string, LastSeen>();
  private knownTracks = new Set<number>();
  private liveTracks = new Set<number>();

  /** Assignation de la piste, ou `undefined` si personne n'y est rattaché. */
  get(trackId: number): Assignment | undefined {
    return this.byTrack.get(trackId);
  }

  /** Copie de toutes les assignations (piste → athlète). */
  snapshot(): Map<number, Assignment> {
    return new Map(this.byTrack);
  }

  /** Le coach désigne l'athlète d'une piste. */
  assign(trackId: number, athleteId: string) {
    // Un athlète ne peut pas être à deux endroits : s'il était rattaché à une
    // AUTRE piste encore visible, celle-ci redevient « non assignée ». Une piste
    // terminée, elle, garde son assignation (c'était bien lui avant l'occlusion).
    for (const [otherTrack, assignment] of this.byTrack) {
      if (
        otherTrack !== trackId &&
        assignment.athleteId === athleteId &&
        this.liveTracks.has(otherTrack)
      ) {
        this.byTrack.delete(otherTrack);
      }
    }
    this.byTrack.set(trackId, { athleteId, auto: false });
    this.lastSeen.delete(athleteId);
  }

  unassign(trackId: number) {
    this.byTrack.delete(trackId);
  }

  /**
   * À appeler à chaque image avec les poses suivies. Met à jour la dernière
   * position connue de chaque athlète et tente la réattribution automatique des
   * pistes qui viennent d'apparaître. Renvoie les pistes réattribuées.
   */
  observe(tMs: number, poses: TrackedPose[]): number[] {
    this.liveTracks = new Set(poses.map((pose) => pose.trackId));

    // Athlètes actuellement visibles : ils ne sont pas candidats à une réattribution.
    const visibleAthletes = new Set<string>();
    for (const pose of poses) {
      const assignment = this.byTrack.get(pose.trackId);
      if (assignment) visibleAthletes.add(assignment.athleteId);
    }

    const reassigned: number[] = [];
    const newcomers = poses.filter(
      (pose) => !this.knownTracks.has(pose.trackId) && !this.byTrack.has(pose.trackId),
    );

    for (const pose of newcomers) {
      const candidates = [...this.lastSeen.entries()].filter(
        ([athleteId, seen]) =>
          !visibleAthletes.has(athleteId) &&
          tMs - seen.tMs <= REACQUIRE_WINDOW_MS &&
          Math.hypot(pose.center.x - seen.center.x, pose.center.y - seen.center.y) <=
            REACQUIRE_MAX_DISTANCE * Math.max(pose.size, seen.size),
      );
      // On ne tranche que s'il n'y a AUCUNE ambiguïté : un seul athlète
      // manquant à proximité, et une seule nouvelle piste qui lui correspond.
      if (candidates.length !== 1) continue;
      const [athleteId, seen] = candidates[0];
      const rivals = newcomers.filter(
        (other) =>
          other !== pose &&
          Math.hypot(other.center.x - seen.center.x, other.center.y - seen.center.y) <=
            REACQUIRE_MAX_DISTANCE * Math.max(other.size, seen.size),
      );
      if (rivals.length > 0) continue;

      this.byTrack.set(pose.trackId, { athleteId, auto: true });
      visibleAthletes.add(athleteId);
      reassigned.push(pose.trackId);
    }

    for (const pose of poses) {
      this.knownTracks.add(pose.trackId);
      const assignment = this.byTrack.get(pose.trackId);
      if (assignment) {
        this.lastSeen.set(assignment.athleteId, {
          trackId: pose.trackId,
          center: pose.center,
          size: pose.size,
          tMs,
        });
      }
    }

    return reassigned;
  }
}
