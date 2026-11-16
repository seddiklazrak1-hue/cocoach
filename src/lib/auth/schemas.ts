import { z } from "zod";
import { fr } from "@/lib/i18n/fr";

const e = fr.auth.errors;

// On nettoie d'abord (espaces, majuscules), on valide ensuite.
const email = z.string().trim().toLowerCase().pipe(z.email(e.emailInvalid));

// 72 = limite de bcrypt, utilisée par Supabase Auth pour hacher les mots de passe.
const password = z
  .string()
  .min(8, e.passwordTooShort)
  .max(72, e.passwordTooLong);

export const loginSchema = z.object({
  email,
  // À la connexion on ne révèle pas les règles de mot de passe : non vide suffit.
  password: z.string().min(1, e.passwordTooShort),
});

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, e.nameRequired).max(60, e.nameTooLong),
  email,
  password,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

/** État renvoyé par les Server Actions d'auth vers le formulaire. */
export type AuthFormState = {
  /** Erreur globale (identifiants refusés, etc.). */
  error?: string;
  /** Message de succès (ex. « vérifie ta boîte mail »). */
  message?: string;
  /** Erreurs par champ, issues de la validation Zod. */
  fieldErrors?: Partial<Record<"displayName" | "email" | "password", string>>;
  /** Valeurs à réafficher (jamais le mot de passe). */
  values?: { displayName?: string; email?: string };
};

/** Traduit un code d'erreur Supabase Auth en message français. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return e.invalidCredentials;
    case "email_not_confirmed":
      return e.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return e.alreadyRegistered;
    case "weak_password":
      return e.weakPassword;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return e.rateLimited;
    default:
      return e.generic;
  }
}

/** Ne garde que le premier message d'erreur de chaque champ. */
export function firstFieldErrors(
  error: z.ZodError,
): NonNullable<AuthFormState["fieldErrors"]> {
  const out: NonNullable<AuthFormState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (
      (key === "displayName" || key === "email" || key === "password") &&
      !out[key]
    ) {
      out[key] = issue.message;
    }
  }
  return out;
}
