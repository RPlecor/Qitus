import { prisma } from "../db.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { CompanyProfileClassificationCenter, type CompanyTier } from "../accounting-reference/company-profile-classification-center.server";

export type CategorizationAutomationMetrics = {
  fiscalYearId: string;
  companyTier: CompanyTier;
  totalCategorized: number;
  autoApplied: number;
  reviewLight: number;
  needsReview: number;
  autoAppliedRate: number;
  reviewRate: number;
  averageAiConfidence: number | null;
  uncategorizedOlderThan30Days: number;
  autoAppliedCorrections: number;
  autoAppliedCorrectionRate: number;
  thresholds: CategorizationAutomationThresholds;
  alerts: CategorizationAutomationAlert[];
};

export type CategorizationAutomationThresholds = {
  minAutoAppliedRate: number;
  maxNeedsReviewRate: number | null;
  minAverageAiConfidence: number;
  maxUncategorizedOlderThan30Days: number;
  maxAutoAppliedCorrectionRate: number;
  expansionCandidateCorrectionRate: number;
};

export type CategorizationAutomationAlert = {
  code:
    | "AUTO_APPLIED_RATE_LOW"
    | "NEEDS_REVIEW_RATE_HIGH"
    | "AI_CONFIDENCE_LOW"
    | "UNCATEGORIZED_OLD_TRANSACTIONS"
    | "AUTO_APPLIED_CORRECTION_RATE_HIGH"
    | "AUTO_APPLIED_EXPANSION_CANDIDATE";
  tone: "warning" | "info";
  message: string;
};

const THRESHOLDS: Record<CompanyTier, CategorizationAutomationThresholds> = {
  TIER_1_MICRO: threshold(95, 15),
  TIER_2_EI_REEL: threshold(85, 25),
  TIER_3_IS_SANS_EC: threshold(80, 30),
  TIER_4_AVEC_EC: threshold(90, null),
};

export class CategorizationAutomationMetricsCenter {
  async getMetrics(workspace: CompanyWorkspace): Promise<CategorizationAutomationMetrics> {
    const classification = new CompanyProfileClassificationCenter().classifyCompanyProfile(workspace.company);
    const [categorizations, uncategorizedOlderThan30Days, autoAppliedCorrections] = await Promise.all([
      prisma.categorization.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        select: { status: true, confidence: true, source: true },
      }),
      prisma.transaction.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          date: { lt: daysAgo(30) },
          categorization: null,
        },
      }),
      prisma.activityLog.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          action: "transaction.user_corrected_auto_applied",
        },
      }),
    ]);

    const totalCategorized = categorizations.length;
    const autoApplied = categorizations.filter((row) => row.status === "AUTO_APPLIED").length;
    const reviewLight = categorizations.filter((row) => row.status === "REVIEW_LIGHT").length;
    const needsReview = categorizations.filter((row) => row.status === "NEEDS_REVIEW").length;
    const aiConfidenceScores = categorizations
      .filter((row) => row.source === "AI")
      .map((row) => confidenceScore(row.confidence));
    const thresholds = THRESHOLDS[classification.tier];
    const metrics = {
      fiscalYearId: workspace.fiscalYear.id,
      companyTier: classification.tier,
      totalCategorized,
      autoApplied,
      reviewLight,
      needsReview,
      autoAppliedRate: rate(autoApplied, totalCategorized),
      reviewRate: rate(needsReview, totalCategorized),
      averageAiConfidence: aiConfidenceScores.length > 0 ? round(aiConfidenceScores.reduce((sum, value) => sum + value, 0) / aiConfidenceScores.length) : null,
      uncategorizedOlderThan30Days,
      autoAppliedCorrections,
      autoAppliedCorrectionRate: rate(autoAppliedCorrections, autoApplied + autoAppliedCorrections),
      thresholds,
      alerts: [] as CategorizationAutomationAlert[],
    };
    metrics.alerts = buildAlerts(metrics);
    return metrics;
  }
}

function threshold(minAutoAppliedRate: number, maxNeedsReviewRate: number | null): CategorizationAutomationThresholds {
  return {
    minAutoAppliedRate,
    maxNeedsReviewRate,
    minAverageAiConfidence: 75,
    maxUncategorizedOlderThan30Days: 10,
    maxAutoAppliedCorrectionRate: 5,
    expansionCandidateCorrectionRate: 2,
  };
}

function buildAlerts(metrics: Omit<CategorizationAutomationMetrics, "alerts">): CategorizationAutomationAlert[] {
  const alerts: CategorizationAutomationAlert[] = [];
  if (metrics.totalCategorized > 0 && metrics.autoAppliedRate < metrics.thresholds.minAutoAppliedRate) {
    alerts.push({ code: "AUTO_APPLIED_RATE_LOW", tone: "warning", message: "Le taux de catégorisation automatique est sous l'objectif du profil." });
  }
  if (metrics.thresholds.maxNeedsReviewRate !== null && metrics.reviewRate > metrics.thresholds.maxNeedsReviewRate) {
    alerts.push({ code: "NEEDS_REVIEW_RATE_HIGH", tone: "warning", message: "Trop de transactions demandent une revue complète." });
  }
  if (metrics.averageAiConfidence !== null && metrics.averageAiConfidence < metrics.thresholds.minAverageAiConfidence) {
    alerts.push({ code: "AI_CONFIDENCE_LOW", tone: "warning", message: "La confiance moyenne de l'IA est sous le seuil attendu." });
  }
  if (metrics.uncategorizedOlderThan30Days > metrics.thresholds.maxUncategorizedOlderThan30Days) {
    alerts.push({ code: "UNCATEGORIZED_OLD_TRANSACTIONS", tone: "warning", message: "Plus de 10 transactions de plus de 30 jours restent sans catégorisation." });
  }
  if (metrics.autoAppliedCorrectionRate > metrics.thresholds.maxAutoAppliedCorrectionRate) {
    alerts.push({ code: "AUTO_APPLIED_CORRECTION_RATE_HIGH", tone: "warning", message: "Les corrections d'éléments appliqués automatiquement dépassent 5 %. La policy doit être resserrée." });
  } else if (metrics.autoApplied > 0 && metrics.autoAppliedCorrectionRate < metrics.thresholds.expansionCandidateCorrectionRate) {
    alerts.push({ code: "AUTO_APPLIED_EXPANSION_CANDIDATE", tone: "info", message: "Le taux de correction est bas : élargissement possible après beta, avec prudence." });
  }
  return alerts;
}

function confidenceScore(confidence: string) {
  if (confidence === "HIGH") return 95;
  if (confidence === "MEDIUM") return 70;
  return 40;
}

function rate(count: number, total: number) {
  return total > 0 ? round((count / total) * 100) : 0;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
