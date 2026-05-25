# Gap Analysis — Automatisation de la Catégorisation Qitus

**Auteur :** CPO Advisory  
**Date :** 2026-05-25  
**Statut :** V1  
**Objectif :** Atteindre 95% d'auto-catégorisation pour la beta ouverte, quasi-100% à moyen terme  
**Seuil minimum beta :** 90%  

---

## 1. État des lieux

### Qitus aujourd'hui : ~55-70% (utilisateur neuf), ~75-85% (utilisateur mature)

Le pipeline de catégorisation Qitus exécute trois étapes séquentielles :

1. **Correction Rules** (source utilisateur) — matching substring sur le counterparty. Confiance HIGH, auto-appliqué. Scopé par exercice fiscal (ne traverse pas les exercices).
2. **Vendor Mappings** (33 règles seed) — patterns globaux couvrant SaaS, transport, banque, URSSAF, assurance, etc. Confiance HIGH, auto-appliqué.
3. **IA fallback** (OpenAI gpt-4o-mini) — tout le reste. Confiance variable (HIGH/MEDIUM/LOW).

**Le problème critique :** la `CategorizationTrustPolicy` marque **toutes** les suggestions IA comme `reviewRequired: true`, indépendamment de la confiance. L'IA ne s'auto-applique jamais. Les 30-45% de transactions qui échappent aux règles déterministes tombent systématiquement en `NEEDS_REVIEW`.

**Résultat :** Qitus est un outil de catégorisation semi-automatique, pas automatique. L'utilisateur doit valider manuellement chaque transaction non couverte par une règle — y compris les cas triviaux (facture Orange → télécom) où l'IA a raison à 99%.

### Indy : ~90% (utilisateur neuf), ~95% (utilisateur mature)

🟢 Sources vérifiées : Bleisure, Tool-Advisor, LogicielComptable.net, documentation Indy.

Indy revendique 90% de catégorisation automatique dès la synchronisation bancaire, montant à 95% après quelques mois d'apprentissage. Leur pipeline :

1. **Base de règles sur libellés bancaires** — matching étendu sur une base de patterns large (supérieure aux 33 règles Qitus).
2. **IA apprenante** — mémorise chaque catégorisation manuelle et la rejoue automatiquement. Pas de distinction "correction rule" vs "AI" côté utilisateur.
3. **Suggestions quand incertain** — propose les deux catégories les plus probables. L'utilisateur choisit en un clic.
4. **Détection TVA automatique** — taux et montant.

Indy ne publie aucun taux de précision (accuracy) parmi les transactions effectivement catégorisées. Seul le taux de couverture (% catégorisé automatiquement) est communiqué. Aucun taux d'erreur public.

### Gap Qitus vs Indy

| Dimension | Qitus | Indy | Gap |
|-----------|-------|------|-----|
| Auto-catégorisation (neuf) | 55-70% | ~90% | **-20 à -35 pts** |
| Auto-catégorisation (mature) | 75-85% | ~95% | **-10 à -20 pts** |
| Règles seed | 33 | Non publié (estimé 200+) | Base de patterns insuffisante |
| IA auto-apply | **Jamais** | Oui (implicite) | Bloquant |
| Apprentissage cross-exercice | Non (scopé fiscal year) | Oui | Perte mémoire annuelle |
| Exploitation sourceCategory bancaire | Non | Non confirmé | Opportunité manquée |
| Détection récurrence | Non | Oui (implicite) | Pas de matching temporel |
| TVA auto-détection | Partielle (PCG-based) | Oui (complète) | TVA non fiabilisée |

---

## 2. Cadre fiscal : ce que l'IA peut auto-appliquer sans risque de redressement

### Principe fondamental

🟢 Source : art. 1 LPF, art. 1729 CGI, BOFiP BOI-CF-INF-10-20-20.

Le contribuable est **toujours** personnellement responsable de ses déclarations fiscales. Un logiciel ne se substitue jamais à cette responsabilité. Les CGU de tous les éditeurs (Indy, Pennylane, Comptalib) excluent la responsabilité pour erreurs de catégorisation.

**Mais** : il existe une **présomption de bonne foi** (art. 1729 CGI). L'administration doit prouver le caractère délibéré de l'erreur pour appliquer des majorations (40% pour manquement délibéré, 80% pour fraude). Une erreur involontaire issue d'un logiciel = bonne foi quasi-systématique = pas de majoration, seulement intérêts de retard (0,20%/mois).

**Et** : la loi ESSOC 2018 (art. L.62 LPF) introduit le **droit à l'erreur** : régularisation spontanée avec intérêts réduits à 50%.

### La distinction qui change tout : erreur comptable vs erreur fiscale

| Type d'erreur | Exemple | Impact fiscal | Risque redressement |
|---------------|---------|---------------|---------------------|
| **Erreur comptable pure** (mauvais compte PCG, même traitement fiscal) | 6251 Transport au lieu de 6256 Déplacements | **Nul** — le résultat imposable ne change pas | Observation, pas de rehaussement |
| **Erreur fiscale de déductibilité** | Dépense perso catégorisée en charge pro | **Direct** — fausse déduction, rehaussement | Redressement certain + intérêts |
| **Erreur fiscale de TVA** | Mauvais taux de TVA déductible | **Direct** — montant TVA déclaré erroné | Redressement certain + intérêts |
| **Erreur charge/immobilisation** | Bien >500€ HT passé en charge au lieu d'immobilisation | **Direct** — résultat fiscal faussé | Redressement + étalement amorti |
| **Erreur de prorata pro/perso** | Charge mixte sans quote-part | **Direct** — fausse déduction partielle | Redressement sur la part non déductible |

### Trois zones de risque pour l'auto-catégorisation

**🟢 ZONE VERTE — Auto-application sans risque fiscal**

Conditions cumulatives :
- La catégorisation porte sur un compte PCG dont la **nature fiscale est identique** aux alternatives (tous déductibles, même TVA)
- Le montant est cohérent avec le type de charge
- Le fournisseur est identifié et récurrent
- Pas de composante "perso" possible

Exemples : OVH → 6135, SNCF → 6251, Qonto frais bancaires → 627, URSSAF → 6451, abonnement GitHub → 6135.

**Même si l'IA se trompe de sous-compte** (ex : 6251 au lieu de 6256), l'erreur est purement cosmétique — aucun impact fiscal. C'est exactement ce que fait Indy.

**🟡 ZONE GRISE — Auto-application possible avec garde-fous**

Cas où l'auto-catégorisation est acceptable à condition de respecter des garde-fous spécifiques :

| Cas gris | Garde-fou requis | Pourquoi c'est acceptable |
|----------|-----------------|---------------------------|
| Fournisseur nouveau, charge clairement pro (ex : facture "Notion Technologies") | IA HIGH + compte de charge d'exploitation standard + TVA 20% | Si l'IA se trompe de sous-compte de charge, l'erreur est comptable pure (zone verte). Le risque ne porte que sur la déductibilité, qui est acquise pour une charge manifestement pro. |
| Transaction de montant < seuil d'immobilisation (500€ HT) | Auto-appliquer en charge | Même si le bien devrait théoriquement être immobilisé, l'administration admet la comptabilisation en charge des biens <500€ HT (BOFiP BOI-BIC-CHG-20-30-10, tolérance administrative). |
| IA confiance MEDIUM sur une charge d'exploitation courante | Auto-appliquer MAIS afficher comme `to_review_light` | Le risque comptable est cosmétique (mauvais sous-compte). Le risque fiscal est nul si la charge reste déductible au même titre. L'utilisateur peut corriger, mais l'absence de correction ne crée pas de risque fiscal. |
| Revenu client (crédit) avec libellé identifiable | Auto-appliquer en produit d'exploitation (706/707) | Le risque de sous-déclaration de revenu est l'inverse : catégoriser un revenu en revenu est toujours safe. Le risque serait de NE PAS le catégoriser en revenu. |

**🔴 ZONE ROUGE — Validation utilisateur obligatoire**

Aucune auto-application, quelle que soit la confiance IA :

| Cas rouge | Raison | Risque fiscal |
|-----------|--------|---------------|
| Dépense potentiellement personnelle | Seul le contribuable sait si c'est pro ou perso | Fausse déduction = rehaussement |
| TVA intracommunautaire / autoliquidation | Régime TVA complexe, erreur = déclaration TVA fausse | Redressement TVA |
| Montant > 500€ HT sur bien potentiellement immobilisable | Charge vs immobilisation = impact fiscal direct | Résultat faussé sur l'exercice |
| Charge mixte pro/perso identifiée | Le prorata est une décision de gestion | Fausse déduction partielle |
| Provision, OD, écriture d'inventaire | Impact direct sur le résultat fiscal | Résultat faussé |
| Avoir / note de crédit fournisseur | Réduction de charge = augmentation du résultat imposable | Sous-déclaration si mal traité |
| Transaction en devise étrangère avec écart de change | Gain/perte de change = impact fiscal | Résultat faussé |

---

## 3. Plan d'action : de 55-70% à 95%

### Phase A — Supersédée par V3 P0 : auto-catégorisation par profil (effort : 8-12j)

La Phase A initiale est remplacée par `docs/plan-v3-auto-categorisation-par-profil.md` et `docs/correctif-plan-implementation-v3.md`.

Décision V3 :

- `AutoApplyReliabilityPolicy` reste le Module profond central.
- `CompanyProfileClassificationCenter` configure la policy selon le profil : micro, EI réel, société IS sans EC, ou entreprise avec EC.
- Les seuils sont numériques : `HIGH=95`, `MEDIUM=70`, `LOW=40`.
- Tier 1 micro : seuil 40, historique fournisseur non requis pour les charges courantes.
- Tier 2 EI réel : seuil 70, au moins 1 historique cohérent.
- Tier 3 IS sans EC : seuil 95, au moins 2 historiques cohérents, provisions et charges exceptionnelles > 1 000 € toujours en revue.
- Tier 4 avec EC : fallback Tier 2 tant que le workflow EC réel n'est pas actif.
- Les dérivations fiscales `fecRequired`, `bilanRequired`, `taxFormSet` restent stubbées en P0 et relèvent du Masterplan fiscal.
- La mémoire des corrections devient cross-exercice : exercice courant prioritaire, exercices antérieurs utilisables si non contradictoires, conflit en `to_review_light`.
- Les Phases B/C de ce document restent post-beta, notamment récurrence fine, catégories simplifiées micro, templates déclaratifs et workflows EC avancés.

Les sections ci-dessous gardent l'analyse de fond, mais leur plan opérationnel P0 doit être lu comme remplacé par V3.

### Phase A historique — Quick wins : 55-70% → 85-90% (remplacée)

#### A-1 : Débloquer l'IA sur la zone verte (3-5j)

**Modifier `CategorizationTrustPolicy`** pour autoriser l'auto-application IA quand TOUTES ces conditions sont réunies :

```
IA confiance HIGH
+ compte PCG valide et postable
+ compte = charge d'exploitation déductible (classe 6, hors 681/686/687/695)
  OU compte = produit d'exploitation (classe 7)
+ TVA = taux standard (20%) ou exonéré (0%) — pas de taux réduit, pas d'intracommunautaire
+ montant < 500€ HT (exclut le risque charge/immobilisation)
+ pas de flag "dépense potentiellement personnelle"
+ pas de correction utilisateur contradictoire antérieure
```

Résolution : `auto_applied`. Affichage : "Appliqué automatiquement — [justification]". Corrigeable en un clic.

**Impact estimé :** +15-20 pts d'auto-catégorisation. Les charges SaaS, télécom, transport, fournitures, honoraires, repas d'affaires avec fournisseur identifiable passent en auto.

#### A-2 : Étendre la base de vendor mappings (2-3j)

Les 33 règles actuelles couvrent le profil "consultant IT". Ajouter 100-150 patterns pour couvrir les profils BNC/micro courants :

- **Restauration** : Deliveroo, UberEats, JustEat, noms de chaînes (McDonald's, Starbucks, Paul)
- **Fournitures** : Fnac, Darty, Boulanger, IKEA, Leroy Merlin, Bureau Vallée
- **Télécom** : Orange, SFR, Bouygues, Free, OVH, Gandi
- **Transport** : TotalEnergies, Shell, BP, Blablacar, Lime, Bolt, Tier
- **Poste** : La Poste, Colissimo, Chronopost, DHL, FedEx, UPS
- **Banque** : BNP, SG, CA, LCL, Boursorama, Revolut, N26, Wise
- **Assurance** : Allianz, MAIF, MACIF, Groupama, MMA, Matmut
- **Publicité** : Google Ads, Meta Ads, LinkedIn Ads, Twitter/X Ads
- **Juridique** : Legalstart, Captain Contrat, notaire patterns

**Impact estimé :** +5-10 pts. Réduit le volume tombant sur l'IA.

#### A-3 : Correction rules cross-exercice (1-2j)

Lever le scoping par exercice fiscal. Les correction rules doivent persister d'un exercice à l'autre (avec option de reset si le plan comptable change).

**Impact estimé :** +5 pts pour les utilisateurs matures qui changent d'exercice.

#### A-4 : Exploiter sourceCategory bancaire (2-3j)

Le type `NormalizedTransaction` a un champ `sourceCategory` (catégorie fournie par la banque/Qonto). Ce champ est ignoré par le pipeline. L'intégrer comme signal supplémentaire dans la policy d'auto-application :

- `sourceCategory = "transport"` + IA confiance MEDIUM → rehausse en `auto_applied` (zone verte)
- `sourceCategory = "alimentation"` + IA confiance HIGH → `auto_applied`
- `sourceCategory = "salaire"` ou `"virement"` → ne pas auto-appliquer (nature ambiguë)

**Impact estimé :** +3-5 pts. Fiabilise les cas MEDIUM en les croisant avec un signal bancaire.

### Phase B — Maturité : 85-90% → 95% (effort : 10-15j)

#### B-1 : IA zone grise — auto-apply MEDIUM avec garde-fous (5-8j)

Autoriser `auto_applied` pour les suggestions IA confiance MEDIUM quand :

```
compte = charge d'exploitation déductible standard (même classe fiscale)
+ TVA simple (20% ou 0%)
+ montant < 500€ HT
+ sourceCategory bancaire cohérente (si disponible)
+ fournisseur non flaggé perso/mixte
+ pas de correction contradictoire
```

Résolution : `auto_applied` MAIS affiché comme `to_review_light` ("Catégorisé automatiquement — à vérifier si besoin"). L'utilisateur voit un badge discret, pas un warning.

**Justification fiscale :** si l'IA se trompe de sous-compte de charge, l'erreur est comptable pure (même déductibilité, même TVA). Le résultat imposable ne change pas. Le risque fiscal est nul.

**Impact estimé :** +5-8 pts.

#### B-2 : Détection de récurrence (3-5j)

Identifier les transactions récurrentes (même fournisseur, même montant ±10%, même jour du mois ±5j) et appliquer automatiquement la catégorisation du mois précédent.

Conditions : au moins 2 occurrences identiques déjà validées.

**Impact estimé :** +3-5 pts.

#### B-3 : Auto-détection revenu (2-3j)

Les crédits (transactions positives) de montants significatifs (>100€) provenant de libellés identifiables comme clients sont catégorisés en produit d'exploitation (706/707). Pas de risque fiscal : catégoriser un revenu en revenu est toujours safe — le risque serait de NE PAS le faire.

**Impact estimé :** +2-3 pts.

### Phase C — Excellence : 95% → ~100% (effort : 8-12j, moyen terme)

#### C-1 : IA confiance LOW — proposition dirigée, pas review ouverte (3-5j)

Pour les transactions LOW confidence, au lieu de les laisser en `to_review` avec un formulaire ouvert :

- Proposer les 2-3 options les plus probables (comme Indy)
- L'utilisateur choisit en un clic (pas de sélection dans un dropdown de 800 comptes)
- Si l'utilisateur choisit la proposition #1 et que les conditions de zone verte sont remplies → créer automatiquement une correction rule

**Impact estimé :** ne réduit pas le % auto-appliqué, mais réduit drastiquement le temps de revue (de 30s/transaction à 3s).

#### C-2 : Détection de pattern d'immobilisation (3-5j)

Identifier les achats potentiellement immobilisables (montant > 500€ HT + nature = bien durable) et les orienter vers `to_review` avec une question claire : "Ce bien doit-il être immobilisé ou passé en charge ?" + explication de l'impact fiscal.

#### C-3 : Détection pro/perso (2-3j)

Certains marchands sont structurellement mixtes (Amazon, Apple, Fnac). Quand le fournisseur est flaggé mixte :
- Montant typique du profil pro (ex : <50€ Amazon pour un consultant) → `auto_applied` en charge fournitures
- Montant atypique ou premier achat chez ce fournisseur → `to_review_light` avec question "Achat professionnel ?"

---

## 4. Trajectoire d'automatisation

```
                    Qitus actuel    Phase A      Phase B      Phase C
                    ────────────    ────────     ────────     ────────
Auto-catégorisé     55-70%          85-90%       93-96%       97-99%
to_review_light     0%              5-8%         3-5%         1-2%
to_review           30-45%          5-10%        2-4%         1-2%
Effort cumulé       —               8-12j        18-27j       26-39j
```

### Comparaison avec Indy à chaque phase

| Phase | Qitus | Indy | Position |
|-------|-------|------|----------|
| Actuel | 55-70% | ~90% | **Inacceptable** — -20 à -35 pts |
| Phase A | 85-90% | ~90% | **Parité** — même niveau fonctionnel |
| Phase B | 93-96% | ~95% | **Parité ou léger avantage** |
| Phase C | 97-99% | ~95% | **Avantage Qitus** — surpasse Indy |

---

## 5. Les "grey zones" — ce que l'IA peut faire sans risque fiscal

### Principe directeur

L'IA peut auto-appliquer librement dès que **l'erreur la plus probable est une erreur comptable pure** (mauvais sous-compte de charge, même nature fiscale). Ce type d'erreur n'a aucune conséquence fiscale : le résultat imposable ne change pas, la TVA déclaré ne change pas, il n'y a pas de base de rehaussement pour l'administration.

### Matrice décisionnelle grey zone

| Confiance IA | Zone verte (même nature fiscale) | Zone grise (ambigu léger) | Zone rouge (impact fiscal) |
|-------------|----------------------------------|---------------------------|---------------------------|
| **HIGH** | `auto_applied` | `auto_applied` | `to_review` |
| **MEDIUM** | `auto_applied` | `to_review_light` | `to_review` |
| **LOW** | `to_review_light` | `to_review` | `to_review` |

### Exemples concrets de grey zones exploitables

| Transaction | Confiance IA | Zone | Décision | Justification fiscale |
|-------------|-------------|------|----------|----------------------|
| "NOTION LABS" 11,99€/mois | HIGH | Verte | `auto_applied` → 6135 | SaaS = charge d'exploitation déductible. Même si on se trompe entre 6135/6132/6064, le résultat imposable est identique. |
| "PAIEMENT CB RESTAURANT LE PETIT ZINC" 45€ | MEDIUM | Grise | `auto_applied` → 6257 | Charge de restauration = déductible (dans les limites). Même si c'est un repas perso, le montant est typique d'un repas d'affaires. L'IA affiche "Catégorisé en frais de repas — corrigez si personnel". |
| "VIR DUPONT JEAN 3500" | LOW | Rouge | `to_review` | Crédit ambigu = client ou virement perso ? Impact fiscal direct (revenu vs non-revenu). |
| "AMAZON 29,99" | MEDIUM | Grise | `auto_applied` → 6064 | Montant typique fournitures. Si c'est perso, l'utilisateur corrige. Le montant est trop faible pour un redressement significatif (6€ d'IS en jeu). |
| "AMAZON 1299,00" | MEDIUM | Rouge | `to_review` | Montant > 500€ = immobilisation potentielle. Impact fiscal direct (charge vs amortissement). |
| "URSSAF COTIS T1" 2847€ | HIGH | Verte | `auto_applied` → 6451 | URSSAF = toujours cotisations sociales. Aucune ambiguïté possible. |
| "AXA PRIME T2" 180€ | HIGH | Verte | `auto_applied` → 6161 | Assurance pro = toujours déductible. |
| "VIREMENT RECU ACME CORP" 5000€ | HIGH | Verte | `auto_applied` → 706 | Crédit identifié comme client = revenu. Auto-catégoriser en revenu est toujours safe (le risque serait de ne PAS le faire). |

### Le filet de sécurité juridique pour les grey zones

🟢 Vérifié : art. 1729 CGI, loi ESSOC 2018, art. L.62 LPF.

1. **Présomption de bonne foi.** L'utilisateur qui se fie à un logiciel automatisé est de bonne foi par défaut. L'administration doit prouver le manquement délibéré pour appliquer des majorations.

2. **Droit à l'erreur.** Même en contrôle fiscal, l'utilisateur peut régulariser avec intérêts réduits (50% de 0,20%/mois = 0,10%/mois).

3. **Erreur comptable pure = pas de rehaussement.** Une erreur qui ne modifie pas le résultat imposable n'est pas une base de redressement. Le vérificateur fait une observation, pas une proposition de rectification.

4. **Proportionnalité.** Sur un freelance BNC qui fait 60k€/an, une erreur de catégorisation sur un repas à 45€ représente un enjeu fiscal de ~11€ (25% IS × 45€). L'administration ne redresse pas pour 11€.

5. **Le moat Qitus.** La traçabilité (justification affichée, source IA documentée, correction possible) est elle-même un argument de bonne foi en cas de contrôle : l'utilisateur peut montrer que le logiciel a catégorisé de façon transparente et qu'il avait la possibilité de corriger.

---

## 6. Décisions à prendre

1. **Seuil d'immobilisation pour l'auto-apply.** Proposition : 500€ HT (tolérance administrative BOFiP). Tout achat < 500€ HT peut être auto-appliqué en charge. Au-dessus → `to_review` si l'IA détecte un bien durable. Valider ce seuil.

2. **Traitement des repas.** Les repas d'affaires sont déductibles mais plafonnés (20,70€ en 2025 pour la part déductible au-delà du barème). Faut-il auto-appliquer avec un warning sur le plafond, ou laisser en `to_review_light` systématiquement ?

3. **Fournisseurs mixtes (Amazon, Apple, Fnac).** Seuil de montant pour auto-apply vs `to_review_light` ? Proposition : < 150€ = auto-apply en fournitures, > 150€ = `to_review_light`. Ou bien flag par utilisateur ("Amazon = toujours pro" / "Amazon = à vérifier").

4. **Phase A seule suffit-elle pour la beta ?** 85-90% est le seuil Indy pour un utilisateur neuf. C'est acceptable pour une beta ouverte. Les phases B et C peuvent être post-beta.

5. **Monitoring du taux de correction.** Mettre en place le tracking dès Phase A : si le taux de correction utilisateur sur les `auto_applied` dépasse 5%, resserrer la policy. En dessous de 2%, élargir.

---

## 7. Lien avec le cadrage durcissement produit

Ce plan est le volet **CE-1** du cadrage durcissement V3 (`cadrage-durcissement-produit.md`). Il implémente le modèle à trois vitesses (`auto_applied` / `to_review_light` / `to_review`) avec la `AutoApplyReliabilityPolicy` détaillée.

La Phase A est **P0 beta**. Sans elle, Qitus demande une action utilisateur sur 30-45% des transactions — soit 100-180 validations manuelles/an pour un freelance, 600+ pour une TPE. C'est rédhibitoire face à Indy.
