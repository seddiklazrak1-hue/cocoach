import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Le calcul des métriques et le cœur de pose doivent rester couverts à 90 % ou plus.
      include: ["src/lib/metrics/**/*.ts", "src/lib/pose/**/*.ts", "src/lib/insights/**/*.ts"],
      // Les actions et lectures serveur (accès Supabase) sont vérifiées de bout en bout dans le navigateur.
      exclude: [
        "**/*.test.ts",
        "src/lib/metrics/actions.ts",
        "src/lib/metrics/queries.ts",
        "src/lib/insights/actions.ts",
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      reporter: ["text-summary", "text"],
    },
  },
});
