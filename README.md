# Combat Coach IA

> Un smartphone sur trépied devient l'assistant du coach de sports de combat
> (lutte, MMA, jiu-jitsu brésilien, boxe).

L'app filme la séance, extrait le squelette de chaque athlète **dans le
navigateur**, puis produit des retours individuels (technique, physique,
prévention) et une vue d'ensemble du groupe. **Aucune vidéo n'est stockée** :
seules des séries de points articulaires quittent l'appareil.

**État du projet : phase 3 sur 8 terminée** (capture, squelettes en direct, assignation). Voir la
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
- **Séances** : création (groupe, date, type, durée), plusieurs séquences
  filmées par séance, suppression.
- **Capture** : caméra du téléphone ou vidéo de l'appareil (lue localement),
  squelettes en direct, conseils de cadrage, images analysées par seconde.
- **Assignation** : le coach touche un squelette et choisit l'athlète. Un athlète
  sans consentement apparaît mais ne peut pas être choisi.
- **Relecture avant envoi** : replay des squelettes seuls, réassignation,
  découpe et échange de deux athlètes confondus.
- **Envoi** : une série de points articulaires compressée par athlète
  (environ 20 Ko pour 20 secondes), jamais de vidéo.
- Tableau de bord avec compteurs et rappel des athlètes non analysables.
- CI : lint, types, tests et build à chaque push.

## Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Front + back | Next.js 16 (App Router), TypeScript | Un seul code pour mobile, tablette et PC |
| UI | Tailwind 4 + shadcn/ui | Composants accessibles, copiés dans le dépôt |
| Base, auth, stockage | Supabase (Postgres, région UE) | Palier gratuit, RLS native |
| Estimation de pose | MediaPipe Pose Landmarker « lite » (WebAssembly, GPU) | Tourne dans le navigateur, aucune image envoyée |
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
   - `supabase/migrations/20261117000004_pose_clips.sql`

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
      sessions/           séances, séquences, écran de capture
    auth/callback/        retour du lien de confirmation par e-mail
  components/             composants d'interface (ui/ = shadcn)
    form/                 champs de formulaire partagés
    roster/               formulaires groupe, athlète, consentement, effacement
    sessions/             formulaire et badge de séance
    capture/              moteur MediaPipe, boucle en direct, replay, relecture
  lib/
    auth/                 schémas Zod, Server Actions, coach courant
    roster/               groupes et athlètes : types, validation, lectures, actions
    sessions/             séances et séquences : types, validation, lectures, actions
    pose/                 cœur de pose, sans React : suivi, identités, enregistrement,
                          corrections, format de fichier, poses synthétiques
    security/csp.ts       serveurs que la page a le droit de contacter
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

7. La base refuse d'enregistrer la pose d'un athlète sans consentement valide,
   même si l'app se trompait.

Ces points sont vérifiés par `tests/db/rls.test.ts`, qui exécute les vraies
migrations dans PGlite (Postgres en WebAssembly).

### Ce qui quitte l'appareil pendant une capture

| Quoi | Vers où | Contenu |
|---|---|---|
| Moteur et modèle de pose (téléchargés une fois) | cdn.jsdelivr.net, storage.googleapis.com | Rien n'est envoyé, on télécharge |
| Séries de pose des athlètes désignés | Supabase (UE), bucket privé | Points articulaires compressés |
| Vidéo | **Nulle part** | Elle reste dans le navigateur |

MediaPipe envoie par défaut des statistiques d'usage à Google
(`odml.pa.googleapis.com`), sans option pour les couper. La politique de
sécurité de l'app (`connect-src`, dans `next.config.ts`) n'autorise que les
serveurs du tableau ci-dessus : le navigateur bloque ces envois.

## Pipeline de capture

```
caméra ou fichier ──► MediaPipe (25 points par personne, 30-60 images/s)
                         │
                         ▼
                  suivi des personnes (boîtes englobantes + distance)
                         │
                         ▼
                  identités : assignation au toucher par le coach
                  (+ réattribution prudente après une occlusion, marquée « à vérifier »)
                         │
                         ▼
                  enregistrement à 10 Hz ──► relecture et corrections
                         │
                         ▼
                  par athlète : quantification 16 bits + différences + gzip
                         │
                         ▼
                  Supabase Storage  <coach>/<séance>/<séquence>/<athlète>.bin
```

On garde 25 des 33 points de MediaPipe : les yeux et la bouche sont retirés,
le nez et les oreilles suffisent pour situer la tête. Le format de fichier est
décrit en tête de `src/lib/pose/codec.ts`.

## Feuille de route

- [x] **1. Fondations** : Next.js, Supabase, auth, schéma, RLS, CI
- [x] **2. Groupes et athlètes** avec consentements et effacement
- [x] **3. Capture caméra**, pose en direct, assignation manuelle, replay
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
- **4 athlètes maximum dans le cadre** recommandés, à 4 à 6 m de la caméra.
  Au-delà, ou plus loin, la détection devient peu fiable.
- Le suivi peut échanger deux athlètes qui se croisent ou s'accrochent : la
  relecture permet de corriger avant l'envoi.
- Une séquence dure 10 minutes au plus. Pour une séance entière, enchaîner
  plusieurs séquences.
- Performances mesurées pour l'instant sur ordinateur (Chrome, 44 à 60 images
  analysées par seconde). Pas encore mesurées sur téléphone.
