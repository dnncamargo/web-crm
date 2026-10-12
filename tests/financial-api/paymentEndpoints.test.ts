import { afterEach, describe, expect, it, vi } from "vitest";

import { handleCorrectPaymentRequest } from "../../api/financial/correct-payment";
import { handleRecordPaymentRequest } from "../../api/financial/record-payment";
import { handleCancelOrderRequest } from "../../api/financial/cancel-order";

const endpoints = [
  ["record-payment", handleRecordPaymentRequest],
  ["correct-payment", handleCorrectPaymentRequest],
  ["cancel-order", handleCancelOrderRequest],
] as const;

describe("payment HTTP endpoints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(endpoints.filter(([name]) => name !== "correct-payment"))("recusa GET em %s", async (_name, handler) => {
    const response = await handler(new Request("http://localhost/api/financial/payment", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("confirma disponibilidade local do endpoint somente quando o gate está aberto", async () => {
    vi.stubEnv("FINANCIAL_TEST_MODE", "enabled");
    vi.stubEnv("FINANCIAL_LOCAL_EXECUTION", "enabled");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
    vi.stubEnv("FINANCIAL_TEST_PROJECT_ID", "demo-web-crm-financial");
    vi.stubEnv("GCLOUD_PROJECT", "demo-web-crm-financial");

    const response = await handleCorrectPaymentRequest(new Request("http://localhost/api/financial/correct-payment"));
    expect(response.status).toBe(204);
  });

  it.each(["preview", "production"] as const)("falha fechada em Vercel %s antes de autenticar", async (environment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", environment);
    for (const [, handler] of endpoints) {
      const response = await handler(new Request("https://example.test/api/financial/payment", { method: "POST" }));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
    }
    const readiness = await handleCorrectPaymentRequest(new Request("https://example.test/api/financial/correct-payment"));
    expect(readiness.status).toBe(503);
    await expect(readiness.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });
});
