import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { TaxPackageReferenceCenter } from "../official-references/tax-package-reference-center.server";

export type TaxPackageRenderInput = {
  workspace: CompanyWorkspace;
  journal: { entriesCount: number; linesCount: number; debitTotal: number; creditTotal: number; balanced: boolean };
  vat: { deductible: number; collected: number; net: number };
};

export class TaxPackageTemplateRenderer {
  constructor(private readonly taxPackageReference = new TaxPackageReferenceCenter()) {}

  renderStructuredSource(input: TaxPackageRenderInput) {
    const { workspace, journal, vat } = input;
    const year = workspace.fiscalYear.endDate.getFullYear();
    const kind = this.taxPackageReference.pickKind({
      taxRegime: workspace.company.incomeRegime,
      vatRegime: workspace.company.vatRegime,
      legalForm: workspace.company.legalForm,
    });
    const reference = this.taxPackageReference.getActiveReference(kind);
    const label = reference.payloadJson.label;
    return [
      `# ${label} - préparation vérifiable`,
      "",
      "> Préparation vérifiable locale - non télétransmise. Document de revue expert-comptable.",
      "",
      `Référentiel : ${reference.version} · checksum ${reference.checksum}`,
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
      `## ${reference.payloadJson.packageCode} - Cases préparées`,
      "",
      "| Case | Libellé | Montant EUR | Source |",
      "|---|---|---:|---|",
      ...reference.payloadJson.cases.map((taxCase) => `| ${taxCase.code} | ${escapeCell(taxCase.label)} | ${amountForCase(taxCase.code, journal, vat)} | ${taxCase.requiredSource === "journal" ? "Journal comptable" : "À compléter"} |`),
      `| controle_equilibre | Équilibre débit/crédit | ${journal.balanced ? "oui" : "à vérifier"} | Journal comptable |`,
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
      `- Référentiel liasse : ${reference.version}`,
      "",
    ].join("\n");
  }
}

function amountForCase(code: string, journal: TaxPackageRenderInput["journal"], vat: TaxPackageRenderInput["vat"]) {
  if (code === "chiffre_affaires") return money(Math.max(0, journal.creditTotal - vat.collected));
  if (code === "charges_externes" || code === "achats") return money(Math.max(0, journal.debitTotal - vat.deductible));
  if (code === "disponibilites") return "à compléter";
  if (code === "resultat") return money(journal.creditTotal - journal.debitTotal);
  return "à compléter";
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
