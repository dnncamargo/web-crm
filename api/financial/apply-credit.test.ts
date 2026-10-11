import { afterEach, describe, expect, it, vi } from "vitest";

import { handleApplyCreditRequest } from "./apply-credit";

describe("apply credit HTTP handler", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["preview", "production"])("falha fechada em Vercel %s antes de autenticar ou ler dados", async (vercelEnvironment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", vercelEnvironment);

    const response = await handleApplyCreditRequest(new Request("https://example.test/api/financial/apply-credit", {
      method: "POST",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });

  it("recusa método não permitido com 405", async () => {
    const response = await handleApplyCreditRequest(new Request("http://localhost/api/financial/apply-credit", {
      method: "GET",
    }));

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({ error: { code: "METHOD_NOT_ALLOWED" } });
  });
});
