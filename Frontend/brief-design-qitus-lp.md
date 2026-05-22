# Brief Design — Landing Page Qitus

**Date :** 2026-05-22
**Client :** Qitus (qitus.io)
**Livrable attendu :** Intégration HTML/CSS/JS directe (pas de maquettes Figma)
**Cible :** Freelances et dirigeants TPE/PME françaises
**CTA principal :** Rejoindre la liste d'attente beta
**Statut :** Prêt pour production

---

## 1. Le produit en 30 secondes

Qitus est un SaaS de comptabilité automatique pour les TPE françaises. Il transforme un relevé bancaire en dossier comptable complet (écritures, FEC, bilan, compte de résultat, liasse fiscale) validé par un expert-comptable.

Ce qui le différencie : une architecture « triple couche » — des règles comptables déterministes traitent ~85% des transactions (gratuit, instantané), l'IA ne touche que les ~15% de cas ambigus (catégorisation, enrichissement), et l'expert-comptable valide le tout avant envoi à l'administration. Le résultat : un dossier vérifiable de bout en bout, pas une boîte noire IA.

**Concurrents directs :** Pennylane (~69-149€/mois), Indy (~22-50€/mois), Georges.tech.
**Positionnement prix :** significativement moins cher grâce à l'architecture rules-first.

---

## 2. Identité de marque

### Personnalité

Qitus n'est pas un outil "fun" ou "disruptif". C'est un outil **fiable, concret, français** — le genre d'outil que tu recommandes à un ami freelance parce qu'il marche, pas parce qu'il est joli. Il faut que le site inspire la confiance dès la première demi-seconde.

Mots clés de la marque : **fiabilité, transparence, simplicité, rigueur comptable, pas de bullshit**.

Ce que Qitus n'est PAS : corporate-générique, startup-hype, "powered by AI" comme argument principal.

### Ton

Professionnel mais direct. Pas corporate. Pas familier non plus. Le ton d'un consultant senior qui explique clairement — pas celui d'un stagiaire marketing qui survend.

---

## 3. Direction artistique

### Palette validée

La direction a été explorée et validée dans un prototype. On s'éloigne volontairement du bleu SaaS générique. Palette vert profond + neutres chauds :

| Token | Hex | Usage |
|-------|-----|-------|
| `green-900` | `#0F3D2B` | Titres foncés, hover boutons |
| `green-700` | `#1B6B4A` | Boutons CTA, accents principaux |
| `green-500` | `#2A8F64` | Bordures actives, éléments secondaires |
| `green-100` | `#E8F5EE` | Backgrounds légers, badges, icônes |
| `green-50` | `#F4FAF7` | Background sections alternées |
| `sand-900` | `#1C1917` | Titres principaux (h1, h2) |
| `sand-700` | `#44403C` | Texte courant, strong |
| `sand-500` | `#78716C` | Texte secondaire, subheadlines |
| `sand-300` | `#D6D3D1` | Bordures, séparateurs |
| `sand-200` | `#E7E5E4` | Bordures légères |
| `sand-100` | `#F5F5F4` | Backgrounds subtils |
| `sand-50` | `#FAFAF9` | Background hero, sections |
| `white` | `#FFFFFF` | Background principal |

Cette palette est un point de départ validé — le designer peut l'affiner (ajuster les nuances, enrichir avec un accent complémentaire) mais la direction vert profond + neutres chauds doit rester.

### Typographie

Le prototype utilise le system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI"...`) pour la performance. Le designer peut proposer une web font si elle apporte réellement quelque chose **sans dégrader le temps de chargement** :

- Si web font : préférer une variable font (un seul fichier). Pas plus de 2 familles.
- Pistes acceptables : Inter (safe), Söhne ou GT America (si on veut se différencier), un serif contemporain pour les headlines (GT Sectra, Lyon Display) pour créer un contraste "rigueur comptable".
- Pas de police display fantaisie. Pas de Google Fonts exotiques avec 14 poids.
- Fallback system font obligatoire. `font-display: swap`.

Échelle typographique existante (ratio ~1.25) :

| Token | Taille |
|-------|--------|
| `text-sm` | 0.875rem |
| `text-base` | 1rem |
| `text-lg` | 1.125rem |
| `text-xl` | 1.25rem |
| `text-2xl` | 1.5rem |
| `text-3xl` | 1.875rem |
| `text-4xl` | 2.25rem |
| `text-5xl` | 3rem |

### Iconographie

Pas d'emojis dans le rendu final. Icônes SVG sobres — style Lucide, Phosphor, ou Heroicons. Trait fin (1.5-2px), monochromes. Pas d'illustrations Notion-style (trop vu). Pas d'illustrations 3D isométriques.

Si le designer veut proposer des illustrations custom pour la section triple couche ou les 4 étapes, elles doivent rester dans l'univers « technique-sobre » — pas de personnages cartoon.

---

## 4. Contraintes techniques non négociables

| Contrainte | Détail |
|-----------|--------|
| **Performance** | Page < 3 secondes sur mobile 4G moyen. Tester avec Lighthouse, cible > 90. |
| **Poids total** | < 500 Ko first load (HTML + CSS + fonts + images critiques). |
| **Images** | WebP ou AVIF, avec fallback. `srcset` pour responsive. Lazy load sous le fold. |
| **Fonts** | Max 2 fichiers font, preload, `font-display: swap`. Subsetting si non-variable. |
| **Mobile-first** | Le design est conçu mobile d'abord. Desktop est l'adaptation, pas l'inverse. |
| **Accessibilité** | WCAG 2.2 AA minimum. Contraste 4.5:1 texte, 3:1 éléments. Navigation clavier. Focus visible. |
| **Animations** | Hover boutons + fade-in au scroll. C'est tout. Pas de parallax, pas de Spline, pas de Lottie, pas de slider auto-play. Si le visiteur remarque l'animation avant l'offre, c'est raté. |
| **JS** | Le strict minimum. La page doit fonctionner avec JS désactivé (sauf formulaire CTA). Pas de framework JS pour une LP. |
| **Single page** | Une seule page, scroll vertical. Pas de routing. Le seul lien de nav = ancres vers sections. |
| **Responsive** | Breakpoint principal à 768px. Le layout doit être propre de 320px à 1440px. |
| **Navigateurs** | Chrome, Safari, Firefox, Edge — 2 dernières versions. Pas d'IE. |

---

## 5. Structure de la page — section par section

### Rythme visuel global (inspiré ClickUp)

La page alterne les fonds pour créer un rythme de scrolling engageant :

| Section | Fond | Ton |
|---------|------|-----|
| Nav | Transparent → blur blanc au scroll | — |
| Hero | `sand-50` (crème léger) | Accueil, confiance |
| Problème | `white` | Neutre, factuel |
| Solution (triple couche) | `green-50` (vert très léger) | Positif, solution |
| Comment ça marche | `white` | Process, clarté |
| Pour qui | `sand-50` | Segmentation |
| Pricing | `white` | Neutre, chiffres |
| FAQ | `sand-50` ou `white` | Utilitaire |
| CTA final | `green-900` ou `sand-900` **(fond dark)** | Rupture, urgence, clôture |
| Footer | `sand-900` | Minimaliste |

La section dark (CTA final) est le moment fort inspiré du bloc "ClickUp Brain" — elle casse le rythme clair et crée un appel à l'action visuellement distinct.

### 5.1 Navigation (sticky)

- Logo "Qitus" en texte (pas d'image logo pour l'instant). Le "Q" en `green-700`, le reste en `sand-900`.
- CTA compact en haut à droite : "Rejoindre la beta" (bouton vert).
- Fond semi-transparent avec blur au scroll (`backdrop-filter`).
- Hauteur : 60px.
- Pas de hamburger menu — il n'y a que le logo et le CTA.

### 5.2 Hero

**Copy :**

> Badge : `BETA — ACCÈS ANTICIPÉ`
>
> Headline : **Votre compta est faite. Votre EC a validé. Vous n'avez rien eu à faire.**
>
> Subheadline : Qitus combine **règles comptables fiables**, **IA ciblée** et **validation par votre expert-comptable** pour produire un dossier complet depuis vos relevés bancaires.
>
> CTA : **Rejoindre la liste d'attente**
>
> Note sous CTA : *Gratuit. Sans engagement. Accès prioritaire pour les premiers inscrits.*

**Visuel :** Screenshot du dashboard produit (fichier fourni : `dashboard-paperasse.png`, 497 Ko). L'afficher dans un cadre navigateur ou device mockup sobre. Le screenshot est le seul élément visuel du hero — pas de stock photo, pas d'illustration à côté.

**Layout :** Texte à gauche, mockup en dessous (mobile) ou à droite/en dessous légèrement décalé (desktop). Priorité absolue : le headline et le CTA doivent être au-dessus du fold sur mobile.

### 5.3 Le problème

**Copy :**

> Header : **Vous avez créé votre boîte pour faire votre métier. Pas votre compta.**
>
> Body : Chaque mois : exporter le relevé. Trier. Classer. Envoyer à l'EC. Attendre. Corriger. Renvoyer. Chaque année : clôture, bilan, liasse. Des semaines d'allers-retours.
>
> Deux cartes côte à côte :
>
> **Freelance** — Vous faites tout vous-même, ou vous payez un EC trop cher pour le volume que vous avez.
>
> **Dirigeant TPE** — Votre EC passe la moitié de son temps en ressaisie. Vous payez du travail mécanique, pas du conseil.
>
> Punchline : **80 % de ce travail est de la procédure pure.** Toujours les mêmes règles, toujours les mêmes comptes. Ça devrait tourner tout seul.

**Design :** Fond blanc. Le flow mensuel peut être affiché en `font-mono` dans un bloc grisé (comme un terminal ou un process). Les deux cartes segments ont une bordure gauche verte de 3px.

### 5.4 La solution — Triple couche

**Copy :**

> Header : **Règles comptables. IA ciblée. Validation humaine. Un dossier solide.**
>
> 3 cartes :
>
> **1. Des règles comptables pour le quotidien** — Votre abonnement Notion → même compte à chaque fois. Votre loyer → même compte. **Pas besoin d'IA pour ça.** La compta, c'est d'abord du suivi de procédure.
>
> **2. L'IA pour les cas ambigus** — Un virement avec un libellé flou. Une dépense atypique. **L'IA analyse ce que les règles ne couvrent pas.** Chaque suggestion passe par votre validation.
>
> **3. Votre EC valide le tout** — Votre expert-comptable accède au dossier, vérifie, valide. **Le dossier qui part est vérifié trois fois** — par le code, par l'IA, par un humain.

**Design :** Fond `green-50`. 3 cartes blanches côte à côte (desktop), empilées (mobile). Chaque carte a une icône dans un carré arrondi `green-100` :
- Carte 1 : icône « code » ou « settings/gear » (règles)
- Carte 2 : icône « sparkles » ou « brain » (IA)
- Carte 3 : icône « shield-check » ou « user-check » (validation humaine)

Hover subtil (élévation ombre). Pas d'animation d'entrée complexe.

### 5.5 Comment ça marche — 4 étapes

**Copy :**

> Header : **4 étapes. De vos relevés à un dossier validé.**
>
> **1. Importez** — Déposez le CSV de votre banque. Qonto, BNP, SG, Boursorama. Qitus détecte le format.
>
> **2. Vérifiez** — La majorité est catégorisée automatiquement. Vous ne voyez que les cas douteux. Un clic pour valider.
>
> **3. Générez** — Écritures, FEC, balance, bilan, compte de résultat. Conformes. Téléchargeables.
>
> **4. Faites valider** — Votre EC reçoit un lien sécurisé vers le dossier complet. Il vérifie, il valide, c'est tracé.

**Design :** Fond blanc. 4 colonnes (desktop) avec numéros circulaires verts et connecteurs horizontaux discrets entre les étapes. Mobile : empilé verticalement avec une ligne verticale comme connecteur.

**Option enrichie (inspirée ClickUp "More powerful platform") :** Sous les 4 étapes textuelles, ajouter une grille de 4 mini-screenshots du produit réel (import, catégorisation, FEC/documents, dossier EC). Chaque screenshot dans un cadre arrondi avec ombre légère et un label court en dessous. Cela montre le produit concret à ceux qui scrollent vite sans lire le texte. Si les 4 screenshots ne sont pas disponibles au moment du dev, prévoir des placeholders avec le même traitement visuel.

### 5.6 Pour qui / Pas pour qui

**Copy :**

> Header : **Freelance ou dirigeant de TPE — Qitus s'adapte.**
>
> Carte Freelance : Vous voulez **être en règle sans devenir comptable**. Qitus prépare tout. Si vous avez un EC, il passe 30 minutes au lieu de 3 heures.
>
> Carte TPE : Votre EC perd du temps en ressaisie. Qitus lui livre un dossier structuré qu'il valide directement. **Moins d'heures mécaniques facturées. Plus de conseil.**
>
> Bloc exclusion : **Qitus n'est pas fait pour :** les grandes entreprises multi-entités, ceux qui veulent se passer d'EC, les cabinets comptables (offre dédiée bientôt).

**Design :** Fond `sand-50`. Deux cartes blanches pour les personas. Le bloc exclusion en dessous : fond léger, texte `sand-500`, icône « x » ou « minus » devant chaque item. Sobre — pas alarmant, juste honnête.

### 5.7 Pricing

**Copy :**

> Header : **Un prix juste, rendu possible par l'architecture.**
>
> Body : La plupart des outils comptables facturent cher parce que chaque transaction passe par de l'IA coûteuse. Chez Qitus, **la majorité du traitement passe par des règles** — pas par des appels API à 0,03 € pièce.

**Grille tarifaire :**

| Plan | Prix | Cible |
|------|------|-------|
| **Solo** | 9,90 €/mois | Freelance, micro-entreprise |
| **Pro** | 24,90 €/mois | TPE 1-5 salariés, régime réel |
| **Cabinet** | 39 €/mois | TPE 5-10 salariés, multi-exercices |

> Note sous pricing : *Pas d'engagement annuel. Pas de frais cachés. Pricing beta — les premiers inscrits gardent leur tarif.*

**Design :** Fond blanc. 3 colonnes tarifaires. Le plan **Pro** visuellement mis en avant (badge "Recommandé", bordure ou ombre légèrement plus prononcée). Le prix doit être le plus gros élément typographique de la section. Pas de tableau complexe avec 20 features — garder ça minimaliste, 3-4 features clés max par plan.

### 5.8 FAQ

**Copy :**

> **Qitus remplace mon EC ?** — Non. Qitus prépare. Votre EC valide. Celui qui prépare n'est pas celui qui signe.
>
> **C'est fiable ?** — La majorité du traitement passe par des règles — le même type de logique que votre EC applique manuellement, mais automatisé. L'IA ne touche que les cas ambigus.
>
> **Différence avec Indy, Pennylane ?** — Trois couches : règles pour le volume, IA pour les cas limites, EC pour la validation. Un dossier vérifiable de bout en bout.
>
> **Quelles banques ?** — Au lancement : Qonto, BNP Paribas, Société Générale, Boursorama. Plus un import CSV générique.
>
> **C'est prêt ?** — Beta en préparation. Inscrivez-vous pour un accès prioritaire.

**Design :** Accordéon simple (clic pour ouvrir/fermer). Pas de fond coloré — fond blanc ou `sand-50`. Séparateurs légers entre questions.

### 5.9 CTA final

**Copy :**

> Header : **Récupérez votre temps. Qitus s'occupe du reste.**
>
> CTA : **Rejoindre la liste d'attente**
>
> Note : *Gratuit. Sans engagement. Accès prioritaire.*

**Design :** Fond `green-50` ou `green-900` (fond sombre pour créer une rupture visuelle avant le footer). CTA centré, large.

### 5.10 Footer

> Qitus — Comptabilité automatique pour freelances et TPE françaises.
>
> [Mentions légales] · [Contact] · [À propos]

**Design :** Minimaliste. Fond `sand-900` ou `green-900`, texte clair. Pas de mega-footer avec 4 colonnes de liens — on n'a pas le contenu pour ça.

---

## 6. Formulaire CTA — Spécifications

Le CTA "Rejoindre la liste d'attente" capture un email. C'est le seul formulaire de la page.

- Un champ email + un bouton submit.
- Placeholder : "votre@email.com"
- Bouton : "Rejoindre la liste"
- Validation inline (email valide, pas vide).
- État success : le formulaire se remplace par un message "Vous êtes inscrit. On vous contacte bientôt."
- Pas de double opt-in sur la LP — ça se gère côté backend.
- Le formulaire apparaît 2 fois : hero + section CTA final.

Backend non spécifié — le designer peut utiliser un `<form>` HTML standard avec `action` configurable. L'intégration backend (Mailchimp, Loops, ou custom) sera branchée séparément.

---

## 7. Assets fournis

| Asset | Fichier | Notes |
|-------|---------|-------|
| Screenshot dashboard | `dashboard-paperasse.png` (497 Ko) | À optimiser (WebP, resize). Sera renommé avec branding Qitus. |
| Prototype HTML existant | `landing-page-lp1.html` | Référence de structure et palette. Le designer n'est pas obligé de le suivre — c'est un point de départ, pas une contrainte. |
| Copy complète | Ce document (sections 5.1 à 5.10) | Texte final. Ne pas reformuler sans validation. |

**Assets manquants (à produire par le designer ou à sourcer) :**

- Icônes pour la triple couche (3 icônes SVG)
- Icônes pour les 4 étapes (4 icônes SVG)
- Favicon Qitus (16x16, 32x32, 180x180 Apple Touch)
- OG Image pour le partage social (1200x630, titre + screenshot)

---

## 8. Références visuelles

### Référence principale : ClickUp (clickup.com)

La LP ClickUp est la direction d'inspiration prioritaire. Voici ce qu'on retient et ce qu'on adapte :

**À reprendre :**

- **Rythme de page par alternance de fonds** — blanc → léger → dark → blanc. Chaque section a son identité visuelle. Le scroll ne donne pas l'impression de lire un document Word. Pour Qitus : alterner `white` → `green-50` → `white` → `sand-900` ou `green-900` (section dark pour le CTA final ou le pricing).
- **Typographie display mixte serif/sans-serif** — ClickUp utilise un serif display pour les grandes headlines de section. C'est ce contraste qui crée de l'élégance sans effort. Pour Qitus : un serif contemporain (GT Sectra, Lyon Display, ou Fraunces) pour les h2 de section, et un sans-serif propre pour le body et les h3.
- **Produit visible immédiatement dans le hero** — le screenshot est grand, central, encadré. Pas une illustration abstraite. Qitus doit faire pareil avec le dashboard.
- **Mini-screenshots dans une grille** — la section "More powerful platform" chez ClickUp montre 4-6 captures d'écran du produit réel dans une grille. Pour Qitus, envisager une grille de 4 screenshots sous la section "Comment ça marche" : écran import, écran catégorisation, écran FEC/documents, écran dossier EC.
- **Section dark en rupture visuelle** — le bloc "ClickUp Brain" sur fond noir casse le rythme blanc/gris et crée un moment fort. Pour Qitus : utiliser ce traitement pour le CTA final ou la section pricing.

**À ne PAS reprendre :**

- L'échelle (trop de sections, trop de features) — Qitus est un produit beta, pas un outil mature. On reste concis.
- Les vidéos/animations hero lourdes — contrainte performance < 500 Ko.
- Le branding aspirationnel ("A New Era of Craft and Quality") — Qitus doit prouver, pas inspirer. On reste factuel.
- Les multiples CTAs différents ("Try free", "Contact sales", "Watch demo") — un seul CTA : liste d'attente.

### Autres références

| Site | Ce qu'on retient |
|------|-----------------|
| **stripe.com** | Clarté du hero, hiérarchie typographique, whitespace généreux. Le produit se comprend en 3 secondes. |
| **linear.app** | Sobriété, dark accents, rythme de la page. Le feeling "outil sérieux pour gens sérieux." |
| **vercel.com** | Performance du site lui-même. Chargement instantané. Minimalisme qui respire la confiance technique. |
| **arc.net** | Différenciation visuelle — ça ne ressemble pas à toutes les LP SaaS. Palette distinctive. |

### Ce qu'on ne veut PAS

| Anti-référence | Pourquoi |
|---------------|----------|
| LP SaaS générique (gradient bleu, illustrations Notion-style, headline en Inter, 3 colonnes de features) | On sera perçu comme un commodity. Qitus doit se distinguer. |
| Stock photos de "professionnels souriants autour d'un laptop" | Détruit la crédibilité instantanément. |
| Parallax / animations 3D / Spline embed | Lourd, distrait du message, mauvaise perf mobile. |
| Mega-footer avec newsletter + blog + 40 liens | On n'a pas le contenu. Un footer vide fait cheap. |
| Slider / carrousel auto-play | Personne ne les lit. Ça ralentit la page. |
| Dark mode par défaut | Le public cible (freelances, dirigeants TPE) s'attend à du clair. Dark mode optionnel = surcoût sans valeur beta. |

---

## 9. SEO technique (minimum vital)

| Élément | Valeur |
|---------|--------|
| `<title>` | Qitus · Comptabilité automatique pour freelances et TPE |
| `<meta description>` | Qitus combine règles comptables, IA ciblée et validation par votre expert-comptable pour produire un dossier complet depuis vos relevés bancaires. À partir de 9,90 €/mois. |
| `<html lang>` | `fr` |
| OG tags | `og:title`, `og:description`, `og:image` (l'OG image à produire), `og:url` = `https://qitus.io` |
| Twitter card | `summary_large_image` |
| Canonical | `https://qitus.io` |
| Structured data | `Organization` schema (nom, url, logo) — optionnel mais propre |
| Sitemap | Pas nécessaire pour une single page |

---

## 10. Livrables attendus

| Livrable | Format | Notes |
|----------|--------|-------|
| Page HTML complète | `index.html` unique (HTML + CSS inline ou fichier séparé, JS minimal) | Auto-contenu, déployable sur n'importe quel hébergeur statique |
| Assets optimisés | WebP/AVIF, SVG pour les icônes | Toutes images compressées, srcset si pertinent |
| Favicon set | ICO + PNG + Apple Touch | |
| OG Image | PNG 1200x630 | Pour le partage social |
| Score Lighthouse | > 90 sur les 4 catégories (Performance, Accessibility, Best Practices, SEO) | Testé sur mobile |

**Pas attendu :** Figma, documentation design system, version dark mode, animations avancées, intégration backend du formulaire.

---

## 11. Processus de validation

1. Le designer livre une V1 intégrée.
2. Review ensemble (structure, palette, typo, responsive, performance).
3. Itérations ciblées (pas de refonte complète — on affine).
4. Validation Lighthouse + test mobile réel.
5. Livraison finale.

Le texte de la copy est final et ne doit pas être modifié sans accord explicite. Le designer a toute latitude sur les choix visuels (typo, espacement, illustrations, micro-interactions) dans le cadre des contraintes listées ci-dessus.

---

## Contact

RP — rpcorbu@gmail.com
Produit : qitus.io
