import { Prisma, type PrivacyRequestKind } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

export class PrivacyCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async getPrivacyStatus(workspace: CompanyWorkspace) {
    const requests = await prisma.privacyRequest.findMany({
      where: { userId: workspace.user.id, companyId: workspace.company.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    });
    return {
      userDeletedAt: workspace.user.deletedAt?.toISOString() ?? null,
      userAnonymizedAt: workspace.user.anonymizedAt?.toISOString() ?? null,
      companyDeletedAt: workspace.company.deletedAt?.toISOString() ?? null,
      companyAnonymizedAt: workspace.company.anonymizedAt?.toISOString() ?? null,
      requests: requests.map((request) => ({
        id: request.id,
        kind: request.kind,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
        processedAt: request.processedAt?.toISOString() ?? null,
        errorMessage: request.errorMessage,
      })),
    };
  }

  async requestSoftDelete(workspace: CompanyWorkspace, input: { reason?: string | null } = {}) {
    const now = new Date();
    const request = await this.createRequest(workspace, "SOFT_DELETE", { reason: input.reason ?? null });
    await prisma.$transaction([
      prisma.company.update({ where: { id: workspace.company.id }, data: { deletedAt: now } }),
      prisma.user.update({ where: { id: workspace.user.id }, data: { deletedAt: now } }),
      prisma.privacyRequest.update({ where: { id: request.id }, data: { status: "DONE", processedAt: now } }),
    ]);
    await this.activity.recordActivity(workspace, {
      action: "privacy.soft_deleted",
      entityType: "privacy",
      entityId: request.id,
      metadata: { kind: "SOFT_DELETE", reason: input.reason ?? null },
    });
    return request;
  }

  async anonymizeUserData(workspace: CompanyWorkspace, input: { reason?: string | null } = {}) {
    const now = new Date();
    const request = await this.createRequest(workspace, "ANONYMIZATION", { reason: input.reason ?? null });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: workspace.user.id },
        data: {
          email: `anon-${workspace.user.id}@paperasse.local`,
          name: "Utilisateur anonymisé",
          anonymizedAt: now,
        },
      }),
      prisma.company.update({
        where: { id: workspace.company.id },
        data: {
          name: `Société anonymisée ${workspace.company.id.slice(-6)}`,
          siren: null,
          siret: null,
          nafCode: null,
          rcs: null,
          addressStreet: null,
          addressPostal: null,
          addressCity: null,
          managerFirstName: null,
          managerLastName: null,
          managerCivility: null,
          managerRole: null,
          anonymizedAt: now,
        },
      }),
      prisma.privacyRequest.update({ where: { id: request.id }, data: { status: "DONE", processedAt: now } }),
    ]);
    await this.activity.recordActivity(workspace, {
      action: "privacy.anonymized",
      entityType: "privacy",
      entityId: request.id,
      metadata: { kind: "ANONYMIZATION", reason: input.reason ?? null },
    });
    return request;
  }

  async purgeDeletedData(workspace: CompanyWorkspace, input: { confirm?: string | null } = {}) {
    if (process.env.CONFIRM_PERMANENT_DELETE !== "1" && input.confirm !== "CONFIRM_PERMANENT_DELETE") {
      throw new ExpectedRouteError("Purge définitive désactivée sans confirmation explicite.", 403);
    }
    const request = await this.createRequest(workspace, "PURGE", { confirmed: true });
    await prisma.company.delete({ where: { id: workspace.company.id } });
    return request;
  }

  private async createRequest(workspace: CompanyWorkspace, kind: PrivacyRequestKind, metadata: Record<string, unknown>) {
    return prisma.privacyRequest.create({
      data: {
        userId: workspace.user.id,
        companyId: workspace.company.id,
        kind,
        status: "PROCESSING",
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
