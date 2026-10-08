import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn((_database: unknown, name: string) => name),
  db: {},
  deleteField: vi.fn(() => "delete-field"),
  doc: vi.fn((_database: unknown, ...path: string[]) => path.join("/")),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: mocks.addDoc,
  collection: mocks.collection,
  deleteField: mocks.deleteField,
  doc: mocks.doc,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
  updateDoc: mocks.updateDoc,
}));

vi.mock("../../services/firebase", () => ({ db: mocks.db }));

import { createOrder, registerOrderPayment, updateOrder } from "./ordersService";

function snapshot(data: Record<string, unknown> | null) {
  return {
    id: "order-1",
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

function setupTransaction(data: Record<string, unknown> | null) {
  const transaction = {
    get: vi.fn().mockResolvedValue(snapshot(data)),
    update: vi.fn(),
  };

  mocks.runTransaction.mockImplementation(async (_database: unknown, callback: (currentTransaction: typeof transaction) => unknown) => callback(transaction));

  return transaction;
}

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderStatus: "active",
    amountPaid: 0,
    total: 100,
    ...overrides,
  };
}

describe("order payment persistence", () => {
  beforeEach(() => {
    mocks.runTransaction.mockReset();
    mocks.deleteField.mockClear();
    mocks.serverTimestamp.mockClear();
    mocks.addDoc.mockReset();
  });

  it("persists empty payments for a new unpaid order", async () => {
    mocks.addDoc.mockResolvedValue({ id: "order-1" });

    await createOrder({
      clientId: "client-1",
      clientName: "Cliente",
      deliveryDateTime: "2026-10-07T10:00",
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      amountPaid: 999,
      orderStatus: "active",
      tagIds: [],
    });

    expect(mocks.addDoc).toHaveBeenCalledWith("orders", expect.objectContaining({ payments: [], amountPaid: 0 }));
  });

  it("appends a payment to a modern order and preserves creditApplied", async () => {
    const transaction = setupTransaction(baseOrder({
      id: "order-1",
      payments: [{ id: "p1", amount: 30, receivedAt: null }],
      amountPaid: 30,
      creditApplied: 20,
    }));

    await registerOrderPayment("order-1", { amount: 60, receivedAt: "2026-10-07T12:00:00.000Z" });

    expect(transaction.update).toHaveBeenCalledWith("orders/order-1", expect.objectContaining({
      payments: [
        { id: "p1", amount: 30, receivedAt: null },
        { id: expect.any(String), amount: 60, receivedAt: "2026-10-07T12:00:00.000Z" },
      ],
      amountPaid: 90,
      creditGenerated: 10,
    }));
    expect(transaction.update.mock.calls[0]?.[1]).not.toHaveProperty("creditApplied");
  });

  it("materializes legacy money with an unknown date on the first new payment", async () => {
    const transaction = setupTransaction(baseOrder({ id: "order-1", amountPaid: 50 }));

    await registerOrderPayment("order-1", { amount: 20, receivedAt: "2026-10-07T12:00:00.000Z" });

    expect(transaction.update).toHaveBeenCalledWith("orders/order-1", expect.objectContaining({
      payments: [
        { id: "legacy-order-1", amount: 50, receivedAt: null },
        { id: expect.any(String), amount: 20, receivedAt: "2026-10-07T12:00:00.000Z" },
      ],
      amountPaid: 70,
    }));
  });

  it("does not duplicate the legacy movement on a second payment", async () => {
    const transaction = setupTransaction(baseOrder({
      id: "order-1",
      amountPaid: 70,
      payments: [{ id: "legacy-order-1", amount: 50, receivedAt: null }, { id: "p1", amount: 20, receivedAt: "2026-10-07T12:00:00.000Z" }],
    }));

    await registerOrderPayment("order-1", { amount: 10, receivedAt: "2026-10-07T13:00:00.000Z" });

    const update = transaction.update.mock.calls[0]?.[1] as { payments: Array<{ id: string }> };
    expect(update.payments.filter((payment) => payment.id === "legacy-order-1")).toHaveLength(1);
    expect(update.payments).toHaveLength(3);
  });

  it("reconciles a stale generic edit against the current payment history", async () => {
    const transaction = setupTransaction(baseOrder({
      payments: [
        { id: "p1", amount: 50, receivedAt: null },
        { id: "p2", amount: 20, receivedAt: null },
      ],
      amountPaid: 70,
    }));

    await updateOrder("order-1", {
      notes: "Edição posterior",
      payments: [{ id: "p1", amount: 50, receivedAt: null }],
      amountPaid: 50,
      creditGenerated: 999,
    });

    const update = transaction.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update).toEqual(expect.objectContaining({
      notes: "Edição posterior",
      amountPaid: 70,
    }));
    expect(update).not.toHaveProperty("payments");
    expect(update).not.toHaveProperty("creditGenerated", 999);
  });

  it("recalculates generated credit using latest cash when the total changes", async () => {
    const transaction = setupTransaction(baseOrder({
      total: 100,
      amountPaid: 130,
      payments: [{ id: "p1", amount: 130, receivedAt: null }],
    }));

    await updateOrder("order-1", { total: 120 });

    expect(transaction.update.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      amountPaid: 130,
      creditGenerated: 10,
    }));
  });

  it("preserves omitted creditApplied and honors an explicit numeric change", async () => {
    const preservedTransaction = setupTransaction(baseOrder({
      amountPaid: 90,
      payments: [{ id: "p1", amount: 90, receivedAt: null }],
      creditApplied: 20,
    }));

    await updateOrder("order-1", { notes: "Sem alteração financeira" });

    expect(preservedTransaction.update.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      amountPaid: 90,
      creditGenerated: 10,
    }));
    expect(preservedTransaction.update.mock.calls[0]?.[1]).not.toHaveProperty("creditApplied");

    const explicitTransaction = setupTransaction(baseOrder({
      amountPaid: 90,
      payments: [{ id: "p1", amount: 90, receivedAt: null }],
      creditApplied: 20,
    }));

    await updateOrder("order-1", { creditApplied: 0 });

    expect(explicitTransaction.update.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      creditApplied: 0,
      creditGenerated: "delete-field",
    }));
  });

  it("clears creditApplied and recalculates generated credit when null is explicit", async () => {
    const transaction = setupTransaction(baseOrder({
      amountPaid: 130,
      payments: [{ id: "p1", amount: 130, receivedAt: null }],
      creditApplied: 20,
    }));

    await updateOrder("order-1", { creditApplied: null });

    expect(transaction.update.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      creditApplied: "delete-field",
      creditGenerated: 30,
    }));
  });

  it("preserves an absent legacy payments field during ordinary edits", async () => {
    const transaction = setupTransaction(baseOrder({ amountPaid: 50 }));

    await updateOrder("order-1", {
      notes: "Pedido legado atualizado",
      payments: [{ id: "stale", amount: 1, receivedAt: null }],
      amountPaid: 1,
    });

    const update = transaction.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update).toEqual(expect.objectContaining({ amountPaid: 50 }));
    expect(update).not.toHaveProperty("payments");
  });

  it("allows an extra payment on a settled order and generates credit", async () => {
    const transaction = setupTransaction(baseOrder({ amountPaid: 100, payments: [{ id: "p1", amount: 100, receivedAt: null }] }));

    await registerOrderPayment("order-1", { amount: 30, receivedAt: "2026-10-07T13:00:00.000Z" });

    expect(transaction.update.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ amountPaid: 130, creditGenerated: 30 }));
  });

  it("rejects cancelled, missing and invalid payments", async () => {
    setupTransaction(baseOrder({ orderStatus: "cancelled" }));
    await expect(registerOrderPayment("order-1", { amount: 10, receivedAt: "2026-10-07T13:00:00.000Z" })).rejects.toThrow("cancelados");

    setupTransaction(null);
    await expect(registerOrderPayment("order-1", { amount: 10, receivedAt: "2026-10-07T13:00:00.000Z" })).rejects.toThrow("não encontrado");

    await expect(registerOrderPayment("order-1", { amount: 0, receivedAt: "2026-10-07T13:00:00.000Z" })).rejects.toThrow("maior que zero");
    await expect(registerOrderPayment("order-1", { amount: -1, receivedAt: "2026-10-07T13:00:00.000Z" })).rejects.toThrow("maior que zero");
    await expect(registerOrderPayment("order-1", { amount: 10, receivedAt: "invalid" })).rejects.toThrow("data");
  });
});
