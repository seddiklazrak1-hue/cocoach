import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/lib/env";
import { isPublicPath, LOGIN_PATH, HOME_PATH, isAuthPage } from "@/lib/routes";

/**
 * Rafraîchit la session Supabase et applique un premier filtre d'accès.
 * Ce filtre est "optimiste" (confort de navigation) : la vraie protection des
 * données reste la RLS de Postgres + la vérification dans chaque page/action.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured) {
    // Pas encore de projet Supabase : on laisse voir les pages publiques,
    // et on renvoie le reste vers /login qui explique comment configurer.
    return isPublicPath(pathname)
      ? NextResponse.next({ request })
      : redirectTo(request, LOGIN_PATH);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // En-têtes anti-cache fournis par Supabase pour ne jamais mettre en
        // cache une réponse qui pose des cookies de session.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Important : ne rien exécuter entre la création du client et getClaims(),
  // sinon le rafraîchissement du jeton peut être perdu.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  if (!isSignedIn && !isPublicPath(pathname)) {
    return redirectTo(request, LOGIN_PATH, response);
  }
  if (isSignedIn && isAuthPage(pathname)) {
    return redirectTo(request, HOME_PATH, response);
  }
  return response;
}

function redirectTo(
  request: NextRequest,
  path: string,
  sessionResponse?: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // On recopie les cookies de session éventuellement rafraîchis.
  sessionResponse?.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
