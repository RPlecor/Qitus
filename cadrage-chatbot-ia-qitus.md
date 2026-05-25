# QITUS — Chatbot IA Comptable

## Note de cadrage produit & architecture

**Version 1.1 — Mai 2026**

| | |
|---|---|
| **Auteur** | RP / CPO Advisor |
| **Statut** | Draft — Pour validation |
| **Classification** | Confidentiel |
| **Produit** | Qitus SaaS — Module Chat IA |

---

## 1. Synthèse exécutive

**Objectif :** construire un chatbot IA intégré à Qitus capable de répondre de manière autonome à 99%+ des questions utilisateurs, en combinant trois bases de connaissances : les règles comptables françaises (BOFiP, PCG, CGI), les règles métier et UX de Qitus, et le contexte propre à chaque utilisateur (abonnement, exercice, écritures, connecteurs).

**Constat :** un module chat existe déjà dans le codebase (`app/modules/chat/`) avec une architecture saine — `ChatContextBuilder`, `ChatReadOnlyPolicy`, `ChatAnswerGrounding` — mais il fonctionne via Codex CLI sans base de connaissances structurée. Le saut qualitatif nécessite deux évolutions majeures : (1) une architecture en cascade déterministe-first qui résout 50-60% des questions sans appel LLM (cohérente avec la philosophie rules-first de Qitus), et (2) le remplacement du provider Codex CLI par un adaptateur multi-provider sélectionnable (Anthropic, OpenAI, Gemini, Grok, Mistral).

**Risque critique identifié :** l'exercice illégal de l'expertise comptable (ordonnance du 19 septembre 1945, art. 20). Le chatbot doit être cadré comme un outil d'aide à la compréhension, jamais comme un conseil comptable. Ce cadrage conditionne toute l'architecture.

**Principes architecturaux clés :**
- **Cascade déterministe-first :** les règles comptables étant déterministes par nature, le chatbot épuise les réponses hardcodées (FAQ, lookups PCG/TVA, navigation UI) avant tout appel LLM — même logique que le moteur comptable Qitus (code déterministe ~85%, IA ciblée ~15%).
- **Provider LLM agnostique :** le chatbot supporte 5 providers interchangeables, sélectionnables par configuration runtime. Aucun vendor lock-in.
- **Scope du changement provider :** le remplacement Codex CLI concerne **uniquement le chatbot** (`accounting-chat-provider.server.ts`). Le reste de la stack IA Qitus (catégorisation des transactions via Anthropic Haiku 4.5) reste inchangé.

**Recommandation :** phasing en 3 paliers (P0/P1/P2) avec un MVP déployable en 4-6 semaines qui capitalise sur l'existant.

---

## 2. Positionnement stratégique

### 2.1 Pourquoi ce chatbot est critique pour Qitus

La promesse de Qitus est de permettre aux TPE de gérer leur comptabilité sans expertise comptable préalable. Le chatbot n'est pas un nice-to-have support — c'est le mécanisme qui rend cette promesse tenable. Sans lui, chaque question comptable non triviale génère soit un abandon (l'utilisateur ne sait pas quoi faire), soit un ticket support (coût marginal insoutenable en phase de scale).

### 2.2 Positionnement produit

| Dimension | Positionnement |
|---|---|
| **Rôle** | Assistant comptable pédagogique in-app, pas un expert-comptable virtuel |
| **Valeur utilisateur** | Réponse immédiate et contextualisée, zéro attente, zéro jargon incompréhensible |
| **Valeur business** | Réduction du coût support à quasi-zéro + différenciateur concurrentiel majeur |
| **Périmètre** | Expliquer les règles, guider dans l'UI, diagnostiquer les blocages. Jamais décider à la place de l'utilisateur |
| **Conversion prospect** | Phase 2 — version allégée sur landing page pour démontrer la valeur avant inscription |

### 2.3 Impact sur la North Star metric

North Star actuelle : exercices comptables clôturés avec validation EC par mois. Le chatbot agit comme un accélérateur direct : chaque question résolue sans friction rapproche l'utilisateur de la clôture. L'hypothèse est qu'un chatbot efficace réduit le time-to-close de 30-40% en éliminant les points de blocage informationnels.

---

## 3. Cadrage réglementaire — Risque d'exercice illégal

> **Ce chapitre est le plus important du document. Une erreur de cadrage ici expose Qitus à des poursuites pénales.**

### 3.1 Le cadre légal

L'ordonnance du 19 septembre 1945 (art. 2 et art. 20) réserve aux experts-comptables inscrits à l'OEC les travaux de tenue, vérification, appréciation et redressement des comptes. L'exercice illégal est un délit puni par les articles 433-17 et 433-25 du Code pénal.

Cependant, un arrêt récent de la Cour de cassation (septembre 2025) a établi une distinction nette entre l'acte matériel isolé (saisie de données dans un logiciel) et les travaux relevant de l'activité réservée (analyse, interprétation, révision, engagement de responsabilité sur la sincérité des comptes).

### 3.2 Ligne rouge pour le chatbot Qitus

| Le chatbot PEUT ✅ | Le chatbot NE PEUT PAS ❌ |
|---|---|
| Expliquer une règle comptable (PCG, BOFiP) | Dire « vous devez comptabiliser ainsi » |
| Indiquer le compte PCG usuel pour un type d'opération | Valider ou certifier une écriture comptable |
| Expliquer pourquoi un contrôle Qitus est en erreur | Produire un avis fiscal personnalisé |
| Guider vers le bon écran pour résoudre un problème | Exécuter une action comptable (mutation) |
| Citer la source BOFiP/CGI d'une règle | Remplacer le jugement d'un expert-comptable |

### 3.3 Garde-fous techniques obligatoires

1. **Disclaimer systématique :** chaque réponse touchant à une règle comptable doit inclure un rappel que Qitus est un outil d'aide, pas un expert-comptable.
2. **Read-only policy maintenue :** le chatbot ne déclenche AUCUNE action comptable. Le `ChatReadOnlyPolicy` existant est la bonne base.
3. **Traçabilité des sources :** chaque réponse réglementaire doit citer la référence BOFiP/PCG/CGI utilisée.
4. **Escalade humaine :** mécanisme explicite de « je ne sais pas, consultez votre expert-comptable » quand la question dépasse le périmètre.
5. **Conformité IA Act (2026) :** documentation des usages IA, formation utilisateurs, supervision humaine.

---

## 4. État des lieux technique

### 4.1 Ce qui existe déjà

Le module `app/modules/chat/` contient une architecture fonctionnelle avec 5 fichiers :

| Fichier | Rôle | Évaluation |
|---|---|---|
| `accounting-chat-center` | Orchestrateur : conversations, messages, entitlements, activity log | ✅ Solide, réutilisable tel quel |
| `chat-context-builder` | Injecte le contexte utilisateur (dashboard, journal, clôture, documents) | ✅ Bonne base, à enrichir |
| `accounting-chat-provider` | Provider LLM via Codex CLI (spawn process) | ⚠️ À remplacer par Anthropic API |
| `chat-answer-grounding` | Références aux écrans Qitus dans les réponses | ✅ Bon pattern, à étendre |
| `chat-read-only-policy` | Bloque les intentions de mutation via regex | ✅ Critique, à maintenir et renforcer |

### 4.2 Ce qui manque

- **Pipeline RAG :** aucun vector store, aucune base de connaissances structurée.
- **Connaissances comptables :** zéro ingestion BOFiP/PCG/CGI.
- **Documentation produit :** pas de knowledge base Qitus structurée pour le chatbot.
- **Contexte utilisateur étendu :** manquent l'abonnement, les connecteurs bancaires, le profil fiscal détaillé.
- **Provider LLM :** dépendance à Codex CLI (spawn process externe) au lieu d'un appel API direct. Aucune abstraction multi-provider.
- **Résolution déterministe :** aucun catalogue FAQ, aucun lookup structuré — chaque question passe par le LLM même quand la réponse est un fait statique.
- **Métriques :** aucun tracking de résolution, satisfaction, escalade.

---

## 5. Architecture cible

### 5.1 Principe directeur : cascade déterministe-first

L'architecture transpose la philosophie rules-first de Qitus au chatbot. Les règles comptables étant déterministes par nature, le chatbot résout le maximum de questions sans appel LLM, puis escalade vers l'IA uniquement pour les cas ambigus. Chaque niveau de la cascade ne s'active que si le précédent n'a pas résolu la question.

```
Question utilisateur
  → ChatReadOnlyPolicy (filtre mutations)
  → Niveau 0 : Match exact FAQ (0€)
    → Résolu ? → Réponse formatée → FIN
  → Niveau 1 : Fuzzy matching BM25 (0€)
    → Résolu avec confiance > seuil ? → Réponse formatée → FIN
  → Niveau 2 : Embedding similarity (≈0.0001€)
    → Match haute confiance ? → Réponse pré-validée → FIN
  → Niveau 3 : LLM + RAG via provider sélectionné (≈0.001€)
    → Génération avec contexte → FIN
  → Escalade : "Consultez votre expert-comptable"
```

### 5.2 Répartition estimée par niveau

| Niveau | Type de questions | % estimé | Coût | Source de données |
|---|---|---|---|---|
| N0 — FAQ exacte | Taux TVA, comptes PCG, navigation UI, glossaire | ~30-35% | 0€ | `VatRatePolicy`, `vendor-mapping-definitions`, `ui-labels`, `actionable-guidance` |
| N1 — Fuzzy match | Variantes de formulation des mêmes questions | ~20-25% | 0€ | Catalogue Q/R étendu (~500-1000 paires) |
| N2 — Embedding | Questions proches mais non identiques au catalogue | ~15-20% | ~0.0001€ | Embeddings pré-calculés du catalogue |
| N3 — LLM + RAG | Questions complexes, multi-règles, contextuelles | ~20-30% | ~0.001€ | BOFiP + PCG + contexte utilisateur |
| Escalade | Hors périmètre, jugement professionnel | ~5% | 0€ | — |

**Résultat :** 50-60% des questions résolues sans aucun appel LLM, 70-80% si on inclut le niveau embedding.

### 5.3 Couches de connaissances

| Couche | Contenu | Technologie | Fréquence MAJ |
|---|---|---|---|
| 1. Catalogue FAQ déterministe | Paires Q/R validées, lookups PCG/TVA, navigation UI | Code TypeScript + JSON statique | Chaque déploiement |
| 2. Règles comptables FR | BOFiP, PCG 2025, CGI, règles TVA | pgvector + chunking sémantique | Mensuelle (flux BOFiP) |
| 3. Connaissances Qitus | Spec fonctionnelle, aide contextuelle, paramètres, UI labels | pgvector + extraction code | Chaque déploiement |
| 4. Contexte utilisateur | Dashboard, exercice, profil fiscal, abonnement, connecteurs, alertes | Injection directe (ChatContextBuilder) | Temps réel |

### 5.4 Pipeline RAG (Niveau 3 uniquement)

#### 5.4.1 Ingestion (offline)

1. **Récupération des sources :** BOFiP via API Open Data (`data.economie.gouv.fr`), PCG via JSON (`data.gouv.fr`), CGI via Légifrance.
2. **Chunking sémantique :** découpage par article/section avec conservation des métadonnées (référence BOFiP, numéro d'article, date de mise à jour).
3. **Embedding :** modèle configurable (Voyage-3, text-embedding-3-small, ou Mistral Embed selon le provider sélectionné).
4. **Stockage :** extension pgvector sur PostgreSQL existant (pas de service supplémentaire).
5. **Index :** HNSW pour recherche rapide, IVFFlat en fallback.

#### 5.4.2 Requête (temps réel — si N0/N1/N2 n'ont pas résolu)

1. Embedding de la question
2. → Recherche vectorielle top-k (k=5-10) sur les deux bases (comptable + Qitus)
3. → Re-ranking par pertinence (scoring heuristique, cross-encoder en P2)
4. → Construction du prompt : system prompt + chunks RAG + contexte utilisateur + historique conversation
5. → Appel LLM via le provider sélectionné (voir 5.5)
6. → Post-processing : ajout sources, disclaimer, références écrans
7. → Persistance réponse + activity log

### 5.5 Architecture multi-provider LLM

#### 5.5.1 Périmètre

Le remplacement du provider concerne **exclusivement le module chatbot** (`accounting-chat-provider.server.ts`). Le reste de la stack IA Qitus (catégorisation des transactions, enrichissement fournisseur) continue d'utiliser l'Anthropic API via Haiku 4.5 — ce circuit n'est pas impacté.

#### 5.5.2 Providers supportés

| Provider | Modèle principal | Modèle fallback | SDK / Intégration | Coût estimé / msg |
|---|---|---|---|---|
| **Anthropic** | Claude Haiku 4.5 | Claude Sonnet 4 | `@anthropic-ai/sdk` (déjà en dépendance) | ~0.001€ |
| **OpenAI** | GPT-4o-mini | GPT-4o | `openai` | ~0.001€ |
| **Google Gemini** | Gemini 2.0 Flash | Gemini 2.5 Pro | `@google/genai` | ~0.0008€ |
| **Mistral** | Mistral Small | Mistral Large | `@mistralai/mistralai` | ~0.001€ |
| **xAI (Grok)** | Grok-3-mini | Grok-3 | API REST (compatible OpenAI) | ~0.001€ |

#### 5.5.3 Design pattern

```
AccountingChatProvider (interface existante)
  ├── DeterministicChatAdapter      ← N0/N1/N2 (cascade sans LLM)
  ├── AnthropicChatAdapter          ← N3 via Anthropic SDK
  ├── OpenAiChatAdapter             ← N3 via OpenAI SDK
  ├── GeminiChatAdapter             ← N3 via Google GenAI SDK
  ├── MistralChatAdapter            ← N3 via Mistral SDK
  ├── GrokChatAdapter               ← N3 via API OpenAI-compatible
  └── FakeChatAdapter               ← Tests (existant)
```

La sélection du provider se fait via `RuntimeConfig` (variable d'environnement `CHAT_LLM_PROVIDER`). L'interface `AccountingChatProvider` reste inchangée — chaque adapter implémente `reply(messages, context)` et retourne un `AccountingChatReply` uniforme.

#### 5.5.4 Comparatif actuel vs. cible

| | Actuel (Codex CLI) | Cible (Multi-provider) |
|---|---|---|
| **Appel** | spawn process (120s timeout) | HTTP API direct (streaming) |
| **Providers** | OpenAI uniquement (via CLI) | Anthropic, OpenAI, Gemini, Mistral, Grok |
| **Sélection** | Hardcodé | `RuntimeConfig` / env var `CHAT_LLM_PROVIDER` |
| **Coût** | Non maîtrisé (CLI) | ~0.0004€/msg moyen (cascade), ~0.001€/msg (LLM seul) |
| **Latence** | 5-15s (spawn + génération) | 0-50ms (N0/N1), 1-3s (N3 streaming) |
| **Résilience** | Single point of failure | Fallback automatique entre providers |
| **Stack** | Dépendance externe (CLI installée) | SDKs npm standard |

#### 5.5.5 Stratégie de fallback

Si le provider principal est indisponible (timeout, erreur 5xx, quota dépassé), le chatbot :
1. Tente le modèle fallback du même provider (ex: Haiku → Sonnet)
2. Si échec, tente un provider secondaire configuré (env var `CHAT_LLM_FALLBACK_PROVIDER`)
3. Si échec total, les niveaux N0/N1 continuent de fonctionner — dégradation gracieuse, pas de panne complète

---

## 6. Cartographie des sources de connaissances

### 6.1 Sources comptables françaises

| Source | Format | Accès | Volume estimé | Faisabilité |
|---|---|---|---|---|
| BOFiP (doctrine fiscale) | XML/HTML | API Open Data data.economie.gouv.fr | ~50 000 articles | ✅ Haute — API REST, stock mensuel + flux hebdo |
| PCG 2025 (plan comptable) | JSON | data.gouv.fr | ~400 comptes | ✅ Haute — JSON structuré prêt à l'emploi |
| CGI (Code Général des Impôts) | HTML | Légifrance | ~2 000 articles pertinents | 🟡 Moyenne — scraping nécessaire, pas d'API structurée |
| Règles TVA (CA3, CA12) | Formulaires + BOFiP | impots.gouv.fr + BOFiP | ~200 règles | ✅ Haute — déjà modélisé dans Qitus (VatRatePolicy) |
| Règles FEC (norme DGFIP) | PDF/BOFiP | BOFiP BOI-CF-IOR-60-40 | 1 norme + annexes | ✅ Haute — périmètre borné |

### 6.2 Sources Qitus (produit)

| Source | Méthode d'extraction | Volume | Faisabilité |
|---|---|---|---|
| Spec fonctionnelle (`docs/`) | Markdown → chunks directs | ~950 lignes | ✅ Immédiate |
| CONTEXT.md (vocabulaire métier) | Markdown → chunks par concept | ~200 définitions | ✅ Immédiate |
| UI labels (`ui-labels.ts`) | Parse TS → paires clé/valeur | ~300 labels | ✅ Immédiate |
| Product language (`product-language/`) | Markdown/TS → chunks | Variable | ✅ Immédiate |
| Messages d'erreur (`route-errors`) | Parse TS | ~50 erreurs | ✅ Immédiate |
| Paramètres techniques (`runtime-config`) | Parse TS | ~20 params | ✅ Immédiate |
| Règles métier (`accounting-rules/`) | Parse TS + documentation inline | Variable | 🟡 Extraction semi-auto |
| Guide utilisateur (`docs/guide`) | HTML/Markdown | ~500 lignes | ✅ Immédiate |

### 6.3 Contexte utilisateur (temps réel)

Le `ChatContextBuilder` existant injecte déjà 6 dimensions. Il faut en ajouter 4 :

| Dimension | Statut | Source dans le code |
|---|---|---|
| Dashboard (KPIs, alertes) | ✅ Existe | `DashboardOverview` |
| Review comptable (blocages, warnings) | ✅ Existe | `AccountingReviewCenter` |
| OD / ajustements clôture | ✅ Existe | `ClosingAdjustmentCenter` |
| Audit journal (balance, anomalies) | ✅ Existe | `JournalAuditCenter` |
| Fraîcheur documents | ✅ Existe | `DocumentFreshnessCenter` |
| Clôture annuelle | ✅ Existe | `AnnualClosingCenter` |
| **Abonnement (plan, quotas, usage)** | ⚠️ À ajouter | `EntitlementGate` |
| **Connecteurs (Qonto, Stripe, Open Banking)** | ⚠️ À ajouter | `ConnectorProductSurface` |
| **Profil fiscal (régime TVA, IS/IR, seuils)** | ⚠️ À ajouter | `CompanyWorkspace` |
| **Historique imports récents** | ⚠️ À ajouter | `ImportOrchestrator` |

---

## 7. Phasing et roadmap

### 7.1 P0 — MVP Chat cascade + multi-provider (4-6 semaines)

**Objectif : chatbot fonctionnel avec cascade déterministe-first, multi-provider LLM, connaissances Qitus et contexte utilisateur enrichi.**

| Semaine | Livrable |
|---|---|
| S1-S2 | Remplacement provider Codex CLI → architecture multi-provider (`AnthropicChatAdapter` par défaut + `OpenAiChatAdapter` + `GeminiChatAdapter` + `MistralChatAdapter` + `GrokChatAdapter`). Sélection via `RuntimeConfig`. System prompt structuré avec disclaimers. Enrichissement `ChatContextBuilder` (+4 dimensions). |
| S3 | Construction du catalogue FAQ déterministe (~200 paires Q/R) à partir des données structurées existantes (`VatRatePolicy`, `vendor-mapping-definitions`, `ui-labels`, `actionable-guidance`). Implémentation du `DeterministicChatAdapter` (N0 match exact + N1 fuzzy BM25). |
| S4 | Ingestion knowledge base Qitus (spec, CONTEXT.md, UI labels, guide) → pgvector. Pipeline de cascade complet : N0 → N1 → N2 embedding → N3 LLM. Router de cascade avec seuils de confiance. |
| S5-S6 | Tests, ajustement des seuils, enrichissement catalogue à ~500 paires. Métriques par niveau de cascade (% résolu à chaque couche). Déploiement beta. |

**Critère go/no-go P0 → P1 :** le chatbot répond correctement à 80%+ des questions sur l'utilisation de Qitus (test sur 50 questions types), dont au moins 50% résolues sans appel LLM (N0/N1).

### 7.2 P1 — Connaissances comptables FR (6-8 semaines)

**Objectif : le chatbot explique les règles comptables françaises avec sources.**

| Semaine | Livrable |
|---|---|
| S1-S3 | Ingestion BOFiP via API Open Data : téléchargement stock, parsing XML/HTML, chunking par article, embedding, stockage pgvector. Pipeline de mise à jour mensuelle automatisé. |
| S4 | Ingestion PCG 2025 (JSON data.gouv.fr) : intégration plan des comptes avec définitions, règles d'imputation, exemples. |
| S5-S6 | Ingestion CGI (articles pertinents TPE) : scraping ciblé Légifrance, périmètre borné aux articles BIC/BNC/TVA/CFE. |
| S7-S8 | Grounding avancé : chaque réponse comptable cite la source (lien BOFiP, article CGI, compte PCG). Tests sur 100 questions comptables types. Ajustement seuils. |

**Critère go/no-go P1 → P2 :** le chatbot répond correctement à 90%+ des questions comptables TPE avec source citée, et 95%+ des questions Qitus.

### 7.3 P2 — Conversion prospect + optimisation (4-6 semaines)

**Objectif : version landing page + taux de résolution 99%.**

- Version allégée du chatbot sur la landing page (sans contexte utilisateur, avec connaissances comptables + Qitus).
- Conversation de conversion : le chatbot répond aux questions pré-achat et guide vers l'inscription.
- Analyse des conversations échouées (P0+P1) pour enrichir la knowledge base.
- Re-ranking avancé (cross-encoder fine-tuné sur les questions réelles).
- Feedback loop : bouton pouce haut/bas sur chaque réponse → amélioration continue.

---

## 8. Métriques et KPIs

| Métrique | Définition | Cible P0 | Cible P1 | Cible P2 |
|---|---|---|---|---|
| Taux de résolution autonome | % de conversations sans escalade humaine | 80% | 92% | 99% |
| Taux de résolution déterministe | % de réponses résolues sans appel LLM (N0+N1) | 50% | 55% | 65% |
| Satisfaction (thumbs up) | % de réponses notées positivement | 70% | 80% | 90% |
| Taux d'escalade | % de conversations redirigées vers « consultez votre EC » | 20% | 8% | < 1% |
| Latence médiane | Temps entre envoi et début de réponse | < 3s | < 3s | < 2s |
| Coût moyen par message | Coût pondéré (0€ pour N0/N1 + LLM pour N3) | < 0.0005€ | < 0.0004€ | < 0.0003€ |
| Grounding rate | % de réponses avec source citée | 60% | 85% | 95% |
| Conversations / user / mois | Adoption du chatbot | 2 | 5 | 8+ |

---

## 9. Stack technique recommandée

| Composant | Choix | Justification |
|---|---|---|
| **Cascade N0/N1** | TypeScript pur + index JSON | Zéro dépendance externe, zéro coût, temps de réponse < 50ms |
| **Cascade N2** | Embeddings pré-calculés + pgvector | Coût quasi-nul (embedding de la question uniquement) |
| **LLM N3 — défaut** | Anthropic Claude Haiku 4.5 | Déjà dans la stack, coût optimal, suffisant pour Q&A |
| **LLM N3 — alternatives** | OpenAI GPT-4o-mini, Gemini 2.0 Flash, Mistral Small, Grok-3-mini | Sélectionnables via `CHAT_LLM_PROVIDER`, même interface |
| **Fallback LLM** | Modèle supérieur du même provider, puis provider secondaire | Résilience : jamais de panne complète du chat |
| **Embeddings** | Voyage-3 (Anthropic) ou text-embedding-3-small (OpenAI) | Performance/coût, compatible pgvector |
| **Vector store** | pgvector (extension PostgreSQL) | Zéro service supplémentaire, DB existante |
| **Fuzzy search N1** | BM25 local (librairie JS in-memory) | ~500-1000 entrées, tient en mémoire sans problème |
| **Streaming** | SDK natif de chaque provider | UX fluide, réponse progressive |
| **Métriques** | Table PostgreSQL + activity log existant | Tracking par niveau de cascade + par provider |
| **Ingestion BOFiP** | Script Node.js (cron mensuel) | API REST + parsing HTML → chunks |
| **Ingestion Qitus** | Script build-time | Extrait de la codebase à chaque deploy |
| **Catalogue FAQ** | Fichier JSON versionné + script de build | Réponses pré-validées, enrichi par boucle de feedback |

**Points clés :**
- Cette architecture n'ajoute aucun service d'infrastructure. pgvector est une extension PostgreSQL activée sur la base existante.
- Le coût moyen par message est réduit de 60-70% par rapport à une architecture full-LLM grâce à la cascade déterministe.
- En cas d'indisponibilité de tous les providers LLM, les niveaux N0/N1 continuent de répondre — dégradation gracieuse.

---

## 10. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Hallucination sur règle comptable | Moyenne | **Critique** | RAG strict avec seuil de confiance. Si score < seuil → « je ne suis pas sûr, vérifiez avec votre EC ». Disclaimer systématique. |
| Exercice illégal (OEC) | Faible si bien cadré | **Critique** | Cadrage « outil pédagogique », pas de conseil. Validation juridique du wording avant lancement. |
| Coût LLM non maîtrisé | Faible (cascade) | Modéré | Cascade déterministe absorbe 50-60% des questions à 0€. Multi-provider permet de basculer vers le moins cher. Quotas par tier (EntitlementGate existant). |
| BOFiP obsolète (doctrine mise à jour) | Haute | Modéré | Pipeline de mise à jour mensuel automatisé. Flux hebdo BOFiP en complément. |
| Qualité du chunking BOFiP | Moyenne | Modéré | Itération sur la stratégie de découpage. Tests sur questions types. Hybrid search (vecteur + BM25). |
| Adoption faible | Faible | Modéré | Chatbot visible et accessible (widget persistant). Onboarding guidé. Suggestions proactives. |
| Conformité IA Act | Faible | Modéré | Documentation des usages, traçabilité (activity log existant), supervision humaine (read-only). |

---

## 11. Estimation d'effort

| Phase | Durée | Effort dev (j/h) | Coût infra additionnel |
|---|---|---|---|
| P0 — MVP Cascade + multi-provider | 4-6 semaines | 15-20 jours | ~0€ (pgvector sur DB existante) |
| P1 — Connaissances comptables | 6-8 semaines | 20-25 jours | ~3-7€/mois (embedding API, réduit par cascade) |
| P2 — Conversion + optimisation | 4-6 semaines | 10-15 jours | ~5-15€/mois (volume accru, compensé par cascade) |
| **Total** | **14-20 semaines** | **45-60 jours** | **< 20€/mois en régime** |

Ces estimations supposent un développeur unique (RP) travaillant à mi-temps sur le chatbot en parallèle des autres développements Qitus.

---

## 12. Recommandations CPO

**1. Commencer par P0, pas par les règles comptables.** La valeur immédiate est dans l'aide à l'utilisation de Qitus (support produit), pas dans l'encyclopédie comptable. Un chatbot qui répond « où est mon FEC ? » ou « pourquoi mon contrôle TVA est rouge ? » a un impact direct sur la North Star.

**2. Valider le cadrage juridique AVANT le lancement.** Faire relire le wording du disclaimer et le périmètre fonctionnel par un juriste ou l'OEC. Le coût de cette validation (quelques centaines d'euros) est négligeable face au risque pénal.

**3. Migrer le provider immédiatement avec l'abstraction multi-provider.** La dépendance à Codex CLI est un point de fragilité (process spawn, timeout 120s, dépendance d'installation externe). L'abstraction multi-provider (Anthropic, OpenAI, Gemini, Mistral, Grok) élimine le vendor lock-in dès le départ. Anthropic en provider par défaut (SDK déjà en dépendance), les autres via env var. C'est un investissement de 3-5 jours qui paie immédiatement.

**4. Construire le catalogue FAQ déterministe avant le RAG.** Les données structurées existent déjà dans le code (`VatRatePolicy`, `vendor-mapping-definitions`, `ui-labels`, `actionable-guidance`). Les transformer en paires Q/R prend 2-3 jours et absorbe immédiatement 50%+ des questions sans aucun coût LLM. Le RAG vient ensuite pour les 20-30% restants.

**5. Ne pas sur-ingénierer le RAG en P0.** La knowledge base Qitus (spec + CONTEXT.md + labels + guide) tient dans ~2000 chunks. Un pgvector basique avec cosine similarity suffit. Le re-ranking avancé, le hybrid search et le fine-tuning sont des optimisations P2.

**6. Mesurer par niveau de cascade.** Mettre en place le tracking dès P0 : quel % résolu à N0, N1, N2, N3, et quel provider utilisé. Les données réelles guideront le choix du provider par défaut et l'enrichissement du catalogue FAQ.

**7. L'objectif 99% est atteignable mais pas en V1.** 80% en P0 est déjà un résultat excellent pour un MVP. Le passage de 80% à 99% est un travail d'itération continue basé sur l'analyse des conversations échouées. Chaque conversation LLM réussie (thumbs up) est candidate pour intégrer le catalogue déterministe — boucle vertueuse qui réduit les coûts en continu.

---

> **Décision demandée :** Validation du phasing P0/P1/P2 et feu vert pour démarrer P0 (cascade déterministe + multi-provider LLM + knowledge base Qitus + enrichissement contexte).

---

## Sources

- [BOFiP Open Data API](https://data.economie.gouv.fr/explore/dataset/bofip-impots/api/)
- [BOFiP publications en vigueur](https://data.economie.gouv.fr/explore/dataset/bofip-vigueur/api/)
- [PCG JSON sur data.gouv.fr](https://www.data.gouv.fr/datasets/plan-comptable-general)
- [PCG officiel ANC](https://www.anc.gouv.fr/plan-comptable-general-0)
- [Art. 20 Ordonnance 1945 — Légifrance](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000045178543)
- [Arrêt Cour de cassation sept. 2025 — saisie comptable](https://aadprox.com/actualites/expertise-comptable/arret-cour-de-cassation-17-9-2025-saisie-comptable-travailleurs-independants-experts-comptables/)
- [Guide IA générative cabinets EC — FranceNum](https://www.francenum.gouv.fr/guides-et-conseils/intelligence-artificielle/comprendre-et-adopter-lia/ia-generative-pour-les)
- [IA et comptabilité : attention aux conseils fiscaux erronés — DAF-Mag](https://www.daf-mag.fr/reglementation-1243/fiscalite-2115/ia-et-comptabilite-attention-aux-pertes-seches-apres-des-conseils-errones-24334)
- [Travaux Data et IA — OEC](https://www.experts-comptables.fr/travaux-data-et-ia)
