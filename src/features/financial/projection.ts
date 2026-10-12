import {
  assertValidMoneyCents,
  legacyReaisToMoneyCents,
  sumMoneyCents,
} from "./money.js";
import {
  reconcileFinancialDocuments,
  type ClientCreditReconstruction,
  type ReconciledOrder,
  type ReconciliationResult,
} from "./reconciliation.js";
import {
  getOrderPaymentHistory,
  getPaymentStatus,
} from "../orders/orderUtils.js";
import type { MoneyCents } from "./money.js";
import type { Order, OrderPayment, PaymentStatus } from "../orders/orderTypes.js";

export interface FinancialReceipt {
  orderId: string;
  receiptId: string;
  amountCents: MoneyCents;
  receivedAt: string | null;
}

export interface KnownFinancialReceipt extends FinancialReceipt {
  receivedAt: string;
}

export interface FinancialReceiptInterval {
  /** ISO instant with an explicit offset; the lower limit is included. */
  startInclusive: string;
  /** ISO instant with an explicit offset; the upper limit is excluded. */
  endExclusive: string;
}

export interface FinancialOrderBalance {
  orderId: string;
  orderStatus: Order["orderStatus"];
  paymentStatus: PaymentStatus | null;
  balanceCents: MoneyCents | null;
  creditAppliedCents: MoneyCents | null;
  creditGeneratedCents: MoneyCents | null;
  operationallyPending: boolean;
}

export interface FinancialProjection {
  /** Facts with a real, explicit receivedAt that can be selected by interval. */
  knownReceipts: KnownFinancialReceipt[];
  /** Valid legacy facts whose historical date is deliberately unknown. */
  historicalDateUnknownReceipts: FinancialReceipt[];
  /** Current order position, never a cash-flow measurement for a period. */
  orderBalances: FinancialOrderBalance[];
  /** IDs selected by the same active/completed pending-payment rule used by Hoje. */
  operationalPendingOrderIds: string[];
  /** Credit is null whenever reconciliation cannot safely reconstruct it. */
  creditByClient: ClientCreditReconstruction[];
  /** Full read-only diagnostics; consumers must surface limitations before definitive totals. */
  reconciliation: ReconciliationResult;
}

function isExplicitIsoInstant(value: string): boolean {
  return /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && !Number.isNaN(new Date(value).getTime());
}

function instantMillis(value: string, name: string): number {
  if (!isExplicitIsoInstant(value)) {
    throw new RangeError(`${name} deve ser um instante ISO com fuso horário explícito.`);
  }

  return new Date(value).getTime();
}

function hasReadablePaymentHistory(order: Order): boolean {
  return order.payments === undefined || Array.isArray(order.payments);
}

function canProjectReceipt(payment: OrderPayment, reconciledOrder: ReconciledOrder | undefined): boolean {
  if (reconciledOrder === undefined
    || reconciledOrder.classification === "INCONSISTENT"
    || reconciledOrder.classification === "INDETERMINATE") {
    return false;
  }

  if (payment.receivedAt !== null && !isExplicitIsoInstant(payment.receivedAt)) return false;

  try {
    return legacyReaisToMoneyCents(payment.amount, "Valor do recebimento") > 0;
  } catch {
    return false;
  }
}

function asMoneyCents(value: number | null): MoneyCents | null {
  if (value === null) return null;
  assertValidMoneyCents(value);
  return value;
}

/**
 * Canonical operational pending-payment selection. Cancelled orders require a
 * future settlement flow and are deliberately excluded from the common queue.
 */
export function selectOperationalPendingOrders(orders: readonly Order[]): Order[] {
  return orders
    .filter((order) => {
      if (order.orderStatus !== "active" && order.orderStatus !== "completed") {
        return false;
      }

      if (!hasReadablePaymentHistory(order)) {
        return false;
      }

      const paymentStatus = getPaymentStatus(order);
      return paymentStatus === "unpaid" || paymentStatus === "partial";
    })
    .sort((firstOrder, secondOrder) => (
      firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime)
    ));
}

/**
 * Selects known receipts using [startInclusive, endExclusive). Bounds are
 * explicit ISO instants so host time zones never affect classification.
 */
export function selectKnownReceiptsInInterval(
  receipts: readonly KnownFinancialReceipt[],
  interval: FinancialReceiptInterval,
): KnownFinancialReceipt[] {
  const startMillis = instantMillis(interval.startInclusive, "startInclusive");
  const endMillis = instantMillis(interval.endExclusive, "endExclusive");

  if (endMillis <= startMillis) {
    throw new RangeError("endExclusive deve ser posterior a startInclusive.");
  }

  return receipts.filter((receipt) => {
    const receivedAtMillis = instantMillis(receipt.receivedAt, "receivedAt");
    return receivedAtMillis >= startMillis && receivedAtMillis < endMillis;
  });
}

/**
 * Builds a pure, read-only financial view from in-memory Orders. It neither
 * repairs legacy facts nor materializes payments, credits, or aggregators.
 */
export function projectFinancialReadModel(orders: readonly Order[]): FinancialProjection {
  const reconciliation = reconcileFinancialDocuments(orders);
  const reconciliationByOrderId = new Map(reconciliation.orders.map((entry) => [entry.orderId, entry]));
  const knownReceipts: KnownFinancialReceipt[] = [];
  const historicalDateUnknownReceipts: FinancialReceipt[] = [];

  orders.forEach((order) => {
    const reconciledOrder = reconciliationByOrderId.get(order.id);
    if (!hasReadablePaymentHistory(order)) return;

    getOrderPaymentHistory(order).forEach((payment) => {
      if (!canProjectReceipt(payment, reconciledOrder)) return;

      const receipt = {
        orderId: order.id,
        receiptId: payment.id,
        amountCents: legacyReaisToMoneyCents(payment.amount, "Valor do recebimento"),
        receivedAt: payment.receivedAt,
      } satisfies FinancialReceipt;

      if (receipt.receivedAt === null) {
        historicalDateUnknownReceipts.push(receipt);
      } else {
        knownReceipts.push(receipt as KnownFinancialReceipt);
      }
    });
  });

  knownReceipts.sort((first, second) => {
    const firstReceivedAt = instantMillis(first.receivedAt, "receivedAt");
    const secondReceivedAt = instantMillis(second.receivedAt, "receivedAt");
    if (firstReceivedAt !== secondReceivedAt) {
      return firstReceivedAt < secondReceivedAt ? -1 : 1;
    }

    return first.orderId.localeCompare(second.orderId) || first.receiptId.localeCompare(second.receiptId);
  });
  historicalDateUnknownReceipts.sort((first, second) => (
    first.orderId.localeCompare(second.orderId) || first.receiptId.localeCompare(second.receiptId)
  ));

  const pendingOrders = selectOperationalPendingOrders(orders);
  const pendingOrderIds = new Set(pendingOrders.map((order) => order.id));
  const orderBalances = orders.map((order) => {
    const reconciledOrder = reconciliationByOrderId.get(order.id);
    const hasDefinitiveBalance = reconciledOrder?.classification === "VALID"
      || reconciledOrder?.classification === "LEGACY_COMPATIBLE";
    const canReadPaymentHistory = hasReadablePaymentHistory(order);

    return {
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentStatus: hasDefinitiveBalance && canReadPaymentHistory ? getPaymentStatus(order) : null,
      balanceCents: hasDefinitiveBalance
        ? asMoneyCents(reconciledOrder?.balanceCents ?? null)
        : null,
      creditAppliedCents: hasDefinitiveBalance
        ? legacyReaisToMoneyCents(order.creditApplied ?? 0, "Crédito aplicado")
        : null,
      creditGeneratedCents: hasDefinitiveBalance
        ? asMoneyCents(reconciledOrder?.calculatedGeneratedCreditCents ?? null)
        : null,
      operationallyPending: pendingOrderIds.has(order.id),
    } satisfies FinancialOrderBalance;
  }).sort((first, second) => first.orderId.localeCompare(second.orderId));

  return {
    knownReceipts,
    historicalDateUnknownReceipts,
    orderBalances,
    operationalPendingOrderIds: pendingOrders.map((order) => order.id),
    creditByClient: reconciliation.clients,
    reconciliation,
  };
}

/** Sums the cents of receipts already selected from this projection. */
export function sumProjectedReceipts(receipts: readonly FinancialReceipt[]): MoneyCents {
  return sumMoneyCents(receipts.map((receipt) => receipt.amountCents));
}
