import { Link } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";

const SETTINGS_CARDS = [
  {
    title: "Entreprise & fiscalité",
    description: "Modifier le nom, le SIREN, le régime TVA, l'exigibilité et le mode d'imposition.",
    href: "/profil",
    action: "Ouvrir l'entreprise",
  },
  {
    title: "Exercices",
    description: "Créer, consulter ou activer l'exercice comptable à utiliser.",
    href: "/exercices",
    action: "Gérer les exercices",
  },
  {
    title: "Connecteurs",
    description: "Configurer Qonto, Stripe, Open Banking et la facturation électronique.",
    href: "/connecteurs",
    action: "Configurer les connecteurs",
  },
  {
    title: "Règles de classement",
    description: "Consulter les corrections apprises et les règles fournisseur prioritaires.",
    href: "/corrections",
    action: "Ouvrir les règles",
  },
  {
    title: "Règles comptables",
    description: "Vérifier les règles Qitus utilisées pour les prochains imports.",
    href: "/regles-comptables",
    action: "Voir les règles comptables",
  },
  {
    title: "Abonnement",
    description: "Consulter le plan, l'usage mensuel et les actions de facturation.",
    href: "/abonnement",
    action: "Gérer l'abonnement",
  },
  {
    title: "Activité",
    description: "Consulter l'historique des actions, imports et modifications dans Qitus.",
    href: "/activity",
    action: "Voir l'activité",
  },
  {
    title: "Confidentialité",
    description: "Exporter vos données, consulter la politique de confidentialité et gérer les demandes RGPD.",
    href: "/profil",
    action: "Gérer mes données",
  },
];

export default function Parametres() {
  return (
    <AppShell active="parametres">
      <Main title="Paramètres" subtitle="Configuration de Qitus, de l'entreprise et des accès externes.">
        <div className="settings-grid">
          {SETTINGS_CARDS.map((card) => (
            <Link className="card settings-card" to={card.href} key={`${card.title}-${card.href}`}>
              <div>
                <h2>{card.title}</h2>
                <p className="sub">{card.description}</p>
              </div>
              <span className="btn btn-sm">{card.action}</span>
            </Link>
          ))}
        </div>
      </Main>
    </AppShell>
  );
}
