import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: fr.auth.loginTitle };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // `/auth/callback` renvoie ici avec ?erreur=lien si le lien e-mail a échoué.
  const { erreur } = await searchParams;
  const initialError =
    erreur === "lien" ? fr.auth.errors.callbackFailed : undefined;

  return <AuthForm mode="login" initialError={initialError} />;
}
