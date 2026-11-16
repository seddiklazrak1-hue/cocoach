// Variables d'environnement publiques (exposées au navigateur).
// La clé "publishable" (ou l'ancienne clé "anon") n'est pas un secret :
// c'est la Row Level Security de Postgres qui protège les données.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Faux tant que `.env.local` n'est pas rempli : l'app affiche alors un message d'installation au lieu de planter. */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
