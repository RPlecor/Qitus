# Brief Design — Landing Page LP2 Qitus

**Date :** 2026-05-25  
**Émetteur :** CPO  
**Destinataire :** Web designer  
**Copy de référence :** `copy-lp2-qitus.md` (V3 validée)  
**Brand de référence :** `docs/BRAND-QITUS.md`  
**Statut :** brief prêt pour exécution

---

## 1. Objectif de la page

Convertir des dirigeants et indépendants en inscrits beta gratuite. Une seule action cible : cliquer "Essayer gratuitement". Pas de compte à créer sur la page, pas de paiement — juste capturer l'email (ou rediriger vers le flow d'inscription).

**Ton visuel :** sobre, confiant, premium. Qitus est un notaire digital, pas une startup fun. Penser Stripe, Wise, Notion — pas Pennylane, pas Indy.

---

## 2. Palette — mise à jour

La palette BRAND-QITUS.md est la base, **avec une modification** : le vert profond `#2D6A4F` est remplacé. Il rappelle trop Pennylane (qui utilise du vert/teal sur tout son site).

| Rôle | Couleur | Hex | Usage |
|------|---------|-----|-------|
| Primaire | Bleu marine profond | `#1B2A4A` | Backgrounds sombres, texte titres, navbar |
| Secondaire | Blanc cassé / ivoire | `#F7F5F0` | Fond de page principal, cards |
| Accent | Or mat / bronze | `#C9A84C` | Boutons CTA, états de validation, badges "Auto" |
| Utilitaire | Gris ardoise | `#4A5568` | Texte corps, sous-titres, éléments secondaires |
| Succès | ~~Vert profond~~ → **Bleu confiance** | `#2B6CB0` | Checkmarks, états "prêt", confirmations |
| Alerte | Rouge brique | `#C53030` | Erreurs, états "à vérifier" (usage minimal) |

**Règle inchangée :** max 3 couleurs par écran. L'or mat reste réservé aux CTA et aux états de validation ("Validé par votre EC", badges).

**Interdit :** vert, teal, menthe, turquoise. Pas de teinte qui évoque Pennylane.

---

## 3. Typographie

| Usage | Famille | Exemples (au choix du designer) |
|-------|---------|--------------------------------|
| Logo / Titres de section | Serif moderne, traits fins | Cormorant Garamond, Freight Display, Editorial New |
| Subheadlines / corps | Sans-serif géométrique | Inter, Satoshi, General Sans |
| Chiffres dans le pricing | Monospace ou tabular lining | JetBrains Mono, IBM Plex Mono |

**Hiérarchie :**
- H1 (hero headline) : serif, gros, bleu marine, 48-64px desktop
- H2 (titres de section) : serif, 32-40px
- Body : sans-serif, 16-18px, gris ardoise `#4A5568`
- Labels / sous-boutons : sans-serif, 13-14px, gris clair

---

## 4. Structure de la page — 7 sections

La page fait ~4-5 écrans de scroll max. Chaque section est espacée généreusement. Le vide = maîtrise.

### Section 1 — Hero

**Layout :** split horizontal. Texte à gauche (60%), mockup produit à droite (40%).

**Contenu gauche :**
- Headline serif, 2 lignes : "Votre compta est faite. / Votre expert-comptable valide en 30 minutes."
- Subheadline sans-serif, gris ardoise, 2-3 lignes max
- Bouton CTA or mat : "Essayer gratuitement"
- Mention sous le bouton : "Beta gratuite. Sans engagement. Accès prioritaire." — petits caractères, gris clair

**Contenu droit :**
- Mockup dashboard Qitus (placeholder `[SCREENSHOT HERO]`)
- Montrer des transactions classées avec des badges "Auto" dorés
- Fond transparent ou ivoire léger — pas de cadre lourd

**Fond :** ivoire `#F7F5F0`  
**Pas de barre promo** (Qitus n'a pas de code promo, c'est gratuit)  
**Pas de Trustpilot** (on n'a pas de notes — ne rien mettre plutôt que du faux)

---

### Section 2 — Showcase produit (onglets)

**Layout :** barre d'onglets horizontale centrée en haut, puis contenu texte + visuel en dessous.

**Mécanique :** 3 onglets cliquables. Au clic, le contenu en dessous change (texte à gauche, animation/mockup à droite). Transition fade ou slide subtile.

| Onglet | Label | Texte gauche | Visuel droit |
|--------|-------|-------------|-------------|
| 1 (défaut) | Classement automatique | "Vos transactions classées automatiquement" + paragraphe | Mockup : liste de transactions, badges "Auto" dorés, 1 ligne "À confirmer" surlignée |
| 2 | Documents comptables | "Bilan, compte de résultat, TVA — générés automatiquement" + paragraphe | Mockup : liste de documents avec statuts "Prêt" (badge bleu confiance) |
| 3 | Collaboration EC | "Votre EC valide le dossier en 30 minutes" + paragraphe | Mockup : vue validation EC, bouton "Valider", historique |

**Style des onglets :**
- Onglet actif : fond bleu marine `#1B2A4A`, texte blanc
- Onglets inactifs : fond transparent, texte gris ardoise, bordure subtile
- Pas de coins trop arrondis — garder la sobriété (border-radius 6-8px max)

**Fond :** blanc pur `#FFFFFF` (contraste avec le ivoire du hero)

---

### Section 3 — Pricing

**Layout :** titre centré + 3 cards côte à côte.

**Titre :** "Des prix simples. Sans surprise."  
**Sous-titre :** "Pas d'engagement. Pas de frais cachés. Les premiers inscrits gardent leur tarif après la beta."

**Cards :**

| Card | Style |
|------|-------|
| Solo — 9,90 €/mois | Card blanche, bordure fine grise |
| Pro — 24,90 €/mois *(Recommandé)* | Card blanche, **bordure or mat** `#C9A84C`, badge "Recommandé" or mat en haut |
| Cabinet — 39 €/mois | Card blanche, bordure fine grise |

**Dans chaque card :**
- Nom du tier (serif, bold)
- Prix en gros (monospace, 36-48px)
- "/mois" en petit
- Description cible (1 ligne, gris)
- Liste de 4-5 features (sans-serif, puces simples — pas de checkmarks verts)
- Bouton "Essayer gratuitement" (or mat pour Pro, outline pour Solo et Cabinet)

**Sous les cards :** mention italique centrée "Beta gratuite — testez Qitus sans payer pendant toute la durée de la beta."

**Fond :** ivoire `#F7F5F0`

---

### Section 4 — Réassurance (break visuel)

**Layout :** full-width, fond bleu marine `#1B2A4A`. 3 blocs côte à côte, texte blanc.

| Bloc | Icône | Titre | Texte |
|------|-------|-------|-------|
| 1 | Checkmark circulaire (or mat) | Vos comptes sont justes dès le départ | Chaque transaction est classée selon les règles comptables qui correspondent à votre situation. Pas d'approximation. |
| 2 | Horloge (or mat) | Vos échéances sont sous contrôle | Qitus vous prévient avant chaque date limite — clôture, TVA, bilan. Vous n'êtes plus jamais en retard. |
| 3 | Bouclier (or mat) | Vos données restent en France | Serveurs sécurisés, hébergement français. Aucun transfert hors Union européenne. |

**Icônes :** linéaires, traits fins, couleur or mat `#C9A84C`. Style Lucide ou Phosphor (pas d'icônes pleines, pas de ronds colorés).

**Typographie :** titres en blanc, corps en blanc/80% opacité.

---

### Section 5 — CTA final + étapes

**Layout :** split horizontal inversé. Étapes à gauche (timeline verticale), titre + CTA à droite.

**Côté gauche — 3 étapes :**
- Timeline verticale avec 3 points connectés par une ligne fine
- Points : cercles or mat avec checkmark blanc dedans
- Chaque étape : titre bold + sous-texte gris

1. **Créez votre compte Qitus** — Renseignez vos informations. 2 minutes.
2. **Importez vos relevés bancaires** — Déposez le fichier de votre banque. Qonto, BNP, SG, Boursorama.
3. **C'est prêt.** — Vos transactions sont classées. Votre dossier est en route.

**Côté droit :**
- Titre serif grand : "Lancez-vous en 5 minutes."
- Bouton CTA or mat : "Essayer gratuitement"
- Mention : "Gratuit. Sans engagement. Accès prioritaire."

**Fond :** ivoire `#F7F5F0`

---

### Section 6 — FAQ

**Layout :** accordéon centré, largeur max 720px.

**Titre centré :** "Questions fréquentes."

**5 questions** (voir copy V3 pour le contenu). Chaque question est un bloc cliquable qui déroule la réponse.

**Style accordéon :**
- Question : sans-serif bold, 18px, gris ardoise
- Icône + / − à droite, or mat
- Réponse : sans-serif regular, 16px, gris clair
- Séparateur horizontal fin entre chaque question

**Fond :** blanc `#FFFFFF`

---

### Section 7 — Footer

**Layout :** minimaliste, une seule ligne.

"Qitus — La certitude comptable."  
Mentions légales · Contact · À propos

**Fond :** bleu marine `#1B2A4A`  
**Texte :** blanc/60% opacité  
**Liens :** blanc/80% au hover

Pas de colonnes, pas de newsletter, pas de réseaux sociaux — on est en beta, le footer est minimal.

---

## 5. Navbar

**Layout :** sticky top, fond blanc/ivoire, ombre légère au scroll.

**Contenu :**
- Logo Qitus à gauche (serif, bleu marine)
- Liens centraux : *(à déterminer post-launch, pour la beta on peut n'avoir que "Fonctionnalités" / "Tarifs" / "FAQ" comme ancres scroll)*
- Bouton CTA à droite : "Essayer gratuitement" (or mat, compact)

**Pas de menu hamburger complexe** — c'est une single-page beta, 3 liens ancres max.

---

## 6. Composants récurrents

### Bouton CTA primaire
- Fond or mat `#C9A84C`, texte bleu marine `#1B2A4A`
- Border-radius : 6-8px (sobre, pas rond)
- Hover : or mat +10% luminosité
- Ombre subtile (shadow-sm)

### Bouton secondaire
- Fond transparent, bordure bleu marine, texte bleu marine
- Hover : fond bleu marine 5% opacité

### Cards
- Fond blanc, bordure 1px gris clair `#E2E8F0`
- Border-radius : 8-12px
- Ombre subtile
- Pas de dégradés, pas de glassmorphism

### Badges
- "Auto" : fond or mat 15% opacité, texte or mat, border-radius 4px
- "Prêt" : fond bleu confiance 15% opacité, texte bleu confiance
- "À confirmer" : fond gris 10% opacité, texte gris ardoise

---

## 7. Responsive

**Breakpoints :** mobile (< 768px), tablette (768-1024px), desktop (> 1024px).

**Mobile :**
- Hero : layout vertical (texte au-dessus, mockup en dessous, plus petit)
- Onglets showcase : deviennent des cards empilées verticalement (pas d'onglets cliquables sur mobile — scroll vertical)
- Pricing : cards empilées, Pro en premier
- Réassurance : blocs empilés verticalement
- CTA final : layout vertical, étapes au-dessus, CTA en dessous
- FAQ : inchangée (accordéon fonctionne bien en mobile)

**Tablette :** hero et CTA final en stack vertical, le reste en layout desktop réduit.

---

## 8. Éléments graphiques signature (du brand brief)

- **Lignes fines horizontales** : évoquer les lignes d'un registre comptable. Utiliser comme séparateurs subtils entre sections (pas entre toutes — 2-3 max sur la page).
- **Espaces blancs généreux** : le vide est un choix de design, pas un oubli. Chaque section respire.
- **Or mat sur validation** : le doré n'apparaît que sur les CTA et les états de succès/validation. Jamais en fond de section, jamais en dégradé.

---

## 9. Ce qu'on ne fait PAS

| Interdit | Pourquoi |
|----------|----------|
| Palette pastel / tons bonbons | = Pennylane, Indy. On est dans le registre notaire, pas startup. |
| Vert, teal, menthe, turquoise | = Pennylane. Zéro vert sur la page. |
| Mascotte, illustrations cartoon | = Indy (photos lifestyle + UI), pas notre registre |
| Confettis, animations excessives | = gamification. Qitus est sobre. |
| Coins très arrondis (20px+) | = "friendly app". On veut "outil professionnel". 6-12px max. |
| Photos stock sourire forcé | Si photos, prise de vue naturelle style Notion/Stripe. Sinon, mockups UI seulement. |
| Faux social proof | Pas de "Rejoignez X utilisateurs" si on ne peut pas le prouver. Rien plutôt que du faux. |
| Dégradés forts, glassmorphism, dark mode intégral | Trop "tech". On cible des dirigeants, pas des devs. |

---

## 10. Livrables attendus

1. **Maquette desktop** (Figma) — toutes les sections, états des onglets, hover des CTA
2. **Maquette mobile** — responsive des 7 sections
3. **Composants** — boutons, cards, badges, onglets, accordéon FAQ, timeline étapes
4. **Spécifications** — espacements, tailles de typo, couleurs exactes pour chaque élément

**Format :** Figma partagé, avec un frame par section + un frame composants.

**Deadline :** à coordonner avec le fondateur.

---

## 11. Références visuelles

| Référence | Ce qu'on emprunte | Lien |
|-----------|-------------------|------|
| **Stripe** | Rigueur typographique, documentation premium, espaces blancs | stripe.com |
| **Wise** | Sobriété, confiance par la simplicité, palette contenue | wise.com |
| **Notion** | Calme, hiérarchie claire, espace blanc comme élément de design | notion.so |
| **Indy** (structure uniquement) | Flow de la page : hero → showcase onglets → pricing → réassurance → CTA → FAQ | indy.fr |

**Ce qu'on n'emprunte PAS :**
- Indy : palette pastel rose, ton décontracté, photos lifestyle
- Pennylane : vert/teal, ton "startup cool", densité d'information
- Tiime : interface chargée, ton artisanal
