# Groupe-Gaff Colireceip

Application web de gestion logistique et de suivi des colis pour **Groupe-Gaff**.

## Fonctionnalités

- **Gestion des colis** : Enregistrement, suivi de l'acheminement, mise à jour des statuts (En attente, En route, Arrivé, Livré).
- **Gestion des clients** : Fiches clients, historique de livraison, informations de contact.
- **Gestion des paiements** : Enregistrement des paiements (Espèces, Orange Money, Wave, etc.), suivi des soldes et des restes à encaisser.
- **Impression de reçus** : Génération de reçus professionnels au format PDF (via `jspdf`).
- **Rapports et analyses** : Export des colis et des paiements en formats Excel/CSV, statistiques journalières et globales.
- **Paramètres personnalisables** : Configuration de l'entreprise, des tarifs et trajets par défaut.
- **Fonctionnement hors-ligne** : Mode hors-ligne avec stockage local (`indexedDB`) pour garantir la saisie terrain sans interruption.

## Technologies utilisées

- **Frontend** : React 18, TypeScript, Tailwind CSS, Lucide React.
- **Routing** : React Router DOM.
- **Gestion d'état** : React Context API.
- **Build tool** : Vite.
- **Fonctionnalités PWA** : Service Workers (`vite-plugin-pwa`) pour le fonctionnement hors-ligne.
