import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function resetDemoDataset(datasetId = "qonto_mvp") {
  await execFileAsync("npm", ["run", "demo:reset"], {
    env: { ...process.env, DEMO_DATASET: datasetId },
    cwd: process.cwd(),
    timeout: 120_000,
  });
}
