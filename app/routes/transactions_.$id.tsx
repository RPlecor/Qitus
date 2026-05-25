import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { Upload } from "lucide-react";
import { useState } from "react";
import { AppShell, Main } from "~/components/ui";
import { AccountingCertaintyCenter } from "~/modules/accounting-certainty/accounting-certainty-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentLinkCenter } from "~/modules/evidence/attachment-link-center.server";
import { TransactionExplorer } from "~/modules/transactions/transaction-explorer.server";
import { TransactionFilterStateCenter } from "~/modules/transactions/transaction-filter-state";
import { TransactionReviewQueue } from "~/modules/transactions/transaction-review-queue.server";
import { TransactionSuggestionCenter } from "~/modules/transactions/transaction-suggestion-center.server";
import { categorizationSourceLabel } from "~/modules/ui-labels";
import { VAT_NATURE_OPTIONS, VAT_RATE_OPTIONS, vatNatureLabel, vatRateLabel, vatRateToOptionValue } from "~/modules/vat/vat-rate-policy";

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const filters = new TransactionFilterStateCenter();
  const filterState = filters.parseFromUrl(new URL(request.url));
  const [transaction, suggestions, navigation, attachmentLinks, certainty] = await Promise.all([
    new TransactionExplorer().getTransactionDetail(workspace, String(params.id)),
    new TransactionSuggestionCenter().getSuggestions(workspace, String(params.id)),
    new TransactionReviewQueue().getCurrentReview(workspace, String(params.id), filterState),
    new AttachmentLinkCenter().listLinksForEntity(workspace, { entityType: "TRANSACTION", entityId: String(params.id) }),
    new AccountingCertaintyCenter().getTransactionCertainty(workspace, String(params.id)),
  ]);
  const back = new URL(request.url).search || "";
  return json({ transaction, suggestions, navigation, attachmentLinks, certainty, back });
}

export default function TransactionReview() {
  const { transaction, suggestions, navigation, attachmentLinks, certainty, back } = useLoaderData<typeof loader>();
  const primary = suggestions[0];

  return (
    <AppShell active="transactions">
      <Main title={transaction.needsReview ? "Correction transaction" : "Transaction"} subtitle="Détail et suggestions">
        <div className="row-actions">
          <Link className="btn btn-ghost" to={navigation.listUrl}>← Retour liste filtrée</Link>
          {navigation.previousUrl ? <Link className="btn" to={navigation.previousUrl}>Précédente</Link> : null}
          {navigation.nextUrl ? <Link className="btn" to={navigation.nextUrl}>Suivante</Link> : null}
        </div>

        {transaction.needsReview ? (
          <div className="alert alert-warn">
            <strong>Transaction à vérifier</strong>
            <span>{navigation.position ? `${navigation.position} / ${navigation.total} à corriger` : "À corriger hors file filtrée"}</span>
          </div>
        ) : null}
        {transaction.needsLightReview ? (
          <div className="alert blue">
            <strong>À relire rapidement</strong>
            <span>Qitus a une proposition fiable, mais attend une vérification légère avant de créer l'écriture.</span>
          </div>
        ) : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Date</div><span className="kpi-val">{formatShortDate(transaction.date)}</span></div>
          <div className="kpi"><div className="kpi-label">Montant</div><span className="kpi-val">{formatEuro(transaction.amount)}</span></div>
          <div className="kpi"><div className="kpi-label">Compte affiché</div><span className="kpi-val">{transaction.account}</span></div>
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{statusLabel(transaction.businessStatus)}</span></div>
        </div>

        <div className={`alert ${certainty.status === "blocked" ? "red" : certainty.status === "needs_review" ? "orange" : certainty.status === "review_light" ? "blue" : "green"}`}>
          <strong>Certitude : {certainty.label}</strong>
          <span>{certainty.reasons[0]?.label ?? "Contrôles Qitus appliqués."}</span>
          {certainty.primaryAction ? <Link className="btn btn-sm" to={certainty.primaryAction.href}>{certainty.primaryAction.label}</Link> : null}
        </div>
        {certainty.reasons.length > 1 ? (
          <ul className="evidence-list">
            {certainty.reasons.slice(1, 5).map((item) => (
              <li key={`${item.source}:${item.label}`}>
                <span>{item.label}</span>
                {item.action ? <Link className="btn btn-sm" to={item.action.href}>{item.action.label}</Link> : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="card">
          <h2>{transaction.label}</h2>
          <p className="sub">{transaction.counterparty ?? "Contrepartie non détectée"} · {transaction.sourceRef ?? "Sans référence"}</p>
          {transaction.categorization?.aiRationale ? <p className="sub">{transaction.categorization.aiRationale}</p> : null}
        </div>

        <div className="sec-head"><h2>Suggestions</h2></div>
        <table className="tbl">
          <thead><tr><th>Badge</th><th>Source</th><th>Débit</th><th>Crédit</th><th>TVA</th><th>Nature</th><th>Libellé</th><th>Raison</th></tr></thead>
          <tbody>
            {suggestions.map((suggestion) => (
              <tr key={suggestion.id}>
                <td>{suggestion.badge}</td>
                <td>{categorizationSourceLabel(suggestion.source)}</td>
                <td><span className="cpt">{suggestion.accountDebit}</span></td>
                <td><span className="cpt">{suggestion.accountCredit}</span></td>
                <td>{vatRateLabel(suggestion.vatRate)}</td>
                <td>{vatNatureLabel(suggestion.vatOperationNature)}</td>
                <td>{suggestion.ecritureLabel}</td>
                <td className="sub">{suggestion.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {transaction.matchingRules.length > 0 ? (
          <>
            <div className="sec-head"><h2>Règles qui matchent</h2></div>
            <table className="tbl">
              <tbody>
                {transaction.matchingRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.counterparty}</td>
                    <td><span className="cpt">{rule.preferredAccount}</span></td>
                    <td>{rule.condition ?? "—"}</td>
                    <td><Link className="btn btn-sm" to={`/corrections/${rule.id}`}>Voir la règle</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {transaction.journalEntry ? (
          <>
            <div className="sec-head"><h2>Écriture liée</h2></div>
            <table className="tbl">
              <thead><tr><th>N°</th><th>Journal</th><th>Libellé</th><th>Lignes</th></tr></thead>
              <tbody><tr><td>{transaction.journalEntry.num}</td><td>{transaction.journalEntry.journal}</td><td>{transaction.journalEntry.label}</td><td>{transaction.journalEntry.lines.length}</td></tr></tbody>
            </table>
          </>
        ) : null}

        <div className="sec-head"><h2>Pièces liées</h2></div>
        <section className="panel">
          <ul className="evidence-list">
            {attachmentLinks.map((link) => (
              <li key={link.id}>
                <span>{link.attachment.filename} · {relationLabel(link.relationType)}</span>
                <Link className="btn btn-sm" to={`/pieces/${link.attachment.id}`}>Voir la pièce</Link>
              </li>
            ))}
            {attachmentLinks.length === 0 ? <li>Aucune pièce rattachée à cette transaction.</li> : null}
          </ul>
          <AttachmentUploadForm transactionId={transaction.id} amount={Number(transaction.amount)} back={back} />
        </section>

        <div className="sec-head"><h2>Correction</h2></div>
        <Form method="post" action={`/api/transactions/${transaction.id}/categorize${back}`} className="card">
          <div className="form-row">
            <div className="field">
              <label>Compte débit</label>
              <input name="accountDebit" defaultValue={primary?.accountDebit ?? ""} />
            </div>
            <div className="field">
              <label>Compte crédit</label>
              <input name="accountCredit" defaultValue={primary?.accountCredit ?? ""} />
            </div>
          </div>
          <div className="field">
            <label>Libellé écriture</label>
            <input name="ecritureLabel" defaultValue={primary?.ecritureLabel ?? transaction.label} />
          </div>
          <div className="field">
            <label>Taux TVA</label>
            <select name="vatRate" defaultValue={vatRateToOptionValue(primary?.vatRate ?? transaction.categorization?.vatRate ?? null)}>
              {VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="help">Utilisé uniquement si l'entreprise est au régime réel TVA.</span>
          </div>
          <div className="field">
            <label>Nature TVA</label>
            <select name="vatOperationNature" defaultValue={primary?.vatOperationNature ?? transaction.categorization?.vatOperationNature ?? "auto"}>
              <option value="auto">Automatique</option>
              {VAT_NATURE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="help">Alimente les brouillons CA3/CA12 et les contrôles TVA.</span>
          </div>
          <div className="field">
            <label><input type="checkbox" name="learn" /> Apprendre cette correction</label>
            <span className="help">Crée une règle utilisateur réutilisable dans les prochaines suggestions.</span>
          </div>
          <button className="btn btn-p" type="submit">Valider la catégorisation</button>
        </Form>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "NEEDS_REVIEW") return "À vérifier";
  if (status === "REVIEW_LIGHT") return "À relire rapidement";
  if (status === "AUTO_APPLIED") return "Appliquée automatiquement";
  if (status === "CORRECTED") return "Corrigée";
  if (status === "CONFIRMED") return "Confirmée";
  if (status === "HAS_RULE") return "Avec règle";
  return "Catégorisée";
}

function AttachmentUploadForm({ transactionId, amount, back }: { transactionId: string; amount: number; back: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const inputId = `attachment-upload-${transactionId}`;

  return (
    <Form method="post" action="/api/attachments" encType="multipart/form-data" className="attachment-upload-form">
      <input type="hidden" name="returnTo" value={`/transactions/${transactionId}${back}`} />
      <input type="hidden" name="entityType" value="TRANSACTION" />
      <input type="hidden" name="entityId" value={transactionId} />
      <input type="hidden" name="relationType" value={amount >= 0 ? "CONTRACT" : "INVOICE"} />
      <div className="attachment-upload-main">
        <span className="upload-title">Ajouter une pièce</span>
        <label className="file-dropzone compact" htmlFor={inputId}>
          <span className="file-dropzone-icon" aria-hidden="true">
            <Upload size={20} strokeWidth={1.8} />
          </span>
          <span>
            <strong>{fileName ?? "Choisir une pièce"}</strong>
            <small>PDF, image ou texte</small>
          </span>
        </label>
        <input
          id={inputId}
          className="visually-hidden-file"
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
      </div>
      <button className="btn btn-p attach-submit" type="submit" disabled={!fileName}>Déposer et rattacher</button>
    </Form>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function relationLabel(value: string) {
  if (value === "INVOICE") return "Facture";
  if (value === "CONTRACT") return "Contrat";
  if (value === "RECEIPT") return "Reçu";
  if (value === "BANK_STATEMENT") return "Relevé";
  if (value === "USER_DECISION") return "Décision";
  return "Pièce";
}
