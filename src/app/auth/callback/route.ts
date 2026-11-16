import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { HOME_PATH, LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Arrivée du lien de confirmation envoyé par e-mail à l'inscription.
 * Supabase ajoute `?code=...` : on l'échange contre une session (flux PKCE).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code && isSupabaseConfigured) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(HOME_PATH, request.url));
    }
  }

  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set("erreur", "lien");
  return NextResponse.redirect(url);
}
