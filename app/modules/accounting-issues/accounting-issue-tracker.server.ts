import { type AccountingIssueStatus } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import {
  AccountingReviewCenter,
  type AccountingControl,
  type AccountingControlEvidence,
} from "../accounting-review/accounting-review-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

export type AccountingIssueSummary = {
  issueKey: string;
  controlCode: string;
  controlTitle: string;
  controlDetail: string;
  severity: "blocking" | "warning";
  category: string;
  status: AccountingIssueStatus;
  note: string | null;
  evidence: AccountingControlEvidence;
  action: { label: string; href: string };
};

export type AccountingIssueStateSummary = {
  open: number;
  resolved: number;
  ignored: number;
};

export class AccountingIssueTracker {
  constructor(
    private readonly reviewCenter = new AccountingReviewCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async listIssues(workspace: CompanyWorkspace): Promise<AccountingIssueSummary[]> {
    const controls = await this.reviewCenter.listDetectedControls(workspace);
    return flattenTrackableIssues(controls);
  }

  async getIssueDetail(workspace: CompanyWorkspace, issueKey: string): Promise<AccountingIssueSummary> {
    const issue = (await this.listIssues(workspace)).find((candidate) => candidate.issueKey === issueKey);
    if (!issue) throw new ExpectedRouteError("Point de contrôle introuvable.", 404);
    return issue;
  }

  async setIssueStatus(
    workspace: CompanyWorkspace,
    input: { issueKey: string; status: AccountingIssueStatus; note?: string | null }
  ): Promise<AccountingIssueSummary> {
    const issue = await this.getIssueDetail(workspace, input.issueKey);
    if (issue.severity === "blocking") {
      throw new ExpectedRouteError("Ce blocage doit être résolu par une correction réelle, pas par un statut de suivi.", 409);
    }

    const existing = await prisma.accountingIssueResolution.findUnique({
      where: { fiscalYearId_issueKey: { fiscalYearId: workspace.fiscalYear.id, issueKey: input.issueKey } },
    });
    const now = new Date();
    const note = normalizeNote(input.note);

    await prisma.accountingIssueResolution.upsert({
      where: { fiscalYearId_issueKey: { fiscalYearId: workspace.fiscalYear.id, issueKey: input.issueKey } },
      update: {
        status: input.status,
        note,
        resolvedAt: input.status === "RESOLVED" ? now : null,
        ignoredAt: input.status === "IGNORED" ? now : null,
      },
      create: {
        fiscalYearId: workspace.fiscalYear.id,
        issueKey: input.issueKey,
        controlCode: issue.controlCode,
        status: input.status,
        note,
        resolvedAt: input.status === "RESOLVED" ? now : null,
        ignoredAt: input.status === "IGNORED" ? now : null,
      },
    });

    await this.activity.recordActivity(workspace, {
      action: activityAction(input.status, existing?.status, existing?.note, note),
      entityType: "accounting_issue",
      entityId: input.issueKey,
      metadata: { controlCode: issue.controlCode, status: input.status, note },
    });

    return this.getIssueDetail(workspace, input.issueKey);
  }

  async summarizeIssueState(workspace: CompanyWorkspace): Promise<AccountingIssueStateSummary> {
    return summarizeIssues(await this.listIssues(workspace));
  }
}

export function flattenTrackableIssues(controls: AccountingControl[]): AccountingIssueSummary[] {
  return controls.flatMap((control) =>
    control.evidence.flatMap((evidence) => {
      if (!evidence.issueKey) return [];
      return {
        issueKey: evidence.issueKey,
        controlCode: control.code,
        controlTitle: control.title,
        controlDetail: control.detail,
        severity: control.severity,
        category: control.category,
        status: evidence.resolutionStatus ?? "OPEN",
        note: evidence.note ?? null,
        evidence,
        action: control.action,
      };
    })
  );
}

export function summarizeIssues(issues: AccountingIssueSummary[]): AccountingIssueStateSummary {
  return {
    open: issues.filter((issue) => issue.status === "OPEN").length,
    resolved: issues.filter((issue) => issue.status === "RESOLVED").length,
    ignored: issues.filter((issue) => issue.status === "IGNORED").length,
  };
}

function activityAction(
  next: AccountingIssueStatus,
  previous: AccountingIssueStatus | undefined,
  previousNote: string | null | undefined,
  nextNote: string | null
) {
  if (next === "RESOLVED") return "accounting_issue.resolved";
  if (next === "IGNORED") return "accounting_issue.ignored";
  if (previous && previous !== "OPEN" && next === "OPEN") return "accounting_issue.reopened";
  if ((previousNote ?? null) !== nextNote) return "accounting_issue.note_updated";
  return "accounting_issue.reopened";
}

function normalizeNote(note: string | null | undefined) {
  const clean = (note ?? "").trim();
  return clean.length > 0 ? clean : null;
}
