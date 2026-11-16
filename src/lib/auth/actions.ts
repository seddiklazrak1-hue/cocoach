"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";
import { HOME_PATH, LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import {
  authErrorMessage,
  firstFieldErrors,
  loginSchema,
  signupSchema,
  type AuthFormState,
} from "./schemas";

const notConfigured: AuthFormState = { error: fr.auth.notConfigured.title };

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return notConfigured;

  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: firstFieldErrors(parsed.error),
      values: { email: raw.email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: authErrorMessage(error.code),
      values: { email: raw.email },
    };
  }

  redirect(HOME_PATH);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return notConfigured;

  const raw = {
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { displayName: raw.displayName, email: raw.email };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error), values };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Lu par le trigger SQL `handle_new_user` pour créer la ligne `coaches`.
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return { error: authErrorMessage(error.code), values };
  }

  // Si la confirmation d'e-mail est désactivée dans Supabase, la session existe déjà.
  if (data.session) redirect(HOME_PATH);

  return { message: fr.auth.checkEmail };
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
