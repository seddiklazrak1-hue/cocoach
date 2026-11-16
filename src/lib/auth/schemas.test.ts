import { describe, expect, it } from "vitest";
import { fr } from "@/lib/i18n/fr";
import {
  authErrorMessage,
  firstFieldErrors,
  loginSchema,
  signupSchema,
} from "./schemas";

const e = fr.auth.errors;

describe("signupSchema", () => {
  it("accepte une inscription valide et normalise l'e-mail", () => {
    const result = signupSchema.safeParse({
      displayName: "  Karim ",
      email: " Coach@Example.COM ",
      password: "motdepasse",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      displayName: "Karim",
      email: "coach@example.com",
      password: "motdepasse",
    });
  });

  it("renvoie un message français par champ invalide", () => {
    const result = signupSchema.safeParse({
      displayName: " ",
      email: "pas-un-email",
      password: "court",
    });
    expect(result.success).toBe(false);
    expect(firstFieldErrors(result.error!)).toEqual({
      displayName: e.nameRequired,
      email: e.emailInvalid,
      password: e.passwordTooShort,
    });
  });

  it("refuse un mot de passe de plus de 72 caractères", () => {
    const result = signupSchema.safeParse({
      displayName: "Karim",
      email: "coach@example.com",
      password: "x".repeat(73),
    });
    expect(firstFieldErrors(result.error!)).toEqual({
      password: e.passwordTooLong,
    });
  });
});

describe("loginSchema", () => {
  it("n'impose pas de longueur minimale au mot de passe existant", () => {
    expect(
      loginSchema.safeParse({ email: "coach@example.com", password: "abc" })
        .success,
    ).toBe(true);
  });

  it("refuse un mot de passe vide", () => {
    expect(
      loginSchema.safeParse({ email: "coach@example.com", password: "" })
        .success,
    ).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("traduit les codes Supabase connus", () => {
    expect(authErrorMessage("invalid_credentials")).toBe(e.invalidCredentials);
    expect(authErrorMessage("email_not_confirmed")).toBe(e.emailNotConfirmed);
    expect(authErrorMessage("user_already_exists")).toBe(e.alreadyRegistered);
  });

  it("retombe sur un message générique pour un code inconnu", () => {
    expect(authErrorMessage("code_inconnu")).toBe(e.generic);
    expect(authErrorMessage(undefined)).toBe(e.generic);
  });
});
