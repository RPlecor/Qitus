import { PrismaClient } from "@prisma/client";
import { seedGlobalVendorMappings } from "../app/modules/demo/vendor-mapping-seed.server";

const prisma = new PrismaClient();

async function main() {
  await seedGlobalVendorMappings(prisma);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
