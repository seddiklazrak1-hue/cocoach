import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 * Il agit avec la session du coach lue dans les cookies : la RLS s'applique donc
 * exactement comme dans le navigateur. Un client neuf par requête, jamais partagé.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : écrire un cookie y est interdit.
          // Sans gravité, car `proxy.ts` rafraîchit la session à chaque requête.
        }
      },
    },
  });
}
