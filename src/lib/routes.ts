// Règles d'accès par chemin, isolées ici pour être testables sans Next.js.

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
/** Page d'arrivée d'un coach connecté. */
export const HOME_PATH = "/dashboard";

const PUBLIC_EXACT = new Set(["/", LOGIN_PATH, SIGNUP_PATH]);
const PUBLIC_PREFIXES = ["/auth/"];

/** Pages visibles sans être connecté. Tout le reste exige une session. */
export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** Pages inutiles une fois connecté (on renvoie vers le tableau de bord). */
export function isAuthPage(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === SIGNUP_PATH;
}
