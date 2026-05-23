import { Form, Link, NavLink, useLocation, useRouteLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { alertClassForGuidanceTone, type ActionableGuidance, type ActionableGuidanceAction } from "~/modules/actionable-guidance";
import { ChatWidget } from "./chat-widget";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings2,
  Paperclip,
  BookOpen,
  Percent,
  GitCompareArrows,
  CheckCircle2,
  Lock,
  Building2,
  FileText,
  MessageCircle,
  User,
  Diamond,
  FolderCheck,
  LogOut,
  ReceiptText,
  ChevronDown,
  FileDown,
  FilePenLine,
  ChevronLeft,
} from "lucide-react";

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

type NavEntry = {
  id: string;
  icon: ReactNode;
  label: string;
  href: string;
  matchPrefixes?: string[];
  badge?: number;
};

type NavSection = {
  id: string;
  label: string;
  icon?: ReactNode;
  items: NavEntry[];
};

type NavigationModel = {
  dashboard: NavEntry;
  sections: NavSection[];
  bottom: NavEntry[];
};

const SIDEBAR_OPEN_SECTION_KEY = "qitus.sidebar.openSection";

function icon(node: ReactNode) {
  return node;
}

function buildNavigation(showDemo: boolean): NavigationModel {
  const dashboard: NavEntry = {
    id: "dashboard",
    icon: icon(<LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
    label: "Tableau de bord",
    href: "/dashboard",
    matchPrefixes: ["/dashboard", "/"],
  };
  const sections: NavSection[] = [
    {
      id: "operations",
      label: "Opérations",
      items: [
        { id: "imports", icon: icon(<FileDown size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Imports", href: "/imports", matchPrefixes: ["/imports"] },
        { id: "transactions", icon: icon(<ArrowLeftRight size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Transactions", href: "/transactions", matchPrefixes: ["/transactions"] },
        { id: "pieces", icon: icon(<Paperclip size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Justificatifs", href: "/pieces", matchPrefixes: ["/pieces"] },
        { id: "factures-entrantes", icon: icon(<ReceiptText size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Factures entrantes", href: "/factures-entrantes", matchPrefixes: ["/factures-entrantes"] },
      ],
    },
    {
      id: "accounting",
      label: "Comptabilité",
      items: [
        { id: "ecritures", icon: icon(<BookOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Écritures", href: "/ecritures", matchPrefixes: ["/ecritures"] },
        { id: "tva", icon: icon(<Percent size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "TVA", href: "/tva", matchPrefixes: ["/tva"] },
        { id: "rapprochements", icon: icon(<GitCompareArrows size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Rapprochements", href: "/rapprochements", matchPrefixes: ["/rapprochements"] },
        { id: "controle", icon: icon(<CheckCircle2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Contrôle", href: "/controle", matchPrefixes: ["/controle"] },
      ],
    },
    {
      id: "closing",
      label: "Clôture & export",
      items: [
        { id: "cloture", icon: icon(<Lock size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Clôture", href: "/cloture", matchPrefixes: ["/cloture"] },
        { id: "cloture-od", icon: icon(<FilePenLine size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "OD de clôture", href: "/cloture/od", matchPrefixes: ["/cloture/od", "/cloture/workpapers", "/controle/od"] },
        { id: "immobilisations", icon: icon(<Building2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Immobilisations", href: "/immobilisations", matchPrefixes: ["/immobilisations"] },
        { id: "documents", icon: icon(<FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Documents", href: "/documents", matchPrefixes: ["/documents"] },
        { id: "dossier-ec", icon: icon(<FolderCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Dossier expert-comptable", href: "/dossier-ec", matchPrefixes: ["/dossier-ec", "/shared"] },
      ],
    },
  ];
  const bottom: NavEntry[] = [
    { id: "parametres", icon: icon(<Settings2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Paramètres", href: "/parametres", matchPrefixes: ["/parametres", "/connecteurs", "/corrections", "/regles-comptables", "/abonnement", "/exercices", "/activity", "/profil"] },
    { id: "chat", icon: icon(<MessageCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Aide", href: "/chat", matchPrefixes: ["/chat"] },
    ...(showDemo ? [{ id: "demo", icon: icon(<Diamond size={ICON_SIZE} strokeWidth={ICON_STROKE} />), label: "Démo", href: "/demo", matchPrefixes: ["/demo"] }] : []),
  ];
  return { dashboard, sections, bottom };
}

export function AppShell({ children, active = "dashboard" }: { children: ReactNode; active?: string }) {
  const location = useLocation();
  const rootData = useRouteLoaderData("root") as {
    authMode?: string;
    shell?: { companyName: string; companyStatus: string; fiscalYearLabel: string; onboardingComplete: boolean } | null;
  } | undefined;
  const showDemo = rootData?.authMode === "dev";
  const shell = rootData?.shell;
  const navigation = useMemo(() => buildNavigation(showDemo), [showDemo]);
  const activeId = findActiveEntryId(navigation, location.pathname, active);
  const activeSectionId = findSectionForEntry(navigation.sections, activeId);
  const [openSectionId, setOpenSectionId] = useState<string | null>(location.pathname === "/dashboard" ? null : activeSectionId);

  useEffect(() => {
    if (location.pathname === "/dashboard") {
      setOpenSectionId(null);
      return;
    }
    if (activeSectionId) {
      setOpenSectionId(activeSectionId);
      window.localStorage.setItem(SIDEBAR_OPEN_SECTION_KEY, activeSectionId);
      return;
    }
    const stored = window.localStorage.getItem(SIDEBAR_OPEN_SECTION_KEY);
    if (stored && navigation.sections.some((section) => section.id === stored)) setOpenSectionId(stored);
    else setOpenSectionId(null);
  }, [activeSectionId, location.pathname, navigation.sections]);

  function toggleSection(sectionId: string) {
    const next = openSectionId === sectionId ? null : sectionId;
    setOpenSectionId(next);
    if (next) window.localStorage.setItem(SIDEBAR_OPEN_SECTION_KEY, next);
    else window.localStorage.removeItem(SIDEBAR_OPEN_SECTION_KEY);
  }

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
          <NavLink to={navigation.dashboard.href} className={`s-item s-main-item ${activeId === navigation.dashboard.id ? "active" : ""}`}>
            <span className="ic">{navigation.dashboard.icon}</span>
            {navigation.dashboard.label}
          </NavLink>
          {navigation.sections.map((section) => (
            <div className="s-section" key={section.id}>
              <button
                type="button"
                className={`s-section-trigger ${openSectionId === section.id ? "open" : ""} ${activeSectionId === section.id ? "active" : ""}`}
                aria-expanded={openSectionId === section.id}
                onClick={() => toggleSection(section.id)}
              >
                <span>{section.label}</span>
                <ChevronDown className="chev" size={14} strokeWidth={ICON_STROKE} />
              </button>
              <div className={`s-section-items ${openSectionId === section.id ? "open" : ""}`}>
                <div className="s-section-items-inner">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      className={`s-item ${activeId === item.id ? "active" : ""}`}
                    >
                      <span className="ic">{item.icon}</span>
                      {item.label}
                      {item.badge != null && item.badge > 0 ? <span className="badge-count">{item.badge}</span> : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
        <div className="s-bot">
          {navigation.bottom.map((item) => (
            <NavLink key={item.id} to={item.href} className={`s-item ${activeId === item.id ? "active" : ""}`}>
              <span className="ic">{item.icon}</span>
              {item.label}
              {item.badge != null && item.badge > 0 ? <span className="badge-count">{item.badge}</span> : null}
            </NavLink>
          ))}
          {rootData?.authMode === "clerk" ? <SignOutButton /> : null}
        </div>
      </aside>
      {children}
      <ChatWidget />
    </div>
  );
}

function findActiveEntryId(navigation: NavigationModel, pathname: string, fallbackId: string) {
  const entries = [navigation.dashboard, ...navigation.sections.flatMap((section) => section.items), ...navigation.bottom];
  const sorted = entries
    .flatMap((entry) => (entry.matchPrefixes ?? [entry.href]).map((prefix) => ({ entry, prefix })))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find(({ prefix }) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`)));
  return match?.entry.id ?? fallbackId;
}

function findSectionForEntry(sections: NavSection[], activeId: string) {
  return sections.find((section) => section.items.some((item) => item.id === activeId))?.id ?? null;
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
  backLink,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backLink?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <main className="main">
      <div className="topbar">
        <div className="tb-left">
          {backLink ? (
            <Link to={backLink.href} className="tb-back">
              <ChevronLeft size={14} strokeWidth={2} />
              {backLink.label}
            </Link>
          ) : null}
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
