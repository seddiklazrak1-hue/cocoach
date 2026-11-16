// Tous les textes de l'interface sont centralisés ici (français en v1).
// Pour traduire plus tard : dupliquer ce fichier (en.ts) avec les mêmes clés.

export const APP_NAME = "Combat Coach IA";

export const fr = {
  common: {
    appName: APP_NAME,
    tagline: "L'assistant coach IA pour les sports de combat",
    notMedical:
      "Combat Coach IA n'est pas un dispositif médical. Les analyses sont des estimations issues du mouvement : elles ne remplacent ni le jugement du coach ni l'avis d'un professionnel de santé.",
    soon: "Bientôt",
  },
  landing: {
    title: "Un smartphone sur trépied devient ton assistant coach.",
    subtitle:
      "Filme la séance, obtiens pour chaque athlète des retours techniques, physiques et de prévention, et suis la progression de ton groupe.",
    ctaSignup: "Créer mon compte coach",
    ctaLogin: "Se connecter",
    features: [
      {
        title: "Aucune vidéo stockée",
        body: "Le squelette est extrait dans le navigateur. Seuls des points articulaires quittent l'appareil.",
      },
      {
        title: "Des métriques, pas des impressions",
        body: "Angles, symétrie, intensité : chaque mesure est calculée de façon déterministe et affichée avec sa fiabilité.",
      },
      {
        title: "Pensé pour les mineurs",
        body: "Aucune analyse tant que le consentement n'est pas enregistré. Effacement complet en un clic.",
      },
    ],
  },
  auth: {
    loginTitle: "Connexion coach",
    loginSubtitle: "Accède à tes groupes et à tes séances.",
    signupTitle: "Créer un compte coach",
    signupSubtitle: "Seul le coach a un compte. Les athlètes n'en ont pas besoin.",
    displayName: "Prénom ou nom affiché",
    email: "E-mail",
    password: "Mot de passe",
    passwordHint: "8 caractères minimum.",
    loginSubmit: "Se connecter",
    signupSubmit: "Créer mon compte",
    pending: "Un instant…",
    noAccount: "Pas encore de compte ?",
    hasAccount: "Déjà un compte ?",
    signOut: "Se déconnecter",
    checkEmail:
      "Compte créé. Clique sur le lien reçu par e-mail pour confirmer ton adresse, puis connecte-toi.",
    errors: {
      invalidCredentials: "E-mail ou mot de passe incorrect.",
      emailNotConfirmed:
        "Ton adresse e-mail n'est pas encore confirmée. Vérifie ta boîte de réception.",
      alreadyRegistered: "Un compte existe déjà avec cet e-mail.",
      weakPassword: "Mot de passe trop faible : 8 caractères minimum.",
      rateLimited: "Trop de tentatives. Réessaie dans quelques minutes.",
      // Le lien ne crée la session que dans le navigateur où l'inscription a
      // été faite. Ailleurs, l'adresse est quand même confirmée.
      callbackFailed:
        "Lien ouvert dans un autre navigateur, ou expiré. Si ton adresse est déjà confirmée, connecte-toi simplement ci-dessous.",
      generic: "Une erreur est survenue. Réessaie.",
      emailInvalid: "Adresse e-mail invalide.",
      passwordTooShort: "8 caractères minimum.",
      passwordTooLong: "72 caractères maximum.",
      nameRequired: "Indique un prénom ou un nom.",
      nameTooLong: "60 caractères maximum.",
    },
    notConfigured: {
      title: "Supabase n'est pas encore configuré",
      body: "Copie .env.example vers .env.local, renseigne l'URL et la clé publique de ton projet Supabase, puis relance le serveur. Le README détaille les étapes.",
    },
  },
  dashboard: {
    greeting: (name: string) => (name ? `Bonjour ${name}` : "Bonjour coach"),
    subtitle: "Voici l'état de ton espace.",
    groups: "Groupes",
    athletes: "Athlètes",
    sessions: "Séances",
    emptyHint:
      "La gestion des groupes et des athlètes arrive à la phase 2 du projet.",
    dbError:
      "Connexion à la base impossible. Vérifie que les migrations SQL ont bien été appliquées (voir README).",
  },
} as const;
