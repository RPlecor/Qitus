import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export class DataExportCenter {
  async buildUserExport(workspace: CompanyWorkspace) {
    const [
      fiscalYears,
      imports,
      transactions,
      journalEntries,
      documents,
      activity,
      chatConversations,
      subscriptions,
      usageEvents,
      notifications,
      privacyRequests,
    ] = await Promise.all([
      prisma.fiscalYear.findMany({ where: { companyId: workspace.company.id }, orderBy: { startDate: "asc" } }),
      prisma.import.findMany({ where: { fiscalYear: { companyId: workspace.company.id } }, orderBy: { createdAt: "asc" } }),
      prisma.transaction.findMany({ where: { fiscalYear: { companyId: workspace.company.id } }, include: { categorization: true }, orderBy: { date: "asc" } }),
      prisma.journalEntry.findMany({ where: { fiscalYear: { companyId: workspace.company.id } }, include: { lines: true }, orderBy: [{ date: "asc" }, { num: "asc" }] }),
      prisma.document.findMany({ where: { companyId: workspace.company.id }, orderBy: { generatedAt: "asc" } }),
      prisma.activityLog.findMany({ where: { companyId: workspace.company.id }, orderBy: { createdAt: "asc" } }),
      prisma.chatConversation.findMany({ where: { companyId: workspace.company.id }, include: { messages: true }, orderBy: { createdAt: "asc" } }),
      prisma.subscription.findMany({ where: { companyId: workspace.company.id } }),
      prisma.usageEvent.findMany({ where: { companyId: workspace.company.id }, orderBy: { createdAt: "asc" } }),
      prisma.notification.findMany({ where: { companyId: workspace.company.id }, orderBy: { createdAt: "asc" } }),
      prisma.privacyRequest.findMany({ where: { companyId: workspace.company.id }, orderBy: { requestedAt: "asc" } }),
    ]);
    return {
      exportVersion: "paperasse-user-export-v1",
      generatedAt: new Date().toISOString(),
      user: workspace.user,
      company: workspace.company,
      fiscalYears,
      imports: imports.map(stripImportBytes),
      transactions,
      journalEntries,
      documents: documents.map((document) => ({
        id: document.id,
        fiscalYearId: document.fiscalYearId,
        type: document.type,
        status: document.status,
        filename: document.filename,
        storageKey: document.storageKey,
        format: document.format,
        sizeBytes: document.sizeBytes,
        generatedAt: document.generatedAt,
        generatedBy: document.generatedBy,
        scriptVersion: document.scriptVersion,
        errorMessage: document.errorMessage,
      })),
      activity,
      chatConversations,
      subscriptions,
      usageEvents,
      notifications,
      privacyRequests,
    };
  }

  async downloadUserExport(workspace: CompanyWorkspace) {
    const payload = await this.buildUserExport(workspace);
    return {
      filename: `paperasse-export-${workspace.company.id}.json`,
      content: JSON.stringify(payload, null, 2),
    };
  }
}

function stripImportBytes(importRow: Awaited<ReturnType<typeof prisma.import.findMany>>[number]) {
  return {
    ...importRow,
    storageKey: importRow.storageKey,
  };
}
