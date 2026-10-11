import { afterEach, describe, expect, it, vi } from "vitest";

import { handleCorrectPaymentRequest } from "../../api/financial/correct-payment";
import { handleRecordPaymentRequest } from "../../api/financial/record-payment";

const endpoints = [
  ["record-payment", handleRecordPaymentRequest],
  ["correct-payment", handleCorrectPaymentRequest],
] as const;

describe("payment HTTP endpoints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(endpoints)("recusa GET em %s", async (_name, handler) => {
    const response = await handler(new Request("http://localhost/api/financial/payment", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it.each(["preview", "production"] as const)("falha fechada em Vercel %s antes de autenticar", async (environment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", environment);
    for (const [, handler] of endpoints) {
      const response = await handler(new Request("https://example.test/api/financial/payment", { method: "POST" }));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
    }
  });
});
