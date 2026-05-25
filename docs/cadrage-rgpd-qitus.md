# Cadrage RGPD by design — Qitus

Version : 1.0  
Date : 2026-05-23  
Statut : DRAFT  
Objectif : garantir la conformité RGPD dès la conception, avant ouverture beta.

---

## 1. Qualification juridique de Qitus

### 1.1 Rôle de Qitus au sens du RGPD

Qitus est **responsable de traitement** (article 4.7 RGPD) pour l'ensemble des données personnelles qu'il collecte et traite dans le cadre de son service.

Qitus n'est **pas sous-traitant** de l'expert-comptable. L'EC accède à un dossier préparé via un lien partagé en lecture seule avec revue. Il ne donne pas d'instruction de traitement à Qitus. Si l'EC utilise les données du dossier dans son propre SI, il devient responsable de traitement indépendant pour ses propres traitements.

### 1.2 Sous-traitants de Qitus (article 28)

| Sous-traitant | Fonction | Données concernées | Localisation | Garanties |
|---|---|---|---|---|
| **Clerk** | Authentification, identité | email, nom, clerkId | USA (SOC 2 Type II) | DPA Clerk, SCCs |
| **Render** | Hébergement applicatif pré-beta fermé | Données de test, démo, staging interne | USA/EU (selon plan) | DPA Render si données personnelles réelles traitées |
| **PostgreSQL Render** | Base de données pré-beta fermé | Données de test, démo, staging interne | USA/EU (selon plan) | Chiffrement at rest et backups selon plan |
| **Clever Cloud** | Hébergement applicatif beta ouverte | Toutes (transit + compute) | France / EU | DPA Clever Cloud, localisation France à confirmer contractuellement |
| **PostgreSQL Clever Cloud** | Base de données beta ouverte | Toutes données persistées | France / EU | Chiffrement at rest, backups et rétention à confirmer sur le plan retenu |
| **S3-compatible** | Stockage objets | Pièces justificatives, documents générés | À définir | Chiffrement at rest, DPA provider |
| **Stripe** | Facturation abonnement | email, stripeCustomerId, stripeSubscriptionId | USA (SOC 2) | DPA Stripe, SCCs |
| **Anthropic** | IA — suggestions catégorisation | Libellés de transactions (anonymisables), labels | USA | DPA Anthropic, zero-retention API |
| **OpenAI** | IA — assistant Qitus P0 | Questions utilisateur sur Qitus, contexte dossier réduit, sources Qitus | USA / hors UE possible selon configuration | DPA OpenAI, minimisation, redaction avant envoi |
| **Qonto API** | Connecteur bancaire | Transactions bancaires, IBAN | France/EU | DPA Qonto |
| **Open Banking provider** | Connecteur bancaire | Transactions bancaires, IBAN, identité bancaire | EU | DPA provider, DSP2/PSD2 |

**Décision beta :** Qitus reste sur Render tant que la beta n'est pas ouverte et que l'environnement sert au staging, aux démonstrations et aux tests contrôlés. L'hébergement applicatif et la base PostgreSQL doivent migrer vers Clever Cloud avant ouverture de la beta avec données réelles d'utilisateurs externes, afin de privilégier un hébergement en France. Chaque sous-traitant doit avoir un DPA (Data Processing Agreement) signé avant traitement de données réelles. Pour la beta fermée avec données de test uniquement, les DPA Clerk et Render sont prioritaires ; pour la beta ouverte, Clever Cloud devient prioritaire.

**Point d'attention USA :** Clerk, Render, Stripe et Anthropic sont basés aux USA ou peuvent impliquer des transferts hors UE selon la configuration. Depuis l'invalidation du Privacy Shield (Schrems II, 2020), le transfert vers les USA nécessite des SCCs (Standard Contractual Clauses) et une évaluation d'impact du transfert (TIA). Le EU-US Data Privacy Framework (DPF) adopté en juillet 2023 couvre les entreprises certifiées — vérifier la certification DPF de chaque sous-traitant US. Le passage à Clever Cloud avant beta ouverte réduit le risque de transfert hors UE sur l'hébergement et la base de données, mais ne supprime pas les transferts liés à l'authentification, la facturation ou l'IA.

### 1.3 Focus Clerk — authentification USA

Clerk est utilisable pour la pré-beta et la beta fermée, mais constitue un risque RGPD moyen terme à surveiller car les données d'authentification sont traitées aux États-Unis sans résidence de données EU confirmée pour Qitus.

**Rôle juridique :**

- Pour les données d'authentification des utilisateurs Qitus, Clerk agit principalement comme sous-traitant de Qitus.
- Pour certaines `Account Information` liées à la relation entre Qitus et Clerk, Clerk indique dans son DPA agir comme responsable de traitement indépendant.
- Qitus doit donc documenter Clerk à la fois comme sous-traitant d'authentification et comme destinataire indépendant limité pour les données nécessaires au fonctionnement du service Clerk.

**Données autorisées dans Clerk :**

| Donnée | Autorisée | Commentaire |
|---|---:|---|
| Email utilisateur | Oui | Nécessaire à l'authentification |
| Nom affiché | Oui | Optionnel, à minimiser |
| Identifiant Clerk | Oui | Identifiant technique d'authentification |
| Téléphone / MFA | Oui si activé | Seulement si la fonctionnalité est utilisée |
| Métadonnées de session et sécurité | Oui | Limitées au fonctionnement de l'auth |
| SIREN / SIRET / adresse entreprise | Non | Donnée métier Qitus, ne doit pas être synchronisée dans Clerk |
| IBAN / données bancaires | Non | Donnée financière interdite dans Clerk |
| Transactions / écritures / pièces | Non | Données comptables interdites dans Clerk |
| Statuts comptables ou dossier EC | Non | Données métier interdites dans Clerk metadata |

**Sous-traitants Clerk à documenter :** Qitus doit conserver un export ou lien daté vers la liste officielle des sous-traitants Clerk avant beta ouverte, notamment les services d'hébergement, logs, emails, webhooks, monitoring et paiement utilisés par Clerk.

**Garanties à vérifier avant beta ouverte :**

- DPA Clerk signé ou accepté formellement.
- Certification DPF Clerk vérifiée.
- SCCs incluses comme mécanisme de secours si le DPF est invalidé.
- SOC 2 Type II disponible ou consultable.
- Représentant UE identifié.
- Politique de confidentialité Qitus mentionnant Clerk, les données concernées, la localisation USA et les garanties DPF/SCCs.

**TIA simplifiée Clerk :**

| Critère | Évaluation |
|---|---|
| Nature des données | Identité et authentification, pas de données comptables si la minimisation est respectée |
| Volume beta | Faible à moyen |
| Sensibilité | Moyenne |
| Pays tiers | États-Unis |
| Garanties | DPF, DPA, SCCs, chiffrement, SOC 2 |
| Risque résiduel | Moyen, principalement dépendant de la stabilité du DPF |
| Mesure Qitus | Minimisation stricte, pas de données métier dans Clerk, plan de sortie documenté |

**Risque réglementaire à surveiller :** le DPF a été confirmé par le Tribunal de l'Union européenne en 2025, mais fait l'objet d'un appel devant la CJUE (`C-703/25 P`). Qitus doit surveiller cette procédure. Si le DPF est invalidé et que Clerk ne propose pas de résidence EU ou de garanties jugées suffisantes, Qitus devra déclencher le plan de sortie auth.

**Plan de sortie Clerk :**

| Déclencheur | Action |
|---|---|
| Invalidation du DPF sans solution Clerk EU sous 6 mois | Lancer migration vers une auth hébergée EU |
| Prospect ou client beta bloque explicitement sur auth USA | Évaluer migration avant ouverture plus large |
| Passage production avec exigences fortes EC/compta | Refaire l'analyse auth et arbitrer Clerk vs alternative EU |

**Alternatives à évaluer :**

- Ory self-hosted en EU.
- Supabase Auth en région EU si garanties suffisantes.
- Keycloak / Ory sur Clever Cloud.
- Auth maison minimale email + mot de passe + session si le périmètre reste volontairement réduit.

---

## 2. Cartographie des données personnelles

### 2.1 Données d'identité utilisateur

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `email` | User | Identifiant direct | Moyenne | Contrat (art. 6.1.b) | Durée du contrat + 3 ans |
| `name` | User | Identifiant direct | Moyenne | Contrat | Durée du contrat + 3 ans |
| `clerkId` | User | Identifiant technique | Faible | Contrat | Durée du contrat + 3 ans |
| `deletedAt` | User | Métadonnée privacy | Faible | Obligation légale (art. 6.1.c) | Jusqu'à purge |
| `anonymizedAt` | User | Métadonnée privacy | Faible | Obligation légale | Jusqu'à purge |

### 2.2 Données d'entreprise

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `name` | Company | Identification entreprise | Faible (personne morale) | Contrat | Durée du contrat + obligations légales |
| `siren` / `siret` | Company | Identifiant public | Faible | Contrat | Durée du contrat |
| `nafCode` / `rcs` | Company | Identifiant public | Faible | Contrat | Durée du contrat |
| `addressStreet/Postal/City` | Company | Coordonnées entreprise | Faible à moyenne (EI = domicile) | Contrat | Durée du contrat |
| `managerFirstName/LastName` | Company | Identifiant direct | Moyenne | Contrat | Durée du contrat + 3 ans |
| `managerCivility/Role` | Company | Identifiant indirect | Faible | Contrat | Durée du contrat |
| `hasAccountant` | Company | Information d'organisation | Faible | Contrat + intérêt légitime | Durée du contrat |
| `accountantEmail` | Company | Identifiant direct d'un tiers professionnel | Moyenne | Contrat + intérêt légitime | Durée du contrat + 3 ans |
| `revenueEstimate` | Company | Estimation économique déclarative | Moyenne | Contrat + intérêt légitime | Durée du contrat |

**Point d'attention EI :** pour une entreprise individuelle, l'adresse de l'entreprise peut être le domicile personnel du dirigeant. Dans ce cas, la donnée est de sensibilité élevée (donnée de localisation du domicile).

**Profil de catégorisation :** `hasAccountant`, `accountantEmail` et `revenueEstimate` servent à orienter l'expérience produit et la prudence de catégorisation. Ils ne sont pas envoyés à Clerk. Le tier de catégorisation dérivé est une aide interne Qitus, corrigeable indirectement via le profil entreprise.

### 2.3 Données financières et comptables

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `label` / `normalizedLabel` | Transaction | Libellé bancaire | Moyenne | Contrat | Durée exercice + 10 ans (obligation comptable art. L123-22 C.com) |
| `counterparty` | Transaction | Identifiant tiers | Moyenne | Contrat | Idem |
| `amount` | Transaction | Donnée financière | Élevée | Contrat | Idem |
| `iban` | BankAccount | Identifiant bancaire | Élevée | Contrat | Durée du contrat |
| `notes` | Transaction | Texte libre | Variable (peut contenir des DP) | Contrat | Durée exercice + 10 ans |
| Pièces justificatives (fichiers) | Attachment | Documents (factures, reçus) | Élevée (peut contenir noms, adresses, IBAN tiers) | Contrat + obligation légale | 10 ans (art. L123-22 C.com) |

### 2.4 Données du dossier EC

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `tokenHash` | ShareLink | Identifiant technique | Faible | Contrat | Jusqu'à révocation + 30 jours |
| `reviewerName` | ShareLink, ExpertReviewRun | Identifiant direct (EC) | Moyenne | Intérêt légitime (art. 6.1.f) | Durée du dossier |
| `reviewerEmail` | ExpertReviewRun | Identifiant direct (EC) | Moyenne | Intérêt légitime | Durée du dossier |
| `authorName` / `body` | ExpertReviewComment | Identifiant direct + texte libre | Moyenne | Intérêt légitime | Durée du dossier |

### 2.5 Données de facturation

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `stripeCustomerId` | Subscription | Identifiant technique | Faible | Contrat | Durée du contrat + 3 ans |
| `stripeSubscriptionId` | Subscription | Identifiant technique | Faible | Contrat | Durée du contrat + 3 ans |

### 2.6 Données d'audit et d'activité

| Champ | Modèle Prisma | Catégorie | Sensibilité | Base légale | Durée de conservation |
|---|---|---|---|---|---|
| `userId` | ActivityLog | Identifiant indirect | Faible | Intérêt légitime (traçabilité comptable) | 10 ans (obligation comptable) |
| `action` / `metadata` | ActivityLog | Événement métier | Faible à moyenne | Intérêt légitime | 10 ans |

---

## 3. Bases légales des traitements (article 6)

### 3.1 Registre des traitements (article 30)

| Finalité du traitement | Base légale | Données concernées | Destinataires |
|---|---|---|---|
| Authentification et gestion de compte | Contrat (6.1.b) | email, nom, clerkId | Clerk |
| Tenue comptable (imports, écritures, TVA, rapprochements, clôture) | Contrat (6.1.b) | Transactions, écritures, pièces, documents | Utilisateur, stockage |
| Conservation des écritures comptables | Obligation légale (6.1.c) — art. L123-22 C.com, 10 ans | FEC, journal, pièces | Néant (conservation interne) |
| Conservation des factures | Obligation légale (6.1.c) — art. 289 CGI, 6 ans (TVA) + 10 ans (C.com) | Factures entrantes, pièces | Néant |
| Préparation du dossier EC | Contrat (6.1.b) | Dossier, snapshot, documents | EC via lien partagé |
| Partage du dossier au cabinet | Intérêt légitime (6.1.f) + action utilisateur explicite | Dossier, commentaires EC | EC identifié |
| Catégorisation IA transactionnelle | Intérêt légitime (6.1.f) | Libellés de transactions, contreparties, profil fiscal minimal, tier de catégorisation | Provider IA configuré |
| Assistant Qitus P0 | Intérêt légitime (6.1.f) + contrat (assistance produit) | Question utilisateur, sources d'aide Qitus, résumé dossier redigé | OpenAI si `CHAT_PROVIDER=openai` |
| Facturation de l'abonnement | Contrat (6.1.b) | email, stripeCustomerId | Stripe |
| Audit et traçabilité | Intérêt légitime (6.1.f) | Actions utilisateur, métadonnées | Néant (interne) |
| Notifications et alertes | Contrat (6.1.b) | userId, companyId, événements | Néant (interne) |

### 3.2 Traitements nécessitant une attention particulière

**IA / Anthropic API :** les libellés de transactions envoyés à l'API Anthropic pour suggestion de catégorisation peuvent contenir des données personnelles indirectes (noms de tiers, contreparties). Mesures requises :

- Utiliser le mode zero-retention de l'API Anthropic (pas de stockage côté Anthropic).
- Minimiser les données envoyées : envoyer le `normalizedLabel` plutôt que le `label` brut quand possible.
- Ne pas envoyer l'email, le nom d'utilisateur, le SIREN ni l'IBAN dans les prompts.
- Documenter ce traitement dans la politique de confidentialité.

**Assistant Qitus P0 / OpenAI :** le chat beta répond uniquement aux questions d'utilisation de Qitus. Il ne traite pas les règles comptables générales, ne crée aucune donnée comptable et ne déclenche aucune mutation. Mesures requises :

- Envoyer uniquement des sources Qitus, des statuts, des compteurs et un contexte dossier réduit.
- Ne pas envoyer les pièces justificatives complètes, les payloads bancaires bruts, les secrets, les tokens, les clés API ni les IBAN complets.
- Rediriger les questions hors Qitus vers un refus clair indiquant que les règles comptables générales seront couvertes en V2.
- Tracer l'appel dans l'activité avec provider, modèle, sources utilisées et refus éventuel, sans contenu sensible brut.
- Documenter la TIA simplifiée OpenAI avant beta ouverte si `CHAT_PROVIDER=openai` est activé.

**Dossier EC partagé :** le partage du dossier au cabinet est une action explicite de l'utilisateur (pas automatique). Le lien partagé expire. L'EC accède en lecture seule avec revue. Ce n'est pas un transfert de données au sens RGPD mais un accès contrôlé.

---

## 4. Droits des personnes concernées (articles 15-22)

### 4.1 Matrice des droits

| Droit | Applicable | Implémentation Qitus | Statut |
|---|---|---|---|
| **Accès** (art. 15) | Oui | Export des données utilisateur via API `/api/privacy/export` | À implémenter |
| **Rectification** (art. 16) | Oui | Modification profil, entreprise, exercice via l'UI | Existant (onboarding, profil) |
| **Effacement** (art. 17) | Oui, avec limites | `PrivacyCenter.requestSoftDelete()` + `anonymizeUserData()` + `purgeDeletedData()` | Existant |
| **Limitation** (art. 18) | Oui | Soft-delete (marque `deletedAt`, données conservées mais inaccessibles) | Existant via soft-delete |
| **Portabilité** (art. 20) | Oui | Export FEC (format normé), export pièces, export dossier | Partiellement existant (FEC) |
| **Opposition** (art. 21) | Limité | Non applicable au traitement contractuel. Applicable aux suggestions IA (intérêt légitime). | À implémenter pour l'IA |
| **Non-profilage** (art. 22) | Oui | Aucune décision automatisée avec effet juridique. Les catégorisations IA peuvent être appliquées automatiquement sur des cas courants, mais restent contractuelles, explicables, corrigeables et sans verrouillage utilisateur. | Conforme by design |

### 4.2 Limites à l'effacement

L'effacement complet est limité par les obligations légales de conservation comptable :

- **Art. L123-22 Code de commerce** : les documents comptables doivent être conservés 10 ans.
- **Art. 289 CGI** : les factures doivent être conservées 6 ans (TVA) à 10 ans.
- **Art. L102 B du LPF** : les documents ou pièces comptables doivent être conservés 6 ans à compter de la dernière opération.

**Conséquence :** lorsqu'un utilisateur demande l'effacement, Qitus doit :

1. Anonymiser les données d'identité (email, nom, adresse, SIREN) — **déjà implémenté** dans `PrivacyCenter.anonymizeUserData()`.
2. Conserver les écritures comptables, pièces et documents sous forme anonymisée pendant la durée légale.
3. Supprimer définitivement uniquement après expiration de la durée légale — **implémenté** via `purgeDeletedData()` avec confirmation explicite.

### 4.3 Implémentations manquantes

| Droit | Ce qui manque | Priorité |
|---|---|---|
| Accès / export RGPD | Route `GET /api/privacy/export` qui génère un ZIP contenant : profil utilisateur (JSON), entreprise (JSON), transactions (CSV), écritures (CSV/FEC), pièces (fichiers originaux), activité (CSV). | P0 beta |
| Opposition aux suggestions IA | Flag `aiSuggestionsDisabled` sur Company. Si activé, `AISuggestionAdapter` est court-circuité. | P1 |
| Information (art. 13) | Page `/privacy` ou `/politique-de-confidentialite` accessible sans auth. | P0 beta |
| Consentement cookies | Bandeau cookie si analytics ou tracking. En beta sans analytics → pas nécessaire immédiatement. | P2 |

---

## 5. Privacy by design — principes et implémentation

### 5.1 Minimisation des données (article 5.1.c)

| Principe | Implémentation Qitus |
|---|---|
| Ne collecter que ce qui est nécessaire | Le schéma Prisma ne stocke pas de données non nécessaires au service. SIREN, adresse, manager sont optionnels. |
| Minimiser les données en transit vers les sous-traitants | Anthropic API : envoyer `normalizedLabel` uniquement, pas le contexte utilisateur. Stripe : uniquement email + subscription. |
| Pas de collecte de données sensibles (art. 9) | Qitus ne collecte pas de données de santé, d'origine ethnique, de religion, d'orientation sexuelle, de données biométriques ni de données politiques. |

### 5.2 Pseudonymisation et chiffrement (article 25.1)

| Mesure | Implémentation | Statut |
|---|---|---|
| Chiffrement en transit | HTTPS obligatoire (`COOKIE_SECURE=true`), TLS sur Clever Cloud | Existant |
| Chiffrement au repos (DB) | PostgreSQL Clever Cloud avec chiffrement at rest selon le plan retenu | Vérifier plan |
| Chiffrement au repos (fichiers) | S3-compatible avec SSE (Server-Side Encryption) | À configurer |
| Pseudonymisation des identifiants | `cuid()` comme identifiants internes (pas d'email en clé primaire) | Existant |
| Anonymisation | `PrivacyCenter.anonymizeUserData()` remplace email, nom, SIREN, adresse par des valeurs anonymes | Existant |
| Hachage des tokens | `ShareLink.tokenHash` — le token partagé est haché, pas stocké en clair | Existant |

### 5.3 Séparation des responsabilités

| Principe | Implémentation |
|---|---|
| Isolation des données par entreprise | Toutes les requêtes Prisma sont scopées par `companyId`. Le `CompanyWorkspace` est le contexte d'accès obligatoire. |
| Pas d'accès cross-tenant | Aucune requête ne traverse les entreprises. L'utilisateur ne voit que ses propres données. |
| EC en lecture seule | Le lien partagé donne un accès `READ_ONLY_REVIEW`. L'EC ne peut pas modifier les écritures. |
| Secrets isolés | Les secrets (Clerk, Stripe, Qonto) sont en variables d'environnement, jamais dans la DB métier. Le `PrivacyCenter` ne log pas les secrets. |

### 5.4 Conservation limitée (article 5.1.e)

| Catégorie de données | Durée de conservation | Mécanisme de purge |
|---|---|---|
| Données d'identité (User) | Durée du contrat + 3 ans (prescription) | Anonymisation à la demande, purge après 3 ans |
| Données d'entreprise (Company) | Durée du contrat + obligations légales | Anonymisation à la demande |
| Transactions et écritures | 10 ans (art. L123-22 C.com) | Conservation obligatoire, anonymisation du contexte utilisateur possible |
| Pièces justificatives | 10 ans (art. L123-22 C.com) | Conservation obligatoire en stockage sécurisé |
| FEC et documents comptables | 10 ans | Conservation obligatoire |
| Liens partagés EC | Jusqu'à révocation + 30 jours | Purge automatique des liens expirés |
| ActivityLog | 10 ans (traçabilité comptable) | Conservation obligatoire |
| Notifications | 1 an après résolution | Purge automatique (à implémenter) |
| WebhookEvents | 90 jours | Purge automatique (à implémenter) |
| PrivacyRequests | 5 ans (preuve de conformité) | Conservation obligatoire |

**À implémenter :** un job de purge automatique (`PurgeScheduler`) qui :

- Supprime les `ShareLink` expirés et révoqués depuis > 30 jours.
- Supprime les `Notification` résolues depuis > 1 an.
- Supprime les `WebhookEvent` de plus de 90 jours.
- Ne touche jamais aux données comptables avant 10 ans.

### 5.5 Sécurité (article 32)

| Mesure | Statut | Action |
|---|---|---|
| HTTPS obligatoire | Existant | — |
| Cookies sécurisés (`Secure`, `HttpOnly`, `SameSite`) | Existant (`COOKIE_SECURE=true`) | Vérifier `HttpOnly` et `SameSite=Lax` |
| Webhooks signés (Clerk SVIX) | Existant | — |
| Rate limiting endpoints sensibles | Mentionné dans roadmap beta (Bloc O) | À implémenter |
| Secrets hors DB et hors logs | Existant | Vérifier que `ActivityLog.metadata` ne contient jamais de secrets |
| Mutations bloquées sur exercice clôturé | Existant | — |
| Confirmation explicite pour suppression | Existant (`purgeDeletedData` avec `CONFIRM_PERMANENT_DELETE`) | — |
| Backups réguliers | Plan PostgreSQL Clever Cloud | Vérifier fréquence, rétention et restauration |
| Journalisation des accès | `ActivityLog` | — |

---

## 6. AIPD — Analyse d'impact relative à la protection des données (article 35)

### 6.1 Une AIPD est-elle requise ?

L'AIPD est obligatoire quand le traitement est "susceptible d'engendrer un risque élevé pour les droits et libertés des personnes physiques." La CNIL liste des critères (délibération n° 2018-327) :

| Critère CNIL | Applicable à Qitus ? |
|---|---|
| Évaluation/scoring/profilage | Non — les suggestions IA ne sont pas du profilage au sens RGPD |
| Décision automatisée avec effet juridique | Non — toute écriture est validée par l'utilisateur |
| Surveillance systématique | Non |
| Données sensibles (art. 9) | Non |
| Données à grande échelle | Non en beta. À réévaluer si > 10 000 utilisateurs |
| Croisement de données | Oui, partiellement — croisement banque + pièces + TVA |
| Personnes vulnérables | Non |
| Usage innovant (IA) | Oui — catégorisation IA avec Anthropic |
| Transfert hors UE | Oui en pré-beta Render et pour Clerk, Stripe, Anthropic. Hébergement et base cible beta ouverte : Clever Cloud France |

**Verdict :** 3 critères sur 9 sont remplis (croisement, IA, transfert hors UE). La CNIL considère qu'à partir de 2 critères, l'AIPD est fortement recommandée. **Une AIPD simplifiée est recommandée avant la sortie de beta avec données réelles.**

### 6.2 Contenu recommandé de l'AIPD

1. Description du traitement et de ses finalités (cf. section 3.1).
2. Évaluation de la nécessité et de la proportionnalité (minimisation déjà en place).
3. Évaluation des risques pour les droits des personnes.
4. Mesures envisagées (cf. section 5).

L'AIPD peut être réalisée avec l'outil PIA de la CNIL (gratuit, open source).

---

## 7. Obligations d'information (articles 13-14)

### 7.1 Politique de confidentialité (à publier)

La politique de confidentialité doit être accessible sur `/privacy` ou `/politique-de-confidentialite` sans authentification. Elle doit contenir :

1. Identité et coordonnées du responsable de traitement (Qitus / entité juridique).
2. Coordonnées du DPO (si désigné) ou contact privacy.
3. Finalités et bases légales de chaque traitement (cf. section 3.1).
4. Destinataires des données (sous-traitants, cf. section 1.2).
5. Transferts hors UE et garanties (SCCs, DPF).
6. Durées de conservation (cf. section 5.4).
7. Droits des personnes et modalités d'exercice.
8. Droit de réclamation auprès de la CNIL.
9. Caractère obligatoire ou facultatif des données.
10. Existence de la catégorisation IA et droit d'opposition.

### 7.2 Mentions spécifiques à afficher dans l'UI

| Écran | Mention requise |
|---|---|
| Inscription (`/signup`) | Lien vers la politique de confidentialité. Mention "En créant votre compte, vous acceptez nos CGU et notre politique de confidentialité." |
| Onboarding entreprise | Si données EI (adresse = domicile) : mention "Votre adresse peut être votre domicile. Elle est protégée et n'est jamais partagée sans votre accord." |
| Upload de pièces | "Vos justificatifs sont stockés de manière sécurisée et chiffrée." |
| Partage dossier EC | "Le lien partagé donne un accès en lecture seule à votre dossier comptable. Il expire automatiquement. Vous pouvez le révoquer à tout moment." |
| Catégorisation IA | "Qitus utilise l'IA pour classer certaines transactions. Les cas courants peuvent être appliqués automatiquement selon votre profil, mais restent expliqués, traçables et corrigeables. Les cas sensibles demandent une vérification." |

---

## 8. Notification de violation (articles 33-34)

### 8.1 Procédure de notification

En cas de violation de données personnelles :

1. **Détection :** monitoring des accès anormaux, alertes Clever Cloud, logs d'erreurs.
2. **Évaluation :** qualifier la nature, l'étendue et l'impact de la violation.
3. **Notification CNIL :** dans les 72 heures suivant la prise de connaissance, via le téléservice de la CNIL, si la violation est susceptible d'engendrer un risque pour les droits des personnes.
4. **Notification aux personnes :** si risque élevé, informer les utilisateurs concernés dans les meilleurs délais.
5. **Documentation :** consigner toute violation dans un registre interne, même si non notifiée à la CNIL.

### 8.2 Implémentation technique

| Mesure | Statut |
|---|---|
| Registre des violations (table `SecurityIncident` ou fichier) | À implémenter |
| Template de notification CNIL | À préparer |
| Contact privacy dans la politique de confidentialité | À ajouter |

---

## 9. Checklist compliance by design — avant beta

### P0 — Obligatoire avant ouverture beta avec données réelles

- [ ] Signer les DPA avec Clerk, Render et Clever Cloud selon les environnements utilisés.
- [ ] Vérifier la certification DPF de Clerk, Render, Stripe, Anthropic.
- [ ] Documenter la TIA simplifiée Clerk et archiver la liste des sous-traitants Clerk.
- [ ] Vérifier qu'aucune donnée métier Qitus n'est synchronisée dans Clerk metadata.
- [ ] Migrer la beta ouverte sur Clever Cloud avec hébergement applicatif et PostgreSQL localisés en France.
- [ ] Publier la politique de confidentialité sur `/privacy`.
- [ ] Ajouter le lien vers la politique de confidentialité sur `/signup`.
- [ ] Implémenter `GET /api/privacy/export` (export RGPD complet en ZIP).
- [ ] Vérifier que `ActivityLog.metadata` ne contient jamais de secrets, d'IBAN ni de données bancaires en clair.
- [ ] Vérifier le chiffrement at rest PostgreSQL sur le plan Clever Cloud retenu.
- [ ] Vérifier `HttpOnly` et `SameSite=Lax` sur les cookies de session.
- [ ] Documenter les durées de conservation dans la politique de confidentialité.

### P1 — Fortement recommandé avant beta ouverte

- [ ] Configurer S3-compatible avec SSE pour les pièces et documents.
- [ ] Préparer le plan de sortie Clerk vers une solution auth EU ou self-hosted.
- [ ] Implémenter le flag `aiSuggestionsDisabled` sur Company (droit d'opposition).
- [ ] Implémenter le `PurgeScheduler` (ShareLink expirés, Notifications anciennes, WebhookEvents > 90 jours).
- [ ] Réaliser l'AIPD simplifiée (outil PIA de la CNIL).
- [ ] Ajouter les mentions UI spécifiques (onboarding EI, upload pièces, partage EC, suggestions IA).
- [ ] Vérifier que les appels Anthropic API utilisent le mode zero-retention et n'envoient pas d'identifiants utilisateur.
- [ ] Créer le registre des traitements (article 30) — document formel.

### P2 — Avant production / scale

- [ ] Désigner un DPO ou un contact privacy formel.
- [ ] Préparer le template de notification CNIL.
- [ ] Créer la table `SecurityIncident` pour le registre des violations.
- [ ] Implémenter un bandeau cookie si ajout d'analytics (Google Analytics, Plausible, etc.).
- [ ] Réévaluer la nécessité d'une AIPD complète si > 10 000 utilisateurs.
- [ ] Auditer les logs serveur pour s'assurer qu'aucune donnée personnelle n'y apparaît en clair.
- [ ] Réévaluer l'hébergement uniquement si Qitus quitte Clever Cloud ou ajoute une région hors UE.

---

## 10. Conformité existante — ce qui est déjà en place

| Exigence RGPD | Statut Qitus | Référence code |
|---|---|---|
| Soft-delete (limitation du traitement) | Existant | `PrivacyCenter.requestSoftDelete()` |
| Anonymisation | Existant | `PrivacyCenter.anonymizeUserData()` — email, nom, SIREN, adresse anonymisés |
| Purge définitive avec confirmation | Existant | `PrivacyCenter.purgeDeletedData()` avec `CONFIRM_PERMANENT_DELETE` |
| Historique des demandes privacy | Existant | `PrivacyRequest` (kind, status, requestedAt, processedAt) |
| Audit trail | Existant | `ActivityLog` avec événements `privacy.soft_deleted`, `privacy.anonymized` |
| Isolation par entreprise | Existant | `CompanyWorkspace` scope toutes les requêtes |
| Pas de décision automatisée | Existant | Toutes les écritures validées par l'utilisateur |
| Secrets hors DB | Existant | Variables d'environnement, jamais dans les modèles Prisma métier |
| Token EC haché | Existant | `ShareLink.tokenHash` |
| EC en lecture seule | Existant | `SharePermission.READ_ONLY_REVIEW` |
| Mutations bloquées sur exercice clôturé | Existant | Bloc 1 spec — `RM-ESPACE-02` |

---

## 11. Décisions ouvertes

1. **Entité juridique :** quelle est l'entité juridique responsable de traitement ? (SAS ? Auto-entrepreneur ? À créer ?)
2. **Hébergement EU :** décision beta actée — rester sur Render avant ouverture beta, puis migrer vers Clever Cloud avec hébergement en France avant données réelles externes. À confirmer : région exacte, chiffrement at rest, fréquence des backups et rétention.
3. **DPO :** désigner un DPO (obligatoire si > 5 000 personnes concernées ou traitement à grande échelle) ou un contact privacy ?
4. **Analytics :** si ajout d'analytics, utiliser un outil EU-only (Plausible, Matomo) pour éviter le consentement cookie complexe.
5. **Anthropic zero-retention :** confirmer contractuellement que le mode zero-retention est activé et documenté dans le DPA.
6. **Plan Clever Cloud PostgreSQL :** quel plan pour le chiffrement at rest, les backups, la restauration et la rétention ?
7. **Auth long terme :** garder Clerk après beta ouverte ou migrer vers Ory, Supabase Auth EU, Keycloak/Ory sur Clever Cloud, ou une auth maison minimale ?
