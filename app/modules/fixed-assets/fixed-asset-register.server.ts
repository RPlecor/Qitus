import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type FixedAssetInput = {
  label: string;
  account: string;
  acquisitionDate: string;
  amount: string | number;
  usefulLifeYears: string | number;
  depreciationAccount: string;
  expenseAccount: string;
};

export type FixedAssetSummary = {
  id: string;
  label: string;
  account: string;
  acquisitionDate: string;
  amount: number;
  method: string;
  usefulLifeYears: number;
  depreciationAccount: string;
  expenseAccount: string;
  archivedAt: string | null;
  depreciation: DepreciationPreview;
};

export type DepreciationPreview = {
  days: number;
  totalDays: number;
  annualAmount: number;
  exerciseAmount: number;
  netBookValue: number;
  lines: Array<{ account: string; debit: number; credit: number }>;
};

export class FixedAssetRegister {
  async listAssets(workspace: CompanyWorkspace): Promise<FixedAssetSummary[]> {
    const assets = await prisma.fixedAsset.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      orderBy: { acquisitionDate: "asc" },
    });
    return assets.map((asset) => summarizeAsset(asset, workspace.fiscalYear.endDate));
  }

  async createAsset(workspace: CompanyWorkspace, input: FixedAssetInput): Promise<FixedAssetSummary> {
    const asset = await prisma.fixedAsset.create({
      data: toData(workspace.fiscalYear.id, input),
    });
    return summarizeAsset(asset, workspace.fiscalYear.endDate);
  }

  async updateAsset(workspace: CompanyWorkspace, assetId: string, input: FixedAssetInput): Promise<FixedAssetSummary> {
    const asset = await prisma.fixedAsset.update({
      where: { id: assetId, fiscalYearId: workspace.fiscalYear.id },
      data: toData(workspace.fiscalYear.id, input),
    });
    return summarizeAsset(asset, workspace.fiscalYear.endDate);
  }

  async archiveAsset(workspace: CompanyWorkspace, assetId: string): Promise<FixedAssetSummary> {
    const asset = await prisma.fixedAsset.update({
      where: { id: assetId, fiscalYearId: workspace.fiscalYear.id },
      data: { archivedAt: new Date() },
    });
    return summarizeAsset(asset, workspace.fiscalYear.endDate);
  }

  async previewDepreciation(workspace: CompanyWorkspace, assetId: string): Promise<DepreciationPreview> {
    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId, fiscalYearId: workspace.fiscalYear.id } });
    return depreciationPreview(asset, workspace.fiscalYear.endDate);
  }
}

function toData(fiscalYearId: string, input: FixedAssetInput) {
  return {
    fiscalYearId,
    label: String(input.label || "").trim(),
    account: String(input.account || "2183").trim(),
    acquisitionDate: new Date(input.acquisitionDate),
    amount: new Prisma.Decimal(Number(input.amount || 0)),
    usefulLifeYears: Number(input.usefulLifeYears || 3),
    depreciationAccount: String(input.depreciationAccount || "28183").trim(),
    expenseAccount: String(input.expenseAccount || "68112").trim(),
  };
}

function summarizeAsset(asset: {
  id: string;
  label: string;
  account: string;
  acquisitionDate: Date;
  amount: Prisma.Decimal | number | string;
  method: string;
  usefulLifeYears: number;
  depreciationAccount: string;
  expenseAccount: string;
  archivedAt: Date | null;
}, fiscalYearEnd: Date): FixedAssetSummary {
  return {
    id: asset.id,
    label: asset.label,
    account: asset.account,
    acquisitionDate: asset.acquisitionDate.toISOString().slice(0, 10),
    amount: Number(asset.amount),
    method: asset.method,
    usefulLifeYears: asset.usefulLifeYears,
    depreciationAccount: asset.depreciationAccount,
    expenseAccount: asset.expenseAccount,
    archivedAt: asset.archivedAt?.toISOString() ?? null,
    depreciation: depreciationPreview(asset, fiscalYearEnd),
  };
}

export function depreciationPreview(asset: {
  acquisitionDate: Date;
  amount: Prisma.Decimal | number | string;
  usefulLifeYears: number;
  depreciationAccount: string;
  expenseAccount: string;
}, fiscalYearEnd: Date): DepreciationPreview {
  const acquisition = asset.acquisitionDate;
  const totalDays = isLeapYear(fiscalYearEnd.getFullYear()) ? 366 : 365;
  const days = Math.max(0, Math.min(totalDays, Math.floor((fiscalYearEnd.getTime() - acquisition.getTime()) / 86_400_000) + 1));
  const amount = Number(asset.amount);
  const annualAmount = round2(amount / asset.usefulLifeYears);
  const exerciseAmount = round2(annualAmount * days / totalDays);
  const netBookValue = round2(Math.max(0, amount - exerciseAmount));
  return {
    days,
    totalDays,
    annualAmount,
    exerciseAmount,
    netBookValue,
    lines: [
      { account: asset.expenseAccount, debit: exerciseAmount, credit: 0 },
      { account: asset.depreciationAccount, debit: 0, credit: exerciseAmount },
    ],
  };
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
