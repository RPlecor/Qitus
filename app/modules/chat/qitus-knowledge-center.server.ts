export type QitusKnowledgeSource = {
  sourceId: string;
  title: string;
  content: string;
  href?: string;
  surface: string;
  audience: "user";
};

const SOURCES: QitusKnowledgeSource[] = [
  {
    sourceId: "qitus-dashboard-next-actions",
    title: "Tableau de bord Qitus",
    href: "/dashboard",
    surface: "dashboard",
    audience: "user",
    content: "Le tableau de bord résume l'état du dossier, les prochaines actions, les alertes, les imports, les documents à mettre à jour, les validations restantes et les blocages à résoudre.",
  },
  {
    sourceId: "qitus-import-review",
    title: "Imports et catégorisation",
    href: "/imports",
    surface: "imports",
    audience: "user",
    content: "La page Imports permet d'importer un CSV, de suivre le statut, de corriger la correspondance de colonnes, de relancer la catégorisation et de supprimer ou réinitialiser les imports de l'exercice actif.",
  },
  {
    sourceId: "qitus-transactions-review",
    title: "Transactions à vérifier",
    href: "/transactions",
    surface: "transactions",
    audience: "user",
    content: "La page Transactions sert à vérifier les mouvements importés, corriger une catégorisation, confirmer une suggestion et voir les transactions en revue avant qu'elles alimentent correctement le dossier.",
  },
  {
    sourceId: "qitus-evidence-attachments",
    title: "Justificatifs",
    href: "/pieces",
    surface: "pieces",
    audience: "user",
    content: "La page Justificatifs permet d'ajouter une pièce, de la rattacher à une transaction ou une écriture, de relire une lecture automatique et de compléter la couverture du dossier.",
  },
  {
    sourceId: "qitus-vat-zero",
    title: "TVA dans Qitus",
    href: "/tva",
    surface: "tva",
    audience: "user",
    content: "La page TVA calcule une position à partir des écritures contenant des lignes TVA. Si le régime TVA a changé après un import, il faut souvent relancer la catégorisation ou vérifier les transactions pour obtenir des lignes TVA exploitables.",
  },
  {
    sourceId: "qitus-control",
    title: "Contrôle",
    href: "/controle",
    surface: "controle",
    audience: "user",
    content: "La page Contrôle liste les points à corriger ou à compléter avant génération documentaire ou clôture. Quand une génération est bloquée, l'action sûre consiste à ouvrir le contrôle concerné.",
  },
  {
    sourceId: "qitus-documents",
    title: "Documents",
    href: "/documents",
    surface: "documents",
    audience: "user",
    content: "La page Documents génère et télécharge les documents du dossier comme FEC, balance, états, liasse source et paquet de preuve. Les documents doivent être régénérés quand les écritures ou OD changent.",
  },
  {
    sourceId: "qitus-closing",
    title: "Clôture et OD",
    href: "/cloture",
    surface: "cloture",
    audience: "user",
    content: "La section Clôture guide la préparation annuelle. Les OD de clôture sont des propositions à relire, valider ou rejeter explicitement avant de fermer l'exercice.",
  },
  {
    sourceId: "qitus-reconciliations",
    title: "Rapprochements",
    href: "/rapprochements",
    surface: "rapprochements",
    audience: "user",
    content: "Les rapprochements comparent transactions, écritures, Stripe, banque, tiers et comptes d'attente. Les écarts restent en revue et doivent être confirmés par l'utilisateur.",
  },
  {
    sourceId: "qitus-connectors",
    title: "Connecteurs",
    href: "/connecteurs",
    surface: "connecteurs",
    audience: "user",
    content: "La page Connecteurs regroupe Qonto bancaire, Stripe, Open Banking et Qonto PA. Qitus affiche l'état de configuration, la dernière mise à jour et les actions de connexion ou synchronisation disponibles.",
  },
  {
    sourceId: "qitus-settings",
    title: "Paramètres",
    href: "/parametres",
    surface: "parametres",
    audience: "user",
    content: "La page Paramètres regroupe entreprise, exercices, régime fiscal et TVA, connecteurs, règles de classement, règles comptables, abonnement et confidentialité.",
  },
  {
    sourceId: "qitus-chat-boundary",
    title: "Périmètre du chat Qitus V1",
    href: "/chat",
    surface: "chat",
    audience: "user",
    content: "Le chat Qitus V1 aide à utiliser Qitus, comprendre les écrans, les statuts et les prochaines actions. Il ne donne pas d'avis comptable personnalisé et ne couvre pas encore les règles comptables générales.",
  },
];

const STOP_WORDS = new Set(["dans", "pour", "avec", "sans", "quoi", "quel", "quelle", "quels", "quelles", "mon", "mes", "une", "des", "les", "est", "sont", "sur", "qitus", "comment", "pourquoi"]);

export class QitusKnowledgeCenter {
  search(question: string, options: { limit?: number; minScore?: number } = {}): QitusKnowledgeSource[] {
    const terms = tokenize(question);
    if (terms.length === 0) return [];
    const scored = SOURCES
      .map((source) => ({ source, score: scoreSource(source, terms) }))
    .filter((item) => item.score >= (options.minScore ?? 1))
      .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title));
    return scored.slice(0, options.limit ?? 3).map((item) => item.source);
  }

  listSources() {
    return [...SOURCES];
  }
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function scoreSource(source: QitusKnowledgeSource, terms: string[]) {
  const haystack = `${source.title} ${source.surface} ${source.content} ${source.href ?? ""}`.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return terms.reduce((score, term) => score + (haystack.includes(term) ? (source.surface.includes(term) ? 4 : 1) : 0), 0);
}
