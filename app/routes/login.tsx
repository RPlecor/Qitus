import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { SignIn } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { AuthLayout, qitusClerkAppearance } from "~/components/auth";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export function loader(_args: LoaderFunctionArgs) {
  return json({ authMode: getRuntimeConfig().authMode });
}

export default function Login() {
  const { authMode } = useLoaderData<typeof loader>();
  if (authMode === "clerk") {
    return (
      <AuthLayout
        title="Connexion à Qitus"
        footer={<p>Pas encore de compte ? <Link to="/signup">Créer mon espace Qitus</Link></p>}
      >
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          forceRedirectUrl="/dashboard"
          appearance={qitusClerkAppearance}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Connexion à Qitus"
      footer={<p>Pas encore de compte ? <Link to="/onboarding">Configurer l'entreprise démo</Link></p>}
    >
      <p className="sub">En développement local, Qitus utilise le compte démo intégré.</p>
      <div className="field">
        <label>Email</label>
        <input defaultValue="demo@qitus.local" />
      </div>
      <div className="field">
        <label>Mot de passe</label>
        <input type="password" defaultValue="qitus" />
      </div>
      <div className="form-actions">
        <Link to="/dashboard" className="btn btn-p">Continuer</Link>
        <Link to="/onboarding" className="btn">Créer un compte</Link>
      </div>
    </AuthLayout>
  );
}
