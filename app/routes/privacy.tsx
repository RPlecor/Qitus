import { Link } from "@remix-run/react";

export default function PrivacyPolicyPage() {
  return (
    <main className="public-page">
      <section className="public-hero">
        <Link to="/" className="auth-brand public-brand" aria-label="Qitus">
          <span className="auth-brand-mark">Q</span>
          <span>Qitus</span>
        </Link>
        <p className="eyebrow">Confidentialité</p>
        <h1>Politique de confidentialité Qitus</h1>
        <p>
          Cette page explique quelles données Qitus traite, pourquoi elles sont utilisées, où elles sont hébergées,
          et comment exercer vos droits. Elle résume le cadrage RGPD beta ; la version juridique finale sera validée
          avant ouverture commerciale large.
        </p>
      </section>

      <section className="public-grid">
        <article className="card">
          <h2>Données traitées</h2>
          <p className="sub">Qitus traite les données nécessaires à votre dossier comptable : compte utilisateur, entreprise, transactions, écritures, justificatifs, documents, activité et demandes RGPD.</p>
        </article>
        <article className="card">
          <h2>Hébergement</h2>
          <p className="sub">Render reste utilisé pour le staging pré-beta. Avant beta ouverte avec données réelles, Qitus prévoit une migration de l'application et de PostgreSQL vers Clever Cloud en France.</p>
        </article>
        <article className="card">
          <h2>Authentification</h2>
          <p className="sub">Qitus utilise Clerk pour la connexion. Les données comptables, bancaires et justificatifs ne doivent jamais être synchronisés dans Clerk.</p>
        </article>
        <article className="card">
          <h2>Vos droits</h2>
          <p className="sub">Vous pouvez demander l'accès, l'export, la rectification, l'anonymisation ou la suppression protégée de vos données depuis votre compte Qitus.</p>
        </article>
      </section>

      <section className="card public-section">
        <h2>Finalités principales</h2>
        <ul className="check-list">
          <li>Créer et sécuriser votre compte Qitus.</li>
          <li>Préparer votre comptabilité, vos contrôles, vos documents et votre dossier expert-comptable.</li>
          <li>Conserver les preuves et l'audit nécessaires au suivi comptable.</li>
          <li>Vous proposer des aides de classement sans créer de décision comptable automatique non validée.</li>
        </ul>
      </section>

      <section className="card public-section">
        <h2>Sous-traitants et transferts</h2>
        <p className="sub">
          Qitus s'appuie notamment sur Clerk pour l'authentification, Render pour le pré-beta, Clever Cloud comme cible beta ouverte,
          Stripe pour l'abonnement si activé, et des connecteurs bancaires uniquement lorsque vous les configurez. Les transferts hors UE
          restants sont encadrés par DPA, DPF et/ou clauses contractuelles types selon les fournisseurs.
        </p>
      </section>

      <section className="card public-section">
        <h2>Conservation</h2>
        <p className="sub">
          Les données comptables et justificatifs peuvent devoir être conservés pendant les durées légales applicables.
          Les données non comptables, temporaires ou expirées sont destinées à être purgées selon une politique de conservation dédiée.
        </p>
      </section>

      <section className="card public-section">
        <h2>Contact</h2>
        <p className="sub">
          Pour toute demande confidentialité, utilisez les actions RGPD dans votre compte Qitus. Un contact privacy formel sera publié avant beta ouverte.
          Vous pouvez également déposer une réclamation auprès de la CNIL.
        </p>
        <div className="form-actions">
          <Link className="btn btn-p" to="/signup">Créer mon espace Qitus</Link>
          <Link className="btn" to="/login">Se connecter</Link>
        </div>
      </section>
    </main>
  );
}
