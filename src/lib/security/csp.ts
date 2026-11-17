// Politique de sécurité du contenu (CSP) : liste des seuls serveurs que la page
// a le droit de contacter (fetch, envoi de fichiers, WebSocket).
//
// Pourquoi : MediaPipe envoie par défaut des statistiques d'usage à Google
// (odml.pa.googleapis.com), sans option pour le désactiver. Ce ne sont pas des
// images, mais l'app promet que seules les séries de pose quittent l'appareil.
// En n'autorisant que Supabase et les fichiers du modèle, ces envois sont
// bloqués par le navigateur, et toute fuite future vers un autre serveur aussi.
//
// On ne restreint volontairement que `connect-src` : une CSP complète (scripts,
// styles) demanderait des « nonces » sur tous les scripts de Next.js, une
// complexité qui n'est pas justifiée à ce stade.

/** Serveurs d'où MediaPipe télécharge son moteur et son modèle. */
export const MEDIAPIPE_ORIGINS = ["https://cdn.jsdelivr.net", "https://storage.googleapis.com"];

export function buildConnectSrc(options: { supabaseUrl: string; dev: boolean }): string[] {
  const sources = ["'self'", ...MEDIAPIPE_ORIGINS];
  if (options.supabaseUrl) {
    const { origin, host } = new URL(options.supabaseUrl);
    sources.push(origin, `wss://${host}`);
  }
  // Rechargement à chaud de Next.js en développement.
  if (options.dev) sources.push("ws://localhost:*", "http://localhost:*");
  return sources;
}

export function buildCsp(options: { supabaseUrl: string; dev: boolean }): string {
  return `connect-src ${buildConnectSrc(options).join(" ")}`;
}
