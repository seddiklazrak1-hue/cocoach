# Combat Coach IA

> Un smartphone sur trépied devient l'assistant du coach de sports de combat
> (lutte, MMA, jiu-jitsu brésilien, boxe).

L'app filme la séance, extrait le squelette de chaque athlète **dans le
navigateur**, puis produit des retours individuels (technique, physique,
prévention) et une vue d'ensemble du groupe. **Aucune vidéo n'est stockée** :
seules des séries de points articulaires quittent l'appareil.

**État du projet : phase 1 sur 8 terminée** (fondations). Voir la
[feuille de route](#feuille-de-route).

> Combat Coach IA n'est pas un dispositif médical. Les analyses sont des
> estimations issues du mouvement ; elles ne remplacent ni le jugement du coach
> ni l'avis d'un professionnel de santé.

## Ce qui fonctionne aujourd'hui

- Inscription, connexion et déconnexion du coach (e-mail + mot de passe).
- Schéma complet de la base avec Row Level Security : un coach ne voit que ses
  données.
- Tableau de bord minimal, protégé par la session.
- CI : lint, types, tests et build à chaque push.

## Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Front + back | Next.js 16 (App Router), TypeScript | Un seul code pour mobile, tablette et PC |
| UI | Tailwind 4 + shadcn/ui | Composants accessibles, copiés dans le dépôt |
| Base, auth, stockage | Supabase (Postgres, région UE) | Palier gratuit, RLS native |
| Validation | Zod | Mêmes schémas côté formulaire et côté serveur |
| Tests | Vitest + PGlite | La RLS est testée dans un vrai Postgres embarqué, sans réseau |

## Démarrer en local

Prérequis : Node 24 et un compte [Supabase](https://supabase.com) gratuit.

1. **Installer**

   ```bash
   npm install
   ```

2. **Créer le projet Supabase** en région UE (Francfort ou Paris).

3. **Créer les tables** : dans Supabase, ouvrir *SQL Editor* et exécuter, dans
   l'ordre, le contenu de :
   - `supabase/migrations/20261116000001_initial_schema.sql`
   - `supabase/migrations/20261116000002_pose_storage.sql`

4. **Renseigner les clés** : copier `.env.example` vers `.env.local`, puis y
   coller l'URL du projet et la clé publique (*publishable key*). Ne jamais y
   mettre la clé secrète.

5. **Autoriser l'URL locale** : dans *Authentication > URL Configuration*,
   mettre `http://localhost:3000` en *Site URL* et ajouter
   `http://localhost:3000/**` aux *Redirect URLs*.

6. **Lancer**

   ```bash
   npm run dev
   ```

Sans `.env.local`, l'app démarre quand même et affiche un message
d'installation sur la page de connexion.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires et tests RLS |
| `npm run typecheck` | Vérification des types |
| `npm run lint` | ESLint |
| `npm run check` | Lint + types + tests (à lancer avant un commit) |
| `npm run build` | Build de production |

## Architecture

```
src/
  app/
    page.tsx              page d'accueil publique
    (auth)/               connexion, inscription
    (app)/                pages réservées au coach connecté
    auth/callback/        retour du lien de confirmation par e-mail
  components/             composants d'interface (ui/ = shadcn)
  lib/
    auth/                 schémas Zod, Server Actions, coach courant
    supabase/             clients navigateur / serveur / proxy
    i18n/fr.ts            tous les textes de l'interface
    routes.ts             règles d'accès par chemin
  proxy.ts                rafraîchit la session et redirige (ex-middleware)
supabase/migrations/      schéma SQL et politiques RLS
tests/db/                 tests de sécurité de la base
```

### Sécurité des données

La protection ne repose pas sur le code de l'app mais sur Postgres :

1. Chaque table porte un `coach_id`, et la politique RLS est partout la même :
   `coach_id = auth.uid()`.
2. Les clés étrangères sont composites `(id, coach_id)` : un coach ne peut pas
   rattacher une de ses lignes à l'objet d'un autre coach.
3. Supprimer un athlète efface en cascade toutes ses données (droit à
   l'effacement).
4. Un athlète sans consentement enregistré a `analysis_allowed = false` : c'est
   le comportement par défaut, ce qui couvre le cas des mineurs.

Ces quatre points sont vérifiés par `tests/db/rls.test.ts`, qui exécute les
vraies migrations dans PGlite (Postgres en WebAssembly).

## Feuille de route

- [x] **1. Fondations** : Next.js, Supabase, auth, schéma, RLS, CI
- [ ] 2. Groupes et athlètes avec consentements
- [ ] 3. Capture caméra, pose en direct, assignation manuelle
- [ ] 4. Pipeline de métriques déterministe
- [ ] 5. Recommandations via l'API Claude
- [ ] 6. Tableaux de bord athlète et groupe
- [ ] 7. Mode démo et finitions
- [ ] 8. Documentation, schéma d'architecture, vidéo de démo

## Limites connues

- L'estimation de pose 2D souffre de l'occlusion en combat (clinch, sol). Chaque
  métrique portera un score de confiance, et les images peu fiables seront
  ignorées.
- Le travail au sol (JJB) est très difficile avec une seule caméra : la v1 se
  limitera à des métriques robustes.
- La fatigue et l'intensité seront des estimations à partir du mouvement, pas
  des mesures physiologiques.
# cocoach
