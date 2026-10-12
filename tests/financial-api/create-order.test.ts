import { afterEach, describe, expect, it, vi } from "vitest";

import { handleCreateOrderRequest } from "../../api/financial/create-order";

describe("create order HTTP handler", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["preview", "production"]) ("bloqueia %s antes de autenticar ou acessar dados", async (vercelEnvironment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", vercelEnvironment);
    const response = await handleCreateOrderRequest(new Request("https://example.test/api/financial/create-order", { method: "POST" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });

  it("recusa métodos não permitidos", async () => {
    const response = await handleCreateOrderRequest(new Request("http://localhost/api/financial/create-order", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("recusa token ausente antes de processar o comando", async () => {
    const response = await handleCreateOrderRequest(new Request("http://localhost/api/financial/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: { code: "UNAUTHENTICATED" } });
  });
});
