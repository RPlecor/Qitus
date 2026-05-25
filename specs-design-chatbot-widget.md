# Qitus — Spécifications design du widget chatbot

**Version** : 1.0  
**Date** : 23 mai 2026  
**Auteur** : RP / Direction artistique Qitus  
**Statut** : Draft — à valider avant implémentation

---

## 1. Positionnement et philosophie

Le chatbot Qitus est un **assistant contextuel sticky**, toujours accessible sans interrompre le travail de l'utilisateur. Il suit le pattern « Intercom-style » : une bulle compacte en bas à droite qui s'ouvre en panneau flottant.

Deux contextes d'usage :

- **In-task** : l'utilisateur travaille sur un écran comptable (transactions, TVA, clôture) et a une question ponctuelle. Le widget ne doit jamais masquer l'interface principale de manière gênante.
- **Dédié** : l'utilisateur ouvre le chat spécifiquement pour poser une question (prospection, onboarding, exploration).

Le design s'inscrit dans le design system Qitus v2 (mai 2026) — même palette, même typographie, même langage de formes.

---

## 2. Anatomie du composant

### 2.1 FAB (Floating Action Button)

| Propriété | Valeur |
|-----------|--------|
| Position | `fixed`, bottom: 24px, right: 24px |
| Dimensions | 56×56px |
| Forme | Cercle (`border-radius: 50%`) |
| Couleur fond | `--green-700` (#1B6B4A) |
| Couleur fond hover | `--green-900` (#0F3D2B) |
| Icône | Chat bubble, 24×24px, fill blanc |
| Ombre | `--shadow-lg` |
| z-index | 9999 |

**États** :

- **Fermé** : icône chat bubble + tooltip « Une question comptable ? » au survol (à gauche du bouton)
- **Ouvert** : icône se transforme en croix (×), pas de tooltip
- **Badge notification** : pastille rouge 18×18px en haut à droite, chiffre blanc, border 2px blanc. Apparaît quand le bot a une réponse en attente.

### 2.2 Panneau de chat

| Propriété | Valeur |
|-----------|--------|
| Position | `fixed`, bottom: 92px, right: 24px |
| Dimensions | 380×560px |
| Max-height | `calc(100vh - 120px)` |
| Fond | `--white` (#FFFFFF) |
| Border-radius | `--r-lg` (16px) |
| Bordure | 1px solid `--sand-200` (#E7E5E4) |
| Ombre | `--shadow-lg` |
| z-index | 9998 |

Le panneau se décompose verticalement en 5 zones :

```
┌──────────────────────┐
│     HEADER (68px)    │  ← fond vert --green-700
├──────────────────────┤
│                      │
│   ZONE CONTENU       │  ← Welcome OU Messages
│   (flex: 1, scroll)  │
│                      │
├──────────────────────┤
│  DISCLAIMER (32px)   │  ← fond --sand-50
├──────────────────────┤
│   INPUT (66px)       │  ← fond blanc
└──────────────────────┘
```

### 2.3 Header

- **Fond** : `--green-700` (#1B6B4A), plein
- **Avatar bot** : cercle 36×36px, fond `rgba(255,255,255,0.2)`, icône chat 20px blanc
- **Titre** : « Assistant Qitus », 15px, weight 600, blanc
- **Status** : « En ligne », 12px, opacity 0.8, dot vert #4ade80 6×6px
- **Action** : bouton « Nouvelle conversation » (icône +), 32×32px, fond `rgba(255,255,255,0.1)`, hover 0.2

### 2.4 Zone contenu — Écran d'accueil (Welcome)

Affiché quand aucune conversation n'est active :

- **Icône** : cercle 56×56px, fond `--green-50`, icône point d'interrogation 28px `--green-700`
- **Titre** : « Bonjour ! Comment puis-je vous aider ? », font-display (Instrument Serif), 20px, `--sand-900`
- **Sous-titre** : 13px, `--sand-500`, max-width 280px, centré
- **Quick actions** : 4 chips (pills) — fond `--sand-50`, border `--sand-200`, radius 20px, 13px, hover → fond `--green-50`, border `--green-100`, couleur `--green-700`

Chips par défaut :

1. « Taux de TVA »
2. « Import bancaire »
3. « Comptes PCG »
4. « Clôture annuelle »

Ces chips sont contextualisables côté serveur selon l'écran actif de l'utilisateur.

### 2.5 Zone contenu — Messages

- **Scroll** : `overflow-y: auto`, scrollbar custom 4px, track transparent, thumb `--sand-300`
- **Gap entre messages** : 16px
- **Max-width message** : 92% de la largeur du conteneur

**Message bot (gauche)** :

| Élément | Spec |
|---------|------|
| Avatar | 28×28px, cercle, fond `--green-50`, icône 14px `--green-700` |
| Bulle | fond `--sand-50`, border 1px `--sand-200`, radius `2px var(--r) var(--r) var(--r)` (coin haut-gauche angulaire) |
| Texte | 14px, `--sand-800`, line-height 1.55 |
| Padding bulle | 12px 14px |

**Message utilisateur (droite)** :

| Élément | Spec |
|---------|------|
| Bulle | fond `--green-700`, couleur blanc, radius `var(--r) 2px var(--r) var(--r)` (coin haut-droit angulaire) |
| Texte | 14px, blanc, line-height 1.55 |
| Padding bulle | 12px 14px |

**Horodatage** : 11px, `--sand-400`, margin-top 4px.

### 2.6 Bloc sources / citations

Affiché sous les messages bot qui citent des sources réglementaires ou Qitus :

| Propriété | Valeur |
|-----------|--------|
| Fond | `--green-50` (#F4FAF7) |
| Bordure | 1px solid `--green-100` (#E8F5EE) |
| Border-radius | `--r-sm` (6px) |
| Padding | 8px 12px |
| Titre | « SOURCES », 11px, weight 600, `--green-700`, uppercase, letter-spacing 0.05em |

Chaque source : icône 12px + texte 12px `--green-800`, cliquable (hover underline + `--green-600`).

### 2.7 Indicateur de saisie (typing)

Même structure que le message bot (avatar + bulle) avec 3 dots pulsants :

- Dots : 7×7px, cercle, couleur `--sand-400`
- Animation : `typingPulse` 1.4s ease-in-out infinite, stagger 0.2s entre chaque dot
- Bulle padding : 14px 18px (légèrement plus large pour laisser respirer)

### 2.8 Disclaimer

- **Fond** : `--sand-50`
- **Bordure haute** : 1px solid `--sand-100`
- **Texte** : 11px, `--sand-400`, centré
- **Contenu** : « Outil pédagogique — ne constitue pas un avis comptable. En savoir plus »
- **Lien** : `--green-700`, hover underline

Ce disclaimer est **obligatoire** — cf. cadrage juridique (ordonnance 1945 art. 20). Il doit être visible en permanence, pas dans un scroll.

### 2.9 Zone de saisie

- **Textarea** : fond `--sand-50`, border 1px `--sand-200`, radius `--r` (10px), 14px, placeholder « Posez votre question… » en `--sand-400`
- **Focus** : border `--green-700`, fond blanc, box-shadow `0 0 0 3px rgba(27,107,74,0.1)`
- **Auto-resize** : min-height 42px, max-height 120px
- **Bouton envoi** : 42×42px, fond `--green-700`, radius `--r`, icône send 18px blanc. Hover → `--green-900`. Disabled → `--sand-200`.
- **Raccourci** : Entrée pour envoyer, Shift+Entrée pour saut de ligne

---

## 3. Animations et transitions

### 3.1 Ouverture / fermeture du panneau

| Propriété | Valeur |
|-----------|--------|
| Durée | 300ms |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` — var(--ease) |
| Transform fermé | `translateY(16px) scale(0.96)` |
| Transform ouvert | `translateY(0) scale(1)` |
| Opacity | 0 → 1 |
| Transform-origin | bottom right |

### 3.2 FAB

| Interaction | Animation |
|-------------|-----------|
| Hover | scale(1.08), ombre amplifiée, 300ms ease |
| Press | scale(0.96) |
| Icône switch | crossfade via display toggle (chat ↔ close) |

### 3.3 Messages entrants

```css
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Durée : 300ms, easing : var(--ease) */
```

### 3.4 Typing dots

```css
@keyframes typingPulse {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
  30%            { opacity: 1; transform: scale(1); }
}
/* Durée : 1.4s, easing : ease-in-out, infinite, stagger 0.2s */
```

### 3.5 Badge notification

- Apparition : `scale(0) → scale(1)` + `opacity 0 → 1`, 300ms ease
- Spring-like avec l'easing `var(--ease)`

### 3.6 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Responsive

### 4.1 Desktop (> 768px)

Comportement par défaut documenté ci-dessus. Le widget flotte au-dessus de l'interface Qitus sans interaction avec le layout de la page.

### 4.2 Tablette (481–768px)

Même comportement que desktop. Le panneau peut être réduit à 340px de large si l'espace est contraint.

### 4.3 Mobile (≤ 480px)

| Propriété | Changement |
|-----------|------------|
| Panneau | Plein écran (`width: 100%`, `height: 100%`, `border-radius: 0`) |
| Position | `bottom: 0`, `right: 0` |
| FAB | `bottom: 16px`, `right: 16px` |
| Header | Ajouter un bouton fermer explicite (la croix du FAB n'est plus visible derrière le panneau) |

---

## 5. Accessibilité

### 5.1 Sémantique et ARIA

- FAB : `role="button"`, `aria-label="Ouvrir l'assistant Qitus"`
- Panneau : `role="dialog"`, `aria-label="Assistant Qitus"`, `aria-modal="false"` (pas de trap focus — l'utilisateur peut continuer à interagir avec l'app)
- Messages : `role="log"`, `aria-live="polite"` sur le conteneur de messages
- Textarea : `aria-label="Votre message"`
- Bouton envoi : `aria-label="Envoyer"`, `title="Envoyer"`

### 5.2 Navigation clavier

- **Tab** : le FAB est focusable, le panneau contient les éléments interactifs dans l'ordre (chips/messages → input → send)
- **Entrée** : ouvre le panneau depuis le FAB, envoie un message depuis l'input
- **Escape** : ferme le panneau
- **Focus visible** : outline 2px solid `--green-700`, offset 3px

### 5.3 Contrastes

Tous les textes respectent le ratio WCAG 2.2 AA minimum :

| Combinaison | Ratio | Cible |
|-------------|-------|-------|
| `--sand-800` sur `--sand-50` (bulle bot) | ~12:1 | AA ✓ |
| Blanc sur `--green-700` (bulle user) | ~5.2:1 | AA ✓ |
| `--sand-400` sur blanc (timestamps) | ~3.9:1 | AA texte large ✓ |
| Blanc sur `--green-700` (header) | ~5.2:1 | AA ✓ |
| `--sand-400` sur `--sand-50` (placeholder) | ~3.5:1 | AA texte large ✓ |

### 5.4 Screen readers

- Les messages doivent être annoncés via `aria-live="polite"` quand ils arrivent
- L'indicateur de saisie doit avoir un `aria-label="L'assistant rédige une réponse"`
- Le disclaimer doit être lisible mais ne pas être annoncé à chaque focus (utiliser `aria-hidden` avec un `sr-only` statique)

---

## 6. États du composant

| État | FAB | Panneau | Contenu | Badge |
|------|-----|---------|---------|-------|
| **Fermé** | Icône chat | Masqué | — | Visible si notification |
| **Welcome** | Icône × | Ouvert | Écran d'accueil + chips | Masqué |
| **Conversation** | Icône × | Ouvert | Messages scrollables | Masqué |
| **Typing** | Icône × | Ouvert | Messages + dots pulsants | Masqué |
| **Erreur réseau** | Icône × | Ouvert | Message d'erreur inline dans la zone messages | — |
| **Quota atteint** | Icône × | Ouvert | Message upsell inline (plan Pro/Cabinet) | — |

### 6.1 État erreur réseau

Bulle bot spéciale :

```
⚠ Connexion interrompue — votre question a été conservée.
[Réessayer]
```

- Fond : `--orange-bg` (#FEF3E2), border `--orange-border` (#FDE68A)
- Bouton « Réessayer » : lien style `--green-700`

### 6.2 État quota atteint

```
Vous avez atteint votre limite de questions pour ce mois.
Passez au plan Pro pour des questions illimitées.
[Voir les plans]
```

- Fond : `--blue-bg`, border `--blue-border`
- Lien « Voir les plans » → route `/settings/subscription`

---

## 7. Tokens design récapitulatifs

```css
/* Couleurs widget */
--chat-header-bg: var(--green-700);
--chat-header-text: #FFFFFF;
--chat-bubble-bot-bg: var(--sand-50);
--chat-bubble-bot-border: var(--sand-200);
--chat-bubble-bot-text: var(--sand-800);
--chat-bubble-user-bg: var(--green-700);
--chat-bubble-user-text: #FFFFFF;
--chat-input-bg: var(--sand-50);
--chat-input-border: var(--sand-200);
--chat-input-focus-border: var(--green-700);
--chat-input-focus-shadow: rgba(27, 107, 74, 0.1);
--chat-source-bg: var(--green-50);
--chat-source-border: var(--green-100);
--chat-disclaimer-bg: var(--sand-50);
--chat-disclaimer-text: var(--sand-400);

/* Dimensions */
--chat-fab-size: 56px;
--chat-panel-width: 380px;
--chat-panel-height: 560px;
--chat-panel-radius: var(--r-lg);  /* 16px */
--chat-bubble-radius: var(--r);    /* 10px */
--chat-input-radius: var(--r);     /* 10px */
--chat-msg-max-width: 92%;

/* Animations */
--chat-panel-duration: 300ms;
--chat-panel-easing: var(--ease);
--chat-msg-duration: 300ms;
--chat-typing-duration: 1.4s;
```

---

## 8. Implémentation — Notes pour le développement

### 8.1 Composant React

Le widget sera un composant Remix monté au niveau du layout racine (`app/root.tsx`) afin d'être présent sur tous les écrans :

```
<ChatWidget
  isAuthenticated={boolean}
  currentRoute={string}          // pour contextualiser les chips
  subscription={SubscriptionTier}  // pour gating quota
  companyId={string}
/>
```

### 8.2 Persistance

- Les conversations sont persistées côté serveur (cf. `accounting-chat-center.server.ts`)
- L'état ouvert/fermé du widget est stocké en `sessionStorage` (reset à chaque session)
- Le panneau récupère la dernière conversation active au montage

### 8.3 Intégration avec le système de cascade

Le widget envoie les messages via l'API existante (`/api/chat/message`). Le serveur gère la cascade N0→N1→N2→N3 de manière transparente. Le widget n'a pas connaissance du niveau de cascade utilisé — il reçoit simplement la réponse et les sources associées.

### 8.4 Landing page (P2)

En version landing page (hors app), le widget sera identique visuellement mais :

- Pas de contextualisation utilisateur (pas de données de compte)
- Chips orientés conversion : « Qitus c'est quoi ? », « Combien ça coûte ? », « Essai gratuit »
- Quota limité (3 questions / session sans compte)
- CTA « Créer un compte gratuit » dans le header ou après le 3e message

---

## 9. Fichiers de référence

- **Mockup interactif** : `chatbot-widget-mockup.html` (même dossier)
- **Design system** : `app/styles/qitus.css`
- **Cadrage technique** : `cadrage-chatbot-ia-qitus.md`
- **Chat center** : `app/modules/chat/accounting-chat-center.server.ts`
- **Grounding** : `app/modules/chat/chat-answer-grounding.server.ts`
