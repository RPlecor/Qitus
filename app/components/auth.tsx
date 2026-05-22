import type { ReactNode } from "react";

export const qitusClerkAppearance = {
  variables: {
    colorPrimary: "#16a34a",
    colorText: "#1a1a1a",
    colorTextSecondary: "#64748b",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#1a1a1a",
    borderRadius: "8px",
    fontFamily: "\"DM Sans\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    fontFamilyButtons: "\"DM Sans\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  },
  elements: {
    rootBox: "qitus-clerk-root",
    card: "qitus-clerk-card",
    header: "qitus-clerk-hidden",
    headerTitle: "qitus-clerk-hidden",
    headerSubtitle: "qitus-clerk-hidden",
    socialButtonsBlockButton: "qitus-clerk-social-button",
    formButtonPrimary: "qitus-clerk-primary",
    formFieldInput: "qitus-clerk-input",
    footer: "qitus-clerk-hidden",
    footerAction: "qitus-clerk-hidden",
    footerPages: "qitus-clerk-hidden",
    footerPagesLink: "qitus-clerk-hidden",
    formFieldLabel: "qitus-clerk-label",
    identityPreviewText: "qitus-clerk-identity",
  },
};

export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label={title}>
        <div className="auth-copy">
          <div className="auth-brand" aria-label="Qitus">
            <span className="auth-brand-mark">Q</span>
            <span>Qitus</span>
          </div>
          <h1>{title}</h1>
          <p>Gérez votre dossier comptable, vos pièces et votre clôture depuis un espace sécurisé.</p>
          <div className="auth-proof">
            <span>Comptabilité guidée</span>
            <span>Preuves centralisées</span>
            <span>Clôture auditée</span>
          </div>
        </div>
        <div className="auth-card">
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
