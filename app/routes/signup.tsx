import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { SignUp } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export function loader(_args: LoaderFunctionArgs) {
  return json({ authMode: getRuntimeConfig().authMode });
}

export default function Signup() {
  const { authMode } = useLoaderData<typeof loader>();
  if (authMode === "clerk") {
    return (
      <div className="shell center">
        <div className="ob-card">
          <h1>Créez votre compte.</h1>
          <SignUp routing="path" path="/signup" signInUrl="/login" forceRedirectUrl="/dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="shell center">
      <div className="ob-card">
        <h1>Créer un compte</h1>
        <p className="sub">En développement local, Paperasse utilise le compte démo intégré.</p>
        <div className="form-actions">
          <Link to="/onboarding" className="btn btn-p">Configurer l'entreprise démo</Link>
          <Link to="/login" className="btn">Retour connexion</Link>
        </div>
      </div>
    </div>
  );
}
