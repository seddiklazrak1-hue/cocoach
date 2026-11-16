"use client";

import { useActionState, useState } from "react";
import {
  FieldShell,
  FormError,
  Select,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fr } from "@/lib/i18n/fr";
import type { ScheduleSlot } from "@/lib/roster/domain";
import {
  dayOptions,
  disciplineOptions,
  groupLevelOptions,
} from "@/lib/roster/labels";
import type { FormState, GroupRaw } from "@/lib/roster/schemas";

const t = fr.roster.groups;

type Props = {
  /** Server Action déjà liée à l'id du groupe en mode modification. */
  action: (
    prev: FormState<GroupRaw>,
    formData: FormData,
  ) => Promise<FormState<GroupRaw>>;
  initial?: GroupRaw;
  submitLabel: string;
};

const EMPTY: GroupRaw = {
  name: "",
  discipline: "wrestling",
  level: "mixed",
  schedule: [],
};

export function GroupForm({ action, initial = EMPTY, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  // Après une erreur, on réaffiche ce que le coach avait saisi.
  const values = state.values ?? initial;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField
        id="name"
        label={t.name}
        placeholder={t.namePlaceholder}
        defaultValue={values.name}
        error={state.fieldErrors?.name}
        maxLength={80}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="discipline"
          label={t.discipline}
          options={disciplineOptions}
          defaultValue={values.discipline}
          error={state.fieldErrors?.discipline}
        />
        <SelectField
          id="level"
          label={t.level}
          options={groupLevelOptions}
          defaultValue={values.level}
          error={state.fieldErrors?.level}
        />
      </div>

      {/* `key` : repart de la saisie renvoyée par le serveur après une erreur. */}
      <ScheduleEditor
        key={JSON.stringify(values.schedule)}
        initial={values.schedule}
        error={state.fieldErrors?.schedule}
      />

      <FormError message={state.error} />
      <Button type="submit" size="lg" className="h-11 self-start px-5" disabled={pending}>
        {pending ? fr.auth.pending : submitLabel}
      </Button>
    </form>
  );
}

/** Liste modifiable de créneaux, envoyée au serveur en JSON dans un champ caché. */
function ScheduleEditor({
  initial,
  error,
}: {
  initial: ScheduleSlot[];
  error?: string;
}) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initial);

  const update = (index: number, patch: Partial<ScheduleSlot>) =>
    setSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );

  return (
    <FieldShell id="schedule" label={t.schedule} hint={t.scheduleHint} error={error}>
      <input type="hidden" name="schedule" value={JSON.stringify(slots)} />
      <ul className="flex flex-col gap-3">
        {slots.map((slot, index) => (
          <li
            key={index}
            className="grid grid-cols-[1fr_1fr] items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
          >
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              {t.slotDay}
              <Select
                value={String(slot.day)}
                onChange={(event) =>
                  update(index, { day: Number(event.target.value) })
                }
              >
                {dayOptions.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t.slotStart}
              <Input
                type="time"
                className="h-11"
                value={slot.start}
                onChange={(event) => update(index, { start: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t.slotEnd}
              <Input
                type="time"
                className="h-11"
                value={slot.end}
                onChange={(event) => update(index, { end: event.target.value })}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="col-span-2 h-11 sm:col-span-1"
              onClick={() =>
                setSlots((current) => current.filter((_, i) => i !== index))
              }
            >
              {t.removeSlot}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 self-start"
        disabled={slots.length >= 14}
        onClick={() =>
          setSlots((current) => [
            ...current,
            { day: 1, start: "19:00", end: "20:30" },
          ])
        }
      >
        {t.addSlot}
      </Button>
    </FieldShell>
  );
}
