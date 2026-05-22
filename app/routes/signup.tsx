import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { SignUp } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { AuthLayout, qitusClerkAppearance } from "~/components/auth";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export function loader(_args: LoaderFunctionArgs) {
  return json({ authMode: getRuntimeConfig().authMode });
}

export default function Signup() {
  const { authMode } = useLoaderData<typeof loader>();
  if (authMode === "clerk") {
    return (
      <AuthLayout
        title="Créer mon espace Qitus"
        footer={<p>Déjà inscrit ? <Link to="/login">Se connecter à Qitus</Link></p>}
      >
        <SignUp
          routing="path"
          path="/signup"
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
          appearance={qitusClerkAppearance}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer mon espace Qitus"
      footer={<p>Déjà inscrit ? <Link to="/login">Retour connexion</Link></p>}
    >
      <p className="sub">En développement local, Qitus utilise le compte démo intégré.</p>
      <div className="form-actions">
        <Link to="/onboarding" className="btn btn-p">Configurer l'entreprise démo</Link>
        <Link to="/login" className="btn">Retour connexion</Link>
      </div>
    </AuthLayout>
  );
}
