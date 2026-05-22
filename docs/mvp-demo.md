# Démo MVP locale Qitus

## Pré-requis

- PostgreSQL local avec `DATABASE_URL` pointant vers une base locale dont le nom contient `qitus`.
- Codex CLI installé et connecté au compte ChatGPT/Codex :

```bash
codex --login
```

Le MVP utilise `AI_PROVIDER=codex-cli`. Il ne faut pas ajouter de `OPENAI_API_KEY` pour cette démo.

## Recréer un état propre

```bash
npm run demo:reset
```

Cette commande est destructive pour la démo locale :

- elle supprime le `dev-user` et ses données ;
- elle vide `storage/documents` ;
- elle recrée l'entreprise de démo, l'exercice 2025 et le compte bancaire `5121` ;
- elle importe `fixtures/bank-imports/qonto-export-2025.csv` ;
- elle catégorise les transactions via le provider configuré ;
- elle génère les écritures déterministes.

Le dataset par défaut est `qonto_mvp`, conservé pour les validations MVP. Les datasets de durcissement sont disponibles sans changer le parcours standard :

```bash
npm run demo:reset -- --list-datasets
DEMO_DATASET=multi_bank npm run demo:reset
DEMO_DATASET=regime_reel_tva npm run demo:reset
DEMO_DATASET=closing_beta npm run demo:reset
```

- `multi_bank` charge Qonto, BNP, Société Générale et Boursorama pour durcir les parsers CSV et l'idempotence.
- `regime_reel_tva` charge la SARL commerce au réel simplifié pour tester les écritures avec TVA.
- `closing_beta` ajoute au MVP les immobilisations et le rapprochement bancaire issus de `fixtures/cloture/cloture-context.json`.

État attendu après reset :

| Donnée | Attendu |
| --- | ---: |
| Imports | 1 |
| Transactions | 42 |
| Catégorisations | 42 |
| Transactions à vérifier | 2 |
| Écritures | 40 |
| Lignes d'écritures | 80 |
| Documents | 0 |

## Lancer le MVP

```bash
npm run dev
```

Ouvrir ensuite :

```txt
http://localhost:5173/dashboard
```

En mode `AUTH_MODE=dev`, la page `/demo` permet de charger ces mêmes datasets directement dans Qitus. Elle demande une confirmation car le reset est destructif, puis redirige vers le dashboard.

Parcours manuel recommandé :

```txt
Dashboard
→ Imports
→ Transactions
→ Recherche et filtre À vérifier
→ Correction des transactions à vérifier avec passage automatique à la suivante
→ Apprendre une correction
→ Règles
→ Détail d'une règle et impact
→ Désactiver/Réactiver une règle
→ Dashboard cohérent
→ Écritures
→ Filtrer BQ / OD / compte
→ Vérifier l'audit journal
→ Exporter CSV
→ Contrôle
→ Détail d'un point à revoir
→ Note puis Résoudre/Ignorer
→ OD proposées
→ Ouvrir une OD
→ Modifier les hypothèses
→ Recalculer
→ Valider une OD
→ Écritures
→ Documents
→ Générer FEC
→ Lire l'audit génération
→ Télécharger paquet de preuve
→ Télécharger
→ Générer États financiers
→ Clôture
→ Démarrer la clôture
→ Saisir le rapprochement bancaire
→ Ajouter une immobilisation
→ Exécuter les 12 étapes
→ Générer liasse brouillon et archive
→ Clôturer puis réouvrir si besoin
→ Chat
→ Poser une question en lecture seule sur les blocages
→ Abonnement
→ Vérifier plan, quotas et usage
```

Après reset, la page `Contrôle` est bloquée par les 2 transactions à corriger. Après correction, les documents deviennent générables, avec des avertissements de pré-clôture à revoir : charges annuelles/CCA, immobilisations, rapprochement Stripe, rapprochement bancaire et seuil TVA.

La page `Transactions` est paginée et filtrable. Les filtres restent dans l'URL : on peut partager ou recharger `/transactions?status=review&search=...` sans perdre le contexte. Les filtres utiles pour la démo sont `À vérifier` pour isoler les 2 transactions à corriger et la recherche `stripe` pour retrouver le payout de mars. La page détail affiche la position dans la file de revue, par exemple `1 / 2 à corriger`, et après validation redirige vers la prochaine transaction à corriger. Quand la file est vide, la liste affiche `Aucune transaction à corriger`.

Lors d'une correction, cocher `Apprendre cette correction` crée une règle visible dans `Règles`. Le détail `/corrections/:id` explique son impact : nombre de transactions matchées, exemples et conflits éventuels. La règle peut être désactivée puis réactivée sans supprimer l'historique.

Le dashboard affiche aussi un signal de cohérence opérationnelle. `Exploitation cohérente` signifie que les compteurs dashboard, la liste des transactions, les documents à régénérer, les OD et les règles racontent le même état métier.

La page `Écritures` est paginée et filtrable par journal, source, compte, dates et libellé. Le résumé affiche total débit, total crédit et le badge `Équilibré`. Le bloc d'audit doit indiquer `Journal équilibré` et `Aucune anomalie` quand l'exercice est exportable. `Exporter CSV` télécharge le journal SaaS avec des colonnes stables ; ce n'est pas le FEC officiel, qui reste généré dans `Documents` par les scripts Qitus.

Les points de pré-clôture suivables peuvent être ouverts en détail depuis `Contrôle`. Une note, un statut `Résolu`, `Ignoré` ou `À traiter` sert uniquement au suivi utilisateur : aucune OD et aucune écriture comptable ne sont créées en Phase 4.5.

Depuis la Phase 5.5, certains points fiables produisent aussi une `OD proposée` avec hypothèses explicites. L'utilisateur peut ouvrir la proposition, modifier les hypothèses, cliquer `Recalculer`, vérifier les lignes débit/crédit, puis cliquer `Valider l'OD`. Cette validation crée une vraie écriture journal `OD` source `Clôture`. Une OD validée n'est plus modifiable. La phase ne verrouille pas l'exercice et ne réalise pas une clôture complète.

Depuis la Phase 8, la page `Clôture` ajoute un workflow annuel guidé en 12 étapes. L'utilisateur démarre la clôture, confirme le rapprochement bancaire, suit les immobilisations, exécute les étapes déterministes, génère la liasse fiscale brouillon et l'archive finale, puis clique `Clôturer l'exercice`. Une clôture réussie passe l'exercice en `CLOSED` et bloque les mutations comptables jusqu'à réouverture explicite avec justification.

Depuis la Phase 9, la page `Chat` permet de poser des questions sur le dossier comptable avec le contexte Qitus réel. Le chat est lecture seule : il explique les blocages, OD, documents, clôture et usage, mais ne modifie rien. Depuis la Phase 9.5, les demandes de mutation sont bloquées avant provider par `ChatReadOnlyPolicy`, les réponses portent des références produit, et les conversations peuvent être archivées.

La page `Abonnement` affiche l'abonnement stub local ou Stripe test-mode, les limites du plan, l'usage mensuel chat/imports/catégorisations IA, la limite minute, l'état des droits et les derniers webhooks billing.

Depuis la Phase 10, la page `Notifications` regroupe les alertes produit calculées depuis les Modules métier : transactions à vérifier, imports en erreur, documents à régénérer, blocages de contrôle, TVA, quotas et fraîcheur réglementaire. La page `Exercices` permet de créer un nouvel exercice et d'activer l'exercice courant via cookie local. La section RGPD du `Profil` permet d'exporter les données, d'anonymiser localement ou de demander une suppression en deux temps.

Depuis la Phase 10.5, la page `Couverture EC` montre ce qui est couvert, partiel ou manquant pour un dossier expert-comptable complet. Le parcours recommandé est `Couverture EC → détail → action recommandée`, par exemple ouvrir les justificatifs manquants, aller vers les documents, ou revoir les rapprochements. Cette couverture est un état produit calculé, pas une certification.

Depuis la Phase 11, la page `Pièces` permet d'uploader un justificatif local, de laisser Qitus tenter une extraction légère, puis de rattacher la pièce à une transaction, une écriture ou une OD. Si l'OCR local échoue, la pièce reste exploitable : corrigez les métadonnées à la main et rattachez-la au bon élément comptable.

Depuis la Phase 11.5, le parcours recommandé devient `Couverture EC → Justificatifs → Revue → Upload → Rattachement → Bundle`. La page `/pieces/revue` liste les preuves `À fournir`, `Satisfaites` et `Recommandées`. Uploader une pièce depuis une exigence précise rattache automatiquement la pièce à la bonne transaction/écriture/OD. Depuis `/pieces/:id`, les suggestions de rattachement affichent un score et une raison, puis l'action de rattachement passe aussi par une exigence réelle pour éviter les liens ambigus. Le paquet de preuve JSON inclut les pièces disponibles en base64, leurs hashes, les liens comptables et le résumé des preuves encore manquantes.

Depuis la Phase 12, la page `TVA` affiche la position déclarative par période, taux, nature et comptes `44566`, `44571`, `4452`, `44551`, `44567`. En franchise, le statut est `Non applicable`. Avec le dataset `regime_reel_tva`, Qitus produit des écritures HT/TVA/TTC, expose les contrôles TVA, puis permet de générer un brouillon local CA12/CA3 en Markdown. Le brouillon TVA est inclus dans la couverture EC, la clôture `VAT_REVIEW`, les notifications et le paquet de preuve.

Depuis la Phase 12.5, le parcours régime réel est gelé avec `npm run validate:vat`. La page `/tva/revue` liste les points TVA actionnables : taux manquant, nature manquante ou déclaration obsolète. Régénérer une CA12/CA3 supersède l'ancien brouillon et conserve un seul brouillon actif par période. Les déclarations TVA affichent leur fraîcheur `Active`, `Obsolète` ou `Superseded`.

Depuis la Phase 14, la page `/cloture/od` sert de cockpit pour les OD de clôture généralisées. Les domaines couverts localement sont FNP, FAE, PCA/CCA, stocks, provisions, emprunts, paie, TVA, IS et écarts de rapprochement. Le parcours recommandé est `Clôture → OD de clôture → Workpaper → Générer les propositions → Relire → Valider ou rejeter`. Un workpaper porte les hypothèses et la preuve attendue ; une proposition porte les calculs et les lignes ; seule la validation utilisateur crée une écriture `OD`.

Depuis la Phase 14.5, le parcours recommandé devient `Clôture → OD → Workpaper → Pièce → Validation/Rejet → Bundle`. `/cloture/od` distingue les workpapers, OD à relire, validées, rejetées et pièces manquantes. Une OD qui exige une preuve ne peut pas être validée sans pièce liée ; une OD obsolète doit être recalculée avant validation ; un rejet exige une note et reste visible dans le paquet de preuve.

Depuis la Phase 15, la page `/dossier-ec` assemble le dossier expert-comptable complet : précontrôle FEC, complétude liasse, justificatifs, rapprochements, workpapers, OD, clôture, activité et revue cabinet. Le parcours recommandé est `Dossier EC → Préparer le dossier → Partager au cabinet → /shared/:token → Demande/commentaire → Validation finale → Export dossier`. L'expert-comptable peut commenter et signer, mais ne modifie jamais les écritures, OD, transactions ou documents.

Depuis la Phase 15.5, le parcours recommandé est `Dossier EC → Snapshot → Partage → Demande EC → Réponse → Signoff → Export`. `/dossier-ec` affiche la file readiness, le dernier snapshot, les actions recommandées et la vérification export. `/dossier-ec/snapshots` montre l'historique et les différences avec l'état courant. `/shared/:token` affiche si le snapshot transmis est obsolète. Le dossier exporté contient aussi `exportVerification`.

## Validation automatique locale

Avec le serveur Remix lancé :

```bash
npm run validate:mvp
```

La commande vérifie les pages principales, la cohérence dashboard, la page/API TVA en franchise, l'API transactions enrichie, les filtres, la recherche Stripe, l'audit journal, la génération bloquée avant correction, la résolution d'une issue CCA, la correction des 2 transactions en revue, l'état vide de la file de revue, la création d'une règle de correction, son impact, sa désactivation/réactivation, le recalcul et la validation d'une OD CCA, la génération d'un FEC incluant l'OD, l'audit génération, le paquet de preuve, le téléchargement, puis les trois états financiers.

Pour valider le parcours comme un utilisateur final, repartez d'abord d'un état propre puis lancez le test navigateur :

```bash
npm run demo:reset
npm run dev
npm run validate:end-user
```

`validate:end-user` exécute Playwright en Chromium. Il clique réellement dans l'application : dashboard cohérent, recherche et filtres transactions, correction avec apprentissage, redirection automatique vers la prochaine transaction, état vide de revue, détail d'une règle, désactivation/réactivation, filtres écritures, audit journal, export CSV journal, contrôle pré-clôture, détail CCA avec note et résolution, hypothèses OD, recalcul, validation d'une OD, documents à régénérer, génération du FEC, audit génération, téléchargement du paquet de preuve, téléchargement du `.txt`, génération des états financiers, clôture annuelle guidée, rapprochement bancaire, immobilisation, archive finale, verrouillage/réouverture, notifications, exercice actif, export RGPD et journal d'activité. Le reset exige que Codex CLI soit connecté au compte ChatGPT/Codex avec `codex --login`.

Pour valider spécifiquement chat/billing :

```bash
npm run validate:chat-billing
```

Le script vérifie `/chat`, `/abonnement`, `/api/subscription`, `/api/usage`, `/api/billing/status` et `/api/chat/readiness`. Il n'envoie un message que si le serveur tourne avec `CHAT_PROVIDER=fake`, ou si `LIVE_CHAT_TESTS=1` autorise explicitement un appel live `codex-cli`.

Pour valider spécifiquement le parcours TVA régime réel :

```bash
npm run validate:vat
```

Le script charge `regime_reel_tva`, vérifie `/tva`, génère deux CA12 pour prouver la supersession, télécharge le brouillon Markdown, vérifie `/couverture/vat`, `/cloture/VAT_REVIEW`, le paquet de preuve, puis restaure automatiquement `qonto_mvp`.

Pour valider spécifiquement les rapprochements ligne à ligne :

```bash
npm run validate:reconciliations
```

Le script charge `closing_beta`, ouvre `/rapprochements`, lance le rapprochement bancaire, importe la fixture Stripe, lance le rapprochement Stripe, lance le lettrage tiers, vérifie les comptes d'attente, puis contrôle la fraîcheur, le rapport probant, la revue des issues, `/couverture/reconciliations`, `/cloture/BANK_RECONCILIATION` et `/cloture/THIRD_PARTY_MATCHING`. Il restaure ensuite automatiquement `qonto_mvp`.

Parcours manuel recommandé : `Rapprochements → Revue → Note → Couverture EC → Clôture → Bundle`. Les issues de rapprochement peuvent être résolues, ignorées avec note ou rouvertes ; elles bloquent la clôture lorsqu'elles sont bloquantes, mais ne bloquent pas la génération documentaire MVP.

Pour valider spécifiquement les OD de clôture généralisées :

```bash
npm run validate:closing
npm run validate:closing-end-user
```

`validate:closing` charge `closing_beta`, ouvre `/cloture/od`, vérifie les workpapers, génère les propositions, rattache une décision utilisateur à la FNP, valide l'OD, vérifie l'écriture `OD`, la couverture `/couverture/closing` et l'étape `/cloture/CLOSING_ADJUSTMENTS`, puis restaure automatiquement `qonto_mvp`.

`validate:closing-end-user` vérifie le gel Phase 14.5 : validation bloquée sans pièce, rattachement d'une pièce, validation FNP, rejet motivé d'une provision, visibilité dans `/cloture/od`, `/ecritures`, `/couverture/closing`, `/cloture/CLOSING_ADJUSTMENTS` et `/activity`.

Pour valider spécifiquement le dossier expert-comptable :

```bash
npm run validate:dossier-ec
npm run validate:dossier-ec-end-user
```

La commande charge `closing_beta`, vérifie `/dossier-ec`, génère les documents nécessaires, prépare un snapshot, crée une revue partagée, ajoute une demande expert-comptable, la résout, signe le dossier, vérifie l'export cabinet, puis restaure `qonto_mvp`.

`validate:dossier-ec-end-user` complète le gel navigateur : ouverture de `/dossier-ec`, préparation, partage, création d'une demande depuis le lien cabinet, réponse utilisateur, résolution, signoff, export et vérification de l'activité.

Pour tester un autre port :

```bash
MVP_BASE_URL=http://localhost:3000 npm run validate:mvp
MVP_BASE_URL=http://localhost:3000 npm run validate:end-user
MVP_BASE_URL=http://localhost:3000 npm run validate:chat-billing
```

## Comportement attendu des documents

- Cliquer sur `Générer` dans FEC crée `912345678FEC20251231.txt`.
- Si des transactions restent à corriger, le clic `Générer` retourne un message lisible et signale de passer par `Contrôle`.
- Cliquer à nouveau remplace le FEC précédent pour éviter les doublons.
- Après correction, nouvel import, écriture ou OD validée, un document existant peut afficher `À régénérer`. Cela signifie qu'il est téléchargeable mais ne contient pas encore les dernières écritures.
- La liste des documents affiche aussi `scriptVersion`, `generatedBy`, le nombre d'écritures utilisées et la fraîcheur calculée. Ces informations servent d'audit local de génération.
- Le bloc `Audit génération` indique la dernière tentative connue : succès ou échec, types générés, fichiers produits, durée, `scriptVersion` et message utilisateur.
- `Télécharger paquet de preuve` est disponible après génération du FEC. Il télécharge un manifest JSON local contenant l'identité entreprise/exercice, le résumé d'audit du journal, l'export CSV journal, les documents générés, leurs dates et leurs versions de script.
- Cliquer sur `Générer` dans États financiers crée ou remplace :
  - `balance.md`
  - `bilan.md`
  - `compte-de-resultat.md`
- Les erreurs Qitus doivent apparaître dans la page Documents avec un message lisible, sans page `Application Error`.

## Export CSV, FEC et paquet de preuve

- `Exporter CSV` dans `Écritures` exporte le journal SaaS filtré ou complet pour contrôle local.
- Le FEC officiel est le fichier `.txt` généré par Qitus depuis `Documents`. C'est lui qui porte le format fiscal attendu.
- Le paquet de preuve n'est pas un nouveau document comptable : c'est un manifest d'audit local qui relie FEC, états financiers, export CSV journal, `scriptVersion`, dates de génération et état d'équilibre du journal.

## Clôture annuelle

- `Démarrer la clôture` crée ou reprend un `AnnualClosingRun` pour l'exercice actif.
- Les 12 étapes affichent blocages, avertissements, preuves et action recommandée.
- Le rapprochement bancaire compare le compte `5121` au solde de relevé saisi.
- Le registre `Immobilisations` calcule la dotation linéaire prorata pour la clôture.
- `Liasse fiscale` génère un brouillon `.md`, pas une télétransmission EDI.
- `Export et archivage` génère le FEC si nécessaire et persiste le paquet de preuve final.
- `Clôturer l'exercice` exige les étapes terminées, un journal exportable, des documents frais, un FEC et une preuve finale.
- Un exercice `CLOSED` doit être réouvert avant import, correction, OD ou régénération documentaire.
