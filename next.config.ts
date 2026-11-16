import type { NextConfig } from "next";

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
};

export default nextConfig;
