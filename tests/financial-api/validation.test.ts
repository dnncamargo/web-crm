import { describe, expect, it } from "vitest";

import { isFinancialApiError } from "../../api/_financial/errors";
import {
  parseApplyCreditCommand,
  parseCorrectPaymentCommand,
  parseCancelOrderCommand,
  parseCreateOrderCommand,
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

describe("cancel order command validation", () => {
  const cancelCommand = {
    orderId: "order-1",
    clientId: "client-1",
    operationId: "cancel-123456",
    expected: { updatedAt: null },
    agreement: "Acordo negociado com o cliente.",
    movement: { kind: "none", amountCents: 0, occurredAt: null },
  };

  it("aceita acordo sem movimentação e recebimento/devolução reais", async () => {
    await expect(parseCancelOrderCommand(request(cancelCommand))).resolves.toMatchObject(cancelCommand);
    for (const kind of ["receipt", "refund"] as const) {
      const body = { ...cancelCommand, movement: { kind, amountCents: 500, occurredAt: "2026-10-12T10:30:00-03:00" } };
      await expect(parseCancelOrderCommand(request(body))).resolves.toMatchObject(body);
    }
  });

  it.each([
    { ...cancelCommand, extraFinancialField: 1 },
    { ...cancelCommand, operationId: "bad" },
    { ...cancelCommand, agreement: "   " },
    { ...cancelCommand, movement: { ...cancelCommand.movement, amountCents: -1 } },
    { ...cancelCommand, movement: { ...cancelCommand.movement, amountCents: 1.5 } },
    { ...cancelCommand, movement: { ...cancelCommand.movement, amountCents: Number.POSITIVE_INFINITY } },
    { ...cancelCommand, movement: { kind: "none", amountCents: 1, occurredAt: null } },
    { ...cancelCommand, movement: { kind: "refund", amountCents: 1, occurredAt: null } },
    { ...cancelCommand, movement: { kind: "receipt", amountCents: 1, occurredAt: "2026-02-30T12:00:00Z" } },
    { ...cancelCommand, movement: { kind: "receipt", amountCents: 1, occurredAt: "2026-10-12T10:30:00" } },
    { ...cancelCommand, movement: { kind: "both", amountCents: 1, occurredAt: "2026-10-12T10:30:00Z" } },
  ])("rejeita contrato de cancelamento inválido", async (body) => {
    await expect(parseCancelOrderCommand(request(body))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 400
    ));
  });
});

describe("create order command validation", () => {
  const createCommand = {
    orderId: "order-123456",
    clientId: "client-1",
    clientName: "Cliente sintético",
    deliveryDateTime: "2026-11-01T12:00:00-03:00",
    items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPriceCents: 1000, totalCents: 1000 }],
    subtotalCents: 1000,
    deliveryFeeCents: 0,
    totalCents: 1000,
    orderStatus: "active",
    tagIds: [],
  };

  it("aceita campos comerciais e fatos iniciais com identidade explícita", async () => {
    const body = {
      ...createCommand,
      initialPayment: { id: "payment-123456", amountCents: 250, receivedAt: "2026-10-11T12:30:00-03:00" },
      creditApplication: { applyCreditCents: 300, presentedAvailableCreditCents: 500, presentedRevision: 3, confirmed: true },
    };
    await expect(parseCreateOrderCommand(request(body))).resolves.toMatchObject(body);
  });

  it.each(["Bolo de cenoura", "Pão de queijo", "Café com leite", "Bolo (sem açúcar)"])(
    "preserva o nome comercial %s",
    async (productName) => {
      const body = { ...createCommand, items: [{ ...createCommand.items[0], productName }] };
      await expect(parseCreateOrderCommand(request(body))).resolves.toMatchObject({ items: [{ productName }] });
    },
  );

  it.each(["", "   ", "x".repeat(4097)])("rejeita nome comercial vazio ou excessivamente longo", async (productName) => {
    const body = { ...createCommand, items: [{ ...createCommand.items[0], productName }] };
    await expect(parseCreateOrderCommand(request(body))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 400
    ));
  });

  it.each(["2026-11-01T12:00", "2026-11-01T12:00:00-03:00", "2026-11-01T15:00:00.000Z"])(
    "preserva deliveryDateTime válido %s",
    async (deliveryDateTime) => {
      await expect(parseCreateOrderCommand(request({ ...createCommand, deliveryDateTime })))
        .resolves.toMatchObject({ deliveryDateTime });
    },
  );

  it.each(["2026-02-30T12:00", "2026-11-01T25:00", "texto arbitrário", ""])(
    "rejeita deliveryDateTime inválido %s",
    async (deliveryDateTime) => {
      await expect(parseCreateOrderCommand(request({ ...createCommand, deliveryDateTime }))).rejects.toSatisfy((error: unknown) => (
        isFinancialApiError(error) && error.status === 400
      ));
    },
  );

  it.each([
    { ...createCommand, amountPaid: 10 },
    { ...createCommand, creditGenerated: 10 },
    { ...createCommand, totalCents: Number.MAX_SAFE_INTEGER + 1 },
    { ...createCommand, initialPayment: { id: "payment-123456", amountCents: 0, receivedAt: "2026-10-11T12:30:00Z" } },
    { ...createCommand, initialPayment: { id: "payment-123456", amountCents: 10, receivedAt: "2026-10-11" } },
    { ...createCommand, creditApplication: { applyCreditCents: 1, presentedAvailableCreditCents: 10, presentedRevision: 1, confirmed: false } },
    { ...createCommand, items: [{ ...createCommand.items[0], unitPriceCents: 1.5 }] },
  ])("rejeita autoridade financeira ou valor inválido no payload", async (body) => {
    await expect(parseCreateOrderCommand(request(body))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 400
    ));
  });

  it("não modifica o objeto usado para construir a requisição", async () => {
    const body = structuredClone(createCommand);
    const before = structuredClone(body);
    await parseCreateOrderCommand(request(body));
    expect(body).toEqual(before);
  });
});
