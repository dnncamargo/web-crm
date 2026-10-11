process.env.FINANCIAL_TEST_MODE = "enabled";
process.env.FINANCIAL_LOCAL_EXECUTION = "enabled";
process.env.FINANCIAL_TEST_PROJECT_ID = "demo-web-crm-financial";
process.env.GCLOUD_PROJECT = "demo-web-crm-financial";

const child = await import("node:child_process");

const runtimeCheck = child.spawnSync(process.execPath, ["scripts/verify-financial-api-runtime.mjs"], {
  stdio: "inherit",
  env: process.env,
});

if (runtimeCheck.status !== 0) {
  process.exit(runtimeCheck.status ?? 1);
}

const result = child.spawnSync("npx", ["vitest", "run", "tests/financial-api"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
