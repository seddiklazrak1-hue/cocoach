import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: fr.auth.signupTitle };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
