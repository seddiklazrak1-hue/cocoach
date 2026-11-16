"use client";

import { useActionState } from "react";
import { ChoiceRow, FieldShell, FormError } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fr } from "@/lib/i18n/fr";
import { CONSENT_STATUSES, type ConsentStatus } from "@/lib/roster/domain";
import type { FormState } from "@/lib/roster/schemas";

const t = fr.roster.consent;

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  current: ConsentStatus;
  /** Vrai si la date de naissance indique un mineur : « adulte » est alors exclu. */
  minor: boolean;
};

/** Ajoute une entrée au journal de consentement de l'athlète. */
export function ConsentForm({ action, current, minor }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.newStatus}</legend>
        {CONSENT_STATUSES.map((status) => (
          <ChoiceRow
            key={status}
            type="radio"
            name="status"
            value={status}
            defaultChecked={status === current}
            disabled={minor && status === "adult_confirmed"}
            className="has-disabled:cursor-not-allowed has-disabled:opacity-50"
          >
            {t.statuses[status]}
          </ChoiceRow>
        ))}
        {state.fieldErrors?.status && (
          <p className="text-sm text-destructive">{state.fieldErrors.status}</p>
        )}
        {minor && (
          <p className="text-sm text-muted-foreground">{t.minorDetected}</p>
        )}
      </fieldset>

      <FieldShell
        id="note"
        label={t.note}
        hint={t.noteHint}
        error={state.fieldErrors?.note}
      >
        <Textarea id="note" name="note" maxLength={500} rows={2} />
      </FieldShell>

      <FormError message={state.error} />
      <Button
        type="submit"
        size="lg"
        className="h-11 self-start px-5"
        disabled={pending}
      >
        {pending ? fr.auth.pending : t.submit}
      </Button>
    </form>
  );
}
