import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Briques de formulaire partagées. Hauteur 44 px partout : c'est la taille
// minimale confortable au doigt sur un téléphone posé en salle.

const CONTROL_HEIGHT = "h-11";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

/** Libellé + contrôle + aide ou erreur, reliés pour les lecteurs d'écran. */
export function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
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

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type TextFieldProps = Omit<FieldShellProps, "children"> &
  Omit<ComponentProps<"input">, "id">;

export function TextField({ id, label, hint, error, ...props }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        name={id}
        className={CONTROL_HEIGHT}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}

/** <select> natif : sur mobile il ouvre le sélecteur du système, le plus pratique au doigt. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        CONTROL_HEIGHT,
        "w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

type SelectFieldProps = Omit<FieldShellProps, "children"> &
  Omit<ComponentProps<"select">, "id"> & {
    options: ReadonlyArray<{ value: string; label: string }>;
  };

export function SelectField({
  id,
  label,
  hint,
  error,
  options,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <Select
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

/** Erreur globale d'un formulaire (échec serveur, etc.). */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Case à cocher ou bouton radio sur une ligne entière, facile à toucher. */
export function ChoiceRow({
  children,
  className,
  ...props
}: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5",
        className,
      )}
    >
      <input className="size-4 shrink-0 accent-primary" {...props} />
      <span>{children}</span>
    </label>
  );
}
