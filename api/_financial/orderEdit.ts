import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  calculateGeneratedCreditCents,
  calculateOrderItemTotalCents,
  calculateOrderSubtotalCents,
  calculateOrderTotalCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  subtractMoneyCents,
  sumMoneyCents,
} from "../../src/features/financial/money.js";
import { confirmCreditApplication, validateRetroactiveCreditReduction } from "../../src/features/financial/credit.js";
import type { MoneyCents } from "../../src/features/financial/money.js";
import type { EditOrderCommand, OperationalOrderEditCommand } from "./validation.js";
import { FinancialApiError } from "./errors.js";

interface StoredPayment {
  id: string;
  amountCents: MoneyCents;
  receivedAt: string | null;
}

interface StoredOrder {
  clientId: string;
  orderStatus: string;
  deliveryDateTime: string;
  addressId?: unknown;
  addressSnapshot?: unknown;
  notes?: unknown;
  tagIds: string[];
  items: Array<Record<string, unknown>>;
  subtotalCents: MoneyCents;
  deliveryFeeCents: MoneyCents;
  totalCents: MoneyCents;
  cashPaidCents: MoneyCents;
  creditAppliedCents: MoneyCents;
  creditGeneratedCents: MoneyCents;
  payments?: StoredPayment[];
}

interface StoredAggregator {
  availableCreditCents: MoneyCents;
  revision: number;
}

export interface EditOrderResult {
  orderId: string;
  operation: EditOrderCommand["kind"];
  availableCreditCents: number | null;
  revision: number | null;
  replayed: boolean;
}

function invalidState(): FinancialApiError {
  return new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
}

function canonical(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function asNonNegativeLegacyCents(value: unknown, field: string): MoneyCents {
  if (typeof value !== "number") throw invalidState();
  try {
    const cents = legacyReaisToMoneyCents(value, field);
    assertNonNegativeMoneyCents(cents, field);
    return cents;
  } catch (error) {
    if (error instanceof FinancialDomainError) throw invalidState();
    throw error;
  }
}

function parseStoredOrder(data: DocumentData): StoredOrder {
  if (typeof data.clientId !== "string"
    || (data.orderStatus !== "active" && data.orderStatus !== "completed" && data.orderStatus !== "cancelled")
    || typeof data.deliveryDateTime !== "string"
    || !Array.isArray(data.items)
    || !Array.isArray(data.tagIds)
    || data.tagIds.some((tagId: unknown) => typeof tagId !== "string")) {
    throw invalidState();
  }

  const items = data.items.map((entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw invalidState();
    const item = entry as Record<string, unknown>;
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity)
      || typeof item.id !== "string" || typeof item.productId !== "string" || typeof item.productName !== "string") {
      throw invalidState();
    }
    const unitPriceCents = asNonNegativeLegacyCents(item.unitPrice, "Preço unitário");
    const totalCents = asNonNegativeLegacyCents(item.total, "Total do item");
    if (calculateOrderItemTotalCents(item.quantity, unitPriceCents) !== totalCents) throw invalidState();
    return { ...item, unitPriceCents, totalCents };
  });

  const subtotalCents = asNonNegativeLegacyCents(data.subtotal, "Subtotal");
  const deliveryFeeCents = asNonNegativeLegacyCents(data.deliveryFee, "Taxa de entrega");
  const totalCents = asNonNegativeLegacyCents(data.total, "Total do pedido");
  if (calculateOrderSubtotalCents(items.map((item) => item.totalCents)) !== subtotalCents
    || calculateOrderTotalCents(subtotalCents, deliveryFeeCents) !== totalCents) throw invalidState();

  let cashPaidCents: MoneyCents;
  let payments: StoredPayment[] | undefined;
  const paymentAmounts: number[] = [];
  if (data.payments !== undefined) {
    if (!Array.isArray(data.payments)) throw invalidState();
    const ids = new Set<string>();
    payments = data.payments.map((entry: unknown) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw invalidState();
      const payment = entry as Record<string, unknown>;
      if (typeof payment.id !== "string" || payment.id.trim().length === 0 || ids.has(payment.id)
        || (payment.receivedAt !== null && (typeof payment.receivedAt !== "string" || Number.isNaN(new Date(payment.receivedAt).getTime()))) ) {
        throw invalidState();
      }
      ids.add(payment.id);
      if (typeof payment.amount !== "number" || !Number.isFinite(payment.amount)) throw invalidState();
      paymentAmounts.push(payment.amount);
      const amountCents = asNonNegativeLegacyCents(payment.amount, "Pagamento");
      if (amountCents <= 0) throw invalidState();
      return { id: payment.id, amountCents, receivedAt: payment.receivedAt as string | null };
    });
  }

  if (typeof data.amountPaid !== "number") throw invalidState();
  try {
    cashPaidCents = legacyReaisToMoneyCents(data.amountPaid, "Dinheiro recebido");
    assertNonNegativeMoneyCents(cashPaidCents, "Dinheiro recebido");
  } catch (error) {
    const isProvenPrecisionResidue = error instanceof FinancialDomainError
      && error.code === "MONETARY_VALUE_REQUIRES_CENT_PRECISION"
      && data.payments !== undefined
      && Number.isFinite(data.amountPaid)
      && data.amountPaid === paymentAmounts.reduce((sum, amount) => sum + amount, 0);
    if (!isProvenPrecisionResidue) throw invalidState();
    cashPaidCents = sumMoneyCents((payments ?? []).map((payment) => payment.amountCents));
  }
  if (payments && sumMoneyCents(payments.map((payment) => payment.amountCents)) !== cashPaidCents) throw invalidState();

  const creditAppliedCents = asNonNegativeLegacyCents(data.creditApplied ?? 0, "Crédito aplicado");
  const creditGeneratedCents = asNonNegativeLegacyCents(data.creditGenerated ?? 0, "Crédito gerado");
  if (creditAppliedCents > totalCents) throw invalidState();
  if (calculateGeneratedCreditCents(totalCents, cashPaidCents, creditAppliedCents) !== creditGeneratedCents) throw invalidState();

  return {
    clientId: data.clientId,
    orderStatus: data.orderStatus,
    deliveryDateTime: data.deliveryDateTime,
    addressId: data.addressId,
    addressSnapshot: data.addressSnapshot,
    notes: data.notes,
    tagIds: data.tagIds as string[],
    items,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    cashPaidCents,
    creditAppliedCents,
    creditGeneratedCents,
    payments,
  };
}

function parseOperationalOrder(data: DocumentData): Pick<StoredOrder, "clientId" | "orderStatus"> {
  if (typeof data.clientId !== "string"
    || (data.orderStatus !== "active" && data.orderStatus !== "completed" && data.orderStatus !== "cancelled")) {
    throw invalidState();
  }
  return { clientId: data.clientId, orderStatus: data.orderStatus };
}

function parseAggregator(data: DocumentData): StoredAggregator {
  if (data.state !== "ready" || !Number.isSafeInteger(data.revision) || data.revision < 0
    || !Number.isSafeInteger(data.availableCreditCents) || data.availableCreditCents < 0) {
    throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
  }
  return { availableCreditCents: data.availableCreditCents as MoneyCents, revision: data.revision as number };
}

function assertOrderPrecondition(updatedAt: unknown, expected: OperationalOrderEditCommand["expected"]): void {
  let current: { seconds: number; nanoseconds: number } | null;
  if (updatedAt === undefined || updatedAt === null) {
    current = null;
  } else if (updatedAt instanceof Timestamp) {
    current = { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds };
  } else {
    throw invalidState();
  }
  if (canonical(current) !== canonical(expected.updatedAt)) {
    throw new FinancialApiError(409, "ORDER_REVISION_CHANGED", "O Pedido mudou; atualize os dados e tente novamente.");
  }
}

function normalizedTarget(changes: OperationalOrderEditCommand["changes"]): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) target[key] = key === "notes" && value === null ? undefined : value;
  return target;
}

async function editOperationalOrder(db: Firestore, command: OperationalOrderEditCommand): Promise<EditOrderResult> {
  const orderRef = db.collection("orders").doc(command.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) throw new FinancialApiError(409, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const data = snapshot.data();
    if (!data) throw invalidState();
    const order = parseOperationalOrder(data);
    if (order.clientId !== command.clientId) throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e cliente não correspondem.");
    if (order.orderStatus === "cancelled") throw new FinancialApiError(409, "ORDER_SETTLEMENT_UNSUPPORTED", "Pedido cancelado depende do contrato de acerto financeiro.");

    const target = normalizedTarget(command.changes);
    const alreadyApplied = Object.entries(target).every(([key, value]) => canonical(data[key]) === canonical(value));
    if (alreadyApplied) return { orderId: command.orderId, operation: "operational", availableCreditCents: null, revision: null, replayed: true };
    assertOrderPrecondition(data.updatedAt, command.expected);

    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      if (canonical(data[key]) === canonical(value)) continue;
      if (key === "notes" && value === undefined) update.notes = FieldValue.delete();
      else update[key] = value;
    }
    if (Object.keys(update).length === 0) return { orderId: command.orderId, operation: "operational", availableCreditCents: null, revision: null, replayed: true };
    update.updatedAt = FieldValue.serverTimestamp();
    transaction.update(orderRef, update);
    return { orderId: command.orderId, operation: "operational", availableCreditCents: null, revision: null, replayed: false };
  });
}

function domainFailure(error: FinancialDomainError): FinancialApiError {
  const conflictCodes = new Set(["INSUFFICIENT_AVAILABLE_CREDIT", "CREDIT_BALANCE_CHANGED", "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED"]);
  return new FinancialApiError(conflictCodes.has(error.code) ? 409 : 400, error.code, "Edição financeira inválida ou conflitante.");
}

async function editCommercialOrder(db: Firestore, command: Extract<EditOrderCommand, { kind: "commercial" }>): Promise<EditOrderResult> {
  const orderRef = db.collection("orders").doc(command.orderId);
  const aggregatorRef = db.collection("clientFinancial").doc(command.clientId);
  try {
    return await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      const aggregatorSnapshot = await transaction.get(aggregatorRef);
      if (!orderSnapshot.exists) throw new FinancialApiError(409, "ORDER_NOT_FOUND", "Pedido não encontrado.");
      if (!aggregatorSnapshot.exists || !aggregatorSnapshot.data()) {
        throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
      }
      const data = orderSnapshot.data();
      if (!data) throw invalidState();
      const order = parseStoredOrder(data);
      const aggregator = parseAggregator(aggregatorSnapshot.data() as DocumentData);
      if (order.clientId !== command.clientId) throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e cliente não correspondem.");
      if (order.orderStatus === "cancelled") throw new FinancialApiError(409, "ORDER_SETTLEMENT_UNSUPPORTED", "Pedido cancelado depende do contrato de acerto financeiro.");

      const itemTotals = command.items.map((item) => {
        const unitPriceCents = item.unitPriceCents as MoneyCents;
        assertNonNegativeMoneyCents(unitPriceCents, "Preço unitário");
        const calculated = calculateOrderItemTotalCents(item.quantity, unitPriceCents);
        if (calculated !== item.totalCents) throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O total de um item não corresponde à quantidade e ao preço.");
        return calculated;
      });
      const subtotalCents = calculateOrderSubtotalCents(itemTotals);
      if (subtotalCents !== command.subtotalCents) throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O subtotal não corresponde aos itens do Pedido.");
      const deliveryFeeCents = command.deliveryFeeCents as MoneyCents;
      const totalCents = calculateOrderTotalCents(subtotalCents, deliveryFeeCents);
      if (totalCents !== command.totalCents) throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O total não corresponde ao subtotal e à taxa de entrega.");

      const creditInput = command.creditApplication;
      const requestedAppliedCents = creditInput ? creditInput.applyCreditCents as MoneyCents : order.creditAppliedCents;

      const nextItems = command.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        ...(item.unit === undefined ? {} : { unit: item.unit }),
        unitPrice: moneyCentsToLegacyReais(item.unitPriceCents as MoneyCents),
        total: moneyCentsToLegacyReais(item.totalCents as MoneyCents),
        ...(item.notes === undefined ? {} : { notes: item.notes }),
        ...(item.tagIds === undefined ? {} : { tagIds: item.tagIds }),
      }));
      const requestedGeneratedCents = calculateGeneratedCreditCents(totalCents, order.cashPaidCents, requestedAppliedCents);
      const currentOrderTarget = {
        items: data.items,
        subtotal: data.subtotal,
        deliveryFee: data.deliveryFee,
        total: data.total,
        creditApplied: data.creditApplied ?? 0,
        creditGenerated: data.creditGenerated ?? 0,
      };
      const nextOrderTarget = {
        items: nextItems,
        subtotal: moneyCentsToLegacyReais(subtotalCents),
        deliveryFee: moneyCentsToLegacyReais(deliveryFeeCents),
        total: moneyCentsToLegacyReais(totalCents),
        creditApplied: moneyCentsToLegacyReais(requestedAppliedCents),
        creditGenerated: moneyCentsToLegacyReais(requestedGeneratedCents),
      };
      if (canonical(currentOrderTarget) === canonical(nextOrderTarget)) {
        return { orderId: command.orderId, operation: "commercial", availableCreditCents: aggregator.availableCreditCents, revision: aggregator.revision, replayed: true };
      }
      assertOrderPrecondition(data.updatedAt, command.expected);

      if (creditInput && aggregator.revision !== creditInput.presentedRevision) {
        throw new FinancialApiError(409, "AGGREGATOR_REVISION_CHANGED", "O estado financeiro mudou; confirme novamente.");
      }
      if (creditInput && aggregator.availableCreditCents !== creditInput.presentedAvailableCreditCents) {
        throw new FinancialApiError(409, "CREDIT_BALANCE_CHANGED", "O saldo de crédito mudou; confirme novamente.");
      }
      if (requestedAppliedCents > totalCents) throw new FinancialApiError(409, "CREDIT_APPLICATION_EXCEEDS_ORDER_TOTAL", "O total não comporta o crédito aplicado; escolha explicitamente outro valor.");
      const appliedDeltaCents = creditInput && requestedAppliedCents > order.creditAppliedCents
        ? subtractMoneyCents(requestedAppliedCents, order.creditAppliedCents)
        : 0 as MoneyCents;
      if (creditInput) {
        confirmCreditApplication({
            presentedAvailableCreditCents: creditInput.presentedAvailableCreditCents as MoneyCents,
            currentAvailableCreditCents: aggregator.availableCreditCents,
            orderTotalCents: totalCents,
            selectedCents: appliedDeltaCents,
            confirmed: creditInput.confirmed,
          });
      }
      const nextAppliedCents = requestedAppliedCents;
      const nextGeneratedCents = calculateGeneratedCreditCents(totalCents, order.cashPaidCents, nextAppliedCents);

      let nextAvailableCents = aggregator.availableCreditCents;
      if (requestedAppliedCents < order.creditAppliedCents) {
        nextAvailableCents = sumMoneyCents([nextAvailableCents, subtractMoneyCents(order.creditAppliedCents, requestedAppliedCents)]);
      } else if (appliedDeltaCents > 0) {
        nextAvailableCents = subtractMoneyCents(nextAvailableCents, appliedDeltaCents);
      }
      if (nextGeneratedCents < order.creditGeneratedCents) {
        nextAvailableCents = validateRetroactiveCreditReduction({
          availableCreditCents: nextAvailableCents,
          previousGeneratedCreditCents: order.creditGeneratedCents,
          nextGeneratedCreditCents: nextGeneratedCents,
        }).nextAvailableCreditCents;
      } else if (nextGeneratedCents > order.creditGeneratedCents) {
        nextAvailableCents = sumMoneyCents([nextAvailableCents, subtractMoneyCents(nextGeneratedCents, order.creditGeneratedCents)]);
      }
      if (nextAvailableCents < 0) throw new FinancialApiError(409, "INSUFFICIENT_AVAILABLE_CREDIT", "O crédito disponível é insuficiente.");

      const financialEffectsChanged = nextAppliedCents !== order.creditAppliedCents || nextGeneratedCents !== order.creditGeneratedCents;
      const revision = aggregator.revision + (financialEffectsChanged ? 1 : 0);
      if (!Number.isSafeInteger(revision)) throw invalidState();
      transaction.update(orderRef, {
        items: nextItems,
        subtotal: nextOrderTarget.subtotal,
        deliveryFee: nextOrderTarget.deliveryFee,
        total: nextOrderTarget.total,
        ...(creditInput ? { ...(nextAppliedCents > 0 ? { creditApplied: nextOrderTarget.creditApplied } : { creditApplied: FieldValue.delete() }) } : {}),
        ...(nextGeneratedCents > 0 ? { creditGenerated: nextOrderTarget.creditGenerated } : { creditGenerated: FieldValue.delete() }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (financialEffectsChanged) {
        transaction.update(aggregatorRef, {
          availableCreditCents: nextAvailableCents,
          revision,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { orderId: command.orderId, operation: "commercial", availableCreditCents: nextAvailableCents, revision, replayed: false };
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) throw domainFailure(error);
    throw error;
  }
}

export function editOrderTransaction(db: Firestore, command: EditOrderCommand): Promise<EditOrderResult> {
  return command.kind === "operational"
    ? editOperationalOrder(db, command)
    : editCommercialOrder(db, command);
}
