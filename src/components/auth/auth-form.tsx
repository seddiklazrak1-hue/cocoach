"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/schemas";
import { fr } from "@/lib/i18n/fr";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";

const t = fr.auth;

type Props = {
  mode: "login" | "signup";
  /** Erreur à afficher d'entrée (ex. lien de confirmation expiré). */
  initialError?: string;
};

/** Formulaire unique pour la connexion et l'inscription (seuls les champs changent). */
export function AuthForm({ mode, initialError }: Props) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isSignup ? signUp : signIn,
    { error: initialError },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{isSignup ? t.signupTitle : t.loginTitle}</h1>
        </CardTitle>
        <CardDescription>
          {isSignup ? t.signupSubtitle : t.loginSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isSignup && (
            <Field
              id="displayName"
              label={t.displayName}
              autoComplete="name"
              defaultValue={state.values?.displayName}
              error={state.fieldErrors?.displayName}
            />
          )}
          <Field
            id="email"
            label={t.email}
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
          <Field
            id="password"
            label={t.password}
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            hint={isSignup ? t.passwordHint : undefined}
            error={state.fieldErrors?.password}
          />

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.message && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
            >
              {state.message}
            </p>
          )}

          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? t.pending : isSignup ? t.signupSubmit : t.loginSubmit}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isSignup ? t.hasAccount : t.noAccount}{" "}
          <Link
            href={isSignup ? LOGIN_PATH : SIGNUP_PATH}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignup ? t.loginSubmit : t.signupSubmit}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
} & React.ComponentProps<"input">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        required
        className="h-11"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
