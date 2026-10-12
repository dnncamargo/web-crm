import { createHash } from "node:crypto";
import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  calculateGeneratedCreditCents,
  calculateOrderItemTotalCents,
  calculateOrderSubtotalCents,
  calculateOrderTotalCents,
  moneyCentsToLegacyReais,
  subtractMoneyCents,
  sumMoneyCents,
} from "../../src/features/financial/money.js";
import type { MoneyCents } from "../../src/features/financial/money.js";
import { confirmCreditApplication } from "../../src/features/financial/credit.js";
import { FinancialApiError } from "./errors.js";
import type { CreateOrderCommand } from "./validation.js";

interface StoredAggregator {
  availableCreditCents: MoneyCents;
  revision: number;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaidCents: number;
  creditAppliedCents: number;
  creditGeneratedCents: number;
  availableCreditCents: number | null;
  revision: number | null;
  replayed: boolean;
}

function invalidState(): FinancialApiError {
  return new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
}

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function optionalPositive(value: MoneyCents): number | undefined {
  return value > 0 ? moneyCentsToLegacyReais(value) : undefined;
}

function parseAggregator(data: DocumentData): StoredAggregator {
  if (data.state !== "ready"
    || !Number.isSafeInteger(data.revision)
    || (data.revision as number) < 0
    || !Number.isSafeInteger(data.availableCreditCents)
    || (data.availableCreditCents as number) < 0) {
    throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
  }
  return {
    availableCreditCents: data.availableCreditCents as MoneyCents,
    revision: data.revision as number,
  };
}

function expectedOrder(command: CreateOrderCommand) {
  const itemTotalCents = command.items.map((item) => {
    const unitPriceCents = item.unitPriceCents as MoneyCents;
    assertNonNegativeMoneyCents(unitPriceCents, "Preço unitário");
    const calculated = calculateOrderItemTotalCents(item.quantity, unitPriceCents);
    if (calculated !== item.totalCents) {
      throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O total de um item não corresponde à quantidade e ao preço.");
    }
    return calculated;
  });
  const subtotalCents = calculateOrderSubtotalCents(itemTotalCents);
  if (subtotalCents !== command.subtotalCents) {
    throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O subtotal não corresponde aos itens do Pedido.");
  }
  const deliveryFeeCents = command.deliveryFeeCents as MoneyCents;
  const totalCents = calculateOrderTotalCents(subtotalCents, deliveryFeeCents);
  if (totalCents !== command.totalCents) {
    throw new FinancialApiError(400, "ORDER_TOTAL_MISMATCH", "O total não corresponde ao subtotal e à taxa de entrega.");
  }
  if (command.orderStatus === "cancelled") {
    throw new FinancialApiError(409, "CANCELLED_ORDER_CREATION_UNSUPPORTED", "A criação de Pedido cancelado depende do contrato de acerto financeiro ainda aberto.");
  }

  const cashPaidCents = (command.initialPayment?.amountCents ?? 0) as MoneyCents;
  const appliedCreditCents = (command.creditApplication?.applyCreditCents ?? 0) as MoneyCents;
  assertNonNegativeMoneyCents(cashPaidCents, "Pagamento inicial");
  assertNonNegativeMoneyCents(appliedCreditCents, "Crédito aplicado");
  const creditGeneratedCents = calculateGeneratedCreditCents(totalCents, cashPaidCents, appliedCreditCents);

  const order = {
    clientId: command.clientId,
    clientName: command.clientName,
    ...(command.addressId === undefined ? {} : { addressId: command.addressId }),
    ...(command.addressSnapshot === undefined ? {} : { addressSnapshot: command.addressSnapshot }),
    deliveryDateTime: command.deliveryDateTime,
    items: command.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      ...(item.unit === undefined ? {} : { unit: item.unit }),
      unitPrice: moneyCentsToLegacyReais(item.unitPriceCents as MoneyCents),
      total: moneyCentsToLegacyReais(item.totalCents as MoneyCents),
      ...(item.notes === undefined ? {} : { notes: item.notes }),
      ...(item.tagIds === undefined ? {} : { tagIds: item.tagIds }),
    })),
    subtotal: moneyCentsToLegacyReais(subtotalCents),
    deliveryFee: moneyCentsToLegacyReais(deliveryFeeCents),
    total: moneyCentsToLegacyReais(totalCents),
    amountPaid: moneyCentsToLegacyReais(cashPaidCents),
    payments: command.initialPayment
      ? [{
          id: command.initialPayment.id,
          amount: moneyCentsToLegacyReais(cashPaidCents),
          receivedAt: command.initialPayment.receivedAt,
        }]
      : [],
    ...(optionalPositive(appliedCreditCents) === undefined ? {} : { creditApplied: optionalPositive(appliedCreditCents) }),
    ...(optionalPositive(creditGeneratedCents) === undefined ? {} : { creditGenerated: optionalPositive(creditGeneratedCents) }),
    orderStatus: command.orderStatus,
    ...(command.notes === undefined ? {} : { notes: command.notes }),
    tagIds: command.tagIds,
  };

  return { order, totalCents, cashPaidCents, appliedCreditCents, creditGeneratedCents };
}

function isReplay(existing: DocumentData, expected: Record<string, unknown>): boolean {
  const comparable = { ...existing };
  delete comparable.createdAt;
  delete comparable.updatedAt;
  return canonical(comparable) === canonical(expected);
}

function creationFingerprint(expected: Record<string, unknown>): string {
  return createHash("sha256").update(canonical(expected)).digest("hex");
}

function domainFailure(error: FinancialDomainError): FinancialApiError {
  const status = error.code === "CREDIT_BALANCE_CHANGED" || error.code === "INSUFFICIENT_AVAILABLE_CREDIT" ? 409 : 400;
  return new FinancialApiError(status, error.code, status === 409 ? "Conflito financeiro." : "Payload financeiro inválido.");
}

export async function createOrderTransaction(db: Firestore, command: CreateOrderCommand): Promise<CreateOrderResult> {
  let calculated: ReturnType<typeof expectedOrder>;
  try {
    calculated = expectedOrder(command);
  } catch (error) {
    if (error instanceof FinancialDomainError) throw domainFailure(error);
    throw error;
  }

  const orderRef = db.collection("orders").doc(command.orderId);
  const fingerprint = creationFingerprint(calculated.order);
  const hasFinancialEffects = command.initialPayment !== undefined || command.creditApplication !== undefined;
  const hasFinancialChanges = command.initialPayment !== undefined
    || (command.creditApplication?.applyCreditCents ?? 0) > 0;
  const aggregatorRef = db.collection("clientFinancial").doc(command.clientId);

  try {
    return await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (orderSnapshot.exists) {
        const existing = orderSnapshot.data();
        const persistedFingerprint = existing?._creationFingerprint;
        const matchesOriginal = typeof persistedFingerprint === "string"
          ? persistedFingerprint === fingerprint
          : Boolean(existing && isReplay(existing, calculated.order));
        if (!existing || !matchesOriginal) {
          throw new FinancialApiError(409, "ORDER_ID_COLLISION", "A identidade do Pedido já existe com conteúdo divergente.");
        }
        return {
          orderId: command.orderId,
          amountPaidCents: calculated.cashPaidCents,
          creditAppliedCents: calculated.appliedCreditCents,
          creditGeneratedCents: calculated.creditGeneratedCents,
          availableCreditCents: null,
          revision: null,
          replayed: true,
        };
      }

      const aggregatorSnapshot = hasFinancialEffects ? await transaction.get(aggregatorRef) : null;

      let aggregator: StoredAggregator | null = null;
      if (hasFinancialEffects) {
        if (!aggregatorSnapshot?.exists || !aggregatorSnapshot.data()) {
          throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
        }
        aggregator = parseAggregator(aggregatorSnapshot.data() as DocumentData);
        const creditInput = command.creditApplication;
        if (creditInput && aggregator.revision !== creditInput.presentedRevision) {
          throw new FinancialApiError(409, "AGGREGATOR_REVISION_CHANGED", "O estado financeiro mudou; confirme novamente.");
        }
        if (creditInput && aggregator.availableCreditCents !== creditInput.presentedAvailableCreditCents) {
          throw new FinancialApiError(409, "CREDIT_BALANCE_CHANGED", "O saldo de crédito mudou; confirme novamente.");
        }
      }

      const creditInput = command.creditApplication;
      const confirmation = creditInput
        ? confirmCreditApplication({
            presentedAvailableCreditCents: creditInput.presentedAvailableCreditCents as MoneyCents,
            currentAvailableCreditCents: aggregator?.availableCreditCents ?? 0 as MoneyCents,
            orderTotalCents: calculated.totalCents,
            selectedCents: creditInput.applyCreditCents as MoneyCents,
            confirmed: creditInput.confirmed,
          })
        : null;

      const revision = aggregator ? aggregator.revision + (hasFinancialChanges ? 1 : 0) : null;
      if (revision !== null && !Number.isSafeInteger(revision)) throw invalidState();
      const nextAvailableCreditCents = aggregator
        ? subtractMoneyCents(
            sumMoneyCents([aggregator.availableCreditCents, calculated.creditGeneratedCents]),
            confirmation?.appliedCents ?? 0 as MoneyCents,
          )
        : null;
      if (nextAvailableCreditCents !== null && nextAvailableCreditCents < 0) {
        throw new FinancialApiError(409, "INSUFFICIENT_AVAILABLE_CREDIT", "O crédito disponível é insuficiente.");
      }

      transaction.create(orderRef, {
        ...calculated.order,
        _creationFingerprint: fingerprint,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (aggregator && hasFinancialChanges && revision !== null && nextAvailableCreditCents !== null) {
        transaction.update(aggregatorRef, {
          availableCreditCents: nextAvailableCreditCents,
          revision,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        orderId: command.orderId,
        amountPaidCents: calculated.cashPaidCents,
        creditAppliedCents: calculated.appliedCreditCents,
        creditGeneratedCents: calculated.creditGeneratedCents,
        availableCreditCents: nextAvailableCreditCents,
        revision,
        replayed: false,
      };
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) throw domainFailure(error);
    throw error;
  }
}
