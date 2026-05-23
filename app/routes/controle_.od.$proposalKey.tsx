import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ClosingAdjustmentCenter } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, Main } from "~/components/ui";
import { closingAdjustmentKindLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new ClosingAdjustmentCenter();
  const [review, auditTrail] = await Promise.all([
    new ClosingAdjustmentReviewWorkflow(center).getProposalReview(workspace, String(args.params.proposalKey)),
    center.getProposalAuditTrail(workspace, String(args.params.proposalKey)),
  ]);
  return json({ review, auditTrail });
}

export default function ClosingAdjustmentDetail() {
  const { review, auditTrail } = useLoaderData<typeof loader>();
  const { proposal } = review;
  const total = proposal.lines.reduce((sum, line) => sum + line.debit, 0);

  return (
    <AppShell active="controle">
      <Main title="OD proposée" subtitle={proposal.label}>
        <Link className="btn btn-ghost" to="/controle">← Retour au contrôle</Link>
        <div className={`alert ${proposal.status === "APPROVED" ? "blue" : proposal.status === "REJECTED" ? "red" : "orange"}`}>
          {statusLabel(proposal.status)}
          {review.freshness.stale ? ` ${review.freshness.reasons[0]?.label ?? "OD à recalculer."}` : ""}
          {review.evidence.missing ? " Une pièce est requise avant validation." : ""}
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Type</div><span className="kpi-val">{kindLabel(proposal.kind)}</span></div>
          <div className="kpi"><div className="kpi-label">Montant</div><span className="kpi-val">{formatEuro(total)}</span></div>
          <div className="kpi"><div className="kpi-label">Fraîcheur</div><span className="kpi-val">{review.freshness.statusLabel}</span></div>
          <div className="kpi"><div className="kpi-label">Pièce</div><span className="kpi-val">{review.evidence.missing ? "Manquante" : review.evidence.required ? "OK" : "Recommandée"}</span></div>
          <div className="kpi"><div className="kpi-label">Écriture</div><span className="kpi-val">{proposal.journalEntryId ? <Link to="/ecritures">Créée</Link> : "—"}</span></div>
        </div>

        <div className="sec-head"><h2>Hypothèses</h2></div>
        {proposal.status === "DRAFT" ? (
          <Form method="post" action={`/api/closing-adjustments/${encodeURIComponent(proposal.proposalKey)}/assumptions`} className="card form-card">
            <AssumptionFields proposal={proposal} />
            <div className="form-actions">
              <button className="btn" type="submit">Enregistrer les hypothèses</button>
            </div>
          </Form>
        ) : (
          <AssumptionReadOnly assumptions={proposal.assumptions} />
        )}

        <div className="sec-head"><h2>Lignes débit/crédit</h2></div>
        <table className="tbl">
          <thead><tr><th>Compte</th><th>Libellé</th><th className="r">Débit</th><th className="r">Crédit</th></tr></thead>
          <tbody>
            {proposal.lines.map((line, index) => (
              <tr key={`${line.account}-${index}`}>
                <td><span className="cpt">{line.account}</span></td>
                <td>{line.accountLabel ?? "—"}</td>
                <td className="r mono">{line.debit ? formatEuro(line.debit) : "—"}</td>
                <td className="r mono">{line.credit ? formatEuro(line.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sec-head"><h2>Calcul</h2></div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Version</div><span className="kpi-val">v{proposal.calculationVersion}</span></div>
          <div className="kpi"><div className="kpi-label">Dernier calcul</div><span className="kpi-val">{proposal.lastCalculatedAt ? formatDateTime(proposal.lastCalculatedAt) : "—"}</span></div>
          <div className="kpi"><div className="kpi-label">Impact résultat</div><span className="kpi-val">{formatEuro(-total)}</span></div>
          <div className="kpi"><div className="kpi-label">Impact bilan</div><span className="kpi-val">{formatEuro(total)}</span></div>
        </div>
        <CalculationReadOnly kind={proposal.kind} calculation={proposal.calculation} assumptions={proposal.assumptions} />

        <div className="sec-head"><h2>Preuves liées</h2></div>
        <div className="card">
          {review.evidence.links.length > 0 ? (
            <ul className="clean-list">
              {review.evidence.links.map((link) => (
                <li key={link.id}>{link.filename ?? link.entityId} · {link.relationType}</li>
              ))}
            </ul>
          ) : (
            <p className="sub">{review.evidence.required ? "Aucune pièce rattachée : validation bloquée." : "Aucune pièce rattachée pour l'instant."}</p>
          )}
          <Link className="btn btn-sm" to={`/pieces/revue`}>Rattacher une pièce</Link>
        </div>

        {review.freshness.reasons.length > 0 ? (
          <>
            <div className="sec-head"><h2>Raisons d'obsolescence</h2></div>
            <table className="tbl">
              <tbody>
                {review.freshness.reasons.map((reason) => (
                  <tr key={`${reason.code}-${reason.happenedAt}`}><td>{reason.label}</td><td className="mono">{formatDateTime(reason.happenedAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <div className="sec-head"><h2>Historique</h2></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Événement</th></tr></thead>
          <tbody>
            {auditTrail.map((event) => (
              <tr key={event.id}>
                <td className="mono">{formatDateTime(event.createdAt)}</td>
                <td>{eventLabel(event.eventType)}</td>
              </tr>
            ))}
            {auditTrail.length === 0 ? <tr><td colSpan={2} className="sub">Aucun événement enregistré.</td></tr> : null}
          </tbody>
        </table>

        {proposal.status === "DRAFT" ? (
          <div className="form-actions">
            <Form method="post" action={`/api/closing-adjustments/${encodeURIComponent(proposal.proposalKey)}/recalculate`}>
              <button className="btn" type="submit">Recalculer</button>
            </Form>
            <Form method="post" action={`/api/closing-adjustments/${encodeURIComponent(proposal.proposalKey)}/approve`}>
              <button className="btn btn-p" type="submit" disabled={!review.canApprove}>Valider l'OD</button>
            </Form>
            <Form method="post" action={`/api/closing-adjustments/${encodeURIComponent(proposal.proposalKey)}/reject`} className="inline-form">
              <input name="note" placeholder="Note de rejet obligatoire" required />
              <button className="btn" type="submit">Rejeter</button>
            </Form>
          </div>
        ) : null}
        {proposal.status === "REJECTED" ? (
          <Form method="post" action={`/api/closing-adjustments/${encodeURIComponent(proposal.proposalKey)}/reopen`} className="form-actions">
            <input name="note" placeholder="Raison de réouverture" required />
            <button className="btn" type="submit">Réouvrir</button>
          </Form>
        ) : null}
      </Main>
    </AppShell>
  );
}

function AssumptionFields({ proposal }: { proposal: { kind: string; assumptions: Record<string, unknown> } }) {
  if (proposal.kind === "CCA") {
    return (
      <div className="form-grid">
        <Field name="period" label="Période couverte" value={proposal.assumptions.period} />
        <Field name="nextExerciseAmount" label="Montant N+1" value={proposal.assumptions.nextExerciseAmount} type="number" step="0.01" />
        <Field name="chargeAccount" label="Compte de charge" value={proposal.assumptions.chargeAccount} />
        <Field name="prepaidExpenseAccount" label="Compte CCA" value={proposal.assumptions.prepaidExpenseAccount} />
      </div>
    );
  }
  if (proposal.kind === "DEPRECIATION") {
    return (
      <div className="form-grid">
        <Field name="acquisitionDate" label="Mise en service" value={proposal.assumptions.acquisitionDate} />
        <Field name="baseAmount" label="Base amortissable" value={proposal.assumptions.baseAmount} type="number" step="0.01" />
        <Field name="usefulLifeYears" label="Durée années" value={proposal.assumptions.usefulLifeYears} type="number" step="1" />
        <Field name="prorataDays" label="Prorata jours" value={proposal.assumptions.prorataDays} type="number" step="1" />
        <Field name="expenseAccount" label="Compte dotation" value={proposal.assumptions.expenseAccount} />
        <Field name="depreciationAccount" label="Compte amortissement" value={proposal.assumptions.depreciationAccount} />
      </div>
    );
  }
  return (
    <div className="form-grid">
      {proposal.kind === "CORPORATE_TAX" ? (
        <>
          <Field name="resultBeforeTax" label="Résultat avant IS" value={proposal.assumptions.resultBeforeTax} type="number" step="0.01" />
          <Field name="rate" label="Taux IS" value={proposal.assumptions.rate} type="number" step="0.01" />
          <Field name="expenseAccount" label="Compte IS" value={proposal.assumptions.expenseAccount} />
          <Field name="payableAccount" label="Compte État" value={proposal.assumptions.payableAccount} />
        </>
      ) : (
        <>
          <Field name="amount" label="Montant" value={proposal.assumptions.amount} type="number" step="0.01" />
          <Field name="debitAccount" label="Compte débit" value={proposal.assumptions.debitAccount} />
          <Field name="creditAccount" label="Compte crédit" value={proposal.assumptions.creditAccount} />
          <Field name="basis" label="Base de calcul" value={proposal.assumptions.basis} />
          {proposal.kind === "STOCK_VARIATION" ? (
            <>
              <Field name="initialStock" label="Stock initial" value={proposal.assumptions.initialStock} type="number" step="0.01" />
              <Field name="finalStock" label="Stock final" value={proposal.assumptions.finalStock} type="number" step="0.01" />
            </>
          ) : null}
          {proposal.kind === "LOAN_INTEREST_ACCRUAL" ? (
            <>
              <Field name="capital" label="Capital restant dû" value={proposal.assumptions.capital} type="number" step="0.01" />
              <Field name="annualRate" label="Taux annuel" value={proposal.assumptions.annualRate} type="number" step="0.001" />
              <Field name="days" label="Jours courus" value={proposal.assumptions.days} type="number" step="1" />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Field({ name, label, value, type = "text", step }: { name: string; label: string; value: unknown; type?: string; step?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} step={step} defaultValue={String(value ?? "")} />
    </div>
  );
}

function AssumptionReadOnly({ assumptions }: { assumptions: Record<string, unknown> }) {
  return <KeyValueCard rows={humanReadableRows(assumptions)} emptyLabel="Aucune hypothèse spécifique." />;
}

function CalculationReadOnly({ kind, calculation, assumptions }: { kind: string; calculation: Record<string, unknown>; assumptions: Record<string, unknown> }) {
  return <KeyValueCard rows={calculationRows(kind, calculation, assumptions)} emptyLabel="Aucun détail de calcul disponible." />;
}

function KeyValueCard({ rows, emptyLabel }: { rows: Array<{ label: string; value: string }>; emptyLabel: string }) {
  return (
    <div className="card">
      {rows.length > 0 ? (
        <table className="tbl compact-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="sub">{emptyLabel}</p>
      )}
    </div>
  );
}

function calculationRows(kind: string, calculation: Record<string, unknown>, assumptions: Record<string, unknown>) {
  if (kind === "CCA") {
    return [
      row("Période concernée", formatPeriod(valueAsString(calculation.period))),
      row("Montant total de la charge", formatEuroValue(calculation.totalAmount)),
      row("Part reportée sur l'exercice suivant", formatEuroValue(calculation.nextExerciseAmount)),
    ];
  }
  if (kind === "DEPRECIATION") {
    return [
      row("Date de mise en service", formatDateOnly(valueAsString(calculation.acquisitionDate))),
      row("Fin d'exercice", formatDateOnly(valueAsString(calculation.fiscalYearEnd))),
      row("Base amortissable", formatEuroValue(calculation.baseAmount)),
      row("Durée retenue", pluralize(calculation.usefulLifeYears, "an", "ans")),
      row("Prorata", pluralize(calculation.prorataDays, "jour", "jours")),
      row("Dotation proposée", formatEuroValue(calculation.depreciationAmount)),
    ];
  }
  if (kind === "CORPORATE_TAX") {
    return [
      row("Résultat avant impôt", formatEuroValue(calculation.resultBeforeTax)),
      row("Taux retenu", formatPercentValue(calculation.rate)),
      row("Impôt proposé", formatEuroValue(calculation.tax)),
    ];
  }
  const readableAssumptions = humanReadableRows(assumptions);
  return readableAssumptions.length > 0 ? readableAssumptions : humanReadableRows(calculation);
}

function humanReadableRows(values: Record<string, unknown>) {
  const rows = Object.entries(values)
    .filter(([key, value]) => !hiddenTechnicalKeys.has(key) && value !== null && value !== undefined && value !== "")
    .map(([key, value]) => row(labelForField(key), formatFieldValue(key, value)));
  return rows.filter((item) => item.value !== "—");
}

function row(label: string, value: string) {
  return { label, value };
}

const hiddenTechnicalKeys = new Set(["accounts", "code", "kind", "source", "sourceEntityId", "sourceEntityType"]);

function labelForField(key: string) {
  const labels: Record<string, string> = {
    amount: "Montant",
    annualRate: "Taux annuel",
    baseAmount: "Base amortissable",
    basis: "Base de calcul",
    capital: "Capital restant dû",
    chargeAccount: "Compte de charge",
    creditAccount: "Compte crédit",
    days: "Jours courus",
    debitAccount: "Compte débit",
    depreciationAccount: "Compte amortissement",
    depreciationAmount: "Dotation proposée",
    expenseAccount: "Compte de charge",
    finalStock: "Stock final",
    fiscalYearEnd: "Fin d'exercice",
    initialStock: "Stock initial",
    label: "Libellé",
    net: "Solde TVA",
    nextExerciseAmount: "Part reportée sur l'exercice suivant",
    payableAccount: "Compte État",
    period: "Période concernée",
    prepaidExpenseAccount: "Compte CCA",
    prorataDays: "Prorata",
    rate: "Taux retenu",
    requiredEvidence: "Pièce nécessaire",
    resultBeforeTax: "Résultat avant impôt",
    tax: "Impôt proposé",
    totalAmount: "Montant total",
    usefulLifeYears: "Durée retenue",
  };
  return labels[key] ?? key;
}

function formatFieldValue(key: string, value: unknown) {
  if (key === "period") return formatPeriod(valueAsString(value));
  if (key.toLowerCase().includes("date") || key === "fiscalYearEnd") return formatDateOnly(valueAsString(value));
  if (key.toLowerCase().includes("rate")) return formatPercentValue(value);
  if (key.toLowerCase().includes("account")) return valueAsString(value);
  if (key === "requiredEvidence") return value ? "Oui" : "Non";
  if (typeof value === "number") return moneyLikeKeys.has(key) ? formatEuro(value) : formatNumberValue(value);
  if (typeof value === "object") return "—";
  return valueAsString(value);
}

const moneyLikeKeys = new Set([
  "amount",
  "baseAmount",
  "capital",
  "depreciationAmount",
  "finalStock",
  "initialStock",
  "net",
  "nextExerciseAmount",
  "resultBeforeTax",
  "tax",
  "totalAmount",
]);

function formatEuroValue(value: unknown) {
  return typeof value === "number" ? formatEuro(value) : "—";
}

function formatNumberValue(value: unknown) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function pluralize(value: unknown, singular: string, plural: string) {
  if (typeof value !== "number") return "—";
  return `${formatNumberValue(value)} ${value > 1 ? plural : singular}`;
}

function formatPercentValue(value: unknown) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function formatPeriod(value: string) {
  const [start, end] = value.split("/");
  if (!start || !end) return value || "—";
  return `du ${formatDateOnly(start)} au ${formatDateOnly(end)}`;
}

function formatDateOnly(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function valueAsString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "OD validée : l'écriture est créée dans le journal OD.";
  if (status === "REJECTED") return "OD rejetée : aucune écriture n'a été créée.";
  return "À valider : relis les lignes avant de créer l'écriture.";
}

const kindLabel = closingAdjustmentKindLabel;

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "proposal.proposed": "OD proposée",
    "assumptions.updated": "Hypothèses modifiées",
    "proposal.recalculated": "OD recalculée",
    "proposal.approved": "OD validée",
    "proposal.rejected": "OD rejetée",
    "proposal.reopened": "OD réouverte",
  };
  return labels[eventType] ?? eventType;
}
