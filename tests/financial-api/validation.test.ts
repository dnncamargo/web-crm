import { describe, expect, it } from "vitest";

import { isFinancialApiError } from "../../api/_financial/errors";
import {
  parseApplyCreditCommand,
  parseCorrectPaymentCommand,
  parseRecordPaymentCommand,
} from "../../api/_financial/validation";

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

describe("payment request validation", () => {
  const recordCommand = {
    orderId: "order-1",
    clientId: "client-1",
    paymentId: "payment-123",
    amountCents: 1500,
    receivedAt: "2026-01-01T12:00:00.000Z",
    presentedAvailableCreditCents: 0,
    presentedRevision: 1,
  };

  it("aceita recebimento com data/hora inequívoca", async () => {
    await expect(parseRecordPaymentCommand(request(recordCommand))).resolves.toMatchObject(recordCommand);
  });

  it.each([
    { ...recordCommand, amountCents: 0 },
    { ...recordCommand, amountCents: 1.5 },
    { ...recordCommand, receivedAt: "2026-01-01" },
    { ...recordCommand, receivedAt: "invalid" },
    { ...recordCommand, receivedAt: "2026-02-30T12:00:00Z" },
    { ...recordCommand, actorUid: "not-allowed" },
  ])("recusa recebimento inválido", async (body) => {
    await expect(parseRecordPaymentCommand(request(body))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 400
    ));
  });

  it("aceita correção com data histórica nula preservada", async () => {
    const command = {
      ...recordCommand,
      expectedAmountCents: 1500,
      expectedReceivedAt: null,
      receivedAt: null,
    };
    await expect(parseCorrectPaymentCommand(request(command))).resolves.toMatchObject(command);
  });
});
