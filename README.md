# Combat Coach IA

> Un smartphone sur trépied devient l'assistant du coach de sports de combat
> (lutte, MMA, jiu-jitsu brésilien, boxe).

L'app filme la séance, extrait le squelette de chaque athlète **dans le
navigateur**, puis produit des retours individuels (technique, physique,
prévention) et une vue d'ensemble du groupe. **Aucune vidéo n'est stockée** :
seules des séries de points articulaires quittent l'appareil.

**État du projet : phase 2 sur 8 terminée** (groupes, athlètes, consentements). Voir la
[feuille de route](#feuille-de-route).

> Combat Coach IA n'est pas un dispositif médical. Les analyses sont des
> estimations issues du mouvement ; elles ne remplacent ni le jugement du coach
> ni l'avis d'un professionnel de santé.

## Ce qui fonctionne aujourd'hui

- Inscription, connexion et déconnexion du coach (e-mail + mot de passe).
- Schéma complet de la base avec Row Level Security : un coach ne voit que ses
  données.
- **Groupes** : création, modification, suppression, créneaux hebdomadaires,
  rattachement des athlètes.
- **Athlètes** : fiche (prénom ou pseudo, discipline, niveau, mesures
  facultatives), groupes, modification.
- **Consentement** : journal daté et non modifiable ; aucune analyse possible
  sans consentement enregistré ; consentement parental imposé pour un mineur.
- **Droit à l'effacement** : un bouton supprime la fiche et toutes les données
  liées, après confirmation par saisie du nom.
- Tableau de bord avec compteurs et rappel des athlètes non analysables.
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
   - `supabase/migrations/20261116000003_consent_journal.sql`

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
      dashboard/          tableau de bord
      groups/             liste, création, fiche et modification d'un groupe
      athletes/           liste, création, fiche et modification d'un athlète
    auth/callback/        retour du lien de confirmation par e-mail
  components/             composants d'interface (ui/ = shadcn)
    form/                 champs de formulaire partagés
    roster/               formulaires groupe, athlète, consentement, effacement
  lib/
    auth/                 schémas Zod, Server Actions, coach courant
    roster/               groupes et athlètes : types, validation, lectures, actions
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
5. Le statut de consentement ne s'écrit pas directement : il faut ajouter une
   ligne au journal `consents`, et un trigger reporte le statut sur l'athlète.
   Le journal lui-même est en ajout seul (ni modification ni suppression).
6. Un athlète dont la date de naissance indique moins de 18 ans ne peut pas
   recevoir un consentement « adulte » : la base le refuse.

Ces six points sont vérifiés par `tests/db/rls.test.ts`, qui exécute les
vraies migrations dans PGlite (Postgres en WebAssembly).

## Feuille de route

- [x] **1. Fondations** : Next.js, Supabase, auth, schéma, RLS, CI
- [x] **2. Groupes et athlètes** avec consentements et effacement
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
