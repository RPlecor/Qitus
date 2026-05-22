import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getAuth } from "@clerk/remix/ssr.server";
import type { BankAccount, Company, FiscalYear, User } from "@prisma/client";
import { SubscriptionCenter, tierLimits, type SubscriptionState } from "../billing/subscription-center.server";
import { prisma } from "../db.server";
import { resolveActiveFiscalYearId } from "../fiscal-years/fiscal-year-center.server";
import { assertRuntimeConfig, getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type CompanyWorkspace = {
  user: User;
  company: Company & { fiscalYears: FiscalYear[]; bankAccounts: BankAccount[] };
  fiscalYear: FiscalYear;
  bankAccount: BankAccount;
  subscription: SubscriptionState;
  authMode: "dev" | "clerk";
};

export type WorkspaceShellContext = {
  companyName: string;
  companyStatus: string;
  fiscalYearLabel: string;
  onboardingComplete: boolean;
};

export interface IdentityAdapter {
  resolveIdentity(args: LoaderFunctionArgs): Promise<{ clerkId: string; email?: string; name?: string | null }>;
}

export class DevIdentityAdapter implements IdentityAdapter {
  async resolveIdentity(_args?: LoaderFunctionArgs) {
    return { clerkId: "dev-user", email: "demo@qitus.local", name: "Démo Qitus" };
  }
}

export class ClerkIdentityAdapter implements IdentityAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async resolveIdentity(args: LoaderFunctionArgs) {
    const auth = await getAuth(args, { secretKey: this.config.clerkSecretKey });
    if (!auth.userId) throw redirect("/login");
    const claims = (auth.sessionClaims ?? {}) as Record<string, unknown>;
    const claimName = [stringClaim(claims.given_name), stringClaim(claims.family_name)].filter(Boolean).join(" ");
    return {
      clerkId: auth.userId,
      email: stringClaim(claims.email) ?? stringClaim(claims.primary_email_address),
      name: stringClaim(claims.name) ?? (claimName || null),
    };
  }
}

export class SubscriptionGateAdapter {
  async getSubscription(): Promise<SubscriptionState> {
    return {
      id: null,
      tier: "SOLO",
      status: "ACTIVE_STUB",
      provider: "NONE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      limits: tierLimits("SOLO"),
    };
  }
}

export async function requireCompanyWorkspace(args: LoaderFunctionArgs): Promise<CompanyWorkspace> {
  const config = assertRuntimeConfig(getRuntimeConfig());
  const identity = config.authMode === "clerk"
    ? await new ClerkIdentityAdapter(config).resolveIdentity(args)
    : await new DevIdentityAdapter().resolveIdentity(args);

  return getOrCreateWorkspaceForIdentity(identity, config.authMode, args.request);
}

export async function getOptionalWorkspaceShell(args: LoaderFunctionArgs): Promise<WorkspaceShellContext | null> {
  const config = getRuntimeConfig();
  if (config.authMode !== "clerk") return null;

  const auth = await getAuth(args, { secretKey: config.clerkSecretKey });
  if (!auth.userId) return null;

  const user = await prisma.user.findFirst({
    where: { clerkId: auth.userId, deletedAt: null },
    include: {
      companies: {
        where: { deletedAt: null },
        include: { fiscalYears: { orderBy: { startDate: "desc" } } },
        take: 1,
      },
    },
  });
  const company = user?.companies[0];
  const fiscalYear = company?.fiscalYears[0];
  if (!company || !fiscalYear) return null;
  return workspaceShellContext(company, fiscalYear);
}

export async function getDevCompanyWorkspace(): Promise<CompanyWorkspace> {
  const identity = await new DevIdentityAdapter().resolveIdentity({} as LoaderFunctionArgs);
  return getOrCreateWorkspaceForIdentity(identity, "dev");
}

export function getActiveFiscalYear(workspace: CompanyWorkspace) {
  return workspace.fiscalYear;
}

async function getOrCreateWorkspaceForIdentity(
  identity: { clerkId: string; email?: string; name?: string | null },
  authMode: "dev" | "clerk",
  request?: Request
): Promise<CompanyWorkspace> {
  let user = await prisma.user.findFirst({ where: { clerkId: identity.clerkId, deletedAt: null } });
  if (user && (identity.email || identity.name !== undefined)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email: identity.email ?? user.email, name: identity.name ?? user.name },
    });
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: identity.clerkId,
        email: identity.email ?? `${identity.clerkId}@qitus.local`,
        name: identity.name ?? undefined,
      },
    });
  }

  let company = await prisma.company.findFirst({
    where: { userId: user.id, deletedAt: null },
    include: { fiscalYears: { orderBy: { startDate: "desc" } }, bankAccounts: true },
  });

  if (!company) {
    const isDev = authMode === "dev";
    company = await prisma.company.create({
      data: {
        userId: user.id,
        name: isDev ? "ACME Digital" : "Entreprise à configurer",
        legalForm: "SASU",
        siren: isDev ? "912345678" : null,
        siret: isDev ? "91234567800015" : null,
        nafCode: isDev ? "6202A" : null,
        rcs: isDev ? "RCS Paris" : null,
        capital: isDev ? 1000 : null,
        addressStreet: isDev ? "42 rue de la Paix" : null,
        addressPostal: isDev ? "75002" : null,
        addressCity: isDev ? "Paris" : null,
        managerFirstName: isDev ? "Marie" : null,
        managerLastName: isDev ? "Dupont" : null,
        managerCivility: isDev ? "Mme" : null,
        managerRole: isDev ? "President" : null,
        corporateTax: "IS",
        vatRegime: "FRANCHISE",
        onboardingComplete: isDev,
        fiscalYears: {
          create: { startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
        },
        bankAccounts: {
          create: { bank: "Qonto", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" },
        },
      },
      include: { fiscalYears: { orderBy: { startDate: "desc" } }, bankAccounts: true },
    });
  }

  const activeFiscalYearId = request ? await resolveActiveFiscalYearId(request, company.fiscalYears) : company.fiscalYears[0]?.id ?? null;
  const fiscalYear = company.fiscalYears.find((candidate) => candidate.id === activeFiscalYearId) ?? company.fiscalYears[0] ?? await prisma.fiscalYear.create({
    data: { companyId: company.id, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
  });
  const bankAccount = company.bankAccounts[0] ?? await prisma.bankAccount.create({
    data: { companyId: company.id, bank: "Qonto", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" },
  });
  const subscription = await new SubscriptionCenter().getSubscription({ company });

  if (authMode === "clerk" && !company.onboardingComplete && request && !allowsIncompleteOnboarding(new URL(request.url).pathname)) {
    throw redirect("/onboarding");
  }

  return { user, company, fiscalYear, bankAccount, subscription, authMode };
}

export function workspaceShellContext(company: Company & { fiscalYears?: FiscalYear[] }, fiscalYear: FiscalYear): WorkspaceShellContext {
  return {
    companyName: company.name,
    companyStatus: company.legalForm,
    fiscalYearLabel: `${formatDate(fiscalYear.startDate)} – ${formatDate(fiscalYear.endDate)}`,
    onboardingComplete: company.onboardingComplete,
  };
}

function allowsIncompleteOnboarding(pathname: string) {
  return pathname === "/login"
    || pathname === "/signup"
    || pathname === "/onboarding"
    || pathname === "/api/companies"
    || pathname === "/webhooks/clerk"
    || pathname === "/healthz"
    || pathname === "/readyz"
    || pathname.startsWith("/shared/");
}

function stringClaim(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}
