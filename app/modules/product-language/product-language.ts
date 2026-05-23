export type ProductLanguageDomain = "attachment" | "document" | "connector" | "import" | "activity" | "generic";

const genericLabels: Record<string, string> = {
  "attachment.extraction": "lecture de pièce",
  "attachment.extraction_failed": "lecture automatique impossible",
  "attachment.extraction_review": "pièce à relire",
  "attachment.extraction_done": "lecture terminée",
  "document.stale": "à mettre à jour",
  "document.evidence_bundle": "dossier de preuves",
  "document.manifest": "inventaire du dossier",
  "import.mapping": "correspondance de colonnes",
  "import.retry": "relancer",
  "connector.provider": "connecteur",
  "connector.sync": "synchronisation",
  "connector.adapter": "connecteur",
};

export function userFacingLabel(key: string) {
  return genericLabels[key] ?? key;
}

export function userFacingAction(key: string) {
  const actions: Record<string, string> = {
    "import.retry": "Relancer",
    "import.mapping": "Associer les colonnes",
    "connector.sync": "Mettre à jour",
    "document.regenerate": "Régénérer",
    "attachment.review": "Relire la pièce",
  };
  return actions[key] ?? userFacingLabel(key);
}

export function userFacingStatus(domain: ProductLanguageDomain, value: string | null | undefined) {
  if (!value) return "À vérifier";
  if (domain === "attachment") return attachmentStatusLabel(value);
  if (domain === "document") return documentFreshnessStatusLabel(value);
  if (domain === "connector") return connectorStatusLabel(value);
  if (domain === "import") return importStepLabel(value);
  return sanitizeUserFacingText(value);
}

export function attachmentStatusLabel(status: string) {
  switch (status) {
    case "EXTRACTED":
      return "Lecture terminée";
    case "EXTRACTION_FAILED":
      return "Lecture à vérifier";
    case "ARCHIVED":
      return "Archivée";
    case "UPLOADED":
    default:
      return "Déposée";
  }
}

export function documentFreshnessStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("stale") || normalized.includes("obsol")) return "À mettre à jour";
  if (normalized.includes("superseded") || normalized.includes("remplac")) return "Remplacé";
  if (normalized.includes("active") || normalized.includes("jour")) return "À jour";
  return sanitizeUserFacingText(status);
}

export function connectorStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("sync")) return "Synchronisation terminée";
  if (normalized.includes("fixture") || normalized.includes("mock") || normalized.includes("sandbox")) return "Données de test";
  if (normalized.includes("provider")) return sanitizeUserFacingText(status);
  return sanitizeUserFacingText(status);
}

export function importStepLabel(step: string) {
  const labels: Record<string, string> = {
    queued: "En attente",
    "detect-and-parse": "Lecture du fichier",
    "await-mapping": "Colonnes à associer",
    "create-transactions": "Transactions",
    categorize: "Catégorisation",
    "write-ledger": "Écritures",
    complete: "Terminé",
  };
  return labels[step] ?? sanitizeUserFacingText(step);
}

export function sanitizeUserFacingText(value: string, options: { allowInternalTestTerms?: boolean } = {}) {
  let text = value;
  text = text.replace(/\bOCR\b/gi, "lecture de pièce");
  text = text.replace(/\bextraction pièce échouée\b/gi, "lecture de pièce impossible");
  text = text.replace(/\bextraction échouée\b/gi, "lecture automatique impossible");
  text = text.replace(/\bextraction\b/gi, "lecture automatique");
  text = text.replace(/\buploader\b/gi, "déposer");
  text = text.replace(/\bupload\b/gi, "dépôt");
  text = text.replace(/\bmapping\b/gi, "correspondance de colonnes");
  text = text.replace(/\bretry\b/gi, "relance");
  text = text.replace(/\bsync\b/gi, "synchronisation");
  text = text.replace(/\bprovider\b/gi, "connecteur");
  text = text.replace(/\badapter\b/gi, "connecteur");
  text = text.replace(/\bstale\b/gi, "à mettre à jour");
  text = text.replace(/\bobsolète(s)?\b/gi, (_match, plural) => `à mettre à jour${plural ? "s" : ""}`);
  text = text.replace(/\bsuperseded\b/gi, "remplacé");
  text = text.replace(/\bdraft\b/gi, "brouillon");
  text = text.replace(/\bparsing\b/gi, "lecture du fichier");
  text = text.replace(/\bparse\b/gi, "lecture du fichier");
  text = text.replace(/\bartifact\b/gi, "fichier");
  text = text.replace(/\bartefact\b/gi, "fichier");
  text = text.replace(/\bmanifest\b/gi, "inventaire du dossier");
  text = text.replace(/\bchecksum\b/gi, "référence de contrôle");
  text = text.replace(/\bwebhook\b/gi, "notification externe");
  text = text.replace(/\bruntime\b/gi, "service");
  text = text.replace(/\bworkpaper\b/gi, "feuille de travail");
  text = text.replace(/\bsnapshot\b/gi, "état transmis");
  text = text.replace(/\bmetadata\b/gi, "informations");
  text = text.replace(/\bmétadonnées\b/gi, "informations");
  if (!options.allowInternalTestTerms) {
    text = text.replace(/\bfixture\b/gi, "données de test");
    text = text.replace(/\bmock\b/gi, "données de test");
    text = text.replace(/\bsandbox\b/gi, "espace de test");
  }
  return text;
}
