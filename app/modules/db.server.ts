import { PrismaClient } from "@prisma/client";

declare global {
  var __paperassePrisma: PrismaClient | undefined;
}

const cachedPrisma = global.__paperassePrisma;
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
  global.__paperassePrisma = undefined;
}

export const prisma = global.__paperassePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__paperassePrisma = prisma;
}
