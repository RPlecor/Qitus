import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { TaxPackageReferenceCenter } from "../official-references/tax-package-reference-center.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import type { TaxPackageCerfaDraft } from "./tax-package-cerfa-center.server";

export type TaxPackageRenderInput = {
  workspace: CompanyWorkspace;
  journal: { entriesCount: number; linesCount: number; debitTotal: number; creditTotal: number; balanced: boolean };
  vat: { deductible: number; collected: number; net: number };
};

export class TaxPackageTemplateRenderer {
  constructor(
    private readonly taxPackageReference = new TaxPackageReferenceCenter(),
    private readonly vatReference = new VatReferenceCenter()
  ) {}

  async renderStructuredSource(input: TaxPackageRenderInput) {
    const { workspace, journal, vat } = input;
    const year = workspace.fiscalYear.endDate.getFullYear();
    const kind = this.taxPackageReference.pickKind({
      taxRegime: workspace.company.incomeRegime,
      vatRegime: workspace.company.vatRegime,
      legalForm: workspace.company.legalForm,
    });
    const reference = await this.taxPackageReference.getActiveReference(kind);
    const vatAccounts = await this.vatReference.getVatAccounts();
    const label = reference.payloadJson.label;
    return [
      `# ${label} - préparation vérifiable`,
      "",
      "> Préparation vérifiable locale - non télétransmise. Document de revue expert-comptable.",
      "",
      `Version vérifiée : ${reference.version}`,
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
      `| ${vatAccounts.deductible} | TVA déductible | ${money(vat.deductible)} | Journal comptable |`,
      `| ${vatAccounts.collected} | TVA collectée | ${money(vat.collected)} | Journal comptable |`,
      `| TVA_NETTE | TVA nette indicative | ${money(vat.net)} | ${vatAccounts.collected} - ${vatAccounts.deductible} |`,
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

  renderCerfaDraft(draft: TaxPackageCerfaDraft) {
    return [
      `# ${draft.label} - préparation CERFA complète case par case`,
      "",
      "> Préparation vérifiable locale - non télétransmise. Document à relire avec votre expert-comptable.",
      "",
      `Version vérifiée : ${draft.reference.version}`,
      `Millésime : ${draft.millesime}`,
      `Source officielle : ${draft.reference.sourceUrl}`,
      "",
      "## Synthèse",
      "",
      `- Statut : ${draft.summary.label}`,
      `- Cases calculées : ${draft.summary.calculated}`,
      `- Cases calculées à 0 faute de mouvement : ${draft.summary.zeroByAbsence}`,
      `- Cases à compléter : ${draft.summary.toComplete}`,
      `- Cases bloquées : ${draft.summary.blocked}`,
      `- Cases non applicables : ${draft.summary.notApplicable}`,
      "",
      "## Identification",
      "",
      "| Information | Valeur |",
      "|---|---|",
      `| Entreprise | ${escapeCell(draft.company.name)} |`,
      `| SIREN | ${draft.company.siren ?? "à compléter"} |`,
      `| Forme juridique | ${draft.company.legalForm ?? "à compléter"} |`,
      `| Exercice | ${draft.fiscalYear.startDate} au ${draft.fiscalYear.endDate} |`,
      "",
      ...draft.tables.flatMap((table) => [
        `## ${table.code}`,
        "",
        "| Case CERFA | Libellé | Valeur | Statut | Source | Lecture Qitus |",
        "|---|---|---:|---|---|---|",
        ...table.cases.map((taxCase) => [
          taxCase.code,
          escapeCell(taxCase.label),
          formatCaseValue(taxCase.value),
          taxCase.status,
          escapeCell(taxCase.source),
          escapeCell(taxCase.reason ?? ""),
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |")),
        "",
      ]),
      "## Contrôles de génération",
      "",
      `- Référentiel liasse : ${draft.reference.version}`,
      `- Formulaire : ${draft.packageCode}`,
      `- Cases modélisées : ${draft.summary.totalCases}`,
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

function formatCaseValue(value: string | number | null) {
  if (value == null || value === "") return "à compléter";
  if (typeof value === "number") return money(value);
  return escapeCell(value);
}
