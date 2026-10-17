process.env.SAFE_DELETION_TEST_MODE = "enabled";
process.env.SAFE_DELETION_LOCAL_EXECUTION = "enabled";
process.env.SAFE_DELETION_TEST_PROJECT_ID = "demo-web-crm-safe-deletion-api";
process.env.GCLOUD_PROJECT = "demo-web-crm-safe-deletion-api";
process.env.VERCEL = "0";

const child = await import("node:child_process");
const result = child.spawnSync("npx", [
  "vitest",
  "run",
  "api/_deletion/gate.test.ts",
  "tests/safeDeletion.integration.test.ts",
  "tests/safeDeletion.api.integration.test.ts",
  "--no-file-parallelism",
  "--testTimeout",
  "20000",
], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
