import { fr } from "@/lib/i18n/fr";

/** Conseils de placement du téléphone, repliables. */
export function PlacementGuide({ open = false }: { open?: boolean }) {
  const t = fr.capture.guide;
  return (
    <details open={open} className="rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">{t.title}</summary>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        {t.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </details>
  );
}
