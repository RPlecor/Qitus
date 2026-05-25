# Brief Copywriter — Landing Page Qitus (LP2)

**Date :** 2026-05-25  
**Commanditaire :** CPO  
**Livrable attendu :** Copy complète LP single-page, prête pour intégration  
**Langue :** Français  
**CTA principal :** À définir (cf. §8)

---

## 1. Pourquoi cette réécriture

La LP1 (copy-lp1-freelances-dirigeants.md, 19 mai 2026) a été écrite sous le nom "Paperasse" avec un ciblage large "freelances + dirigeants TPE/PME." Depuis, trois choses ont changé :

1. **Le produit a un nom et une marque.** Qitus, pas Paperasse. Le brand brief est verrouillé (BRAND-QITUS.md).
2. **Le segment d'attaque est clarifié.** L'analyse CPO (analyse-cpo-qitus-vs-indy.md, 24 mai) conclut que Qitus ne doit PAS viser les freelances mass market en beta — Indy les tient avec un produit gratuit et 300k utilisateurs. Le segment cible est plus précis.
3. **Le moteur d'auto-catégorisation est passé de "85% IA + validation" à "85-90% auto-catégorisation par profil entreprise"** (plan V3). Ce n'est plus "l'IA propose, vous validez" — c'est "Qitus catégorise automatiquement selon votre profil, vous corrigez si nécessaire." L'effort utilisateur a fondamentalement baissé.

La LP actuelle (`Frontend/Qitus Landing.html`, 22 mai) a repris la copy LP1 et l'a intégrée dans un design abouti (dashboard mockup, animations fade-in, pricing cards). La structure est bonne, le design tient. Ce qui doit changer, c'est le message, le segment, et la promesse.

---

## 2. Ce que Qitus est — en 3 phrases

Qitus transforme vos relevés bancaires en dossier comptable complet — écritures, FEC, bilan, compte de résultat — en s'appuyant sur des règles comptables déterministes, de l'IA ciblée, et les référentiels officiels (PCG ANC, spec FEC). Chaque décision est traçable et corrigeable. Votre expert-comptable reçoit un dossier structuré qu'il valide en 30 minutes au lieu de 3 heures.

---

## 3. Segment cible — qui lit cette page

### Cible primaire (beta)

**Dirigeants de sociétés IS simples avec expert-comptable.** SASU, EURL, SAS. Un associé, activité de services ou prestations intellectuelles. Revenus 50k-500k€. L'EC existe déjà. Le dirigeant n'a pas envie de faire sa compta, mais il paie son EC pour de la ressaisie mécanique.

**Ce qu'il veut :** ne pas toucher à sa compta ET que son EC soit content du dossier reçu.  
**Ce qu'il craint :** les erreurs de catégorisation, un contrôle fiscal, la dépendance à une boîte noire IA.  
**Ce qui le ferait switcher :** un dossier vérifiable que son EC valide sans friction.

### Cible secondaire (beta)

**Dirigeants sensibles aux données et à la traçabilité.** Avocats, professions réglementées, experts-comptables indépendants. Ils veulent savoir d'où vient chaque écriture. "Faites-nous confiance" ne suffit pas — ils veulent vérifier.

### Cible tertiaire (post-beta)

**Freelances EI réel / BNC sans EC.** Ils cherchent un outil fiable pour préparer leur compta eux-mêmes. Ce n'est pas le segment beta, mais la LP ne doit pas les repousser — elle doit les orienter vers la waitlist.

### Qui ne doit PAS se sentir ciblé

- Micro-entrepreneurs cherchant du gratuit (→ Indy les sert mieux)
- Grandes entreprises multi-entités
- Cabinets comptables multi-clients (offre dédiée à venir)
- Personnes voulant se passer totalement d'EC

---

## 4. Ce qui a changé depuis la LP1 — implications copy

| Élément | LP1 (19 mai) | LP2 (à écrire) | Implication copy |
|---------|-------------|-----------------|------------------|
| Nom | "Paperasse" partout | **Qitus** | Tout renommer. Baseline : "Qitus — La certitude comptable." |
| Segment | "Freelances & Dirigeants TPE/PME" | **Sociétés IS + EC** (primaire), EI réel (secondaire) | Section "Pour qui" à réécrire. Ne plus ouvrir sur "Freelance — SASU, EURL, micro" |
| Promesse | "Votre compta est faite. Votre EC a validé. Vous n'avez rien eu à faire." | **Même promesse, mais matérialisée** | La promesse était aspirationnelle. Avec l'auto-catégorisation par profil (85-90%), elle est maintenant factuelle |
| Auto-catégorisation | "La majorité est catégorisée automatiquement" (flou) | **"85-90% de vos transactions catégorisées automatiquement selon votre profil"** | Le chiffre change tout. Passer de "la majorité" à un nombre |
| Référentiels | Non mentionné | **Moat architectural** : PCG ANC chargé, FEC validé par spec, blocage si référentiel absent | C'est le différenciateur vs Indy. Le copywriter doit le rendre concret sans jargon technique |
| Traçabilité | "L'IA analyse ce que les règles ne couvrent pas" | **"Chaque écriture porte sa source : règle déterministe, mapping fournisseur, ou IA avec score de confiance"** | Plus précis. Le visiteur comprend que ce n'est pas une boîte noire |
| Contre-positionnement | Implicite ("pas une boîte noire") | **Explicite vs Indy/Pennylane** : "Qitus refuse de produire une sortie comptable sans référentiel officiel actif" | Ne pas nommer les concurrents. Positionner par contraste sans attaquer |
| Pricing | "À partir de [X] €/mois" — non chiffré | **Solo 9.90€ / Pro 24.90€ / Cabinet 39€** | Chiffrer. Le pricing positionne immédiatement vs Indy (0-49€) et Pennylane (30-150€) |
| CTA | "Rejoindre la liste d'attente" | À décider : waitlist beta ou inscription beta | Voir §8 |
| Palette | Vert profond (#0F3D2B) + sable | **Bleu marine profond (#1B2A4A) + ivoire (#F7F5F0) + or mat accent (#C9A84C)** | Suivre BRAND-QITUS.md, pas le brief LP1 |

---

## 5. Punchlist — écarts LP actuelle vs brief LP2

Audit de la copy extraite de `Qitus Landing.html` (22 mai 2026). Le design (layout, dashboard mockup, animations, pricing cards) est conservé. Seule la copy change.

| # | Élément LP actuelle | Problème | Correction |
|---|---|---|---|
| P-1 | Title tag : "Comptabilité automatique pour freelances et TPE" | "Freelances" en premier = mauvais signal de segment | Remplacer par "Comptabilité automatique pour dirigeants et TPE" ou "La certitude comptable pour TPE" |
| P-2 | Headline hero : "Votre compta est faite. Votre EC a validé. Vous n'avez rien eu à faire." | Bonne promesse mais ne différencie pas. Pas de chiffre. | Proposer 2-3 variantes dont une "certitude" (cf. §7). Intégrer le chiffre 85-90% dans le subheadline. |
| P-3 | Subheadline : "Qitus combine règles comptables fiables, IA ciblée, validation par votre EC" | Aucune mention des référentiels officiels ni du profil entreprise | Ajouter référentiels ou profil. Ex : "…appuyé sur les référentiels comptables officiels." |
| P-4 | Section Problème : ouvre avec "Freelance" en premier, "Dirigeant TPE" en second | Segment inversé par rapport au brief | Inverser : dirigeant TPE avec EC en premier, freelance en second |
| P-5 | Section Solution : "La majorité est catégorisée automatiquement" | Trop flou — pas de chiffre | Remplacer par "85-90% de vos transactions catégorisées automatiquement selon votre profil" |
| P-6 | Section Solution : aucune mention des référentiels officiels (PCG ANC, spec FEC) | Moat architectural absent de la page | Ajouter un paragraphe ou sous-section : comptes validés par le PCG officiel, FEC généré selon spec DGFiP |
| P-7 | Section Solution : aucune traçabilité par source expliquée | Le visiteur ne comprend pas la différence avec une boîte noire IA | Ajouter : "Chaque écriture porte sa source — règle, mapping fournisseur, ou IA avec score de confiance" |
| P-8 | Section Pour qui : "Freelance ou dirigeant de TPE — Qitus s'adapte" | Pas de hiérarchisation, trop large | Restructurer : bloc 1 = dirigeant IS + EC (primaire), bloc 2 = indépendant EI réel (secondaire) |
| P-9 | FAQ : "Quelle différence avec Indy ou Pennylane ?" | Nomme les concurrents — le brief interdit ça | Reformuler : "Quelle différence avec les autres outils comptables ?" |
| P-10 | FAQ "C'est fiable ?" | Ne mentionne pas les référentiels officiels | Ajouter : "Les comptes sont validés par le Plan Comptable Général officiel. Le FEC est généré selon la spécification DGFiP." |
| P-11 | Aucune mention de souveraineté données | Différenciateur secondaire mais attendu par le segment cible | Ajouter en FAQ : "Mes données sont où ?" → 100% France/UE |
| P-12 | Le mot "corrigeable" n'apparaît jamais après "automatique" | Contrainte §9.7 non respectée | Systématiser : "catégorisé automatiquement, toujours corrigeable" |
| P-13 | Prix tier Cabinet non chiffré dans le corps de page | Incohérence pricing | Afficher 39€/mois comme les deux autres tiers |
| P-14 | Dashboard mockup hero ne montre pas de badges AUTO_APPLIED | Occasion manquée de montrer l'automatisation par profil | Ajouter badges "Auto" ou "Catégorisé automatiquement" sur les lignes du mockup |
| P-15 | Footer : "Comptabilité automatique pour freelances et TPE françaises" | Même problème que P-1 | Aligner avec le title tag corrigé |

### Éléments à conserver tels quels

- Structure 7 sections (hero, problème, solution, étapes, pour qui, pricing, FAQ)
- Dashboard mockup interactif (layout, animations)
- Les 4 étapes (Importez → Vérifiez → Générez → Faites valider) — seule la copy de l'étape 2 change
- Pricing cards (layout + argument "architecture rules-first = coûts bas")
- Bloc "Pas fait pour" (grandes entreprises, remplacement EC total, cabinets)
- CTA "Rejoindre la beta" (hero + fin)
- Animations fade-in au scroll

---

## 6. Architecture de la page (rappel) — sections et rôle de chaque bloc

La structure de la LP actuelle est conservée. Ordre et rôle de chaque section :

### Hero
**Rôle :** Blink test. En 3 secondes : ce que c'est, pour qui, pourquoi c'est différent.  
**Contrainte :** Headline + subheadline + CTA + screenshot produit. Le screenshot est non négociable — pas de stock, un vrai écran du dashboard.  
**Headline LP1 :** "Votre compta est faite. Votre EC a validé. Vous n'avez rien eu à faire." — **à challenger.** C'est bon mais ça ne différencie pas. "Votre EC a validé" est le meilleur segment — le creuser.  
**Direction :** la promesse doit résonner avec un dirigeant SASU qui paie 3 000€/an d'EC et dont 60% du temps EC est de la ressaisie.

### Problème
**Rôle :** Reconnaissance. Le visiteur doit se dire "c'est exactement ça."  
**Direction LP2 :** recentrer sur la douleur EC. "Vous payez votre EC pour classer des relevés bancaires. C'est du travail mécanique, pas du conseil." La douleur freelance ("vous faites tout vous-même") passe en secondaire.

### Solution — triple couche
**Rôle :** Crédibilité technique sans jargon.  
**Les 3 couches restent :** règles déterministes (85%), IA ciblée (15%), validation EC/utilisateur.  
**Ajout LP2 :** les référentiels officiels. "Les comptes sont validés par le Plan Comptable Général officiel (ANC). Le FEC est généré selon la spécification DGFiP." → ça doit sonner "notaire digital", pas "ingénieur."  
**Ajout LP2 :** l'auto-catégorisation par profil. "Qitus s'adapte à votre profil : micro-entrepreneur, EI réel, ou société IS. Les seuils d'automatisation sont calibrés selon votre risque fiscal réel."

### Comment ça marche — 4 étapes
**Rôle :** Réduire l'effort perçu.  
**LP2 :** Conserver les 4 étapes (Importez → Vérifiez → Générez → Faites valider). Mettre à jour l'étape 2 : "Vous ne voyez que les 10-15% restants. Un clic pour valider ou corriger." Le chiffre compte.

### Pour qui
**Rôle :** Qualification. Le bon prospect se reconnaît, le mauvais décroche.  
**LP2 :** Restructurer complètement :
- **Bloc 1 — Dirigeant SASU/EURL avec EC** (primaire) : "Votre EC passe moins de temps en ressaisie. Vous payez du conseil, pas du classement."
- **Bloc 2 — Indépendant EI réel / BNC** (secondaire) : "Votre dossier est prêt pour un EC. Ou pour vous, si vous faites seul."
- **Bloc 3 — "Pas fait pour"** (conserver) : grandes entreprises, remplacement EC total, micro cherchant du gratuit.

### Pricing
**Rôle :** Filtrage prix + positionnement vs marché.  
**LP2 :** Afficher les 3 tiers.

| Tier | Nom | Prix | Cible |
|------|-----|------|-------|
| Entry | Qitus Solo | 9.90€/mois | Freelance solo, compta simple |
| Standard | Qitus Pro | 24.90€/mois | Dirigeant TPE, dossier EC |
| Premium | Qitus Cabinet | 39€/mois | Accès EC intégré + validation |

**Argument prix :** "La majorité du traitement passe par des règles, pas par de l'IA coûteuse. Nos coûts sont structurellement bas." → LP1 avait ça, c'est bon, conserver.  
**Pas de mention "moins cher qu'Indy/Pennylane"** — laisser le lecteur faire la comparaison.

### FAQ
**Rôle :** Lever les dernières objections.  
**LP2 — Questions à couvrir :**
1. "Qitus remplace mon EC ?" → Non. Qitus prépare, l'EC valide.
2. "C'est fiable ?" → Triple couche + référentiels officiels. Chaque écriture est traçable.
3. "Différence avec Indy / Pennylane ?" → Sans nommer : "Contrairement aux outils qui reposent sur une IA opaque, chaque catégorisation dans Qitus est traçable jusqu'à sa source."
4. "Quelles banques ?" → Import CSV universel + [liste beta]. Open Banking à venir.
5. "Mes données sont où ?" → France, 100% souverain. Pas de transfert hors UE.
6. "C'est prêt ?" → Beta [statut].

### CTA final
**Rôle :** Conversion.  
**LP2 :** Reprendre le CTA hero. Urgence douce, pas de pression.

---

## 7. Différenciateurs à intégrer dans la copy — priorité

Le copywriter doit faire passer ces 5 messages. Pas nécessairement dans cet ordre, pas nécessairement dans des sections dédiées, mais ils doivent être dans la page.

| # | Message | Où | Importance |
|---|---------|-----|-----------|
| 1 | **85-90% auto-catégorisé** — le chiffre, pas "la majorité" | Solution + étape 2 | Critique — c'est la promesse factuelle |
| 2 | **Référentiels officiels** — PCG ANC, spec FEC, blocage si absent | Solution ou différenciation | Critique — c'est le moat |
| 3 | **Dossier EC natif** — pas un add-on à +49€/mois | Pour qui + pricing | Élevé — c'est le contre-positionnement vs Indy |
| 4 | **Traçabilité** — chaque écriture porte sa source | Solution | Élevé — ça rassure le segment cible |
| 5 | **Souveraineté données** — 100% France/UE | FAQ ou footer | Moyen — différenciateur secondaire mais vocal |

---

## 8. Décisions ouvertes — à trancher avant rédaction

| # | Question | Options | Recommandation CPO |
|---|----------|---------|-------------------|
| 1 | CTA principal | "Rejoindre la beta" / "Créer mon compte" / "Réserver ma place" | **"Rejoindre la beta"** si beta fermée. **"Créer mon compte gratuit"** si beta ouverte. À confirmer selon timing. |
| 2 | Headline direction | A. Résultat ("Votre compta est faite") / B. Douleur EC ("Votre EC facture 3h de ressaisie") / C. Certitude ("La compta où chaque écriture a sa preuve") | **Tester A et C.** B est agressif et pourrait repousser les EC qui lisent aussi la page. |
| 3 | Ton | Corporate-sobre (notaire digital) / Accessible-direct (LP1) | **Accessible-direct avec crédibilité technique.** Pas corporate froid, pas startup cool. Le dirigeant SASU lit ça à 22h — il veut comprendre vite et avoir confiance. |
| 4 | Social proof | Rien (pré-beta) / "X entreprises en beta" / Témoignage EC | **Rien en v1.** Ajouter dès que disponible. Ne pas inventer. |
| 5 | Pricing visible | Oui avec 3 tiers / Oui avec "à partir de 9.90€" / Non | **Oui avec 3 tiers.** Le pricing filtre. Un dirigeant SASU à 24.90€ sait immédiatement si c'est dans son budget. |
| 6 | Screenshot hero | Dashboard réel / Mockup fidèle / Pas de visuel | **Mockup fidèle du dashboard catégorisation.** Montrer les transactions avec badges AUTO_APPLIED. Le produit EST le visuel. |

---

## 9. Contraintes non négociables

Ces règles s'appliquent au copywriter sans exception.

1. **Nom = Qitus.** Jamais "Paperasse." Baseline : "Qitus — La certitude comptable."
2. **Pas de promesses non livrées.** Si la feature n'est pas en beta, ne pas la promettre. "À venir" est acceptable.
3. **Pas de "IA magique."** La copy ne doit jamais donner l'impression que tout repose sur de l'IA. L'architecture est rules-first (85% déterministe). L'IA est ciblée et traçable.
4. **Pas de dénigrement concurrent.** Pas de "contrairement à Indy" ou "mieux que Pennylane." Positionner par la valeur propre, pas par l'attaque.
5. **Zéro chiffre inventé.** Pas de "99% de précision" ou "10x plus rapide." Les seuls chiffres autorisés : 85-90% auto-catégorisation (plan V3, cible technique validée), pricing (validé), et métriques réelles post-beta.
6. **Le copywriter écrit pour des scanners.** Phrases courtes. Paragraphes courts. Gras sur les mots-clés. 3 lignes max par paragraphe sur mobile.
7. **Le mot "automatique" doit toujours être suivi de "corrigeable."** Qitus catégorise automatiquement, toujours corrigeable.
8. **Single-page, un seul path.** Le CTA apparaît 2 fois (hero + fin). Pas de navigation complexe.

---

## 10. Documents de référence à fournir au copywriter

| Document | Chemin | Usage |
|----------|--------|-------|
| **LP actuelle (base de travail)** | `Frontend/Qitus Landing.html` | Design, layout, mockups à conserver. Copy à réécrire selon ce brief |
| Brand brief | `docs/BRAND-QITUS.md` | Nom, baseline, palette, ton, positionnement |
| Copy LP1 (historique) | `Frontend/copy-lp1-freelances-dirigeants.md` | Référence de ce qui fonctionnait dans la copy v1 |
| Analyse CPO vs Indy | `docs/analyse-cpo-qitus-vs-indy.md` | Segment cible, contre-positionnement, moat |
| Brief design LP | `Frontend/brief-design-qitus-lp.md` | Contraintes visuelles (palette, perf, animations) |
| Plan V3 auto-catégorisation | `docs/plan-v3-auto-categorisation-par-profil.md` | Le "85-90%" — d'où vient le chiffre, comment ça marche |

---

## 11. Livrable attendu

Le copywriter livre un fichier `copy-lp2-qitus.md` contenant :

1. Copy complète par section (hero, problème, solution, étapes, pour qui, pricing, FAQ, CTA final)
2. 2-3 variantes de headline pour A/B test
3. Meta description SEO (~155 caractères)
4. OG title + description (pour partage social)
5. Placeholders identifiés (metrics à confirmer, CTA à valider, screenshot à produire)

**Longueur cible :** 800-1200 mots de copy visible (hors annotations).  
**Ton :** Accessible, direct, crédible. Pas corporate froid. Pas startup cool. Le registre d'un associé senior qui explique simplement un sujet technique à un dirigeant intelligent qui n'est pas comptable.

---

*Ce brief est un input CPO. Le copywriter est libre de challenger la structure et le ton. Les contraintes §9 sont non négociables. Le reste est négociable.*
