"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { clearDemo, loadDemo, type DemoState } from "@/lib/demo/actions";
import { fr } from "@/lib/i18n/fr";

const t = fr.demo;

/** Charger ou effacer la démo. Effacer demande confirmation : la suppression est définitive. */
export function DemoControls({ loaded }: { loaded: boolean }) {
  const [loadState, loadAction, loading] = useActionState<DemoState, FormData>(
    () => loadDemo(),
    {},
  );
  const [clearState, clearAction, clearing] = useActionState<DemoState, FormData>(
    () => clearDemo(),
    {},
  );
  const message = clearState.ok ?? clearState.error ?? loadState.ok ?? loadState.error;

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">{t.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.intro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {loaded ? (
          <>
            <span className="inline-flex h-7 items-center rounded-full border px-3 text-sm font-medium">
              {t.loadedBadge}
            </span>
            <form
              action={clearAction}
              onSubmit={(event) => {
                if (!window.confirm(t.clearConfirm)) event.preventDefault();
              }}
            >
              <Button type="submit" variant="outline" size="lg" className="h-11 px-5" disabled={clearing}>
                {t.clear}
              </Button>
            </form>
          </>
        ) : (
          <form action={loadAction}>
            <Button type="submit" size="lg" className="h-11 px-5" disabled={loading}>
              {loading ? "…" : t.load}
            </Button>
          </form>
        )}
      </div>

      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
