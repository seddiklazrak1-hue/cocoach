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
    sessions: "Séances",
  },
  demo: {
    title: "Données de démonstration",
    intro:
      "Ajoute trois groupes fictifs (boxe, MMA, lutte), douze athlètes et neuf séances analysées, pour découvrir l'app sans filmer. Tout est marqué « Démo » : tes vraies fiches ne sont pas touchées.",
    loadedBadge: "Démo chargée",
    load: "Charger la démo",
    clear: "Effacer la démo",
    clearConfirm:
      "Effacer toutes les données de démonstration ? Tes vraies données ne sont pas touchées.",
    loaded: (groups: number, athletes: number, sessions: number) =>
      `Démo chargée : ${groups} groupes, ${athletes} athlètes, ${sessions} séances.`,
    cleared: "Données de démonstration effacées.",
    alreadyLoaded: "La démo est déjà chargée. Efface-la avant de la recharger.",
    notLoaded: "Aucune donnée de démonstration à effacer.",
    error: "Opération impossible. Réessaie.",
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
      "Crée un groupe, ajoute tes athlètes, puis crée une séance pour filmer.",
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
        "Chaque changement est daté et ne peut plus être modifié ensuite. Retirer le consentement efface aussi les résultats d'analyse déjà calculés.",
      autoResetNote:
        "Date de naissance modifiée : athlète mineur, consentement parental requis.",
      outOfSync:
        "Le journal et le statut ne concordent pas : la base n'est pas à jour. Exécute la migration 20261116000003_consent_journal.sql dans Supabase, puis enregistre de nouveau le consentement.",
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
      weightShort: "Poids",
      heightShort: "Taille",
      weightValue: (kg: number) => `${kg.toLocaleString("fr-FR")} kg`,
      heightValue: (cm: number) => `${cm.toLocaleString("fr-FR")} cm`,
      birthDate: "Date de naissance",
      optional: "Facultatif",
      birthDateHint:
        "La date de naissance sert uniquement à savoir si un consentement parental est requis.",
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
    notFound: {
      title: "Page introuvable",
      body: "Cette page n'existe pas, ou l'élément a été supprimé.",
      back: "Retour au tableau de bord",
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
  sessions: {
    title: "Séances",
    subtitle: "Chaque séance regroupe une ou plusieurs séquences filmées.",
    new: "Nouvelle séance",
    newForGroup: "Nouvelle séance pour ce groupe",
    empty: "Aucune séance pour l'instant.",
    emptyHint: "Crée une séance, puis filme une première séquence.",
    noGroup: "Crée d'abord un groupe : une séance appartient toujours à un groupe.",
    createTitle: "Nouvelle séance",
    group: "Groupe",
    date: "Date",
    kind: "Type de séance",
    duration: "Durée prévue (min)",
    durationHint: "Facultatif.",
    create: "Créer la séance",
    kinds: {
      technique: "Technique",
      sparring: "Sparring",
      cardio: "Cardio",
      drill: "Drills",
    },
    statuses: {
      draft: "À filmer",
      captured: "Filmée",
      analyzed: "Analysée",
    },
    minutes: (n: number) => `${n} min`,
    athletesTitle: "Athlètes du groupe",
    athletesEmpty: "Ce groupe n'a pas encore d'athlète.",
    blockedWarning: (n: number) =>
      n === 1
        ? "1 athlète n'a pas de consentement enregistré : il pourra apparaître à l'image, mais ses mouvements ne seront pas enregistrés."
        : `${n} athlètes n'ont pas de consentement enregistré : ils pourront apparaître à l'image, mais leurs mouvements ne seront pas enregistrés.`,
    clipsTitle: "Séquences enregistrées",
    clipsEmpty: "Aucune séquence pour l'instant.",
    capture: "Filmer une séquence",
    clipLabel: (n: number) => `Séquence ${n}`,
    clipMeta: (duration: string, count: number) =>
      `${duration} · ${count === 1 ? "1 athlète" : `${count} athlètes`}`,
    confidence: (percent: number) => `fiabilité ${percent} %`,
    viewClip: "Revoir les squelettes",
    hideClip: "Masquer",
    loadingClip: "Chargement des données de pose…",
    clipLoadError: "Impossible de charger cette séquence.",
    deleteClip: "Supprimer cette séquence",
    deleteClipConfirm: "Supprimer définitivement",
    dangerTitle: "Supprimer la séance",
    dangerBody:
      "La séance, ses séquences et toutes les données de mouvement associées seront supprimées définitivement.",
    confirmWord: "supprimer",
    deleteSubmit: "Supprimer la séance",
    errors: {
      dateInvalid: "Date invalide.",
      durationRange: "Durée attendue entre 1 et 600 minutes.",
      clipInvalid: "Séquence invalide. Recommence l'enregistrement.",
      consent:
        "Un athlète de cette séquence n'a plus de consentement valide : rien n'a été enregistré.",
    },
  },
  capture: {
    title: "Filmer une séquence",
    privacy:
      "La vidéo reste sur cet appareil : seuls les points articulaires des athlètes que tu désignes sont envoyés.",
    sourceTitle: "Source vidéo",
    useCamera: "Utiliser la caméra",
    useFile: "Analyser une vidéo de l'appareil",
    fileHint:
      "Le fichier est lu localement, il n'est jamais envoyé. Pratique pour tester sans être en salle.",
    loadingEngine: "Chargement du modèle de pose (environ 6 Mo, une seule fois)…",
    engineError:
      "Impossible de charger le modèle de pose. Vérifie ta connexion, puis recharge la page.",
    cameraError:
      "Accès à la caméra refusé ou indisponible. Autorise la caméra dans le navigateur, ou analyse une vidéo de l'appareil.",
    changeSource: "Changer de source",
    fps: (n: number) => `${n} images/s analysées`,
    people: (n: number) =>
      n === 0 ? "Aucune personne détectée" : n === 1 ? "1 personne détectée" : `${n} personnes détectées`,
    slowDevice:
      "Analyse lente sur cet appareil : les mouvements rapides seront moins bien captés.",
    tapToAssign: "Touche un squelette pour indiquer de quel athlète il s'agit.",
    assignTitle: "Qui est-ce ?",
    assignBlocked: "consentement manquant",
    unassign: "Ne pas suivre cette personne",
    cancel: "Annuler",
    onScreen: "À l'image",
    unassigned: "non assigné",
    autoAssigned: "à vérifier",
    record: "Enregistrer",
    stop: "Arrêter",
    recording: "Enregistrement",
    maxDuration: (minutes: number) => `Arrêt automatique après ${minutes} min.`,
    warnings: {
      tooFar: "Les athlètes sont loin : rapproche la caméra pour des mesures plus fiables.",
      edge: "Un athlète sort du cadre.",
      lowConfidence: "Fiabilité faible : vérifie l'éclairage et l'angle de la caméra.",
      noPerson: "Personne n'est détecté : vérifie le cadrage.",
    },
    guide: {
      title: "Bien placer la caméra",
      tips: [
        "Téléphone à l'horizontale, sur trépied, à environ 1 m du sol.",
        "Entre 4 et 6 m des athlètes : le corps entier doit rester dans le cadre, pieds compris.",
        "La lumière doit venir de derrière la caméra, pas de face.",
        "Filme de côté ou de trois quarts plutôt que de face pour mieux voir les flexions.",
        "4 athlètes maximum dans le cadre : au-delà, la détection devient peu fiable.",
        "Le travail au sol et le clinch masquent beaucoup de points : ces passages seront marqués peu fiables.",
      ],
    },
    review: {
      title: "Vérifier avant d'enregistrer",
      subtitle:
        "Revois les squelettes et corrige l'assignation si deux athlètes ont été confondus.",
      play: "Lecture",
      pause: "Pause",
      position: "Position dans la séquence",
      tracksTitle: "Personnes suivies",
      tracksHint:
        "Chaque ligne correspond à une personne suivie sans interruption. Choisis l'athlète correspondant, ou « personne » pour ne pas l'enregistrer.",
      track: (n: number) => `Personne ${n}`,
      nobody: "— Personne (ne pas enregistrer) —",
      goTo: "Voir",
      split: "Couper ici",
      splitHint: "Coupe cette ligne à la position actuelle (en cas d'échange d'identité).",
      swapTitle: "Corriger un échange d'identité",
      swapHint: "À partir de la position actuelle, tout ce qui était attribué à l'un passe à l'autre.",
      swapA: "Athlète",
      swapB: "et",
      swap: (time: string) => `Échanger à partir de ${time}`,
      summaryTitle: "Ce qui sera enregistré",
      summaryEmpty:
        "Aucun athlète assigné : désigne au moins une personne pour enregistrer la séquence.",
      coverage: (percent: number) => `présent ${percent} % du temps`,
      reliability: {
        good: "fiabilité bonne",
        medium: "fiabilité moyenne",
        low: "fiabilité faible",
      },
      shortPresence: "présence très courte",
      save: (n: number) => (n === 1 ? "Enregistrer 1 série" : `Enregistrer ${n} séries`),
      discard: "Ne pas enregistrer",
      discardConfirm: "Abandonner cette séquence ? Les données de pose seront perdues.",
      saving: (done: number, total: number) => `Envoi ${done}/${total}…`,
      saveError: "L'envoi a échoué. Vérifie ta connexion et réessaie.",
    },
    saved: {
      title: "Séquence enregistrée",
      body: (n: number, size: string) =>
        `${n === 1 ? "1 série de pose envoyée" : `${n} séries de pose envoyées`} (${size}). Aucune image vidéo n'a quitté l'appareil.`,
      another: "Filmer une autre séquence",
      back: "Retour à la séance",
    },
  },
  progress: {
    athleteTitle: "Progression",
    athleteSubtitle:
      "Chaque point est une séance. Seules les mesures assez fiables apparaissent ici.",
    noData: "Pas encore assez de mesures fiables : analyse au moins une séance filmée.",
    pick: "Mesure",
    first: "Première mesure",
    last: "Dernière mesure",
    change: "Écart",
    changeHint: "Écart entre la première et la dernière mesure : sans jugement de sens.",
    sessionsCount: (n: number) => (n > 1 ? `${n} séances` : `${n} séance`),
    columns: {
      date: "Date",
      value: "Valeur",
      reliability: "Fiabilité",
      watch: "Signal",
      mean: "Moyenne",
      athletes: "Athlètes",
    },
    watchYes: "à surveiller",
    watchNo: "–",
    chartLabel: (name: string) => `Évolution de ${name} au fil des séances`,
    groupLink: "Suivi du groupe",
    groupTitle: "Suivi du groupe",
    groupSubtitle:
      "Moyennes des athlètes dont la mesure est fiable. Valeurs indicatives, à lire avec le coach.",
    sessionsTitle: "Séances",
    sessionsEmpty: "Aucune séance pour ce groupe.",
    notAnalysed: "Non analysée",
    analysedCount: (n: number) => (n > 1 ? `${n} athlètes` : `${n} athlète`),
    watchCount: (n: number) => (n > 0 ? `${n} à surveiller` : "Aucun signal"),
    groupNoData: "Pas encore de mesures fiables pour ce groupe.",
  },
  metrics: {
    title: "Analyse des mouvements",
    subtitle:
      "Mesures calculées à partir des squelettes : ce sont des estimations, accompagnées de leur fiabilité.",
    analyze: "Analyser la séance",
    reanalyze: "Relancer l'analyse",
    analyzing: "Analyse en cours…",
    noClips: "Filme au moins une séquence pour lancer l'analyse.",
    notAnalyzed: "Séance pas encore analysée.",
    done: (analyzed: number, skipped: number) =>
      `${analyzed <= 1 ? `${analyzed} athlète analysé` : `${analyzed} athlètes analysés`}${
        skipped > 0 ? ` · ${skipped} sans consentement valide, non analysé${skipped > 1 ? "s" : ""}` : ""
      }.`,
    errorGeneric: "L'analyse a échoué. Réessaie.",
    errorDownload: "Impossible de lire les données de pose de cette séance.",
    presence: (duration: string, quality: number) =>
      `Présent et visible ${duration} · points visibles à ${quality} % en moyenne`,
    categories: {
      technique: "Technique",
      physical: "Physique",
      injury_prevention: "Prévention des blessures",
      discipline: "Spécifique à la discipline",
    },
    confidence: { high: "fiable", medium: "à confirmer", low: "peu fiable" },
    confidenceHint:
      "Fiabilité = visibilité des points × nombre d'images × part du temps exploitable. Les mesures peu fiables ne serviront pas aux recommandations.",
    watch: "à surveiller",
    watchHint:
      "Signal à vérifier avec un professionnel (kiné, médecin du sport), jamais un diagnostic.",
    howMeasured: "Comment c'est mesuré",
    sides: (left: string, right: string) => `gauche ${left} · droite ${right}`,
    missing: (labels: string) => `Non mesurable sur cette séance (pas assez d'images fiables) : ${labels}.`,
    notes: {
      short_presence:
        "Moins de 30 secondes exploitables : les mesures sont indicatives.",
      low_quality:
        "Points souvent peu visibles (éclairage, distance ou angle) : fiabilité réduite.",
      ground_heavy:
        "Beaucoup de travail au sol : les mesures « debout » portent sur moins d'images.",
      bjj_limited:
        "Jiu-jitsu : le travail au sol est mal vu par une seule caméra. Seules les mesures robustes sont gardées.",
      depth_estimated:
        "Certaines mesures utilisent la profondeur estimée par le modèle (plus bruitée) : leur fiabilité est réduite d'office.",
    },
    items: {
      stance_width: {
        label: "Largeur d'appuis",
        description:
          "Distance entre les chevilles, rapportée à la largeur d'épaules. Médiane sur les moments debout.",
      },
      guard_height: {
        label: "Hauteur de garde",
        description:
          "Hauteur des poignets par rapport aux épaules, en longueurs de tronc : 0 = à hauteur d'épaules, négatif = mains plus basses.",
      },
      knee_flexion: {
        label: "Flexion des genoux",
        description:
          "Angle hanche-genou-cheville (180° = jambe tendue). Médiane sur les moments debout.",
      },
      hip_flexion: {
        label: "Flexion des hanches",
        description: "Angle épaule-hanche-genou (180° = corps droit). Médiane sur les moments debout.",
      },
      trunk_lean: {
        label: "Inclinaison du tronc",
        description: "Angle du tronc (hanches → épaules) avec la verticale. Médiane.",
      },
      balance_offset: {
        label: "Centrage sur les appuis",
        description:
          "Écart horizontal entre un centre de masse approché et le milieu des pieds, en longueurs de tronc. Plus c'est bas, mieux l'athlète est centré.",
      },
      intensity: {
        label: "Intensité",
        description:
          "Vitesse moyenne des poignets, coudes, genoux et chevilles par rapport aux hanches. Estimation à partir du mouvement, pas une mesure physiologique.",
      },
      explosiveness: {
        label: "Explosivité",
        description: "Pics de vitesse des poignets et des chevilles (95e centile).",
      },
      rhythm_variability: {
        label: "Variabilité du rythme",
        description:
          "Variation de l'intensité d'une seconde à l'autre. Élevée = alternance d'efforts et de pauses.",
      },
      intensity_drop: {
        label: "Baisse d'intensité",
        description:
          "Écart d'intensité entre le premier et le dernier tiers de la séance. Positif = baisse : indicateur possible de fatigue.",
      },
      guard_drop_over_time: {
        label: "Garde qui baisse",
        description:
          "Différence de hauteur de garde entre le début et la fin de la séance. Positif = mains plus basses à la fin.",
      },
      knee_range: {
        label: "Amplitude des genoux",
        description: "Écart entre flexion et extension les plus marquées (5e à 95e centile).",
      },
      hip_range: {
        label: "Amplitude des hanches",
        description: "Écart entre flexion et extension les plus marquées (5e à 95e centile).",
      },
      shoulder_range: {
        label: "Amplitude des épaules",
        description: "Écart d'élévation des bras (angle hanche-épaule-coude, 5e à 95e centile).",
      },
      knee_valgus: {
        label: "Genou qui rentre (valgus)",
        description:
          "Quand le genou est fléchi, écart du genou vers l'intérieur par rapport à l'axe hanche-cheville, en % de la longueur de jambe (90e centile du côté le plus marqué).",
      },
      trunk_flexion: {
        label: "Flexion du tronc prononcée",
        description:
          "Inclinaison du tronc dans les moments les plus penchés (90e centile). Le dos arrondi lui-même n'est pas mesurable sans points sur la colonne.",
      },
      elbow_lockout: {
        label: "Coude verrouillé en frappe",
        description:
          "Part des mouvements de bras rapides qui finissent coude tendu au-delà de 172°.",
      },
      asymmetry: {
        label: "Asymétrie gauche/droite",
        description:
          "Écart moyen d'amplitude entre côté gauche et côté droit (genoux, hanches, coudes, épaules).",
      },
      stance_level: {
        label: "Niveau de garde",
        description:
          "Hauteur des hanches au-dessus du sol, en longueurs de jambe : plus c'est bas, plus la garde est basse.",
      },
      level_changes: {
        label: "Changements de niveau",
        description: "Nombre de descentes nettes des hanches par minute (entrées de jambes, sprawls).",
      },
      guard_drops: {
        label: "Garde baissée",
        description:
          "Nombre de fois par minute où les mains restent loin du visage plus d'une demi-seconde.",
      },
      guard_recovery: {
        label: "Temps de retour en garde",
        description: "Durée moyenne pendant laquelle la garde reste baissée.",
      },
      strike_rate: {
        label: "Frappes par minute",
        description:
          "Mouvements de poignet au-delà de 3 m/s, comptés une fois chacun. Estimation : un geste rapide n'est pas toujours une frappe.",
      },
      trunk_rotation: {
        label: "Rotation du tronc",
        description:
          "Rotation des épaules par rapport aux hanches, vue de dessus, dans les moments les plus marqués (90e centile).",
      },
      ground_share: {
        label: "Temps au sol",
        description: "Part du temps où l'athlète est au sol ou en position très basse.",
      },
    },
  },
  insights: {
    title: "Recommandations",
    generate: "Rédiger les recommandations",
    regenerate: "Rédiger à nouveau",
    generating: "Rédaction en cours…",
    needsAnalysis: "Lance d'abord l'analyse pour pouvoir rédiger les recommandations.",
    done: (n: number) =>
      n <= 1 ? `${n} recommandation rédigée.` : `${n} recommandations rédigées.`,
    errorGeneric: "La rédaction a échoué. Réessaie dans un instant.",
    errorRefusal: "Le modèle a refusé de rédiger ces retours.",
    errorInvalid:
      "Les retours proposés ne respectaient pas les règles (métriques citées, ton, vocabulaire médical) : rien n'a été enregistré.",
    sourceClaude: (model: string) => `Rédigé par l'IA (${model}) à partir des métriques, sans vidéo ni prénom`,
    sourceRules: "Mode démonstration : texte produit par des règles simples, sans IA (aucune clé API configurée)",
    sourceInsufficient: "Pas assez de mesures fiables pour rédiger des recommandations",
    mockNotice: "Mode démonstration sans IA : retours génériques produits par des règles.",
    insufficient:
      "Pas assez de mesures fiables sur cette séance pour rédiger des recommandations. Filme une séquence plus longue, avec le corps entier dans le cadre.",
    reviewHint: "À relire par le coach avant de transmettre à l'athlète.",
    summary: "En bref",
    strengths: "Points forts",
    improvements: "Axes d'amélioration",
    priority: (n: number) => `Priorité ${n}`,
    exercises: "Exercices proposés",
    exerciseKinds: { technique: "Technique", physique: "Physique", mobilite: "Mobilité" },
    alerts: "Signaux à vérifier",
    alertsHint:
      "Ce ne sont pas des diagnostics : ces points sont à vérifier avec un professionnel de santé (kiné, médecin du sport).",
    weekPlan: "Plan pour la semaine prochaine",
    reliability: "Fiabilité de ces retours",
    basedOn: "S'appuie sur",
    toConfirm: "à confirmer",
  },
} as const;
