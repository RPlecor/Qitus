import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Landmark,
  LogOut,
  Search,
  Shield,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { activeFiscalYearCookie } from "~/modules/fiscal-years/fiscal-year-center.server";
import { OnboardingCenter, onboardingCompletionInputFromForm } from "~/modules/onboarding/onboarding-center.server";
import { ExpectedRouteError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

type OnboardingDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  source: string;
  hasSiren: "yes" | "no";
  sirenOrSiret: string;
  companyName: string;
  legalForm: "micro" | "ei" | "eurl" | "sasu" | "sci" | "other" | "";
  activity: "services" | "products" | "mixed" | "rental" | "real-estate" | "other" | "";
  activityDescription: string;
  taxRegime: "is" | "ir" | "";
  vatStatus: "franchise" | "yes" | "";
  vatFrequency: "monthly" | "quarterly" | "annual" | "";
  vatExigibility: "encaissement" | "facturation" | "mixte" | "";
  fiscalYearQuick: "2025" | "2026" | "custom" | "";
  fiscalYearStart: string;
  fiscalYearEnd: string;
  creationDate: string;
  addressStreet: string;
  addressPostal: string;
  addressCity: string;
  managerName: string;
  managerRole: string;
  capital: string;
  startMode: "bank" | "csv" | "later" | "";
  selectedBank: string;
};

type Screen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type FieldErrors = Partial<Record<keyof OnboardingDraft | "csvFile", string>>;

const STORAGE_KEY = "qitus.onboarding.draft";
const currentYear = new Date().getFullYear();

const legalFormLabels: Record<NonNullable<OnboardingDraft["legalForm"]>, string> = {
  micro: "Micro-entreprise / auto-entrepreneur",
  ei: "Entreprise individuelle",
  eurl: "EURL / SARL",
  sasu: "SASU / SAS",
  sci: "SCI",
  other: "Autre forme juridique",
  "": "Non renseigné",
};

const banks = ["Qonto", "Crédit Agricole", "BNP Paribas", "Société Générale", "Boursobank", "Banque Populaire", "Caisse d'Épargne", "CIC", "Revolut"];

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  if (workspace.authMode === "clerk" && workspace.company.onboardingComplete) throw redirect("/dashboard");
  const config = getRuntimeConfig();
  const nameParts = (workspace.user.name ?? "").trim().split(/\s+/).filter(Boolean);
  return json({
    authMode: workspace.authMode,
    email: workspace.user.email,
    canConnectBank: config.openBankingProvider !== "disabled" || (config.connectorsMode ?? "disabled") === "live",
    initialDraft: {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      phone: "",
      role: "",
      source: "",
      hasSiren: workspace.company.siren || workspace.company.siret ? "yes" : "no",
      sirenOrSiret: workspace.company.siret ?? workspace.company.siren ?? "",
      companyName: workspace.company.name === "Entreprise à configurer" ? "" : workspace.company.name,
      legalForm: legalFormToDraft(workspace.company.legalForm),
      activity: activityToDraft(workspace.company.incomeRegime),
      activityDescription: "",
      taxRegime: workspace.company.corporateTax === "IR" ? "ir" : "is",
      vatStatus: workspace.company.vatRegime === "FRANCHISE" ? "franchise" : "yes",
      vatFrequency: workspace.company.vatRegime === "REEL_SIMPLIFIE" ? "annual" : workspace.company.vatRegime === "REEL_NORMAL" ? "monthly" : "",
      vatExigibility: vatExigibilityToDraft(workspace.company.vatExigibility),
      fiscalYearQuick: fiscalYearQuick(workspace.fiscalYear.startDate, workspace.fiscalYear.endDate),
      fiscalYearStart: toDateInput(workspace.fiscalYear.startDate),
      fiscalYearEnd: toDateInput(workspace.fiscalYear.endDate),
      creationDate: "",
      addressStreet: workspace.company.addressStreet ?? "",
      addressPostal: workspace.company.addressPostal ?? "",
      addressCity: workspace.company.addressCity ?? "",
      managerName: [workspace.company.managerFirstName, workspace.company.managerLastName].filter(Boolean).join(" "),
      managerRole: workspace.company.managerRole ?? "",
      capital: workspace.company.capital ? String(workspace.company.capital) : "",
      startMode: "",
      selectedBank: "",
    } satisfies OnboardingDraft,
  });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const result = await new OnboardingCenter().completeOnboarding(workspace, onboardingCompletionInputFromForm(form));
    const headers = new Headers();
    headers.append("Set-Cookie", await activeFiscalYearCookie.serialize(result.fiscalYearId));
    return redirect(result.redirectTo, { headers });
  } catch (error) {
    const message = error instanceof ExpectedRouteError || error instanceof Error ? error.message : "Configuration impossible.";
    return json({ error: message }, { status: error instanceof ExpectedRouteError ? error.status : 400 });
  }
}

export default function Onboarding() {
  const { email, initialDraft, canConnectBank } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [screen, setScreen] = useState<Screen>(0);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string } | null>(null);
  const isSubmitting = navigation.state !== "idle";

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      setDraft((current) => ({ ...current, ...JSON.parse(stored) }));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const currentGroup = STEP_GROUPS[screen];
  const fiscalSummary = useMemo(() => fiscalitySummary(draft), [draft]);
  const canSubmit = screen === 12 && validateScreen(draft, 12).ok;

  function update<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function goTo(next: Screen) {
    setScreen(next);
    setErrors({});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueTo(next: Screen) {
    const validation = validateScreen(draft, screen);
    setErrors(validation.errors);
    if (validation.ok) goTo(next);
  }

  function selectFiscalYear(value: OnboardingDraft["fiscalYearQuick"]) {
    if (value === "2025") {
      setDraft((current) => ({ ...current, fiscalYearQuick: value, fiscalYearStart: "2025-01-01", fiscalYearEnd: "2025-12-31" }));
      return;
    }
    if (value === "2026") {
      setDraft((current) => ({ ...current, fiscalYearQuick: value, fiscalYearStart: "2026-01-01", fiscalYearEnd: "2026-12-31" }));
      return;
    }
    update("fiscalYearQuick", value);
  }

  return (
    <div className="ob-shell">
      <aside className="ob-side">
        <div className="ob-logo"><span>Q</span>itus</div>
        <OnboardingStepper group={currentGroup} />
        <div className="ob-side-footer">
          <button className="ob-logout" type="button" onClick={() => window.location.assign("/login")}>
            <LogOut size={16} strokeWidth={1.75} /> Se déconnecter
          </button>
        </div>
      </aside>

      <main className="ob-main">
        <Form method="post" encType="multipart/form-data" className="ob-content">
          <HiddenDraftInputs draft={draft} />
          {actionData?.error ? <div className="ob-server-error">{actionData.error}</div> : null}

          {screen === 0 ? (
            <ScreenFrame title="Bienvenue dans Qitus" subtitle="Quelques informations suffisent pour préparer votre espace comptable et vous guider vers la première action utile.">
              <div className="ob-email-badge"><CheckCircle2 size={16} /> {email ? `Votre adresse email ${email} est vérifiée` : "Votre adresse email est vérifiée"}</div>
              <div className="ob-checklist">
                {["Votre entreprise", "Votre régime fiscal et TVA", "Votre exercice comptable", "Votre premier import ou connecteur bancaire"].map((item, index) => (
                  <div className="ob-check-item" key={item}><span className="ob-check-dot">{index + 1}</span>{item}</div>
                ))}
              </div>
              <OnboardingActions primaryLabel="Commencer" onPrimary={() => goTo(1)} secondaryLabel="Me déconnecter" onSecondary={() => window.location.assign("/login")} />
            </ScreenFrame>
          ) : null}

          {screen === 1 ? (
            <ScreenFrame title="Qui êtes-vous ?" subtitle="Ces informations servent uniquement à personnaliser votre espace et à faciliter les échanges liés à votre dossier.">
              <div className="ob-row">
                <Field label="Prénom" error={errors.firstName}><input className="ob-input" value={draft.firstName} maxLength={80} onChange={(event) => update("firstName", event.target.value)} placeholder="Jean" /></Field>
                <Field label="Nom" error={errors.lastName}><input className="ob-input" value={draft.lastName} maxLength={80} onChange={(event) => update("lastName", event.target.value)} placeholder="Dupont" /></Field>
              </div>
              <Field label="Téléphone" optional><input className="ob-input" type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+33 6 12 34 56 78" /></Field>
              <Field label="Rôle dans l'entreprise" optional>
                <select className="ob-input" value={draft.role} onChange={(event) => update("role", event.target.value)}>
                  <option value="">Sélectionner un rôle</option>
                  <option>Dirigeant</option>
                  <option>Indépendant</option>
                  <option>Collaborateur administratif</option>
                  <option>Expert-comptable ou cabinet</option>
                </select>
              </Field>
              <Field label="Comment avez-vous entendu parler de Qitus ?" optional><input className="ob-input" value={draft.source} onChange={(event) => update("source", event.target.value)} placeholder="Bouche à oreille, recherche web..." /></Field>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(0)} primaryLabel="Continuer" onPrimary={() => continueTo(2)}>
                <Link className="ob-link" to="/privacy" target="_blank">Lire la politique de confidentialité</Link>
              </OnboardingActions>
            </ScreenFrame>
          ) : null}

          {screen === 2 ? (
            <ScreenFrame title="Votre entreprise" subtitle="Identifiez votre entreprise pour que Qitus prépare votre espace comptable.">
              <div className="ob-choices">
                <ChoiceCard selected={draft.hasSiren === "yes"} title="J'ai un SIREN ou SIRET" onClick={() => update("hasSiren", "yes")} />
                <ChoiceCard selected={draft.hasSiren === "no"} title="Je n'ai pas encore de numéro" onClick={() => update("hasSiren", "no")} />
              </div>
              {draft.hasSiren === "yes" ? (
                <>
                  <Field label="SIREN ou SIRET" error={errors.sirenOrSiret}><input className="ob-input" value={draft.sirenOrSiret} maxLength={17} inputMode="numeric" onChange={(event) => update("sirenOrSiret", event.target.value)} placeholder="123 456 789" /></Field>
                  <Field label="Nom de l'entreprise" error={errors.companyName}><input className="ob-input" value={draft.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="Ma Société SAS" /></Field>
                </>
              ) : (
                <>
                  <Field label="Nom de l'entreprise ou du projet" error={errors.companyName}><input className="ob-input" value={draft.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="Mon projet" /></Field>
                  <div className="ob-help">Vous pourrez compléter le SIREN ou SIRET plus tard dans Paramètres.</div>
                </>
              )}
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(1)} primaryLabel="Continuer" onPrimary={() => continueTo(3)} />
            </ScreenFrame>
          ) : null}

          {screen === 3 ? (
            <ScreenFrame title="Forme juridique" subtitle="La forme juridique permet à Qitus de proposer les bons régimes fiscaux et les bons contrôles.">
              <div className="ob-choices">
                <ChoiceCard selected={draft.legalForm === "micro"} title="Micro-entreprise / auto-entrepreneur" onClick={() => update("legalForm", "micro")} />
                <ChoiceCard selected={draft.legalForm === "ei"} title="Entreprise individuelle" onClick={() => update("legalForm", "ei")} />
                <ChoiceCard selected={draft.legalForm === "eurl"} title="EURL / SARL" onClick={() => update("legalForm", "eurl")} />
                <ChoiceCard selected={draft.legalForm === "sasu"} title="SASU / SAS" badge="Le plus fréquent" onClick={() => update("legalForm", "sasu")} />
                <ChoiceCard selected={draft.legalForm === "sci"} title="SCI" onClick={() => update("legalForm", "sci")} />
                <ChoiceCard selected={draft.legalForm === "other"} title="Autre forme juridique" onClick={() => update("legalForm", "other")} />
              </div>
              {draft.legalForm === "micro" ? <div className="ob-warn">Qitus peut vous aider à suivre vos justificatifs et exports, mais certaines fonctions comptables avancées peuvent ne pas être nécessaires.</div> : null}
              {errors.legalForm ? <p className="ob-error visible">{errors.legalForm}</p> : null}
              <div className="ob-help">Vous pourrez modifier cette information plus tard dans Paramètres.</div>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(2)} primaryLabel="Continuer" onPrimary={() => continueTo(4)} />
            </ScreenFrame>
          ) : null}

          {screen === 4 ? (
            <ScreenFrame title="Nature de votre activité" subtitle="Qitus utilise cette information pour préparer les règles de classement et les comptes adaptés.">
              <div className="ob-choices">
                <ChoiceCard selected={draft.activity === "services"} title="Prestations de services" description="Conseil, développement, coaching, santé, avocat" onClick={() => update("activity", "services")} />
                <ChoiceCard selected={draft.activity === "products"} title="Vente de produits" description="E-commerce, commerce, marchandises" onClick={() => update("activity", "products")} />
                <ChoiceCard selected={draft.activity === "mixed"} title="Services et produits" onClick={() => update("activity", "mixed")} />
                <ChoiceCard selected={draft.activity === "rental"} title="Location meublée" onClick={() => update("activity", "rental")} />
                <ChoiceCard selected={draft.activity === "real-estate"} title="Immobilier / SCI" onClick={() => update("activity", "real-estate")} />
                <ChoiceCard selected={draft.activity === "other"} title="Autre activité" onClick={() => update("activity", "other")} />
              </div>
              <Field label="Décrivez votre activité en quelques mots" optional><input className="ob-input" value={draft.activityDescription} maxLength={160} onChange={(event) => update("activityDescription", event.target.value)} placeholder="Développement web freelance" /></Field>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(3)} primaryLabel="Continuer" onPrimary={() => goTo(5)} />
            </ScreenFrame>
          ) : null}

          {screen === 5 ? (
            <ScreenFrame title="Imposition des bénéfices" subtitle="Comment votre activité est-elle imposée ?">
              <div className="ob-choices">
                <ChoiceCard selected={draft.taxRegime === "is"} title="Impôt sur les sociétés (IS)" badge={draft.legalForm === "sasu" || draft.legalForm === "eurl" ? "Le plus fréquent" : undefined} onClick={() => update("taxRegime", "is")} />
                <ChoiceCard selected={draft.taxRegime === "ir"} title="Impôt sur le revenu (IR)" badge={draft.legalForm === "ei" || draft.legalForm === "micro" ? "Le plus fréquent" : undefined} onClick={() => update("taxRegime", "ir")} />
              </div>
              {errors.taxRegime ? <p className="ob-error visible">{errors.taxRegime}</p> : null}
              <div className="ob-help"><strong>Vous hésitez ?</strong> Choisissez le régime indiqué sur vos documents de création ou demandez à votre expert-comptable. Vous pourrez corriger ce choix avant vos premiers exports.</div>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(4)} primaryLabel="Continuer" onPrimary={() => continueTo(6)} />
            </ScreenFrame>
          ) : null}

          {screen === 6 ? (
            <ScreenFrame title="TVA" subtitle="Ces informations permettent à Qitus de calculer les positions TVA et de vous signaler les écritures à revoir.">
              <div className="ob-choices">
                <ChoiceCard selected={draft.vatStatus === "franchise"} title="Non, je suis en franchise de TVA" description="Aucune déclaration de TVA à préparer dans Qitus" onClick={() => update("vatStatus", "franchise")} />
                <ChoiceCard selected={draft.vatStatus === "yes"} title="Oui, je déclare la TVA" onClick={() => update("vatStatus", "yes")} />
              </div>
              {draft.vatStatus === "yes" ? (
                <div className="ob-conditional">
                  <label className="ob-label standalone">À quelle fréquence déclarez-vous la TVA ?</label>
                  <div className="ob-choices">
                    <ChoiceCard selected={draft.vatFrequency === "monthly"} title="Tous les mois" onClick={() => update("vatFrequency", "monthly")} />
                    <ChoiceCard selected={draft.vatFrequency === "quarterly"} title="Tous les 3 mois" onClick={() => update("vatFrequency", "quarterly")} />
                    <ChoiceCard selected={draft.vatFrequency === "annual"} title="Une fois par an" onClick={() => update("vatFrequency", "annual")} />
                  </div>
                  {errors.vatFrequency ? <p className="ob-error visible">{errors.vatFrequency}</p> : null}
                  <label className="ob-label standalone">Quand la TVA devient-elle exigible ?</label>
                  <div className="ob-choices">
                    <ChoiceCard selected={draft.vatExigibility === "encaissement"} title="À l'encaissement" onClick={() => update("vatExigibility", "encaissement")} />
                    <ChoiceCard selected={draft.vatExigibility === "facturation"} title="À la facturation" onClick={() => update("vatExigibility", "facturation")} />
                    <ChoiceCard selected={draft.vatExigibility === "mixte"} title="Mixte" onClick={() => update("vatExigibility", "mixte")} />
                  </div>
                  {errors.vatExigibility ? <p className="ob-error visible">{errors.vatExigibility}</p> : null}
                  <div className="ob-help">Pour les prestations de services, l'encaissement est fréquent. Pour les ventes de biens, la facturation est fréquente.</div>
                </div>
              ) : null}
              {errors.vatStatus ? <p className="ob-error visible">{errors.vatStatus}</p> : null}
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(5)} primaryLabel="Continuer" onPrimary={() => continueTo(7)} />
            </ScreenFrame>
          ) : null}

          {screen === 7 ? (
            <ScreenFrame title="Exercice comptable" subtitle="Quel exercice voulez-vous suivre dans Qitus ?">
              <div className="ob-choices">
                <ChoiceCard selected={draft.fiscalYearQuick === "2025"} title="Exercice 2025" description="01/01/2025 - 31/12/2025" onClick={() => selectFiscalYear("2025")} />
                <ChoiceCard selected={draft.fiscalYearQuick === "2026"} title="Exercice 2026" description="01/01/2026 - 31/12/2026" badge={currentYear === 2026 ? "Année en cours" : undefined} onClick={() => selectFiscalYear("2026")} />
                <ChoiceCard selected={draft.fiscalYearQuick === "custom"} title="Autre période" onClick={() => selectFiscalYear("custom")} />
              </div>
              {draft.fiscalYearQuick === "custom" ? (
                <div className="ob-row">
                  <Field label="Date de début" error={errors.fiscalYearStart}><input className="ob-input" type="date" value={draft.fiscalYearStart} onChange={(event) => update("fiscalYearStart", event.target.value)} /></Field>
                  <Field label="Date de fin" error={errors.fiscalYearEnd}><input className="ob-input" type="date" value={draft.fiscalYearEnd} onChange={(event) => update("fiscalYearEnd", event.target.value)} /></Field>
                </div>
              ) : null}
              <Field label="Date de création de l'entreprise" optional><input className="ob-input" type="date" value={draft.creationDate} onChange={(event) => update("creationDate", event.target.value)} /></Field>
              <div className="ob-help"><strong>Qu'est-ce qu'un exercice comptable ?</strong> C'est la période sur laquelle Qitus organise vos imports, écritures, TVA, documents et clôture. Elle dure généralement 12 mois.</div>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(6)} primaryLabel="Continuer" onPrimary={() => continueTo(8)} />
            </ScreenFrame>
          ) : null}

          {screen === 8 ? (
            <ScreenFrame title="Informations légales" subtitle="Ces informations apparaissent dans certains documents comptables. Vous pourrez les compléter plus tard dans Paramètres.">
              <Field label="Adresse" optional><input className="ob-input" value={draft.addressStreet} onChange={(event) => update("addressStreet", event.target.value)} placeholder="12 rue de la Paix" /></Field>
              <div className="ob-row">
                <Field label="Code postal" optional><input className="ob-input" value={draft.addressPostal} maxLength={5} inputMode="numeric" onChange={(event) => update("addressPostal", event.target.value)} placeholder="75002" /></Field>
                <Field label="Ville" optional><input className="ob-input" value={draft.addressCity} onChange={(event) => update("addressCity", event.target.value)} placeholder="Paris" /></Field>
              </div>
              <div className="ob-row">
                <Field label="Nom du dirigeant" optional><input className="ob-input" value={draft.managerName} onChange={(event) => update("managerName", event.target.value)} placeholder="Jean Dupont" /></Field>
                <Field label="Rôle du dirigeant" optional><input className="ob-input" value={draft.managerRole} onChange={(event) => update("managerRole", event.target.value)} placeholder="Président" /></Field>
              </div>
              <Field label="Capital social" optional><input className="ob-input" value={draft.capital} onChange={(event) => update("capital", event.target.value)} placeholder="1 000 €" /></Field>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(7)} primaryLabel="Continuer" onPrimary={() => goTo(9)}>
                <button className="ob-btn ob-btn-ghost" type="button" onClick={() => goTo(9)}>Passer cette étape</button>
              </OnboardingActions>
            </ScreenFrame>
          ) : null}

          {screen === 9 ? (
            <ScreenFrame title="Comment voulez-vous démarrer ?" subtitle="Choisissez comment Qitus reçoit ses premières données.">
              <div className="ob-cards-grid">
                <StartCard icon={<Landmark size={28} />} title="Connecter ma banque" text="Qitus récupère vos transactions et les classe automatiquement quand c'est fiable." onClick={() => { update("startMode", "bank"); goTo(10); }} />
                <StartCard icon={<FileText size={28} />} title="Importer un relevé CSV" text="Utilisez un export bancaire si vous ne voulez pas connecter votre banque maintenant." onClick={() => { update("startMode", "csv"); goTo(11); }} />
                <StartCard icon={<Check size={28} />} title="Commencer sans données" text="Vous pourrez importer ou connecter une banque plus tard." onClick={() => { update("startMode", "later"); goTo(12); }} />
              </div>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(8)} />
            </ScreenFrame>
          ) : null}

          {screen === 10 ? (
            <ScreenFrame title="Connecter votre banque" subtitle="La connexion est sécurisée et en lecture seule. Qitus ne peut pas effectuer de paiement.">
              {!canConnectBank ? <div className="ob-warn">La connexion bancaire sera disponible prochainement. Vous pouvez importer un relevé CSV.</div> : null}
              <div className="ob-bank-search"><Search size={16} /><input className="ob-input" type="search" placeholder="Rechercher une banque..." /></div>
              <div className="ob-bank-list">
                {banks.map((bank) => (
                  <button className={`ob-bank ${draft.selectedBank === bank ? "selected" : ""}`} type="button" key={bank} onClick={() => update("selectedBank", bank)}>
                    <span className="ob-bank-dot" /> {bank}
                  </button>
                ))}
              </div>
              <div className="ob-bank-security"><Shield size={16} /> Connexion en lecture seule. Qitus ne peut pas effectuer de paiement.</div>
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(9)} primaryLabel={canConnectBank ? "Connecter" : undefined} onPrimary={canConnectBank ? () => goTo(12) : undefined}>
                <button className="ob-btn ob-btn-ghost" type="button" onClick={() => { update("startMode", "csv"); goTo(11); }}>Importer un relevé à la place</button>
                <button className="ob-btn ob-btn-ghost" type="button" onClick={() => { update("startMode", "later"); goTo(12); }}>Passer cette étape</button>
              </OnboardingActions>
            </ScreenFrame>
          ) : null}

          {screen === 11 ? (
            <ScreenFrame title="Importer un relevé bancaire" subtitle="Vous pouvez importer un export Qonto, BNP Paribas, Société Générale, Boursobank ou utiliser une correspondance de colonnes.">
              <label className={`ob-upload ${fileMeta ? "has-file" : ""}`}>
                <Upload size={28} />
                <span>{fileMeta ? fileMeta.name : "Glissez un relevé CSV ou parcourez vos fichiers"}</span>
                <small>{fileMeta ? fileMeta.size : "Format accepté : .csv"}</small>
                <input type="file" name="csvFile" accept=".csv,text/csv" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  setFileMeta(file ? { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} Ko` } : null);
                  update("startMode", "csv");
                }} />
              </label>
              {errors.csvFile ? <p className="ob-error visible">{errors.csvFile}</p> : null}
              <OnboardingActions secondaryLabel="Retour" onSecondary={() => goTo(9)} primaryLabel="Importer" onPrimary={() => {
                if (!fileMeta) {
                  setErrors((current) => ({ ...current, csvFile: "Choisissez un relevé CSV ou passez cette étape." }));
                  return;
                }
                goTo(12);
              }}>
                <button className="ob-btn ob-btn-ghost" type="button" onClick={() => { update("startMode", "later"); goTo(12); }}>Passer cette étape</button>
              </OnboardingActions>
            </ScreenFrame>
          ) : null}

          {screen === 12 ? (
            <ScreenFrame title="Votre espace Qitus est prêt" subtitle="Voici un résumé de votre configuration. Vous pourrez tout modifier plus tard dans Paramètres.">
              <OnboardingSummary draft={draft} fiscalSummary={fiscalSummary} goTo={goTo} />
              <div className="ob-next-action">
                <h4>Prochaine action recommandée</h4>
                <p>{nextActionMessage(draft)}</p>
              </div>
              {!canSubmit ? <div className="ob-warn">Certaines informations indispensables sont encore manquantes. Modifiez vos réponses avant d'entrer dans Qitus.</div> : null}
              <OnboardingActions secondaryLabel="Modifier mes réponses" onSecondary={() => goTo(2)} primaryLabel={isSubmitting ? "Configuration..." : "Entrer dans Qitus"} submitPrimary disabled={!canSubmit || isSubmitting} />
            </ScreenFrame>
          ) : null}
        </Form>
      </main>
    </div>
  );
}

const STEP_GROUPS: Record<Screen, number> = { 0: -1, 1: 0, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 4 };

function OnboardingStepper({ group }: { group: number }) {
  const steps = ["Vous", "Entreprise", "Fiscalité", "Exercice", "Démarrage"];
  return (
    <div className="ob-stepper">
      {steps.map((label, index) => (
        <div className={`ob-step ${index === group ? "active" : ""} ${index < group ? "done" : ""}`} key={label}>
          <span className="ob-step-dot">{index < group ? <Check size={13} /> : index + 1}</span>
          <span className="ob-step-label">{label}</span>
          <span className="ob-step-line" />
        </div>
      ))}
    </div>
  );
}

function ScreenFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="ob-screen active"><h1 className="ob-title">{title}</h1><p className="ob-subtitle">{subtitle}</p>{children}</section>;
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: ReactNode }) {
  return <div className={`ob-field ${error ? "has-error" : ""}`}><label className="ob-label">{label}{optional ? <span className="opt">optionnel</span> : null}</label>{children}{error ? <div className="ob-error visible">{error}</div> : null}</div>;
}

function ChoiceCard({ selected, title, description, badge, onClick }: { selected: boolean; title: string; description?: string; badge?: string; onClick: () => void }) {
  return (
    <button className={`ob-choice ${selected ? "selected" : ""}`} type="button" onClick={onClick}>
      <span className="ob-choice-radio" />
      <span className="ob-choice-text"><span className="ob-choice-title">{title}</span>{description ? <span className="ob-choice-desc">{description}</span> : null}</span>
      {badge ? <span className="ob-badge">{badge}</span> : null}
    </button>
  );
}

function StartCard({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return <button className="ob-card" type="button" onClick={onClick}><span className="ob-card-icon">{icon}</span><h3>{title}</h3><p>{text}</p><span className="ob-card-action">Choisir <ArrowRight size={14} /></span></button>;
}

function OnboardingActions({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  children,
  submitPrimary,
  disabled,
}: {
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  children?: ReactNode;
  submitPrimary?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="ob-actions">
      {secondaryLabel ? <button className="ob-btn ob-btn-secondary" type="button" onClick={onSecondary}><ArrowLeft size={18} /> {secondaryLabel}</button> : <span />}
      <div className="ob-actions-right">
        {children}
        {primaryLabel ? (
          <button className="ob-btn ob-btn-primary" type={submitPrimary ? "submit" : "button"} onClick={onPrimary} disabled={disabled}>
            {primaryLabel} {!submitPrimary ? <ArrowRight size={18} /> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OnboardingSummary({ draft, fiscalSummary, goTo }: { draft: OnboardingDraft; fiscalSummary: string; goTo: (screen: Screen) => void }) {
  return (
    <div className="ob-summary-grid">
      <SummaryCard title="Entreprise" value={draft.companyName || "À compléter"} hint={legalFormLabels[draft.legalForm]} onEdit={() => goTo(2)} />
      <SummaryCard title="Fiscalité" value={draft.taxRegime === "ir" ? "Impôt sur le revenu" : "Impôt sur les sociétés"} hint={fiscalSummary} onEdit={() => goTo(5)} />
      <SummaryCard title="Exercice" value={`${formatDate(draft.fiscalYearStart)} - ${formatDate(draft.fiscalYearEnd)}`} onEdit={() => goTo(7)} />
      <SummaryCard title="Démarrage" value={startModeLabel(draft)} onEdit={() => goTo(9)} />
    </div>
  );
}

function SummaryCard({ title, value, hint, onEdit }: { title: string; value: string; hint?: string; onEdit: () => void }) {
  return <div className="ob-summary-card"><h4>{title}</h4><p>{value}</p>{hint ? <p className="hint">{hint}</p> : null}<button type="button" className="ob-edit" onClick={onEdit}>Modifier</button></div>;
}

function HiddenDraftInputs({ draft }: { draft: OnboardingDraft }) {
  return <>{Object.entries(draft).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}</>;
}

function validateScreen(draft: OnboardingDraft, screen: Screen): { ok: boolean; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (screen === 1) {
    if (!draft.firstName.trim()) errors.firstName = "Ce champ est nécessaire pour continuer.";
    if (!draft.lastName.trim()) errors.lastName = "Ce champ est nécessaire pour continuer.";
  }
  if (screen === 2 || screen === 12) {
    if (!draft.companyName.trim()) errors.companyName = "Ce champ est nécessaire pour continuer.";
    const digits = draft.sirenOrSiret.replace(/\D/g, "");
    if (draft.hasSiren === "yes" && digits && digits.length !== 9 && digits.length !== 14) {
      errors.sirenOrSiret = "Le numéro doit contenir 9 chiffres pour un SIREN ou 14 chiffres pour un SIRET.";
    }
  }
  if (screen === 3 || screen === 12) {
    if (!draft.legalForm) errors.legalForm = "Choisissez une forme juridique pour continuer.";
  }
  if (screen === 5 || screen === 12) {
    if (!draft.taxRegime) errors.taxRegime = "Choisissez un régime d'imposition pour continuer.";
  }
  if (screen === 6 || screen === 12) {
    if (!draft.vatStatus) errors.vatStatus = "Choisissez votre situation TVA pour continuer.";
    if (draft.vatStatus === "yes" && !draft.vatFrequency) errors.vatFrequency = "Choisissez une fréquence de déclaration.";
    if (draft.vatStatus === "yes" && !draft.vatExigibility) errors.vatExigibility = "Choisissez une exigibilité TVA.";
  }
  if (screen === 7 || screen === 12) {
    if (!draft.fiscalYearStart) errors.fiscalYearStart = "La date de début est nécessaire.";
    if (!draft.fiscalYearEnd) errors.fiscalYearEnd = "La date de fin est nécessaire.";
    if (draft.fiscalYearStart && draft.fiscalYearEnd && draft.fiscalYearEnd <= draft.fiscalYearStart) errors.fiscalYearEnd = "La date de fin doit être après la date de début.";
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

function fiscalitySummary(draft: OnboardingDraft) {
  if (draft.vatStatus !== "yes") return "Franchise de TVA";
  const frequency = draft.vatFrequency === "annual" ? "réel simplifié" : "réel normal";
  const exigibility = draft.vatExigibility === "facturation" ? "facturation" : draft.vatExigibility === "mixte" ? "mixte" : "encaissement";
  return `TVA ${frequency} · ${exigibility}`;
}

function nextActionMessage(draft: OnboardingDraft) {
  if (draft.startMode === "csv") return "Vérifier les transactions importées ou finaliser la correspondance de colonnes si Qitus en a besoin.";
  if (draft.startMode === "bank") return "Synchroniser les transactions depuis le connecteur bancaire choisi.";
  return "Importer un relevé ou connecter une banque pour commencer à classer vos transactions.";
}

function startModeLabel(draft: OnboardingDraft) {
  if (draft.startMode === "csv") return "Relevé CSV";
  if (draft.startMode === "bank") return draft.selectedBank ? `Banque : ${draft.selectedBank}` : "Connexion bancaire";
  return "Aucune donnée importée";
}

function legalFormToDraft(value: string): OnboardingDraft["legalForm"] {
  if (value === "AUTO_ENTREPRENEUR") return "micro";
  if (value === "EI") return "ei";
  if (value === "EURL" || value === "SARL") return "eurl";
  if (value === "SASU" || value === "SAS" || value === "SA") return "sasu";
  if (value === "SCI") return "sci";
  return "";
}

function activityToDraft(value: string | null): OnboardingDraft["activity"] {
  const candidates = ["services", "products", "mixed", "rental", "real-estate", "other"] as const;
  return candidates.includes(value as (typeof candidates)[number]) ? value as OnboardingDraft["activity"] : "";
}

function vatExigibilityToDraft(value: string): OnboardingDraft["vatExigibility"] {
  if (value === "DEBITS") return "facturation";
  if (value === "MIXED") return "mixte";
  return "encaissement";
}

function fiscalYearQuick(start: Date, end: Date): OnboardingDraft["fiscalYearQuick"] {
  const startText = toDateInput(start);
  const endText = toDateInput(end);
  if (startText === "2025-01-01" && endText === "2025-12-31") return "2025";
  if (startText === "2026-01-01" && endText === "2026-12-31") return "2026";
  return "custom";
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "À compléter";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}
