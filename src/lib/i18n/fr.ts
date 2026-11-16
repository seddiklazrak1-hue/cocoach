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
  nav: {
    dashboard: "Tableau de bord",
    groups: "Groupes",
    athletes: "Athlètes",
  },
  dashboard: {
    greeting: (name: string) => (name ? `Bonjour ${name}` : "Bonjour coach"),
    subtitle: "Voici l'état de ton espace.",
    groups: "Groupes",
    athletes: "Athlètes",
    sessions: "Séances",
    blockedTitle: (n: number) =>
      n === 1
        ? "1 athlète ne peut pas encore être analysé"
        : `${n} athlètes ne peuvent pas encore être analysés`,
    blockedBody:
      "Aucune analyse n'est lancée tant que le consentement n'est pas enregistré sur la fiche de l'athlète.",
    blockedCta: "Voir les athlètes",
    startTitle: "Pour commencer",
    startBody:
      "Crée un groupe, puis ajoute tes athlètes. Les séances filmées arrivent à l'étape suivante du projet.",
    dbError:
      "Connexion à la base impossible. Vérifie que les migrations SQL ont bien été appliquées (voir README).",
  },
  roster: {
    disciplines: {
      wrestling: "Lutte",
      mma: "MMA",
      bjj: "Jiu-jitsu brésilien",
      boxing: "Boxe",
      kickboxing: "Kickboxing / muay-thaï",
      judo: "Judo",
      other: "Autre",
    },
    levels: {
      beginner: "Débutant",
      intermediate: "Intermédiaire",
      advanced: "Avancé",
      mixed: "Tous niveaux",
    },
    days: {
      1: "Lundi",
      2: "Mardi",
      3: "Mercredi",
      4: "Jeudi",
      5: "Vendredi",
      6: "Samedi",
      7: "Dimanche",
    },
    consent: {
      title: "Consentement",
      statuses: {
        missing: "Non recueilli",
        adult_confirmed: "Adulte, consentement confirmé",
        minor_parental_confirmed: "Mineur, consentement parental confirmé",
        withdrawn: "Consentement retiré",
      },
      allowed: "Analyse autorisée",
      blocked: "Analyse bloquée",
      explain:
        "Sans consentement enregistré, aucune séance de cet athlète n'est analysée. Pour un mineur, c'est l'accord écrit d'un parent ou responsable légal qu'il faut avoir recueilli.",
      minorDetected:
        "D'après sa date de naissance, cet athlète est mineur : seul le consentement parental est accepté.",
      change: "Mettre à jour le consentement",
      newStatus: "Nouveau statut",
      note: "Note (facultatif)",
      noteHint:
        "Ex. « autorisation papier signée par la mère le 12/11 ». Pas de donnée de santé ici.",
      submit: "Enregistrer au journal",
      journal: "Journal",
      journalEmpty: "Aucune entrée pour l'instant.",
      journalHint:
        "Chaque changement est daté et ne peut plus être modifié ensuite.",
      autoResetNote:
        "Date de naissance modifiée : athlète mineur, consentement parental requis.",
    },
    groups: {
      title: "Groupes",
      subtitle: "Tes créneaux d'entraînement et leurs athlètes.",
      new: "Nouveau groupe",
      empty: "Aucun groupe pour l'instant.",
      emptyHint: "Commence par créer ton premier groupe, par exemple « Lutte adultes lundi ».",
      createTitle: "Nouveau groupe",
      editTitle: "Modifier le groupe",
      name: "Nom du groupe",
      namePlaceholder: "Lutte adultes lundi",
      discipline: "Discipline",
      level: "Niveau",
      schedule: "Créneaux",
      scheduleHint: "Jours et horaires habituels. Facultatif.",
      scheduleEmpty: "Aucun créneau renseigné",
      addSlot: "Ajouter un créneau",
      removeSlot: "Retirer ce créneau",
      slotDay: "Jour",
      slotStart: "Début",
      slotEnd: "Fin",
      create: "Créer le groupe",
      save: "Enregistrer",
      edit: "Modifier",
      members: "Athlètes du groupe",
      memberCount: (n: number) =>
        n === 0 ? "Aucun athlète" : n === 1 ? "1 athlète" : `${n} athlètes`,
      membersEmpty: "Ce groupe n'a pas encore d'athlète.",
      addMembers: "Ajouter des athlètes existants",
      addMembersSubmit: "Ajouter au groupe",
      addMembersNone: "Tous tes athlètes sont déjà dans ce groupe.",
      newAthleteHere: "Créer un athlète dans ce groupe",
      removeMember: "Retirer du groupe",
      dangerTitle: "Supprimer le groupe",
      dangerBody:
        "Le groupe et ses séances (avec leurs analyses) seront supprimés. Les fiches des athlètes sont conservées.",
      deleteSubmit: "Supprimer définitivement",
    },
    athletes: {
      title: "Athlètes",
      subtitle: "Les athlètes n'ont pas de compte : tout passe par toi.",
      new: "Nouvel athlète",
      empty: "Aucun athlète pour l'instant.",
      emptyHint: "Ajoute tes athlètes pour pouvoir les rattacher à un groupe.",
      createTitle: "Nouvel athlète",
      editTitle: "Modifier l'athlète",
      displayName: "Prénom ou pseudo",
      displayNameHint: "Pas besoin du nom complet : un prénom ou un pseudo suffit.",
      discipline: "Discipline principale",
      disciplineNone: "Non précisée",
      level: "Niveau",
      weight: "Poids (kg)",
      height: "Taille (cm)",
      birthDate: "Date de naissance",
      optional: "Facultatif",
      birthDateHint:
        "Facultatif. Sert uniquement à savoir si un consentement parental est requis.",
      groups: "Groupes",
      groupsNone: "Aucun groupe créé pour l'instant.",
      noGroup: "Sans groupe",
      consentAtCreation: "Consentement à l'analyse",
      create: "Ajouter l'athlète",
      save: "Enregistrer",
      edit: "Modifier",
      profile: "Fiche",
      age: (n: number) => `${n} ans`,
      minor: "Mineur",
      dangerTitle: "Effacer toutes les données",
      dangerBody:
        "La fiche, le journal de consentement, les séries de mouvement, les métriques et les recommandations de cet athlète seront supprimés. Cette action est définitive (droit à l'effacement, RGPD).",
      deleteSubmit: "Tout effacer définitivement",
      deleted: (name: string) => `Toutes les données de ${name} ont été effacées.`,
    },
    confirm: {
      label: (name: string) => `Pour confirmer, tape « ${name} »`,
    },
    errors: {
      generic: "L'enregistrement a échoué. Réessaie.",
      notFound: "Élément introuvable.",
      nameRequired: "Indique un nom.",
      nameTooLong: "Nom trop long.",
      choiceInvalid: "Choix invalide.",
      timeInvalid: "Heure invalide.",
      slotOrder: "L'heure de fin doit être après l'heure de début.",
      tooManySlots: "14 créneaux maximum.",
      weightRange: "Poids attendu entre 10 et 300 kg.",
      heightRange: "Taille attendue entre 80 et 250 cm.",
      birthDateInvalid: "Date de naissance invalide.",
      minorNeedsParent:
        "D'après la date de naissance, l'athlète est mineur : choisis le consentement parental.",
      noteTooLong: "500 caractères maximum.",
      confirmMismatch: "Le nom saisi ne correspond pas.",
    },
  },
} as const;
