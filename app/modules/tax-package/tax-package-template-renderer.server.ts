import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export type TaxPackageRenderInput = {
  workspace: CompanyWorkspace;
  journal: { entriesCount: number; linesCount: number; debitTotal: number; creditTotal: number; balanced: boolean };
  vat: { deductible: number; collected: number; net: number };
};

export class TaxPackageTemplateRenderer {
  renderStructuredSource(input: TaxPackageRenderInput) {
    const { workspace, journal, vat } = input;
    const year = workspace.fiscalYear.endDate.getFullYear();
    return [
      "# Liasse fiscale 2033 - brouillon structuré",
      "",
      "> Brouillon local - non télétransmis. Document de revue expert-comptable.",
      "",
      "## Identification",
      "",
      "| Case | Libellé | Valeur | Source |",
      "|---|---|---:|---|",
      `| A1 | Dénomination | ${escapeCell(workspace.company.name)} | Profil société |`,
      `| A2 | SIREN | ${workspace.company.siren ?? "non renseigné"} | Profil société |`,
      `| A3 | Forme juridique | ${workspace.company.legalForm} | Profil société |`,
      `| A4 | Exercice | ${date(workspace.fiscalYear.startDate)} au ${date(workspace.fiscalYear.endDate)} | FiscalYear |`,
      "",
      "## 2033-A - Bilan simplifié",
      "",
      "| Case | Libellé | Montant EUR | Source |",
      "|---|---|---:|---|",
      `| 110 | Total actif - brouillon | ${money(journal.debitTotal)} | JournalEntry débit total |`,
      `| 310 | Total passif - brouillon | ${money(journal.creditTotal)} | JournalEntry crédit total |`,
      `| 399 | Équilibre débit/crédit | ${journal.balanced ? "oui" : "non"} | JournalAudit |`,
      "",
      "## 2033-B - Compte de résultat simplifié",
      "",
      "| Case | Libellé | Montant EUR | Source |",
      "|---|---|---:|---|",
      `| 210 | Produits d'exploitation - brouillon | ${money(Math.max(0, journal.creditTotal - vat.collected))} | JournalEntry crédits hors TVA estimée |`,
      `| 230 | Charges d'exploitation - brouillon | ${money(Math.max(0, journal.debitTotal - vat.deductible))} | JournalEntry débits hors TVA estimée |`,
      `| 270 | Résultat comptable indicatif | ${money(journal.creditTotal - journal.debitTotal)} | JournalExplorer summary |`,
      "",
      "## TVA - Agrégation préparatoire",
      "",
      "| Compte | Libellé | Montant EUR | Source |",
      "|---|---|---:|---|",
      `| 44566 | TVA déductible | ${money(vat.deductible)} | JournalLine |`,
      `| 44571 | TVA collectée | ${money(vat.collected)} | JournalLine |`,
      `| TVA_NETTE | TVA nette indicative | ${money(vat.net)} | 44571 - 44566 |`,
      "",
      "## Contrôles de génération",
      "",
      `- Année fiscale : ${year}`,
      `- Écritures incluses : ${journal.entriesCount}`,
      `- Lignes incluses : ${journal.linesCount}`,
      `- Source structurée générée par : TaxPackageTemplateRenderer`,
      "",
    ].join("\n");
  }
}

function date(value: Date) {
  return value.toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function escapeCell(value: string) {
  return value.replace(/\|/g, "/");
}
