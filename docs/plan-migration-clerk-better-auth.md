# Plan de migration Clerk → Better Auth — Qitus

Version : 2.0  
Date : 2026-05-23  
Statut : DRAFT  
Auteur : RP (assisté Claude CPO Advisor + review Codex)  
Estimation : 6-7 jours de dev (1 sprint dédié)

---

## 1. Contexte et motivation

### Pourquoi migrer

Clerk stocke les données d'authentification (email, nom, sessions) aux USA sur Google Cloud Platform, sans option de résidence EU. Le transfert repose sur le EU-US Data Privacy Framework (DPF), dont la pérennité est incertaine (appel CJUE C-703/25 P en cours). Pour un SaaS comptabilité ciblant les TPE/PME françaises, ce risque RGPD est structurel.

### Pourquoi Better Auth

- **Données d'identité en EU** : lib embarquée, données dans la PostgreSQL Qitus sur Clever Cloud France. Les données d'authentification (email, hash mot de passe, sessions, tokens) ne quittent pas l'infrastructure EU.
- **Pas de sous-traitant d'identité centralisé** : contrairement à Clerk qui stocke et gère l'identité de tes utilisateurs sur son infra US, Better Auth est une lib locale. Note : Google OAuth (pour le social login) et le SMTP domaine (pour les emails transactionnels) restent des sous-traitants au sens RGPD, mais ils ne stockent pas l'identité utilisateur.
- **TypeScript-first** : s'intègre nativement dans le stack Remix/Prisma
- **Gratuit** : open source MIT, pas de pricing au MAU

### Pourquoi maintenant

La base utilisateur est à zéro (pré-beta). C'est le moment le moins coûteux pour migrer — pas de données utilisateur réelles à transférer, pas de sessions actives à gérer, pas de communication de rupture.

### Scope MVP de migration

Le scope du sprint se concentre sur le socle auth minimum viable :

- Email/password + vérification email par OTP
- Google OAuth (social login)
- Reset password
- Session serveur

**Reporté au sprint suivant (post-stabilisation) :**
- MFA TOTP + backup codes + trusted devices
- MFA OTP email comme second facteur

Raison : MFA ajoute 3-4 écrans UI, des flows de fallback complexes, et de la surface de test. Pour une beta fermée avec 10-20 users de confiance, c'est de la sur-ingénierie. Mieux vaut un socle auth solide d'abord.

---

## 2. Décisions d'architecture (retours review Codex)

### 2.1 Séparation User métier / User auth

**Décision : garder le modèle `User` Prisma de Qitus séparé des tables auth Better Auth.**

Better Auth gère ses propres tables (`ba_user`, `session`, `account`, `verification`). Le modèle `User` métier Qitus conserve un champ `authSubjectId` (ex-`clerkId`) qui pointe vers le `ba_user.id` de Better Auth. L'`IdentityAdapter` fait le pont : il lit la session Better Auth, récupère le `user.id`, et cherche le `User` Qitus par `authSubjectId`. Si le user métier n'existe pas encore (premier login), il le crée.

Pourquoi : Better Auth reste un détail d'implémentation derrière l'interface `IdentityAdapter`. Si demain on doit remigrer (Ory, Hanko, custom), seul l'adapter change, pas le domaine métier Qitus.

### 2.2 EmailDeliveryAdapter avec SMTP domaine

**Décision : pas de sous-traitant email tiers (Brevo, Resend). Envoi via SMTP sur le domaine qitus.fr.**

Architecture adapter pattern :

```
EmailDeliveryAdapter (interface)
├── SmtpEmailAdapter      ← MVP : SMTP domaine qitus.fr via nodemailer
├── BrevoEmailAdapter     ← futur si besoin de scaling/deliverability
├── ResendEmailAdapter    ← futur si besoin de DX avancée
└── ConsoleEmailAdapter   ← mode dev : log OTP en console, pas d'envoi réel
```

L'interface `EmailDeliveryAdapter` expose une seule méthode :

```typescript
interface EmailDeliveryAdapter {
  send(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
}
```

Tous les points d'envoi Better Auth (`sendVerificationOTP`, `sendResetPassword`, `sendVerificationEmail`) appellent cet adapter, pas directement nodemailer. Changer de provider = écrire un nouvel adapter, zéro impact sur le code auth.

**SMTP domaine — prérequis :**

- Domaine `qitus.fr` (ou sous-domaine `mail.qitus.fr`) avec enregistrements DNS :
  - SPF : `v=spf1 include:<smtp-provider> ~all`
  - DKIM : clé publique en TXT record
  - DMARC : `v=DMARC1; p=quarantine; rua=mailto:dmarc@qitus.fr`
- Serveur SMTP : soit le SMTP du registrar domaine, soit MailPace (addon Clever Cloud natif, serveur EU), soit un relay SMTP dédié
- Nodemailer avec signature DKIM intégrée (support natif, pas de dépendance supplémentaire)

**Option Clever Cloud MailPace :** Clever Cloud propose MailPace comme addon managé, avec injection automatique des variables d'environnement. C'est un SMTP transactionnel hébergé EU, pas un sous-traitant email marketing. Le SMTP host est `smtp.mailpace.com:465` (TLS). Ça reste un sous-traitant technique, mais limité au transit — pas de stockage d'identité.

**Volume beta estimé :** 10-20 users beta × (1 inscription + ~2 resets/mois + ~0 2FA) = ~30-50 emails/mois. N'importe quel SMTP gère ça.

**Mode dev :** `ConsoleEmailAdapter` log l'OTP en console. Pas de SMTP en local. Pas de risque d'envoi accidentel.

### 2.3 Phase 0 — Spike technique

**Décision : ajouter une demi-journée de spike avant la migration.**

Objectif : valider avant de s'engager que Better Auth fonctionne correctement avec le stack Qitus.

Checklist du spike :

- [ ] `npx @better-auth/cli generate` produit un schéma Prisma sans conflit avec les tables existantes
- [ ] Le Prisma adapter fonctionne avec le `prisma` client existant
- [ ] Le handler Remix `api.auth.$.ts` route correctement les requêtes
- [ ] La session cookie se propage dans les loaders Remix (lecture via `auth.api.getSession({ headers })`)
- [ ] L'inscription email/password crée bien un `ba_user` + `account` + `session`
- [ ] Le mode dev (`ConsoleEmailAdapter`) affiche l'OTP en console

Si le spike échoue sur un point bloquant, la décision Clerk → Better Auth est réévaluée avant d'avoir engagé le sprint complet.

---

## 3. Cartographie de l'existant Clerk

### 3.1 Fichiers avec imports directs Clerk (5 fichiers)

| Fichier | Import Clerk | Usage |
|---|---|---|
| `app/root.tsx` | `ClerkProvider`, `rootAuthLoader` | Wrapper provider + SSR auth loader |
| `app/routes/login.tsx` | `SignIn` de `@clerk/remix` | Composant sign-in Clerk |
| `app/routes/signup.tsx` | `SignUp` de `@clerk/remix` | Composant sign-up Clerk |
| `app/routes/webhooks.clerk.ts` | (indirect) | Endpoint webhook Clerk |
| `app/modules/company-workspace/company-workspace.server.ts` | `getAuth` de `@clerk/remix/ssr.server` | **Point d'intégration central** — résolution identité dans chaque route protégée |

### 3.2 Fichiers à supprimer (2 fichiers)

| Fichier | Raison |
|---|---|
| `app/routes/webhooks.clerk.ts` | Plus de webhooks entrants — Better Auth gère les users localement |
| `app/modules/clerk-webhook/clerk-webhook-receiver.server.ts` | Pipeline webhook Svix + sync user — obsolète |

### 3.3 Fichiers de configuration (3 fichiers)

| Fichier | Changement |
|---|---|
| `app/modules/runtime-config.server.ts` | `AuthMode`: `"clerk"` → `"better-auth"`. Supprimer 3 vars Clerk, ajouter `BETTER_AUTH_SECRET`, `SMTP_*` |
| `app/modules/deployment/security-hardening-center.server.ts` | Renommer checks `auth_clerk` → `auth_better_auth` |
| `app/modules/deployment/beta-readiness-center.server.ts` | Supprimer check `clerkWebhookSecret`, ajouter check SMTP |

### 3.4 Composants UI (1 fichier)

| Fichier | Changement |
|---|---|
| `app/components/auth.tsx` | Supprimer `qitusClerkAppearance`. Garder `AuthLayout`. |

### 3.5 Schéma Prisma

| Modèle | Champ | Action |
|---|---|---|
| `User` | `clerkId String @unique` | Renommer en `authSubjectId` — pointe vers `ba_user.id` |
| `WebhookEvent` | (modèle entier) | Garder si réutilisé pour Stripe/Open Banking |
| (nouvelles tables) | Better Auth tables | Ajoutées par `npx @better-auth/cli generate` : `ba_user`, `session`, `account`, `verification` |

### 3.6 Variables d'environnement

| Variable | Action |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | Supprimer |
| `CLERK_SECRET_KEY` | Supprimer |
| `CLERK_WEBHOOK_SECRET` | Supprimer |
| `BETTER_AUTH_SECRET` | Ajouter (secret pour signer sessions/tokens, min 32 chars) |
| `BETTER_AUTH_URL` | Ajouter (URL publique de l'app, ex: `https://app.qitus.fr`) |
| `GOOGLE_CLIENT_ID` | Ajouter (OAuth Google) |
| `GOOGLE_CLIENT_SECRET` | Ajouter |
| `SMTP_HOST` | Ajouter (ex: `smtp.mailpace.com` ou SMTP registrar) |
| `SMTP_PORT` | Ajouter (ex: `465`) |
| `SMTP_USER` | Ajouter |
| `SMTP_PASSWORD` | Ajouter |
| `SMTP_FROM` | Ajouter (ex: `noreply@qitus.fr`) |

### 3.7 Dépendances NPM

| Package | Action |
|---|---|
| `@clerk/remix` | Supprimer |
| `svix` | Supprimer (sauf si réutilisé pour d'autres webhooks) |
| `better-auth` | Ajouter |
| `@better-auth/cli` | Ajouter (dev dependency) |
| `nodemailer` | Ajouter |
| `@types/nodemailer` | Ajouter (dev dependency) |

### 3.8 Tests impactés (5 fichiers)

| Fichier test | Impact |
|---|---|
| `tests/clerk-webhook-receiver.test.ts` | Supprimer |
| `tests/company-workspace.test.ts` | Adapter mocks `getAuth` → Better Auth session |
| `tests/runtime-config.test.ts` | Adapter assertions `authMode` |
| `tests/billing-entitlements.test.ts` | Adapter si mock Clerk identity |
| `tests/demo-local-access.test.ts` | Adapter si mock Clerk identity |

---

## 4. Architecture cible

### 4.1 EmailDeliveryAdapter

Créer `app/modules/auth/email-delivery.server.ts` :

```typescript
export interface EmailDeliveryAdapter {
  send(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
}

// --- Mode dev : log en console ---
export class ConsoleEmailAdapter implements EmailDeliveryAdapter {
  async send(params) {
    console.log(`[EMAIL-DEV] To: ${params.to} | Subject: ${params.subject}`);
    console.log(`[EMAIL-DEV] Body: ${params.text}`);
  }
}

// --- Mode production : SMTP domaine ---
export class SmtpEmailAdapter implements EmailDeliveryAdapter {
  private transporter: nodemailer.Transporter;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    this.from = config.from;
  }

  private from: string;

  async send(params) {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}

// --- Factory ---
export function createEmailAdapter(config: RuntimeConfig): EmailDeliveryAdapter {
  if (config.authMode === "dev") return new ConsoleEmailAdapter();
  return new SmtpEmailAdapter({
    host: config.smtpHost!,
    port: config.smtpPort,
    user: config.smtpUser!,
    password: config.smtpPassword!,
    from: config.smtpFrom!,
  });
}
```

### 4.2 Configuration Better Auth (serveur)

Créer `app/modules/auth/auth.server.ts` :

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "../db.server";
import { getRuntimeConfig } from "../runtime-config.server";
import { createEmailAdapter } from "./email-delivery.server";

const config = getRuntimeConfig();
const emailAdapter = createEmailAdapter(config);

export const auth = betterAuth({
  appName: "Qitus",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await emailAdapter.send({
        to: user.email,
        subject: "Qitus — Réinitialisation de mot de passe",
        text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${url}`,
        html: `<p>Cliquez sur <a href="${url}">ce lien</a> pour réinitialiser votre mot de passe.</p>`,
      });
    },
  },

  socialProviders: {
    google: {
      clientId: config.googleClientId!,
      clientSecret: config.googleClientSecret!,
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const subjects: Record<string, string> = {
          "sign-in": "Qitus — Code de connexion",
          "email-verification": "Qitus — Vérification de votre email",
          "forget-password": "Qitus — Code de réinitialisation",
        };
        await emailAdapter.send({
          to: email,
          subject: subjects[type] ?? "Qitus — Code de vérification",
          text: `Votre code de vérification Qitus : ${otp}\n\nCe code expire dans 5 minutes.`,
          html: `<p>Votre code de vérification Qitus : <strong>${otp}</strong></p><p>Ce code expire dans 5 minutes.</p>`,
        });
      },
    }),
  ],
});
```

Note : pas de plugin `twoFactor` dans le MVP. Sera ajouté au sprint suivant.

### 4.3 Client auth

Créer `app/modules/auth/auth.client.ts` :

```typescript
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
```

### 4.4 Route API handler

Créer `app/routes/api.auth.$.ts` (catch-all pour Better Auth) :

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { auth } from "~/modules/auth/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
```

### 4.5 Identity adapter migré

Dans `company-workspace.server.ts`, remplacer `ClerkIdentityAdapter` :

```typescript
import { auth } from "../auth/auth.server";

export interface IdentityAdapter {
  resolveIdentity(args: LoaderFunctionArgs): Promise<{
    authSubjectId: string;
    email?: string;
    name?: string | null;
  }>;
}

export class BetterAuthIdentityAdapter implements IdentityAdapter {
  async resolveIdentity(args: LoaderFunctionArgs) {
    const session = await auth.api.getSession({
      headers: args.request.headers,
    });
    if (!session?.user) throw redirect("/login");
    return {
      authSubjectId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  }
}

export class DevIdentityAdapter implements IdentityAdapter {
  async resolveIdentity(_args?: LoaderFunctionArgs) {
    return {
      authSubjectId: "dev-user",
      email: "demo@qitus.local",
      name: "Démo Qitus",
    };
  }
}
```

La fonction `getOrCreateWorkspaceForIdentity` change `clerkId` → `authSubjectId` dans toutes ses requêtes Prisma, mais la logique reste identique.

### 4.6 Schéma DB

Better Auth crée ses tables séparées (via `npx @better-auth/cli generate` puis `npx prisma migrate dev`) :

- `ba_user` — user d'auth (id, email, name, emailVerified, image, createdAt, updatedAt)
- `session` — sessions serveur (token, userId, expiresAt, ipAddress, userAgent)
- `account` — providers liés (userId, providerId, accountId, password hash, etc.)
- `verification` — tokens de vérification email, OTP

Le modèle `User` métier Qitus :

```prisma
model User {
  id              String   @id @default(cuid())
  authSubjectId   String   @unique   // ex-clerkId, pointe vers ba_user.id
  email           String   @unique
  name            String?
  // ... reste inchangé
}
```

---

## 5. Séquence de migration (par phases)

### Phase 0 — Spike technique (Jour 0, demi-journée)

| # | Tâche | Critère de validation |
|---|---|---|
| 0.1 | Installer `better-auth` + `nodemailer` dans une branche spike | Compilation OK |
| 0.2 | Exécuter `npx @better-auth/cli generate` avec Prisma adapter | Schéma généré sans conflit avec tables existantes |
| 0.3 | Appliquer migration Prisma en local | Tables `ba_user`, `session`, `account`, `verification` créées |
| 0.4 | Créer handler Remix `api.auth.$.ts` minimal | Route accessible GET/POST |
| 0.5 | Tester inscription email/password + `ConsoleEmailAdapter` | OTP affiché en console, `ba_user` créé en DB |
| 0.6 | Tester lecture session dans un loader Remix | `auth.api.getSession({ headers })` retourne le user |
| 0.7 | **Go/No-Go** : valider que le spike est concluant | Décision formelle avant sprint |

### Phase 1 — Fondations (Jour 1)

| # | Tâche | Fichiers |
|---|---|---|
| 1.1 | `npm install better-auth nodemailer` + `npm uninstall @clerk/remix svix` | `package.json` |
| 1.2 | Créer `app/modules/auth/email-delivery.server.ts` (EmailDeliveryAdapter + implémentations) | Nouveau fichier |
| 1.3 | Créer `app/modules/auth/auth.server.ts` (config Better Auth + emailOTP) | Nouveau fichier |
| 1.4 | Créer `app/modules/auth/auth.client.ts` (client plugins) | Nouveau fichier |
| 1.5 | Créer `app/routes/api.auth.$.ts` (handler catch-all) | Nouveau fichier |
| 1.6 | Ajouter env vars dans `.env` : `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_*`, `SMTP_*` | `.env` |
| 1.7 | Mettre à jour `RuntimeConfig` : changer `AuthMode`, ajouter nouvelles vars, supprimer vars Clerk | `runtime-config.server.ts` |
| 1.8 | Générer schéma Prisma Better Auth + renommer `User.clerkId` → `User.authSubjectId` | `prisma/schema.prisma` |
| 1.9 | Créer migration Prisma | `prisma/migrations/` |

### Phase 2 — Cœur auth (Jour 2)

| # | Tâche | Fichiers |
|---|---|---|
| 2.1 | Réécrire `IdentityAdapter` interface : `clerkId` → `authSubjectId` | `company-workspace.server.ts` |
| 2.2 | Supprimer `ClerkIdentityAdapter`, créer `BetterAuthIdentityAdapter` | `company-workspace.server.ts` |
| 2.3 | Mettre à jour `DevIdentityAdapter` | `company-workspace.server.ts` |
| 2.4 | Renommer toutes les refs `clerkId` → `authSubjectId` dans `getOrCreateWorkspaceForIdentity` | `company-workspace.server.ts` |
| 2.5 | Mettre à jour `CompanyWorkspace.authMode` : `"clerk"` → `"better-auth"` | `company-workspace.server.ts` |
| 2.6 | Mettre à jour `requireCompanyWorkspace` et `getOptionalWorkspaceShell` | `company-workspace.server.ts` |
| 2.7 | Grep + remplacer `clerkId` → `authSubjectId` dans tous les fichiers restants | `demo-dataset-seeder.server.ts`, etc. |

### Phase 3 — UI auth (Jour 3)

| # | Tâche | Fichiers |
|---|---|---|
| 3.1 | Réécrire `app/root.tsx` : supprimer `ClerkProvider` + `rootAuthLoader` | `app/root.tsx` |
| 3.2 | Réécrire `app/routes/login.tsx` : formulaire email/pwd + bouton Google OAuth | `app/routes/login.tsx` |
| 3.3 | Réécrire `app/routes/signup.tsx` : formulaire inscription + redirect vers vérification | `app/routes/signup.tsx` |
| 3.4 | Créer `app/routes/verify-email.tsx` : écran de saisie code OTP email | Nouveau fichier |
| 3.5 | Supprimer `qitusClerkAppearance` de `auth.tsx` | `app/components/auth.tsx` |
| 3.6 | Mettre à jour `app/routes/onboarding.tsx` : refs `authMode === "clerk"` → `"better-auth"` | `app/routes/onboarding.tsx` |

### Phase 4 — Nettoyage (Jour 4)

| # | Tâche | Fichiers |
|---|---|---|
| 4.1 | Supprimer `app/routes/webhooks.clerk.ts` | Suppression |
| 4.2 | Supprimer `app/modules/clerk-webhook/clerk-webhook-receiver.server.ts` | Suppression |
| 4.3 | Mettre à jour `security-hardening-center.server.ts` : renommer checks, ajouter check SMTP | Modification |
| 4.4 | Mettre à jour `beta-readiness-center.server.ts` : supprimer check webhook Clerk, ajouter check SMTP | Modification |
| 4.5 | Supprimer vars Clerk du `.env` | `.env` |
| 4.6 | Grep global `clerk` / `Clerk` / `clerkId` pour traquer les résidus | Tous fichiers |

### Phase 5 — Tests + sécurité (Jour 5)

| # | Tâche | Fichiers |
|---|---|---|
| 5.1 | Supprimer `tests/clerk-webhook-receiver.test.ts` | Suppression |
| 5.2 | Adapter `tests/company-workspace.test.ts` (mock BetterAuthIdentityAdapter) | Test |
| 5.3 | Adapter `tests/runtime-config.test.ts` (assertions `better-auth`) | Test |
| 5.4 | Adapter `tests/billing-entitlements.test.ts` si mock identity | Test |
| 5.5 | Adapter `tests/demo-local-access.test.ts` si mock identity | Test |
| 5.6 | Créer `tests/email-delivery.test.ts` (unit test ConsoleEmailAdapter + SmtpEmailAdapter mock) | Nouveau test |
| 5.7 | Tester manuellement : inscription email/pwd → OTP → email vérifié → session | Manuel |
| 5.8 | Tester manuellement : login email/pwd, Google OAuth, logout | Manuel |
| 5.9 | Tester manuellement : reset password → OTP → nouveau mdp → login OK | Manuel |
| 5.10 | Valider checklist sécurité auth (voir section 7) | Manuel |

### Phase 6 — Documentation & RGPD (Jour 6)

| # | Tâche | Fichiers |
|---|---|---|
| 6.1 | Mettre à jour `cadrage-rgpd-qitus.md` : supprimer Clerk, ajouter auth locale + SMTP domaine | `docs/cadrage-rgpd-qitus.md` |
| 6.2 | Mettre à jour la politique de confidentialité (draft) | À créer |
| 6.3 | Mettre à jour `CONTEXT.md` et `ROADMAP.md` | Docs projet |
| 6.4 | Mettre à jour `beta-ops-checklist.md` et `deployment-beta.md` | Docs ops |
| 6.5 | Créer le projet Google Cloud Console pour OAuth (Google client ID/secret) | Console Google |
| 6.6 | Configurer DNS domaine qitus.fr : SPF, DKIM, DMARC | Registrar domaine |

---

## 6. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Spike Phase 0 échoue (incompatibilité Prisma/Remix) | Faible | Élevé | Go/No-Go formel. Si échec → rester sur Clerk avec DPA signé, réévaluer Hanko. |
| Régression auth sur routes protégées | Moyenne | Élevé | Tests manuels systématiques de chaque route après Phase 2 |
| Schéma Prisma Better Auth en conflit avec tables existantes | Faible | Moyen | Phase 0 spike valide exactement ce point |
| SMTP deliverability faible (emails OTP en spam) | Moyenne | Moyen | SPF/DKIM/DMARC bien configurés. Fallback : migrer vers MailPace (addon Clever Cloud). |
| Google OAuth mal configuré | Faible | Faible | Tester en local avec callback `http://localhost:3000/api/auth/callback/google` |
| Perte de la compatibilité mode `dev` | Faible | Moyen | `DevIdentityAdapter` reste, `ConsoleEmailAdapter` log les OTP en console |

---

## 7. Checklist sécurité auth (manque identifié par Codex)

### 7.1 Ce que Better Auth gère nativement

- [x] Hashing mot de passe (bcrypt, configurable)
- [x] Sessions signées (cookie HttpOnly)
- [x] Protection CSRF (token automatique)
- [x] Comparaison constante-time pour OTP/TOTP
- [x] Chiffrement des secrets TOTP en base (quand MFA activé)

### 7.2 À implémenter / configurer (responsabilité Qitus)

- [ ] **Rate limiting login** : limiter les tentatives de connexion par IP et par email (ex: 5 tentatives / 15 min). Implémenter via middleware Remix ou via un rate limiter Redis (BullMQ déjà dans le stack).
- [ ] **Rate limiting OTP** : Better Auth gère `allowedAttempts` (défaut 3), mais le rate limiting sur l'envoi (anti-flood) est à ajouter côté application.
- [ ] **Politique mot de passe** : longueur minimum (12 chars recommandé pour un SaaS compta), complexité. Better Auth supporte `minPasswordLength` dans la config.
- [ ] **Anti-enumération d'email** : ne pas révéler si un email est déjà enregistré dans les réponses d'erreur login/signup/reset. Better Auth a une option pour ça.
- [ ] **Cookies sécurisés** : `HttpOnly`, `Secure`, `SameSite=Lax`. Better Auth les configure par défaut en production, mais vérifier via le spike.
- [ ] **Expiration sessions** : configurer une durée de session raisonnable (ex: 7 jours, refresh automatique).
- [ ] **Journalisation des événements auth** : login réussi/échoué, inscription, reset password, changement email. Brancher sur `ActivityLog` existant.
- [ ] **Révocation de sessions** : permettre à l'utilisateur de voir et révoquer ses sessions actives (écran "Appareils connectés"). Reporté post-MVP.

---

## 8. Sous-traitants RGPD post-migration

| Sous-traitant | Fonction | Données | Localisation | Stocke l'identité ? |
|---|---|---|---|---|
| **Clever Cloud** | Hébergement app + DB | Toutes (transit + compute + persistence) | France | Oui (DB PostgreSQL) |
| **SMTP domaine** (ou MailPace) | Transit email transactionnel | Adresse email destinataire, contenu email | EU (MailPace) ou registrar | Non (transit uniquement) |
| **Google OAuth** | Flow d'authentification social login | Email Google, nom (pendant le flow OAuth) | USA | Non (pas de stockage côté Qitus, données en session locale) |
| **Stripe** | Facturation abonnement | email, stripeCustomerId | USA (SOC 2, DPF) | Non |
| **Anthropic** | IA suggestions catégorisation | Libellés transactions (anonymisables) | USA (zero-retention API) | Non |

Clerk est **supprimé** de la liste des sous-traitants.

---

## 9. Checklist de validation post-migration

### Fonctionnel

- [ ] `AUTH_MODE=better-auth` fonctionne en local
- [ ] `AUTH_MODE=dev` fonctionne toujours (mode développement)
- [ ] Inscription email/password → OTP email reçu (ou en console en dev) → email vérifié → session créée
- [ ] Login email/password → session créée → accès dashboard
- [ ] Login Google OAuth → callback → session créée → accès dashboard
- [ ] Reset password → OTP email → nouveau mot de passe → login OK
- [ ] Logout → session détruite → redirect login
- [ ] Onboarding complet après première inscription

### Technique

- [ ] `grep -ri "clerk" app/ prisma/ tests/` → zéro résultat (sauf docs historiques)
- [ ] `npm ls @clerk/remix` → not found
- [ ] Tests Vitest passent (`npm test`)
- [ ] Security hardening center → tous checks verts
- [ ] Beta readiness center → tous checks verts
- [ ] DNS qitus.fr : SPF + DKIM + DMARC configurés et validés
- [ ] Email test envoyé via SMTP → reçu en inbox (pas spam)

### Sécurité

- [ ] Rate limiting login actif
- [ ] Rate limiting OTP envoi actif
- [ ] Politique mot de passe min 12 chars
- [ ] Cookies HttpOnly + Secure + SameSite en production
- [ ] Pas d'enumération d'email dans les réponses d'erreur

---

## 10. Sprint suivant (post-stabilisation)

Scope : MFA / 2FA

- Activer plugin `twoFactor` dans Better Auth
- Écran activation TOTP (QR code + vérification code)
- Écran saisie code TOTP au login
- Backup codes (génération, affichage, utilisation)
- Trusted devices (30 jours)
- OTP email comme méthode 2FA alternative
- Tests manuels et automatisés des flows MFA
- Mise à jour documentation sécurité
