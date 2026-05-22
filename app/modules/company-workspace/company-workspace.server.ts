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

export interface IdentityAdapter {
  resolveIdentity(args: LoaderFunctionArgs): Promise<{ clerkId: string; email?: string; name?: string | null }>;
}

export class DevIdentityAdapter implements IdentityAdapter {
  async resolveIdentity(_args?: LoaderFunctionArgs) {
    return { clerkId: "dev-user", email: "demo@paperasse.local", name: "Demo Paperasse" };
  }
}

export class ClerkIdentityAdapter implements IdentityAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async resolveIdentity(args: LoaderFunctionArgs) {
    const auth = await getAuth(args, { secretKey: this.config.clerkSecretKey });
    if (!auth.userId) throw redirect("/login");
    return { clerkId: auth.userId };
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
        email: identity.email ?? `${identity.clerkId}@clerk.paperasse.local`,
        name: identity.name ?? undefined,
      },
    });
  }

  let company = await prisma.company.findFirst({
    where: { userId: user.id, deletedAt: null },
    include: { fiscalYears: { orderBy: { startDate: "desc" } }, bankAccounts: true },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        userId: user.id,
        name: "ACME Digital",
        legalForm: "SASU",
        siren: "912345678",
        siret: "91234567800015",
        nafCode: "6202A",
        rcs: "RCS Paris",
        capital: 1000,
        addressStreet: "42 rue de la Paix",
        addressPostal: "75002",
        addressCity: "Paris",
        managerFirstName: "Marie",
        managerLastName: "Dupont",
        managerCivility: "Mme",
        managerRole: "President",
        corporateTax: "IS",
        vatRegime: "FRANCHISE",
        onboardingComplete: authMode === "dev",
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

  return { user, company, fiscalYear, bankAccount, subscription, authMode };
}
