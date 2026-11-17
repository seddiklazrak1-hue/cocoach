# Combat Coach IA : pitch et posts

## Le pitch en dix lignes

1. Un smartphone sur trépied filme la séance d'entraînement.
2. La pose de chaque athlète est extraite dans le navigateur, sur l'appareil.
3. La vidéo n'est jamais envoyée ni stockée : seules des séries de points articulaires remontent (environ 20 Ko pour 20 secondes).
4. 25 métriques (technique, physique, prévention, par discipline) sont calculées par du code déterministe.
5. Chaque métrique porte sa fiabilité : une mesure peu fiable n'est pas utilisée.
6. Claude rédige les retours à partir des seules métriques ; il ne calcule rien.
7. Chaque conseil affiche les mesures qui le justifient.
8. Le consentement est journalisé et non modifiable ; un mineur n'est pas analysé sans accord parental.
9. La sécurité repose sur la base : Row Level Security, un coach ne voit que ses données.
10. Ce n'est pas un dispositif médical : ce sont des estimations 2D, à confronter au jugement du coach.

## Post LinkedIn 1 : le problème

Un coach de combat ne peut pas regarder vingt-cinq points de technique à la fois, sur chaque athlète, à chaque séance. Les vidéos s'accumulent sur un téléphone et personne ne les revoit.

J'ai construit Combat Coach IA : un smartphone sur trépied, et l'app propose des repères concrets par athlète, à relire avec le coach avant tout envoi.

Ce n'est pas un remplacement du coach. C'est une mémoire de séance.

[Lien du dépôt]

## Post LinkedIn 2 : le choix de ne pas stocker la vidéo

Premier choix non négociable de Combat Coach IA : la vidéo ne quitte jamais l'appareil.

Le navigateur extrait les points articulaires, puis n'envoie que des séries de coordonnées compressées. Une séance de 20 secondes pour un athlète tient en environ 20 Ko.

Les avantages sont concrets : pas de visage stocké, pas de vidéo à sécuriser, et un consentement qui couvre des mesures de mouvement, pas une image.

[Lien du dépôt]

## Post LinkedIn 3 : ce que l'outil ne sait pas faire

Une caméra 2D ne voit pas la profondeur, et le sol cache les membres. Combat Coach IA l'affiche : chaque mesure a une fiabilité de 0 à 1, et les mesures peu fiables ne servent à rien.

Le modèle de langage rédige, il ne calcule pas. Chaque conseil cite les mesures qui le justifient, et un contrôle rejette toute citation d'une mesure qui n'existe pas.

Ce projet est une démonstration pour apprendre, pas un outil médical. Les signaux « à surveiller » renvoient vers un kinésithérapeute ou un médecin du sport.

[Lien du dépôt]
