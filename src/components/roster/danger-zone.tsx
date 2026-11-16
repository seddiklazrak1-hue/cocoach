"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fr } from "@/lib/i18n/fr";
import type { FormState } from "@/lib/roster/schemas";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  title: string;
  body: string;
  /** Nom à retaper pour débloquer le bouton (vérifié aussi côté serveur). */
  confirmName: string;
  submitLabel: string;
};

/**
 * Suppression définitive. Le coach doit retaper le nom : sur un téléphone, un
 * simple bouton « Supprimer » se touche trop facilement par erreur.
 */
export function DangerZone({
  action,
  title,
  body,
  confirmName,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [typed, setTyped] = useState("");
  const matches =
    typed.trim().toLowerCase() === confirmName.trim().toLowerCase();

  return (
    <section className="rounded-xl border border-destructive/40 p-4">
      <h2 className="font-heading text-base font-semibold text-destructive">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">{fr.roster.confirm.label(confirmName)}</Label>
          <Input
            id="confirm"
            name="confirm"
            className="h-11 sm:max-w-xs"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <FormError message={state.error} />
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          className="h-11 self-start px-5"
          disabled={!matches || pending}
        >
          {pending ? fr.auth.pending : submitLabel}
        </Button>
      </form>
    </section>
  );
}
