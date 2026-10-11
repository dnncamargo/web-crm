process.env.FINANCIAL_TEST_MODE = "enabled";
process.env.FINANCIAL_LOCAL_EXECUTION = "enabled";
process.env.FINANCIAL_TEST_PROJECT_ID = "demo-web-crm-financial";
process.env.GCLOUD_PROJECT = "demo-web-crm-financial";

const child = await import("node:child_process");

const result = child.spawnSync("npx", ["vitest", "run", "api"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
