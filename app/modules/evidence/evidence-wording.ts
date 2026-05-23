export type EvidenceWordingLevel = "required" | "recommended" | string;

export function entriesWithoutEvidenceLabel(count: number, options: { compact?: boolean } = {}) {
  const noun = `${count} écriture${count > 1 ? "s" : ""}`;
  return options.compact ? `${noun} sans justificatif` : `${noun} sans justificatif rattaché`;
}

export function orphanAttachmentsLabel(count: number) {
  return `${count} pièce${count > 1 ? "s" : ""} sans écriture`;
}

export function ocrReviewLabel(count: number) {
  return `${count} pièce${count > 1 ? "s" : ""} à relire`;
}

export function evidenceCoverageSummary(input: { entriesWithoutEvidence: number; orphanAttachments: number; extractionFailures: number }) {
  return [
    entriesWithoutEvidenceLabel(input.entriesWithoutEvidence),
    orphanAttachmentsLabel(input.orphanAttachments),
    ocrReviewLabel(input.extractionFailures),
  ].join(" · ");
}

export function evidenceCoverageHint(input: { entriesWithoutEvidence: number; orphanAttachments: number }) {
  return `${entriesWithoutEvidenceLabel(input.entriesWithoutEvidence, { compact: true })} · ${orphanAttachmentsLabel(input.orphanAttachments)}`;
}

export function evidenceLevelLabel(level: EvidenceWordingLevel, options: { satisfied?: boolean } = {}) {
  if (level === "required") return options.satisfied ? "Complétée" : "À compléter";
  if (level === "recommended") return "Recommandée";
  return String(level);
}
