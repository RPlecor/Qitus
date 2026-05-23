import { Form, Link, NavLink, useRouteLoaderData } from "@remix-run/react";
import type { ReactNode } from "react";
import { alertClassForGuidanceTone, type ActionableGuidance, type ActionableGuidanceAction } from "~/modules/actionable-guidance";
import {
  LayoutDashboard,
  Bell,
  Clock,
  Upload,
  ArrowLeftRight,
  Settings2,
  Paperclip,
  BookOpen,
  Percent,
  GitCompareArrows,
  CheckCircle2,
  Shield,
  Lock,
  Building2,
  FileText,
  MessageCircle,
  CreditCard,
  CalendarDays,
  User,
  Diamond,
  FolderCheck,
  Plug,
  LogOut,
  LibraryBig,
  ReceiptText,
} from "lucide-react";

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

type NavEntry = {
  id: string;
  icon: ReactNode;
  label: string;
  href: string;
};

type NavSection = {
  label: string;
  items: NavEntry[];
};

function buildNav(showDemo: boolean): NavSection[] {
  return [
    {
      label: "Pilotage",
      items: [
        { id: "dashboard", icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Tableau de bord", href: "/dashboard" },
        { id: "notifications", icon: <Bell size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Notifications", href: "/notifications" },
        { id: "activity", icon: <Clock size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Activité", href: "/activity" },
      ],
    },
    {
      label: "Opérations",
      items: [
        { id: "imports", icon: <Upload size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Imports", href: "/imports" },
        { id: "connecteurs", icon: <Plug size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Connecteurs", href: "/connecteurs" },
        { id: "transactions", icon: <ArrowLeftRight size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Transactions", href: "/transactions" },
        { id: "corrections", icon: <Settings2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Règles", href: "/corrections" },
        ...(showDemo
          ? [{ id: "regles-comptables", icon: <LibraryBig size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Règles comptables", href: "/regles-comptables" }]
          : []),
        { id: "pieces", icon: <Paperclip size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Pièces", href: "/pieces" },
        { id: "factures-entrantes", icon: <ReceiptText size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Factures entrantes", href: "/factures-entrantes" },
      ],
    },
    {
      label: "Comptabilité",
      items: [
        { id: "ecritures", icon: <BookOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Écritures", href: "/ecritures" },
        { id: "tva", icon: <Percent size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "TVA", href: "/tva" },
        { id: "rapprochements", icon: <GitCompareArrows size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Rapprochements", href: "/rapprochements" },
        { id: "controle", icon: <CheckCircle2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Contrôle", href: "/controle" },
        { id: "couverture", icon: <Shield size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Couverture EC", href: "/couverture" },
      ],
    },
    {
      label: "Clôture",
      items: [
        { id: "cloture", icon: <Lock size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Clôture", href: "/cloture" },
        { id: "immobilisations", icon: <Building2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Immobilisations", href: "/immobilisations" },
        { id: "documents", icon: <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Documents", href: "/documents" },
        { id: "dossier-ec", icon: <FolderCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Dossier EC", href: "/dossier-ec" },
      ],
    },
    {
      label: "Administration",
      items: [
        { id: "chat", icon: <MessageCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Chat", href: "/chat" },
        { id: "abonnement", icon: <CreditCard size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Abonnement", href: "/abonnement" },
        { id: "exercices", icon: <CalendarDays size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Exercices", href: "/exercices" },
        ...(showDemo
          ? [{ id: "demo", icon: <Diamond size={ICON_SIZE} strokeWidth={ICON_STROKE} />, label: "Démo", href: "/demo" }]
          : []),
      ],
    },
  ];
}

export function AppShell({ children, active = "dashboard" }: { children: ReactNode; active?: string }) {
  const rootData = useRouteLoaderData("root") as {
    authMode?: string;
    shell?: { companyName: string; companyStatus: string; fiscalYearLabel: string; onboardingComplete: boolean } | null;
  } | undefined;
  const showDemo = rootData?.authMode === "dev";
  const shell = rootData?.shell;
  const sections = buildNav(showDemo);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="s-brand" aria-label="Qitus">
          <span className="s-brand-name"><span className="q">Q</span>itus</span>
        </div>
        <div className="s-id">
          <strong>{shell?.companyName ?? "Qitus Démo"}</strong>
          <span>
            {shell ? `${shell.companyStatus} · Exercice ${shell.fiscalYearLabel}` : "SASU · Exercice 01/01 – 31/12/2025"}
          </span>
          {shell && !shell.onboardingComplete ? <span>Configuration à terminer</span> : null}
        </div>
        <nav className="s-nav">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="s-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  className={`s-item ${active === item.id ? "active" : ""}`}
                >
                  <span className="ic">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="s-bot">
          <NavLink to="/profil" className={`s-item ${active === "profil" ? "active" : ""}`}>
            <span className="ic">
              <User size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </span>
            Profil
          </NavLink>
          {rootData?.authMode === "clerk" ? <SignOutButton /> : null}
        </div>
      </aside>
      {children}
    </div>
  );
}

function SignOutButton() {
  return (
    <button
      type="button"
      className="s-item s-item-btn"
      onClick={() => {
        const clerk = (window as typeof window & { Clerk?: { signOut: (options?: { redirectUrl?: string }) => Promise<void> } }).Clerk;
        void clerk?.signOut({ redirectUrl: "/login" });
      }}
    >
      <span className="ic">
        <LogOut size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </span>
      Déconnexion
    </button>
  );
}

export function Main({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="main">
      <div className="topbar">
        <div className="tb-left">
          <b>{title}</b>
          {subtitle ? ` — ${subtitle}` : null}
        </div>
        {action}
      </div>
      <div className="content">{children}</div>
    </main>
  );
}

export function ButtonLink({
  to,
  children,
  primary = false,
}: {
  to: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link className={`btn ${primary ? "btn-p" : ""}`} to={to}>
      {children}
    </Link>
  );
}

export function GuidanceAlert({ guidance }: { guidance: ActionableGuidance }) {
  return (
    <div className={`alert guidance-alert ${alertClassForGuidanceTone(guidance.tone)}`}>
      <div className="guidance-copy">
        <strong>{guidance.title}</strong>
        <span>{guidance.message}</span>
      </div>
      <div className="guidance-actions">
        {guidance.primaryAction ? <GuidanceAction action={guidance.primaryAction} primary /> : null}
        {guidance.secondaryAction ? <GuidanceAction action={guidance.secondaryAction} /> : null}
      </div>
    </div>
  );
}

export function GuidanceList({ items }: { items: ActionableGuidance[] }) {
  if (items.length === 0) return null;
  return (
    <div className="guidance-list">
      {items.map((item) => (
        <GuidanceAlert key={`${item.source}:${item.title}:${item.message}`} guidance={item} />
      ))}
    </div>
  );
}

function GuidanceAction({ action, primary = false }: { action: ActionableGuidanceAction; primary?: boolean }) {
  const className = `btn btn-sm ${primary ? "btn-p" : ""}`;
  if (action.method === "post") {
    return (
      <Form method="post" action={action.href}>
        <button className={className} type="submit">{action.label}</button>
      </Form>
    );
  }
  return <Link className={className} to={action.href}>{action.label}</Link>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="table-shell">{children}</div>;
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <span className="kpi-val">{value}</span>
      {hint ? <div className="sub">{hint}</div> : null}
    </div>
  );
}

export type StatusTone = "ok" | "warn" | "error" | "done" | "pending" | "neutral" | "info";

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

export function StatusBadge({
  status,
}: {
  status: "ok" | "warn" | "error" | "done" | "pending";
}) {
  const config: Record<string, { label: string; tone: StatusTone }> = {
    ok: { label: "✓ Catégorisé", tone: "ok" },
    warn: { label: "À vérifier", tone: "warn" },
    error: { label: "Erreur", tone: "error" },
    done: { label: "Terminé", tone: "done" },
    pending: { label: "En cours", tone: "pending" },
  };
  const { label, tone } = config[status] ?? config.ok;
  return <StatusPill label={label} tone={tone} />;
}
