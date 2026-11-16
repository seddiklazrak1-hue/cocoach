"use client";

import { useActionState } from "react";
import {
  ChoiceRow,
  FormError,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { athleteLevelOptions, disciplineOptions } from "@/lib/roster/labels";
import {
  EMPTY_ATHLETE,
  type AthleteRaw,
  type FormState,
} from "@/lib/roster/schemas";

const t = fr.roster.athletes;
const tc = fr.roster.consent;

type Props = {
  action: (
    prev: FormState<AthleteRaw>,
    formData: FormData,
  ) => Promise<FormState<AthleteRaw>>;
  initial?: AthleteRaw;
  groups: ReadonlyArray<{ id: string; name: string }>;
  /** À la création seulement : le consentement se saisit dans le même écran. */
  withConsent?: boolean;
  submitLabel: string;
};

const CREATION_CONSENTS = [
  "missing",
  "adult_confirmed",
  "minor_parental_confirmed",
] as const;

export function AthleteForm({
  action,
  initial = EMPTY_ATHLETE,
  groups,
  withConsent = false,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField
        id="displayName"
        label={t.displayName}
        hint={t.displayNameHint}
        defaultValue={values.displayName}
        error={errors.displayName}
        maxLength={60}
        autoComplete="off"
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="discipline"
          label={t.discipline}
          options={[{ value: "", label: t.disciplineNone }, ...disciplineOptions]}
          defaultValue={values.discipline}
          error={errors.discipline}
        />
        <SelectField
          id="level"
          label={t.level}
          options={athleteLevelOptions}
          defaultValue={values.level}
          error={errors.level}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          id="weightKg"
          label={t.weight}
          hint={t.optional}
          inputMode="decimal"
          defaultValue={values.weightKg}
          error={errors.weightKg}
        />
        <TextField
          id="heightCm"
          label={t.height}
          hint={t.optional}
          inputMode="decimal"
          defaultValue={values.heightCm}
          error={errors.heightCm}
        />
        <TextField
          id="birthDate"
          label={t.birthDate}
          hint={t.optional}
          type="date"
          defaultValue={values.birthDate}
          error={errors.birthDate}
        />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{t.birthDateHint}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.groups}</legend>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.groupsNone}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((group) => (
              <ChoiceRow
                key={group.id}
                type="checkbox"
                name="groupIds"
                value={group.id}
                defaultChecked={values.groupIds.includes(group.id)}
              >
                {group.name}
              </ChoiceRow>
            ))}
          </div>
        )}
        {errors.groupIds && (
          <p className="text-sm text-destructive">{errors.groupIds}</p>
        )}
      </fieldset>

      {withConsent && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t.consentAtCreation}
          </legend>
          {CREATION_CONSENTS.map((status) => (
            <ChoiceRow
              key={status}
              type="radio"
              name="consent"
              value={status}
              defaultChecked={values.consent === status}
            >
              {tc.statuses[status]}
            </ChoiceRow>
          ))}
          {errors.consent ? (
            <p className="text-sm text-destructive">{errors.consent}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{tc.explain}</p>
          )}
        </fieldset>
      )}

      <FormError message={state.error} />
      <Button
        type="submit"
        size="lg"
        className="h-11 self-start px-5"
        disabled={pending}
      >
        {pending ? fr.auth.pending : submitLabel}
      </Button>
    </form>
  );
}
