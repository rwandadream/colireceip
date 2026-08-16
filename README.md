# Groupe-Gaff Colireceip

Application web de gestion logistique et de suivi des colis pour Groupe-Gaff.

## Fonctionnalités

- Gestion des clients, colis, trajets, paiements et dépenses.
- Suivi des statuts et impression de reçus PDF.
- Exports Excel/CSV et tableaux de bord.
- Mode hors ligne avec IndexedDB.
- API sécurisée par session HTTP-only et persistance PostgreSQL/Prisma lorsqu’elle est disponible.

## Installation

```bash
npm install
Copy-Item .env.example .env
```

Renseignez dans `.env` une URL PostgreSQL valide, une clé JWT longue et aléatoire, ainsi que les identifiants du premier administrateur. Ne versionnez jamais ce fichier.

## Initialisation de la base

```bash
npx prisma migrate deploy
npm run bootstrap-admin
```

La création de l’administrateur est idempotente : si un administrateur existe déjà, aucune nouvelle donnée n’est créée.

## Développement et contrôles

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npx prisma validate
```

En développement sans les routes serverless `/api`, l’application continue de fonctionner via IndexedDB. En environnement avec l’API, l’authentification, les clients et la création de colis utilisent PostgreSQL ; les opérations restent disponibles localement lorsque l’API est indisponible.

Les contrôles d’intégration suivants nécessitent une base configurée et peuvent créer puis supprimer des données temporaires :

```bash
npm run test-admin-auth
npm run test-data-api
```
