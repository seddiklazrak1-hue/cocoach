import type { NextConfig } from "next";
import { buildCsp } from "./src/lib/security/csp";

// Choix volontaire : `cacheComponents` et `partialPrefetching` (activés par le
// template) sont désactivés. Toute l'app est derrière une session coach, donc
// le pré-rendu statique n'apporte presque rien et impose des <Suspense>
// partout. On garde le rendu dynamique classique, plus simple à raisonner.
const nextConfig: NextConfig = {
  turbopack: {
    // Évite que Next prenne un package-lock.json parent pour la racine du projet.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Seuls Supabase et les fichiers du modèle de pose sont joignables
            // depuis la page (voir src/lib/security/csp.ts).
            key: "Content-Security-Policy",
            value: buildCsp({
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
              dev: process.env.NODE_ENV !== "production",
            }),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
