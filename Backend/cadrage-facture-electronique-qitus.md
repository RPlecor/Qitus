# Cadrage CPO — Facture électronique pour Qitus

Date : 2026-05-22  
Auteur : CPO Advisor  
Statut : Cadrage stratégique — décision fondateur requise

---

## Bottom Line

Qitus ne doit **pas** devenir un outil de facturation. Le périmètre actuel — import bancaire → comptabilité → clôture → dossier EC — est cohérent et différenciant. Ajouter un module de création de factures revient à construire un second produit (Pennylane, Tiime, Sellsy, Axonaut font déjà ça) et diluera le focus pré-beta.

En revanche, Qitus **doit** intégrer la réception et le traitement comptable des factures électroniques entrantes, parce que c'est une obligation légale pour tous ses utilisateurs dès le 1er septembre 2026, et parce que les factures fournisseur structurées (Factur-X / UBL / CII) sont une source de données qui alimente directement la boucle de valeur existante.

**Recommandation : build "réception + exploitation comptable", partner "émission".**

---

## 1. Contexte réglementaire

### Calendrier vérifié 🟢

| Date | Obligation | Cible |
|------|-----------|-------|
| **1er sept. 2026** | Réception obligatoire de factures électroniques | **Toutes** les entreprises assujetties TVA |
| **1er sept. 2026** | Émission obligatoire | Grandes entreprises + ETI uniquement |
| **1er sept. 2027** | Émission obligatoire | PME, TPE, micro-entreprises, freelances |

Source : [economie.gouv.fr](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises), [impots.gouv.fr](https://www.impots.gouv.fr/depliant-la-facturation-electronique-en-4-questions)

### Deux obligations distinctes

1. **E-invoicing** : émettre et recevoir des factures au format structuré (Factur-X, UBL ou CII) via une Plateforme Agréée (PA, ex-PDP).
2. **E-reporting** : transmettre à la DGFiP les données de transaction qui échappent à l'e-invoicing (B2C, export, données de paiement pour les prestations de services).

### Infrastructure existante

- **112 Plateformes Agréées** immatriculées par la DGFiP au 26 mars 2026 (SERES/Docaposte, Tiime, Indy, Pennylane, Qonto, etc.)
- **Chorus Pro / PPF** reste la plateforme publique de référence pour le secteur public
- Trois formats socles : **Factur-X** (PDF + XML hybride), **UBL**, **CII**

Sources : [impots.gouv.fr — PA](https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees), [Docaposte — liste PA](https://www.docaposte.com/blog/article/liste-pa)

---

## 2. Position actuelle de Qitus

### Ce que Qitus fait aujourd'hui

```
Import CSV/connecteur → Catégorisation → Écritures → Documents → Contrôle → Clôture → Dossier EC
```

Qitus est un **outil de tenue comptable automatisée**, pas un outil de facturation. Il ne crée pas de factures. Il ne gère pas de devis, bons de commande, avoirs. Son entrée est la transaction bancaire brute ou le connecteur API (Qonto, Stripe).

### Ce que la ROADMAP prévoit

La facturation électronique est classée **Phase 18 — Extensions métier après beta**, aux côtés de l'audit CAC, la simulation de contrôle fiscal et les domaines notaire/syndic. C'est-à-dire : pas avant 6-12 mois minimum.

### Le problème

Le calendrier réglementaire ne s'aligne pas avec la roadmap. Les utilisateurs cible de Qitus (freelances, TPE, micro-entreprises) devront :

- **Recevoir** des factures électroniques dès le **1er sept. 2026** — dans 3,5 mois
- **Émettre** dès le **1er sept. 2027** — dans 15,5 mois

La question n'est pas "faut-il faire de la facture électronique un jour" mais "comment Qitus reste pertinent dans un monde où les factures fournisseur arrivent en Factur-X au lieu d'un PDF dans la boîte mail".

---

## 3. Analyse des options

### Option A — Ne rien faire (rester sur Phase 18)

**Hypothèse** : les utilisateurs gèrent la facturation ailleurs (Pennylane, Tiime, Sellsy) et continuent d'importer leurs transactions bancaires dans Qitus.

**Avantages :**
- Zéro effort supplémentaire
- Focus préservé sur la beta

**Risques :**
- 🔴 **Perte de pertinence** : si le logiciel de facturation de l'utilisateur fait aussi la compta (c'est le cas de Pennylane, Indy, Tiime), pourquoi garder Qitus en plus ?
- 🔴 **Données manquantes** : les factures structurées contiennent le fournisseur, les montants HT/TVA, la date d'échéance — exactement ce que Qitus essaie de deviner par catégorisation IA. Ignorer cette source de données, c'est résoudre un problème déjà résolu.
- 🟡 **Perception marché** : un outil comptable qui ne sait pas traiter les factures électroniques en 2026 envoie un signal de retard technologique.

**Verdict : non viable à moyen terme.** Le problème n'est pas la conformité (l'utilisateur sera conforme via son outil de facturation), c'est la pertinence produit.

### Option B — Construire un module de facturation complet (émission + réception)

**Périmètre** : création de factures, devis, avoirs, numérotation conforme, envoi, suivi des paiements, rappels, connexion PA pour émission et réception, e-reporting.

**Avantages :**
- Qitus devient un outil "tout-en-un"
- Capture complète du flux fournisseur + client

**Risques :**
- 🔴 **Scope massif** : c'est un second produit. Devis → facture → avoir → rappel → e-reporting, c'est 20+ écrans, une connexion PA pour l'émission, la conformité mentions légales, la numérotation séquentielle, etc.
- 🔴 **Marché saturé** : Pennylane, Tiime, Sellsy, Axonaut, Henrri, Freebe, Abby — tous font ça. Qitus n'a aucun avantage différenciant sur la facturation.
- 🔴 **Dilution focus** : la beta n'est pas encore sortie. Construire un module facturation retarde tout le reste de 3-6 mois.
- 🔴 **Devenir PA** : émettre des factures électroniques exige de passer par une PA (ou d'en devenir une). Le processus d'immatriculation PA est lourd (audit DGFiP, infrastructure, certification).

**Verdict : non recommandé.** Coût d'opportunité trop élevé pour un solo-fondateur pré-beta. Ce n'est pas le moat de Qitus.

### Option C — Build "réception + exploitation comptable", Partner "émission" ✅

**Périmètre** : Qitus se connecte à une PA tierce via API pour récupérer les factures fournisseur entrantes au format structuré, les exploite pour enrichir automatiquement les transactions et les écritures, et laisse l'émission de factures à l'outil de facturation de l'utilisateur.

**Avantages :**
- 🟢 **Alignement parfait avec le core** : les factures structurées résolvent le problème de catégorisation — fournisseur, montant HT, TVA, compte comptable sont déjà dans le XML. C'est un raccourci vers le 95% de catégorisation déterministe visé en Phase 5.
- 🟢 **Scope maîtrisé** : pas de module de création de factures, pas d'e-reporting côté émission, pas de numérotation, pas de devis.
- 🟢 **Différenciation** : "Qitus exploite vos factures fournisseur pour écrire la comptabilité automatiquement" — aucun concurrent ne le formule ainsi parce qu'ils font tous la facturation eux-mêmes.
- 🟢 **Respect du calendrier** : réception obligatoire dès sept. 2026 = motivation utilisateur immédiate.

**Risques :**
- 🟡 **Dépendance PA tierce** : il faut choisir une ou plusieurs PA avec API ouverte (Chorus Pro API REST est gratuit, certaines PA privées ont des APIs documentées).
- 🟡 **Périmètre e-reporting** : l'e-reporting B2C (encaissements sans facture) pourrait concerner certains utilisateurs Qitus. À cadrer.

**Verdict : recommandé.** C'est le seul scénario qui renforce le core sans le diluer.

---

## 4. Cadrage fonctionnel — Option C détaillée

### 4.1 Périmètre P0 (avant beta ou sprint suivant)

**Objectif** : permettre à un utilisateur Qitus de recevoir et exploiter les factures fournisseur structurées.

| Fonctionnalité | Description | Effort estimé 🔴 |
|---------------|-------------|-------------------|
| **Parser Factur-X** | Extraire les données structurées (XML) d'un PDF Factur-X uploadé manuellement | Moyen — librairie existante (factur-x-parser npm ou parsing XML direct) |
| **Parser UBL/CII** | Extraire les données d'un fichier XML UBL ou CII | Faible — XML parsing standard |
| **Enrichissement transaction** | Matcher une facture fournisseur parsée avec une transaction bancaire existante (montant + date + fournisseur) | Moyen — logique de rapprochement |
| **Catégorisation automatique** | Utiliser les données structurées (SIRET fournisseur, nature) pour catégoriser sans IA | Faible — extension du moteur existant |
| **Écriture TVA ventilée** | Créer l'écriture avec ventilation HT/TVA directement depuis la facture | Faible — les données sont dans le XML |
| **Rattachement pièce** | Lier la facture parsée comme pièce justificative de l'écriture | Faible — le module pièces existe |
| **UI upload facture** | Extension de la zone d'upload existante (pièces) pour détecter Factur-X | Faible — détection au parsing |

**Ce que ça change pour l'utilisateur** : au lieu d'importer un CSV bancaire puis deviner les catégories, l'utilisateur uploade aussi ses factures fournisseur. Qitus croise automatiquement : transaction bancaire + facture = écriture complète avec TVA ventilée et pièce rattachée. Zéro IA nécessaire.

### 4.2 Périmètre P1 (post-beta, T4 2026)

| Fonctionnalité | Description |
|---------------|-------------|
| **Connecteur PA** | Connexion API à une PA (Chorus Pro en premier — API REST gratuite et documentée) pour récupérer automatiquement les factures entrantes |
| **Polling / webhook** | Récupération périodique des nouvelles factures depuis la PA |
| **Dashboard factures entrantes** | Liste des factures reçues, statut de rapprochement, alertes |
| **Rapprochement automatique** | Matching bancaire + facture sans intervention utilisateur |

### 4.3 Périmètre P2 (2027, si demande marché)

| Fonctionnalité | Description |
|---------------|-------------|
| **E-reporting B2C** | Transmission des données d'encaissement (prestations de services) à la DGFiP via PA — pertinent si Qitus adresse des prestataires de services |
| **Intégration multi-PA** | Support de plusieurs PA (pas seulement Chorus Pro) |
| **Émission via partenaire** | Passerelle vers un outil de facturation partenaire (API Tiime, Pennylane, etc.) — Qitus prépare les données, le partenaire émet |

### 4.4 Hors périmètre (jamais dans Qitus)

- Création de factures client (devis, factures, avoirs)
- Numérotation séquentielle de factures
- Envoi de factures aux clients
- Relance de paiement
- Devenir PA / immatriculation DGFiP

---

## 5. Impact sur la ROADMAP

### Recommandation de séquencement

Le P0 (parsers Factur-X/UBL/CII + enrichissement + catégorisation) peut s'insérer comme une **Phase 8.7** ou une extension de la Phase 9 existante, sans bloquer la beta.

Pourquoi : les parsers sont des modules isolés (entrée = fichier, sortie = données structurées). L'enrichissement s'appuie sur le moteur de catégorisation existant et le module pièces existant. Pas de nouvelle infrastructure.

```
Phase 8.5 (couverture comptable beta) ← en cours
Phase 8.7 (parsers facture structurée + enrichissement)  ← NOUVEAU
Phase 9  (chat + billing)
Phase 10 (infra + observabilité)
[...]
Phase 15 (e-invoicing réception via PA)  ← ramené de Phase 18
```

Le P1 (connecteur PA) peut être ramené de Phase 18 à **Phase 15**, après la stabilisation infra mais avant les extensions métier post-beta.

### Effort estimé P0

Pour un développeur solo :

- Parsers Factur-X/UBL/CII : **2-3 jours** (librairies npm existantes, XML standard)
- Enrichissement transaction : **2-3 jours** (matching montant/date/fournisseur, extension CategorizationEngine)
- Écriture TVA ventilée depuis facture : **1 jour** (les données sont dans le XML, le LedgerWriter existe)
- Rattachement pièce automatique : **1 jour** (le module AttachmentCenter existe)
- UI : **1 jour** (extension upload-zone existante)

**Total P0 : 7-9 jours de développement.**

---

## 6. Analyse concurrentielle

### Positionnement des concurrents directs

| Concurrent | Facturation | Compta | PA | Position e-invoicing |
|-----------|-------------|--------|-----|---------------------|
| **Pennylane** | ✅ Complète | ✅ Complète | ✅ PA intégrée gratuite | Tout-en-un, PA gratuite pour les clients |
| **Indy** | ✅ Complète | ✅ Complète | ✅ Immatriculé PA | Tout-en-un |
| **Tiime** | ✅ Complète | ✅ (via EC) | ✅ PA immatriculée | Tout-en-un, fort sur TPE/freelance |
| **Qitus** | ❌ Pas de facturation | ✅ Automatisée | ❌ Non PA | **Compta pure, exploite les factures des autres** |

### Différenciation Qitus

Tous les concurrents construisent la facturation ET la compta. Qitus fait le choix inverse : la compta pure, alimentée par les données structurées provenant des outils de facturation de l'utilisateur. C'est un choix de focus, pas un manque — à condition de l'assumer dans le positionnement.

**Message produit possible** : "Votre outil de facturation crée les factures. Qitus les exploite pour écrire votre comptabilité automatiquement."

### Analyse du repo romainsimon/paperasse (skills IA comptables)

Le repo [romainsimon/paperasse](https://github.com/romainsimon/paperasse) est une collection open-source (MIT) de skills Markdown pour agents IA, couvrant 4 métiers de la bureaucratie française : comptable, contrôleur fiscal, commissaire aux comptes, notaire. Ce n'est pas un SaaS concurrent — c'est un jeu de prompts structurés pour Claude Code, Cursor, Codex, etc.

**Pertinence pour le cadrage e-invoicing :**

1. **Pas de couverture facture électronique.** Le skill `comptable` couvre le workflow complet (import → catégorisation → journal → clôture → FEC → liasse fiscale) mais ne mentionne ni Factur-X, ni e-invoicing, ni connexion PA. Sa roadmap ne prévoit pas de composant e-invoicing. C'est un angle mort partagé avec l'ensemble de l'écosystème des outils IA comptables open-source.

2. **Même workflow, même gap.** Le skill `comptable` et Qitus partagent exactement le même flux : CSV bancaire → catégorisation (mappage vendor→PCG, 800+ comptes) → écritures double entrée → clôture 12 étapes → FEC → états financiers. La différence : le skill s'exécute dans un agent local via fichiers JSON, Qitus le fait dans un SaaS multi-tenant avec Prisma/PostgreSQL. Mais le gap est le même : sans factures structurées, les deux devinent les catégories à partir de libellés bancaires.

3. **Données réutilisables.** Le repo embarque des données open-source utiles : le Plan Comptable Général complet en JSON (800+ comptes depuis data.gouv.fr), la nomenclature des cases de la liasse fiscale en CSV, et un script de mise à jour des données depuis les APIs publiques. Le PCG JSON pourrait servir de référence de validation pour les mappings Factur-X → PCG.

4. **Intégrations Qonto/Stripe identiques.** Les connecteurs du repo (fetch transactions Qonto via API, fetch charges/payouts Stripe) couvrent exactement les mêmes sources que les connecteurs Qitus. Aucun des deux ne traite les factures entrantes structurées.

**Conclusion de l'analyse croisée :** le repo confirme que le marché des outils IA comptables français (open-source comme SaaS) n'a pas encore intégré la facture électronique. C'est un avantage first-mover pour Qitus : être le premier outil de compta automatisée qui exploite nativement les factures structurées Factur-X/UBL/CII au lieu de deviner les catégories depuis les CSV bancaires.

---

## 7. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| L'utilisateur préfère un tout-en-un (Pennylane) | 🟡 Moyenne | 🔴 Élevé | Positionnement clair : Qitus = compta automatisée pour ceux qui ont déjà un outil de facturation |
| Les PA n'offrent pas d'API ouverte exploitable | 🟡 Moyenne | 🟡 Moyen | Chorus Pro a une API REST documentée et gratuite. Commencer par là |
| Le format Factur-X est mal adopté par les PME | 🟢 Faible | 🟡 Moyen | C'est une obligation légale. L'adoption sera forcée par la réglementation |
| Le rapprochement automatique facture/transaction échoue souvent | 🟡 Moyenne | 🟡 Moyen | Fallback en rapprochement manuel assisté (suggestions), le module pièces le gère déjà |

---

## 8. Décision requise

**Question au fondateur :**

1. **Go/No-Go P0** : intégrer les parsers Factur-X/UBL/CII et l'enrichissement comptable dans la roadmap pré-beta (Phase 8.7) ? Effort estimé : 7-9 jours.

2. **Positionnement assumé** : Qitus ne fera jamais de facturation (création/émission de factures) et l'assume dans son positionnement marché ?

3. **PA cible P1** : commencer par Chorus Pro (gratuit, API REST, secteur public) ou une PA privée avec API (Tiime, Docaposte) ?

---

## Sources

- [economie.gouv.fr — Facturation électronique](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises)
- [impots.gouv.fr — La facturation électronique en 4 questions](https://www.impots.gouv.fr/depliant-la-facturation-electronique-en-4-questions)
- [impots.gouv.fr — Plateformes agréées](https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees)
- [Bpifrance — Facturation électronique 2026 TPE/PME](https://flash.bpifrance.fr/pret-articles-temoignages-tpe-pme/facturation-electronique-2026-tpe-pme-dirigeants)
- [Pennylane — Logiciel facturation électronique](https://www.pennylane.com/fr/logiciel-facturation-electronique)
- [Pennylane — Réforme facturation électronique](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/reforme-facturation-electronique)
- [Docaposte — Liste PA février 2026](https://www.docaposte.com/blog/article/liste-pa)
- [Quadient — Formats facturation électronique](https://www.quadient.com/fr/blog/formats-facturation-electronique-france)
- [Chorus Pro — Plateforme de référence 2026](https://www.impots.gouv.fr/actualite/chorus-pro-restera-la-plateforme-de-reference-pour-la-facturation-electronique-du-secteur)
- [romainsimon/paperasse — Skills IA comptables FR](https://github.com/romainsimon/paperasse)
