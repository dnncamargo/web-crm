import { describe, expect, it } from "vitest";

import { isFinancialApiError } from "../../api/_financial/errors";
import { parseApplyCreditCommand } from "../../api/_financial/validation";

function command(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operationId: "operation-123",
    clientId: "client-1",
    orderId: "order-1",
    applyCreditCents: 3000,
    presentedAvailableCreditCents: 5000,
    presentedRevision: 1,
    confirmed: true,
    ...overrides,
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/financial/apply-credit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("apply credit request validation", () => {
  it("aceita o contrato mínimo explícito", async () => {
    await expect(parseApplyCreditCommand(request(command()))).resolves.toMatchObject({
      applyCreditCents: 3000,
      confirmed: true,
    });
  });

  it.each([
    command({ unexpectedFinancialField: 10 }),
    command({ operationId: "bad" }),
    command({ applyCreditCents: -1 }),
    command({ applyCreditCents: 1.5 }),
    command({ applyCreditCents: Number.POSITIVE_INFINITY }),
    command({ confirmed: false }),
  ])("rejeita payload financeiro inválido", async (body) => {
    try {
      await parseApplyCreditCommand(request(body));
      throw new Error("O payload deveria falhar.");
    } catch (error) {
      expect(isFinancialApiError(error) && error.status).toBe(400);
    }
  });
});
