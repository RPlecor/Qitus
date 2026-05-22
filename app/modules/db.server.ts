import { PrismaClient } from "@prisma/client";

declare global {
  var __qitusPrisma: PrismaClient | undefined;
}

const cachedPrisma = global.__qitusPrisma;
const cachedPrismaShape = cachedPrisma as (PrismaClient & {
  subscription?: unknown;
  chatConversation?: unknown;
  attachment?: unknown;
  dossierSnapshot?: unknown;
  expertReviewRun?: unknown;
  bankConnection?: unknown;
}) | undefined;
const hasCurrentSchema = Boolean(cachedPrismaShape?.subscription && cachedPrismaShape.chatConversation && cachedPrismaShape.attachment && cachedPrismaShape.dossierSnapshot && cachedPrismaShape.expertReviewRun && cachedPrismaShape.bankConnection);

if (cachedPrisma && !hasCurrentSchema) {
  cachedPrisma.$disconnect().catch(() => undefined);
  global.__qitusPrisma = undefined;
}

export const prisma = global.__qitusPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__qitusPrisma = prisma;
}
