import "../app/modules/env.server";
import { prisma } from "../app/modules/db.server";
import { DemoDatasetSeeder, DEMO_DATASETS } from "../app/modules/demo/demo-workspace-reset.server";

async function main() {
  const datasetId = readDatasetId();
  const result = await new DemoDatasetSeeder().resetDemoWorkspace({ datasetId });
  console.log(`Demo Paperasse réinitialisée (${result.dataset.id} — ${result.dataset.label}).`);
  console.log(result.dataset.description);
  console.table(result.state);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function readDatasetId() {
  if (process.argv.includes("--list-datasets")) {
    console.table(DEMO_DATASETS.map(({ id, label, description }) => ({ id, label, description })));
    process.exit(0);
  }
  const arg = process.argv.find((value) => value.startsWith("--dataset="));
  return arg?.slice("--dataset=".length) ?? process.env.DEMO_DATASET;
}
