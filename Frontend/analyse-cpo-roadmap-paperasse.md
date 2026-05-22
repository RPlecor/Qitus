# Analyse CPO — Roadmap Paperasse SaaS

**Date** : 2026-05-21  
**Contexte** : Fin d'implémentation locale Phases 1→16. Le fondateur demande une lecture stratégique avant passage en beta.  
**Format** : Bottom Line → Diagnostic → Risques → Décisions → GTM → North Star → Actions

---

## Bottom Line

Paperasse a atteint un niveau de couverture fonctionnelle remarquable pour un solo-founder : 16 phases implémentées localement, couvrant 9 des 10 étapes de la chaîne comptable TPE française. Le produit est architecturalement sain — triple couche déterministe/IA/humain, auditabilité intégrée, coûts IA marginaux.

**Mais « implémenté localement » n'est pas « production-ready ».** Le gap entre l'état actuel et le premier utilisateur payant est un gap d'infrastructure, de packaging et de confiance — pas de fonctionnalité. C'est une bonne nouvelle : le risque n'est plus « est-ce que le produit fait le job ? » mais « est-ce que le produit est livrable ? ».

Recommandation : **ne pas ajouter de scope fonctionnel.** Toute l'énergie doit aller vers le chemin le plus court jusqu'au premier utilisateur payant réel.

---

## 1. État du produit — Ce qui est construit

### Couverture de la chaîne comptable TPE

| # | Étape | Statut | Phase |
|---|-------|--------|-------|
| 1 | Collecte bancaire | ✅ Couvert | CSV (P1-3) + Open Banking provider (P16) + Qonto/Stripe (P4) |
| 2 | Catégorisation | ✅ Couvert | Déterministe ~85% + IA résiduelle (P5) |
| 3 | Écritures comptables | ✅ Couvert | Partie double, HT/TVA/TTC (P1 + P8.5) |
| 4 | TVA | ✅ Couvert | Ventilation + déclarations CA3/CA12 brouillon (P8.5 + P12) |
| 5 | Justificatifs | ✅ Couvert | Upload, rattachement, extraction locale (P11) |
| 6 | Rapprochements | ✅ Couvert | Bancaire, Stripe, tiers, comptes d'attente (P13) |
| 7 | Clôture annuelle | ✅ Couvert | 12 étapes, OD généralisées, workpapers (P8 + P14) |
| 8 | Documents comptables | ✅ Couvert | FEC, balance, bilan, CdR, liasse brouillon (P7 + P8.5) |
| 9 | Revue expert-comptable | ✅ Couvert | Dossier collaboratif, demandes/commentaires, signoff (P15) |
| 10 | Télédéclaration EDI | ❌ Non couvert | Hors scope beta (Phase 17+) |

**Score : 9/10.** C'est un score élevé. Le seul manque (télédéclaration) est un sujet d'intégration réglementaire qui ne bloque pas la proposition de valeur core : « automatiser la compta TPE avec revue EC ».

### Profondeur architecturale

Le ROADMAP révèle une profondeur inhabituelle pour un projet solo :

- **Auditabilité** : journal d'audit, preuves, evidence bundles, traçabilité scriptVersion, ActivityLog omniprésent.
- **Fraîcheur** : chaque Module majeur a un *FreshnessCenter* qui détecte les données obsolètes (TVA, rapprochements, OD, snapshots EC).
- **Revue guidée** : des *ReviewWorkflow* dédiés pour justificatifs, TVA, rapprochements, OD, dossier EC.
- **Couverture EC** : un *AccountingCoverageCenter* qui agrège l'état de toutes les briques en un score.
- **Gel systématique** : les phases .5 stabilisent chaque domaine avant de passer au suivant.

C'est un produit conçu comme un cabinet tier-1 conçoit un SI — pas comme une startup fait un MVP. C'est une force (crédibilité EC, auditabilité) mais aussi un risque (time-to-market, complexité de maintenance).

---

## 2. Le gap « implémenté localement → production-ready »

C'est ici que se concentre le travail réel avant la beta. Le ROADMAP lui-même liste les points « à durcir » mais ne les priorise pas. Voici une lecture priorisée.

### Tier 0 — Bloquants pour le premier utilisateur

| Élément | État actuel | Ce qu'il faut |
|---------|------------|---------------|
| **Déploiement Render** | Architecture prévue, pas déployé | Web service + worker + managed DB + Redis |
| **Auth Clerk en prod** | Contexte dev, pas Clerk réel | Clerk live avec webhooks, sessions réelles |
| **Stockage objet S3** | Adapter prêt, `OBJECT_STORAGE_MODE=local` | Scaleway S3 configuré, buckets créés, IAM |
| **Migration Prisma prod** | Migrations locales | Migration sur PostgreSQL managé Render |
| **Provider Open Banking** | Mock/fixture | Contrat signé avec Bridge ou Powens, sandbox puis prod |
| **Billing Stripe live** | Test-mode, `BILLING_MODE=stub` | Stripe live, produits/prix créés, webhook prod |
| **Secrets et sécurité** | Variables locales | Secrets Render/vault, SESSION_SECRET, encryption keys |
| **RGPD minimum** | PrivacyCenter implémenté | CGU/CGV, politique de confidentialité, DPA |
| **Domaine et SSL** | Aucun | Domaine acheté, SSL, DNS |

### Tier 1 — Nécessaires avant premiers beta-testeurs

| Élément | Raison |
|---------|--------|
| Onboarding flow réel | Le premier utilisateur ne connaît pas le produit |
| Emails transactionnels | Confirmation, réinitialisation, notifications critiques |
| Error monitoring | Sentry ou équivalent — sinon les bugs prod seront invisibles |
| Backup DB | Au minimum backup quotidien Render |
| Rate limiting | Protection API minimale |
| Seed de prod | Base de vendors globaux (100-150 mappings) en production |

### Tier 2 — Souhaitables mais non bloquants

| Élément | Raison |
|---------|--------|
| PDF Puppeteer en prod | Image worker Chromium — la source structurée suffit en fallback |
| SSE temps réel | Le polling court suffit pour la beta |
| Multi-company | Un seul exercice par utilisateur suffit au lancement |
| Connecteurs Qonto/Stripe live | Le CSV + Open Banking couvrent le cas général |

---

## 3. Risques — Les signaux à surveiller

### 🔴 Risques critiques

**R1 — Provider IA incohérent avec la stack déclarée.**  
Le ROADMAP mentionne `codex-cli` (Codex local ChatGPT) comme provider IA cible. La stack technique déclarée dans le CLAUDE.md mentionne Anthropic API (Claude). Le MRR model utilise Haiku 4.5. Il y a trois versions différentes du provider IA dans la documentation. Ce n'est pas grave architecturalement (le pattern Adapter isole le provider), mais c'est un point de confusion qui doit être tranché avant déploiement.

**Recommandation** : trancher définitivement Anthropic Haiku 4.5 via API comme provider prod. Mettre à jour le ROADMAP. Supprimer les références à `codex-cli` qui est un outil de dev local, pas un provider SaaS scalable.

**R2 — Aucun utilisateur réel n'a jamais touché le produit.**  
16 phases implémentées sur la base de fixtures et de datasets de test. Zéro feedback utilisateur réel. Le risque classique : le produit résout le problème tel que le fondateur le comprend, pas tel que l'utilisateur le vit.

**Recommandation** : trouver 3-5 beta-testeurs avant de finir le packaging. Même avec un déploiement local/staging. Le feedback sur l'onboarding et l'import vaut plus que n'importe quel calculateur supplémentaire.

**R3 — Complexité de maintenance solo.**  
Le produit a ~30+ Modules/Centers, des phases .5 de gel, des workflows de revue imbriqués, des FreshnessCenters croisés. C'est un système profond. La question : est-ce que le fondateur peut maintenir, débugger et faire évoluer tout ça seul en production ?

**Recommandation** : avant la beta, faire un exercice de « bus factor audit » — quels modules sont les plus fragiles si le fondateur est indisponible 2 semaines ? Documenter les chemins critiques de debugging.

### 🟡 Risques modérés

**R4 — Time-to-revenue étiré.**  
16 phases d'implémentation sans revenu. Le MRR model projette un breakeven rapide (coûts très bas), mais le temps fondateur investi est le vrai coût. Chaque mois sans utilisateur payant est un mois de coût d'opportunité.

**R5 — Open Banking provider — pricing non confirmé.**  
Le MRR model utilise €0.40-0.50/user/mois comme hypothèse Open Banking (proxy Tink). Bridge et Powens n'ont pas de pricing public. Si le coût réel est 2-3x plus élevé, la marge brute du tier Starter (9.90€) se comprime significativement.

**R6 — Dépendance au repo `vendor/paperasse`.**  
Le SaaS appelle les scripts Paperasse via CLI/workdir. La décision « submodule vs fork » n'est pas tranchée. En production, un bug dans un script Paperasse est un bug dans le SaaS. Sans fork versionné, une mise à jour upstream peut casser silencieusement la génération de documents.

**Recommandation** : fork versionné. Un submodule Git pointe vers un commit, mais le workflow de mise à jour est fragile. Un fork dans le repo avec des tags de release donne un contrôle total.

---

## 4. Les 5 décisions restantes — Recommandations

### D1 — Submodule Git vs fork (`vendor/paperasse`)

**Recommandation : fork versionné dans le repo.**  
Raison : contrôle total sur les scripts critiques (FEC, liasse, états financiers). Les mises à jour upstream sont cherry-pickées, pas subies. Le pattern workdir/execFile est déjà en place. Le fork ne change rien au runtime, seulement à la gouvernance du code.

### D2 — SSE vs polling pour statuts d'import

**Recommandation : polling court pour la beta.**  
Raison : SSE ajoute de la complexité serveur (connexions persistantes, gestion de reconnexion, load balancer compatible). Le polling à 2-3 secondes est suffisant pour un import CSV qui prend 5-30 secondes. SSE pourra être ajouté post-beta si le volume le justifie.

### D3 — Scaleway Object Storage vs autre S3

**Recommandation : Scaleway.**  
Raison : datacenter français (conformité données comptables), pricing transparent, compatible S3, l'Adapter est déjà codé pour. Pas de raison de chercher ailleurs sauf si Scaleway pose un problème technique spécifique.

### D4 — Premier provider Open Banking

**Recommandation : Bridge (Bankin') en priorité.**  
Raison : entreprise française, forte couverture des banques FR (SG, BNP, Boursorama, CIC, LCL, Banque Postale — exactement les banques du fondateur), DSP2 agréé via Bankin', documentation en français, intégration Sandbox disponible. Powens en backup si Bridge ne convient pas (pricing, couverture, support).

**Action immédiate** : contacter Bridge pour obtenir un devis et un accès sandbox. Le pricing conditionne la viabilité du tier Starter.

### D5 — Multi-company : quand l'activer ?

**Recommandation : post-beta, Phase 17.**  
Raison : le modèle Prisma le supporte déjà (company liée à user). Mais activer le multi-company avant d'avoir validé le parcours mono-company avec de vrais utilisateurs, c'est de la complexité prématurée. Un comptable avec 2 sociétés peut créer 2 comptes Paperasse en attendant.

---

## 5. Readiness GTM — Ce qui manque pour vendre

| Dimension | État | Action |
|-----------|------|--------|
| **Produit déployé** | ❌ Local uniquement | Déployer sur Render |
| **Landing page** | ✅ LP1 prête (HTML) | Héberger, connecter au domaine |
| **Pricing** | ✅ Modélisé (Scénario B) | Créer les produits Stripe, mettre à jour LP1 |
| **Onboarding** | 🟡 Analysé (benchmark) | Implémenter le flow product-led recommandé |
| **Legal** | ❌ Rien | CGU, CGV, politique de confidentialité, mentions légales |
| **Support** | ❌ Rien | Au minimum un email support@ et un FAQ |
| **Beta-testeurs** | ❌ Aucun | Recruter 3-5 TPE via réseau, forums comptables, Slack |
| **EC partenaire** | ❌ Aucun | Trouver 1 EC qui teste le dossier collaboratif |
| **Domaine** | ❌ Non acheté | Acheter paperasse.app ou paperasse.fr ou équivalent |
| **Analytics** | ❌ Rien | Plausible ou PostHog minimum pour mesurer activation |

---

## 6. North Star Metric — Recommandation

Pour un SaaS comptable TPE, la north star n'est pas le nombre d'inscrits ni le MRR. C'est :

> **Nombre d'exercices comptables clôturés avec validation EC par mois**

Pourquoi :
- C'est l'acte de valeur terminale — le moment où l'utilisateur ET son expert-comptable ont validé que Paperasse fait le job.
- Ça force à mesurer la rétention réelle (un utilisateur qui clôture est un utilisateur qui reste).
- Ça capture la double persona (TPE + EC).
- C'est un proxy de PMF : si les exercices se clôturent avec signoff EC, le produit marche.

**Leading indicators** :
1. Imports réussis par semaine (activation)
2. % de transactions catégorisées automatiquement (valeur déterministe)
3. Dossiers EC partagés par mois (adoption du workflow EC)
4. Temps moyen import → première écriture (time to value)

**Lagging indicators** :
- MRR, churn, NPS

---

## 7. Plan d'action recommandé — Les 30 prochains jours

La séquence ci-dessous est ordonnée par dépendance et impact. Chaque bloc peut prendre 3-7 jours.

### Semaine 1 — Fondations prod

1. Trancher le provider IA → Anthropic Haiku 4.5 API. Mettre à jour le ROADMAP et la config.
2. Fork `vendor/paperasse` avec tag de release.
3. Acheter le domaine.
4. Déployer sur Render : web + worker + PostgreSQL managé + Redis.
5. Configurer Clerk live + webhooks.
6. Première migration Prisma sur DB prod.

### Semaine 2 — Services externes

7. Contacter Bridge pour sandbox + devis Open Banking.
8. Configurer Scaleway S3, buckets, IAM.
9. Créer les produits/prix Stripe live (Starter 9.90€, Pro 24.90€, Business 39€).
10. Configurer Sentry ou équivalent pour error monitoring.
11. Mettre en place backup DB quotidien.

### Semaine 3 — Packaging

12. Implémenter l'onboarding flow réel (basé sur le benchmark Indy product-led).
13. Rédiger CGU/CGV/politique de confidentialité (un template adapté suffit pour la beta).
14. Héberger LP1 sur le domaine.
15. Mettre à jour les pricing placeholders dans LP1 avec Scénario B.
16. Configurer analytics (Plausible ou PostHog).

### Semaine 4 — Beta

17. Recruter 3-5 beta-testeurs TPE (réseau personnel, forums, LinkedIn).
18. Trouver 1 EC partenaire pour tester le dossier collaboratif.
19. Seed de prod : charger les 100-150 vendor mappings globaux.
20. Smoke test end-to-end : inscription → import CSV → catégorisation → écritures → documents → partage EC.
21. Ouvrir la beta.

---

## 8. Ce qu'il ne faut PAS faire maintenant

- **Pas de Phase 17.** Ni audit CAC, ni Factur-X, ni facturation électronique, ni multi-company, ni domaine notaire/syndic. Tout ça est post-PMF.
- **Pas de refactor des scripts Paperasse en modules importables.** Le pattern CLI/workdir marche. Le refactor est un piège de perfectionnisme technique.
- **Pas d'EBICS.** Même en read-only. L'Open Banking via provider couvre le besoin.
- **Pas de nouveaux calculateurs OD.** La Phase 14 couvre déjà FNP, FAE, PCA, stock, provisions, intérêts, paie, TVA, écarts.
- **Pas de portail cabinet multi-client.** Le ShareLink + dossier EC suffit pour la beta.

---

## Verdict

🟢 **Le produit est fonctionnellement prêt pour une beta.** La couverture est profonde, l'architecture est saine, le positionnement coût (€0.02 IA/user vs €0.50-2€ concurrents) est un avantage structurel.

🟡 **Le produit n'est pas opérationnellement prêt.** Zéro infra prod, zéro legal, zéro utilisateur réel, zéro analytics. Le gap est comblable en 4 semaines concentrées.

🔴 **Le risque principal n'est pas technique — il est temporel.** 16 phases sans revenu. Chaque semaine supplémentaire passée à polir le code local plutôt qu'à mettre le produit devant un vrai utilisateur est une semaine de validation de marché perdue.

**Ta décision** : quel jour tu déploies sur Render ?

---

*Analyse produite en posture CPO advisor. Données sourcées du ROADMAP.md (1245 lignes, Phases 1→17), du benchmark fonctionnel v3, du modèle MRR Scénario B et de l'analyse d'onboarding.*
