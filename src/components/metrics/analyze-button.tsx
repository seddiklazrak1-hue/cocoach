"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { analyzeSession, type AnalyzeState } from "@/lib/metrics/actions";

const t = fr.metrics;

export function AnalyzeButton({ sessionId, analyzed }: { sessionId: string; analyzed: boolean }) {
  const [state, action, pending] = useActionState<AnalyzeState>(
    () => analyzeSession(sessionId),
    {},
  );
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button
        type="submit"
        variant={analyzed ? "outline" : "default"}
        size="lg"
        className="h-11 px-5"
        disabled={pending}
      >
        {pending ? t.analyzing : analyzed ? t.reanalyze : t.analyze}
      </Button>
      {state.ok && (
        <p role="status" className="text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
