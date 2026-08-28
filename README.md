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

## Synchronisation hors ligne et conflits

L’application est *local-first* : chaque écriture est d’abord enregistrée dans IndexedDB puis répliquée vers l’API par une file d’attente fiable.

- Le voyant de synchronisation dans l’en-tête expose l’état : **Hors ligne** (reprise automatique au retour du réseau), **Synchronisation…**, **X en attente**, **X en erreur**, **X conflit(s)**. Un clic sur le voyant lance une synchronisation manuelle.
- Les enregistrements modifiés hors ligne ne sont jamais écrasés par un tirage serveur (règle *protected record*) : le serveur reste l’autorité pour les écritures, mais une modification locale en attente est toujours conservée puis envoyée.
- Les mutations échouant temporairement sont reprises avec backoff (`2s, 5s, 15s, 30s, 60s, 120s`) ; au-delà elles passent en **erreur** et restent visibles dans la file.
- Un **conflit** survient quand le serveur rejette une mutation (par ex. un changement de statut sur un colis au statut périmé). Le voyant affiche le nombre de conflits et permet de les consulter puis de résoudre : conserver l’état local (ré-envoyer) ou abandonner la mutation. La résolution est toujours manuelle et explicite.
- Les changements de statut d’un colis sont transmis avec le statut attendu (précondition), de sorte que la séquence `Reçu → En route → Arrivé → Livré` reste valide même après plusieurs changements hors ligne.

## Récupération des données

- La base locale (IndexedDB) est la source de vérité pour toutes les écritures non encore synchronisées. Supprimer la base d’un appareil ne supprime pas les données déjà répliquées côté serveur.
- Sauvegardez régulièrement via **Rapports → Exports** : chaque rapport peut être exporté en PDF (impression/imprimante) ou en Excel `.xlsx` (fichier lisible par Excel/LibreOffice).
- Le mode PWA permet d’installer l’application (écran d’accueil du téléphone) ; les colis, paiements et clients restent consultables et saisissables hors réseau.
- En cas de réinstallation, une fois connecté au réseau la file de synchronisation vide revient à l’état du serveur (tirage complet) ; aucun enregistrement en attente n’est perdu si la base n’est pas effacée avant synchronisation.

## Comptes et sécurité

- Les mots de passe doivent contenir au moins **8 caractères** (contrôlé côté client et côté serveur). La réinitialisation passe par un administrateur (non self-service).
- Les sessions reposent sur un cookie `HttpOnly`/`SameSite=Lax` (`Secure` en production) et un JWT signé en `HS256`. La session est rafraîchie automatiquement (toutes les 5 minutes ou au retour en ligne).
- Les paramètres société (nom, adresses, prix de transport par défaut) sont modifiables uniquement par un administrateur ; ils sont synchronisés sur chaque appareil.

## Tests

```bash
npm run test-sync-logic           # coalescence / replanification de la file
npm run test-sync-engine          # moteur de synchronisation intégré
npm run test-reconnect-sync       # reprise après coupure réseau
npm run test-payment-double-submit# verrou anti double-soumission
npm run test-parcel-create-local-first  # création colis local-first
npm run test-parcel-financials    # total / solde / 0-solde ≠ livré / sync offline
npm run test-settings-sync        # paramètres : pull / push / protection locale
npm run test-excel-exports        # round-trip des exports Excel
npm run test-data-api             # CRUD API (nécessite une base)
npm run test-admin-auth           # bootstrap + authentification admin (base requise)
npm run test-tracking-collision   # régénération des numéros en cas de collision
npm run test-payment-idempotency  # idempotence serveur des paiements
npm run test-payment-persistence  # persistance paiement + solde
```
