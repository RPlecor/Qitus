import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { SignIn } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export function loader(_args: LoaderFunctionArgs) {
  return json({ authMode: getRuntimeConfig().authMode });
}

export default function Login() {
  const { authMode } = useLoaderData<typeof loader>();
  if (authMode === "clerk") {
    return (
      <div className="shell center">
        <div className="ob-card">
          <h1>Connectez-vous.</h1>
          <SignIn routing="path" path="/login" signUpUrl="/signup" forceRedirectUrl="/dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="shell center">
      <div className="ob-card">
        <h1>Connectez-vous.</h1>
        <p className="sub">Le MVP utilise Clerk en production. En développement, les routes serveur peuvent créer un utilisateur local.</p>
        <div className="field">
          <label>Email</label>
          <input defaultValue="demo@paperasse.local" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" defaultValue="paperasse" />
        </div>
        <div className="form-actions">
          <Link to="/dashboard" className="btn btn-p">Continuer</Link>
          <Link to="/onboarding" className="btn">Créer un compte</Link>
        </div>
      </div>
    </div>
  );
}
