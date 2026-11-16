import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type CurrentCoach = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * Point d'entrée unique pour « qui est connecté ? » côté serveur.
 * `getUser()` revalide le jeton auprès de Supabase Auth (on ne fait pas
 * confiance au cookie seul). `cache` évite de refaire l'appel plusieurs fois
 * pendant le rendu d'une même requête.
 */
export const requireCoach = cache(async (): Promise<CurrentCoach> => {
  if (!isSupabaseConfigured) redirect(LOGIN_PATH);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  // La RLS garantit qu'on ne peut lire que sa propre ligne.
  const { data: coach } = await supabase
    .from("coaches")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: coach?.display_name ?? "",
  };
});
