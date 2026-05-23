# Roadmap de sortie beta fonctionnelle Qitus

Version : 1.0  
Date : 2026-05-23  
Statut : DRAFT  
Objectif : déployer Qitus rapidement en beta, avec un périmètre clair, testable et cohérent avec ce que le produit affiche.

## 1. Définition de la beta visée

La beta cible n'est pas une production certifiée. C'est une version hébergée, persistante et testable par de vrais comptes utilisateurs, où chaque fonctionnalité visible fonctionne de bout en bout dans son mode annoncé.

Le périmètre beta inclut :

- authentification Qitus via Clerk ;
- onboarding entreprise ;
- imports bancaires CSV ;
- catégorisation et règles comptables ;
- transactions, écritures et exports ;
- TVA en régime franchise ou réel ;
- pièces justificatives ;
- documents comptables et paquet de preuve ;
- rapprochements ;
- clôture et OD validables ;
- dossier expert-comptable ;
- notifications, activité et change impacts ;
- connecteurs visibles Qonto bancaire, Stripe, Open Banking et Qonto PA ;
- banc de test interne pour les flux simulés ;
- facture électronique entrante en mode upload, test interne ou sandbox non conforme PA réelle.

Le périmètre beta n'inclut pas :

- certification fiscale ;
- télétransmission ;
- EBICS ;
- paiement ;
- émission de factures clients ;
- réception PA légalement conforme sans contrat PA réel ;
- Open Banking live garanti sans configuration provider ;
- stockage local éphémère pour de vraies données client ;
- garantie SLA production.

## 2. Décision produit à figer avant déploiement

Avant d'ouvrir la beta, Qitus doit afficher uniquement ce qu'il sait assumer.

### 2.1 Message beta

À afficher dans le discours produit, les docs et éventuellement l'onboarding :

> Qitus est une beta comptable pour centraliser imports, pièces, TVA, clôture, rapprochements et dossier expert-comptable. Les connecteurs et la facture électronique peuvent être testés dans un environnement interne contrôlé. Les écritures restent validées par l'utilisateur.

### 2.2 Positionnement des connecteurs

En mode utilisateur normal :

- `Qonto bancaire` = connecteur produit, configuré ou non configuré.
- `Stripe` = connecteur produit, configuré ou non configuré.
- `Open Banking` = connecteur produit, configuré ou non configuré.
- `Qonto PA` = cible facturation électronique, en attente partenaire tant que le contrat PA n'est pas validé.

En mode test interne uniquement :

- Qitus peut simuler un flux bancaire.
- Qitus peut importer une fixture Stripe.
- Qitus peut simuler une facture entrante.
- Ces données doivent rester explicitement marquées comme non conformes production.

## 3. Bloc A — Déploiement Render stable

### Objectif

Avoir une URL Render utilisable sans intervention locale.

### Étapes restantes

1. Vérifier que le dernier commit GitHub est bien déployé automatiquement par Render.
2. Vérifier que le build Render installe les dépendances nécessaires à Remix.
3. Vérifier que `render.yaml` ne dépend pas de commandes non supportées par le plan Render choisi.
4. Vérifier que les migrations Prisma s'exécutent au démarrage ou dans une étape supportée.
5. Vérifier `/healthz`.
6. Vérifier `/readyz`.
7. Vérifier `/login`.
8. Vérifier `/signup`.
9. Vérifier `/dashboard` après connexion.

### Variables minimales staging

```env
APP_ENV=staging
AUTH_MODE=clerk
BILLING_MODE=stub
OBJECT_STORAGE_MODE=local
CONNECTORS_MODE=disabled
OPEN_BANKING_PROVIDER=disabled
E_INVOICE_PROVIDER=disabled
QITUS_INTERNAL_TEST_MODE=false
COOKIE_SECURE=true
```

### Variables secrètes obligatoires

```env
SESSION_SECRET=<secret-long>
CLERK_PUBLISHABLE_KEY=<clé-clerk>
CLERK_SECRET_KEY=<clé-clerk>
CLERK_WEBHOOK_SECRET=<secret-svix>
```

### Critère de sortie

Un utilisateur peut créer un compte, terminer l'onboarding et accéder au tableau de bord depuis Render.

## 4. Bloc B — Authentification et onboarding Qitus

### Objectif

Un nouvel utilisateur doit pouvoir entrer dans Qitus sans mode dev.

### Étapes restantes

1. Vérifier que `/login` et `/signup` affichent uniquement le branding Qitus.
2. Vérifier qu'aucune mention visible de Clerk n'apparaît sur les pages publiques.
3. Vérifier les URLs Clerk :
   - sign-in URL : `/login` ;
   - sign-up URL : `/signup` ;
   - after sign-in : `/dashboard` ;
   - after sign-up : `/dashboard` ou onboarding selon état utilisateur ;
   - webhook : `/webhooks/clerk`.
4. Tester la création d'un compte neuf.
5. Tester la création automatique de l'utilisateur Qitus si le webhook Clerk arrive en retard.
6. Tester l'onboarding entreprise.
7. Vérifier que le nom réel de l'entreprise apparaît dans le shell.
8. Vérifier la déconnexion.
9. Vérifier que `/demo` est masqué ou refusé hors mode dev.

### Critère de sortie

Un utilisateur inconnu peut s'inscrire, renseigner son entreprise et utiliser Qitus sans intervention admin.

## 5. Bloc C — Persistance et sauvegarde des données

### Objectif

Ne pas perdre les données utilisateur beta.

### Étapes restantes ASAP

1. Utiliser une base PostgreSQL Render persistante.
2. Activer les backups automatiques du plan PostgreSQL.
3. Documenter la fréquence de backup réelle disponible sur le plan choisi.
4. Documenter la procédure de restauration.
5. Tester au moins une restauration sur une base séparée avant ouverture large.

### Étapes fortement recommandées avant vraies données client

1. Passer les pièces et documents en stockage S3-compatible.
2. Configurer deux buckets séparés :
   - documents générés ;
   - pièces et preuves.
3. Activer le versioning ou une politique équivalente côté provider S3.
4. Configurer `OBJECT_STORAGE_MODE=s3`.
5. Renseigner :

```env
S3_ENDPOINT=<endpoint>
S3_REGION=<region>
S3_BUCKET_DOCUMENTS=<bucket-documents>
S3_BUCKET_EVIDENCE=<bucket-evidence>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
```

6. Vérifier `/api/storage/status`.
7. Vérifier `/api/storage/audit`.

### Critère de sortie minimal

La base PostgreSQL est persistante et backupée.

### Critère de sortie robuste

La base est backupée, les fichiers sont en S3-compatible, et un audit stockage ne signale aucun artefact critique manquant.

## 6. Bloc D — Parcours MVP comptable

### Objectif

Le parcours comptable de base doit être fiable avant toute communication beta.

### Étapes restantes

1. Recharger un environnement propre.
2. Importer le CSV MVP.
3. Vérifier le nombre de transactions importées.
4. Vérifier la catégorisation.
5. Vérifier les transactions en revue.
6. Corriger une transaction.
7. Vérifier la création ou mise à jour d'une règle.
8. Vérifier les écritures générées.
9. Vérifier l'export journal.
10. Vérifier l'activité associée.
11. Vérifier les notifications.

### Points de vigilance produit

- Si les règles fournisseurs ne sont pas seedées avant import, les transactions peuvent partir en revue.
- Si le régime TVA change après import, les écritures existantes ne doivent pas être recalculées automatiquement.
- Une action utilisateur claire doit exister pour relancer la catégorisation.
- Une action utilisateur claire doit exister pour supprimer ou réinitialiser les imports de l'exercice.

### Validations

```bash
npm run demo:reset
npm run validate:mvp
npm run validate:end-user
```

### Critère de sortie

Le scénario end-user passe sur une base propre et sur l'URL Render beta.

## 7. Bloc E — Imports, recatégorisation et reset contrôlé

### Objectif

L'utilisateur doit pouvoir réparer un import sans intervention SQL.

### Étapes restantes

1. Vérifier que `/imports` affiche l'historique.
2. Vérifier que `Relancer la catégorisation` apparaît pour un import en revue avec lignes parsées.
3. Vérifier que la relance ne modifie pas les corrections utilisateur.
4. Vérifier que la relance ne crée pas de doublon d'écritures.
5. Vérifier qu'un import peut être supprimé avec confirmation.
6. Vérifier que tous les imports de l'exercice peuvent être réinitialisés avec confirmation forte.
7. Vérifier que les pièces ne sont pas supprimées avec les imports.
8. Vérifier que les documents, TVA, rapprochements et dossier EC sont marqués obsolètes après reset.

### Critère de sortie

Un utilisateur peut repartir de zéro côté imports depuis l'interface, sans support technique.

## 8. Bloc F — TVA

### Objectif

La TVA doit être compréhensible, surtout quand les écritures ne permettent pas encore le calcul.

### Étapes restantes

1. Vérifier le régime franchise.
2. Vérifier le régime réel normal.
3. Vérifier que les libellés techniques comme `REEL_NORMAL` sont traduits en français lisible.
4. Vérifier que `/tva` affiche une alerte si le régime réel est actif sans lignes TVA.
5. Vérifier que la génération CA3/CA12 ne produit pas une fausse impression de validité quand les écritures TVA sont absentes.
6. Vérifier que les brouillons superseded ne polluent pas l'interface principale.
7. Vérifier le téléchargement de déclaration.

### Validation

```bash
npm run validate:vat
```

### Critère de sortie

Un utilisateur comprend pourquoi la TVA est calculée ou pourquoi elle ne peut pas encore l'être.

## 9. Bloc G — Pièces, documents et preuve

### Objectif

Les justificatifs et exports doivent être exploitables sans perte.

### Étapes restantes

1. Uploader une pièce.
2. Rattacher une pièce à une transaction ou écriture.
3. Vérifier les pièces sans écriture.
4. Générer le FEC.
5. Générer les états financiers.
6. Générer le paquet de preuve.
7. Télécharger les fichiers générés.
8. Vérifier que les documents deviennent obsolètes après modification comptable.
9. Vérifier que le bundle signale les artefacts manquants sans `Application Error`.

### Critère de sortie

Un utilisateur peut produire, télécharger et retrouver les preuves du dossier.

## 10. Bloc H — Rapprochements

### Objectif

Les rapprochements doivent être utilisables même si le connecteur bancaire live n'est pas activé.

### Étapes restantes

1. Lancer le rapprochement bancaire.
2. Confirmer un match.
3. Ignorer un match avec note.
4. Relancer après modification.
5. Vérifier la fraîcheur.
6. Vérifier les comptes d'attente.
7. Vérifier le lettrage tiers.
8. Tester le flux Stripe interne si le mode test interne est activé.

### Validation

```bash
npm run validate:reconciliations
```

### Critère de sortie

Un utilisateur peut comprendre ce qui est rapproché, ce qui ne l'est pas, et ce qui bloque la clôture.

## 11. Bloc I — Clôture et OD validables

### Objectif

La clôture doit rester guidée, auditable et sans écriture automatique.

### Étapes restantes

1. Charger le dataset de clôture.
2. Ouvrir `/cloture/od`.
3. Vérifier les workpapers.
4. Générer les propositions OD.
5. Vérifier le blocage si pièce requise manquante.
6. Rattacher une pièce.
7. Valider une OD.
8. Rejeter une OD avec note.
9. Vérifier l'écriture générée.
10. Vérifier la fraîcheur après modification.
11. Vérifier la couverture clôture.

### Validations

```bash
npm run validate:closing
npm run validate:closing-end-user
```

### Critère de sortie

Chaque OD créée par Qitus est relue et validée explicitement par l'utilisateur.

## 12. Bloc J — Dossier expert-comptable

### Objectif

Le dossier EC doit permettre une revue externe sans donner la main sur la comptabilité.

### Étapes restantes

1. Préparer le dossier EC.
2. Créer un snapshot.
3. Créer un lien partagé.
4. Ouvrir le lien partagé.
5. Créer une demande côté expert.
6. Répondre côté utilisateur.
7. Résoudre la demande.
8. Signer le dossier côté expert.
9. Exporter le dossier final.
10. Vérifier que toute modification après snapshot rend le dossier obsolète.

### Validations

```bash
npm run validate:dossier-ec
npm run validate:dossier-ec-end-user
```

### Critère de sortie

Un cabinet peut relire, commenter et signer sans pouvoir modifier les écritures.

## 13. Bloc K — Connecteurs produit et banc de test interne

### Objectif

Les connecteurs doivent être sérieux côté utilisateur et testables côté équipe.

### Étapes restantes côté produit

1. Vérifier que `/connecteurs` n'affiche pas `mock`, `fixture`, `sandbox`, `adapter` ou `generic_pa` en mode normal.
2. Vérifier que les cartes visibles sont :
   - Qonto bancaire ;
   - Stripe ;
   - Open Banking ;
   - Qonto PA.
3. Vérifier que Qonto bancaire et Qonto PA ne partagent pas les mêmes messages ni les mêmes secrets.
4. Vérifier que Qonto PA affiche `PA en attente partenaire` tant que le contrat n'est pas validé.
5. Vérifier que les connecteurs non configurés ont des messages actionnables.

### Étapes restantes côté test interne

1. Activer explicitement :

```env
QITUS_INTERNAL_TEST_MODE=true
```

2. Tester un flux bancaire simulé.
3. Tester un payout Stripe simulé.
4. Tester une facture entrante simulée.
5. Vérifier que les données test ne sont jamais marquées comme conformes production.

### Validations

```bash
npm run validate:connector-product-surface
npm run validate:open-banking
npm run validate:open-banking-end-user
QITUS_INTERNAL_TEST_MODE=true npm run validate:e-invoice-pa-sandbox
```

### Critère de sortie

Un utilisateur voit des connecteurs produits clairs, et l'équipe garde un banc de test manuel sans fuite UX.

## 14. Bloc L — Facture électronique entrante

### Objectif

Qitus doit exploiter les factures entrantes sans prétendre être PA.

### Étapes restantes

1. Vérifier l'upload XML.
2. Vérifier l'upload Factur-X.
3. Vérifier la détection UBL/CII.
4. Vérifier les erreurs lisibles sur XML invalide.
5. Générer un brouillon comptable.
6. Approuver le brouillon.
7. Vérifier l'écriture `E_INVOICE`.
8. Vérifier le lien avec TVA, pièces, couverture et bundle.
9. Vérifier que le provider test ne marque jamais la réception comme conforme PA réelle.
10. Vérifier que Qonto PA reste guarded tant que le contrat API PA n'est pas disponible.

### Validations

```bash
npm run validate:e-invoices
npm run validate:e-invoice-provider-mock
npm run validate:e-invoice-pa-readiness
npm run validate:e-invoice-provider-contract
npm run validate:qonto-pa-readiness
```

### Critère de sortie

Une facture entrante structurée peut être transformée en écriture validée, mais la conformité PA réelle reste explicitement réservée à un futur adapter partenaire.

## 15. Bloc M — Règles comptables et impacts de changement

### Objectif

Qitus doit expliquer quand une donnée dérivée est obsolète.

### Étapes restantes

1. Vérifier les alertes TVA après changement de régime.
2. Vérifier les impacts documents après modification profil ou écritures.
3. Vérifier les impacts FEC.
4. Vérifier les impacts rapprochements.
5. Vérifier les impacts dossier EC après snapshot.
6. Vérifier qu'aucun diagnostic n'est doublonné entre anciennes alertes et ChangeImpactCenter.
7. Vérifier que les mises à jour de règles s'appliquent aux futurs imports sans modifier les anciennes écritures.

### Validation

```bash
npm run validate:accounting-rules-auto-update
```

### Critère de sortie

L'utilisateur sait quoi relancer ou vérifier après un changement, sans que Qitus modifie silencieusement le passé.

## 16. Bloc N — Chat, abonnement et limites

### Objectif

Le chat et le billing doivent être cohérents avec une beta.

### Étapes restantes

1. Vérifier que le mode chat fake fonctionne en local/staging.
2. Vérifier que le chat live n'est activé que si explicitement configuré.
3. Vérifier que le billing reste en stub si Stripe billing n'est pas activé.
4. Vérifier que les limites sont lisibles.
5. Vérifier qu'aucune clé Stripe de billing n'est confondue avec le secret Stripe de rapprochement.

### Validation

```bash
npm run validate:chat-billing
```

### Critère de sortie

Le produit ne bloque pas l'utilisateur beta sur une facturation incomplète.

## 17. Bloc O — Sécurité, confidentialité et conformité beta

### Objectif

Ne pas exposer de secrets ni perdre de données.

### Étapes restantes

1. Vérifier `SESSION_SECRET`.
2. Vérifier `COOKIE_SECURE=true`.
3. Vérifier Clerk en staging.
4. Vérifier les webhooks signés.
5. Vérifier que les secrets ne sortent pas dans :
   - `/connecteurs` ;
   - `/api/system/status` ;
   - `/api/connectors/status` ;
   - logs ;
   - ActivityLog.
6. Vérifier le rate limit sur endpoints sensibles.
7. Vérifier les mutations bloquées sur exercice clôturé.
8. Vérifier l'export RGPD.
9. Vérifier l'anonymisation.
10. Vérifier la suppression douce.

### Validations

```bash
npm run validate:production-config
npm run validate:beta-infra
```

### Critère de sortie

Qitus peut être testé par des utilisateurs beta sans exposition évidente de secrets ni comportement destructif implicite.

## 18. Séquence recommandée pour déployer ASAP

### Jour 0 — Gel du périmètre

1. Déclarer officiellement le périmètre beta.
2. Désactiver les promesses non prêtes :
   - PA réelle conforme ;
   - Open Banking live non configuré ;
   - Stripe live si secret absent ;
   - Qonto live si secret absent.
3. Garder `QITUS_INTERNAL_TEST_MODE=false` sur Render public.

### Jour 1 — Déploiement technique

1. Vérifier Render build.
2. Vérifier Clerk.
3. Vérifier PostgreSQL.
4. Vérifier migrations.
5. Vérifier `/healthz`.
6. Vérifier `/readyz`.
7. Vérifier `/dashboard`.

### Jour 2 — Données et backups

1. Activer backups PostgreSQL.
2. Documenter restore.
3. Décider si S3 est obligatoire avant ouverture.
4. Si oui, configurer S3.
5. Vérifier storage audit.

### Jour 3 — Validation produit

1. Lancer les validations coeur.
2. Corriger tout bloquant.
3. Tester manuellement un compte neuf.
4. Tester un import réel.
5. Tester la suppression/reset d'import.

### Jour 4 — Beta contrôlée

1. Ouvrir à un nombre limité d'utilisateurs.
2. Collecter les erreurs Render.
3. Lire `/activity`.
4. Lire `/notifications`.
5. Vérifier régulièrement `/api/beta-readiness`.

## 19. Suite de validation complète

Avant ouverture beta :

```bash
npm run typecheck
npm test
npm run build
npm run demo:reset
npm run validate:mvp
npm run validate:end-user
npm run validate:vat
npm run validate:reconciliations
npm run validate:closing
npm run validate:closing-end-user
npm run validate:dossier-ec
npm run validate:dossier-ec-end-user
npm run validate:production-config
npm run validate:beta-infra
npm run validate:connector-product-surface
```

Pour le banc de test interne :

```bash
QITUS_INTERNAL_TEST_MODE=true npm run validate:e-invoice-pa-sandbox
npm run validate:open-banking
npm run validate:open-banking-end-user
npm run validate:e-invoices
npm run validate:e-invoice-provider-contract
```

## 20. Go / No-Go beta

### Go

La beta peut être ouverte si :

- Render déploie automatiquement depuis GitHub.
- L'inscription Clerk fonctionne.
- L'onboarding fonctionne.
- La base est persistante.
- Les backups PostgreSQL sont actifs.
- Le parcours MVP passe.
- Le reset import est possible sans SQL.
- Les documents et pièces sont persistants ou explicitement limités à des tests sans données sensibles.
- Les connecteurs test ne sont pas visibles hors mode interne.
- Les secrets ne sortent pas dans les statuts.
- Les erreurs utilisateur sont lisibles.

### No-Go

La beta ne doit pas être ouverte si :

- `/dashboard` est inaccessible après login.
- Les imports nécessitent une intervention base pour être corrigés.
- Les fichiers sont stockés uniquement sur un disque éphémère avec de vraies données utilisateur.
- Les backups ne sont pas connus.
- Clerk affiche encore une expérience non brandée Qitus.
- Les connecteurs test sont visibles comme des connecteurs produit.
- Une génération d'écriture automatique se produit sans validation utilisateur.
- Les secrets apparaissent dans une page, une API ou un log.

## 21. Décisions restantes

1. Le stockage S3 est-il obligatoire avant la première beta fermée ?
2. Quel plan Render PostgreSQL est retenu pour backups et restauration ?
3. Combien d'utilisateurs maximum pour la beta initiale ?
4. Les utilisateurs beta peuvent-ils importer de vraies données bancaires ?
5. Le banc de test interne sera-t-il accessible seulement à l'équipe ou aussi à certains beta testers ?
6. Quelle PA réelle est contractualisée pour la suite facture électronique ?
7. Quelle politique de rétention des pièces et documents est affichée aux utilisateurs ?
8. Quel canal support est promis pendant la beta ?

