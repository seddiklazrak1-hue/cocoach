"use client";

import { useActionState } from "react";
import { FormError, SelectField, TextField } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import type { FormState } from "@/lib/roster/schemas";
import { createSession } from "@/lib/sessions/actions";
import { SESSION_KINDS } from "@/lib/sessions/domain";
import type { SessionRaw } from "@/lib/sessions/schemas";

const t = fr.sessions;

const kindOptions = SESSION_KINDS.map((value) => ({ value, label: t.kinds[value] }));

export function SessionForm({
  groups,
  initial,
}: {
  groups: ReadonlyArray<{ id: string; name: string }>;
  initial: SessionRaw;
}) {
  const [state, formAction, pending] = useActionState<FormState<SessionRaw>, FormData>(
    createSession,
    {},
  );
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <SelectField
        id="groupId"
        label={t.group}
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
        defaultValue={values.groupId}
        error={errors.groupId}
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          id="date"
          label={t.date}
          type="date"
          defaultValue={values.date}
          error={errors.date}
          required
        />
        <SelectField
          id="kind"
          label={t.kind}
          options={kindOptions}
          defaultValue={values.kind}
          error={errors.kind}
        />
        <TextField
          id="durationMin"
          label={t.duration}
          hint={t.durationHint}
          inputMode="numeric"
          defaultValue={values.durationMin}
          error={errors.durationMin}
        />
      </div>
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="h-11 self-start px-5" disabled={pending}>
        {pending ? fr.auth.pending : t.create}
      </Button>
    </form>
  );
}
