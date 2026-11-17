"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { generateSessionInsights, type InsightsState } from "@/lib/insights/actions";

const t = fr.insights;

export function GenerateInsightsButton({ sessionId, hasInsights }: { sessionId: string; hasInsights: boolean }) {
  const [state, action, pending] = useActionState<InsightsState>(() => generateSessionInsights(sessionId), {});
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button
        type="submit"
        variant={hasInsights ? "outline" : "default"}
        size="lg"
        className="h-11 px-5"
        disabled={pending}
      >
        {pending ? t.generating : hasInsights ? t.regenerate : t.generate}
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
