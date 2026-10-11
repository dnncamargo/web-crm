import {
  assertValidMoneyCents,
  legacyReaisToMoneyCents,
  sumMoneyCents,
} from "./money.js";
import {
  reconcileFinancialDocuments,
  type ClientCreditReconstruction,
  type ReconciliationFinding,
  type ReconciliationResult,
} from "./reconciliation.js";
import {
  getOrderBalanceInfo,
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
  paymentStatus: PaymentStatus;
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

const receiptIntegrityCodes = new Set([
  "PAYMENTS_INVALID_STRUCTURE",
  "PAYMENT_INVALID_STRUCTURE",
  "PAYMENT_ID_INVALID",
  "PAYMENT_ID_DUPLICATE",
  "PAYMENT_AMOUNT_NON_POSITIVE",
  "PAYMENT_DATE_INVALID_OR_MISSING",
  "AMOUNT_PAID_PAYMENTS_MISMATCH",
  "MONETARY_ARITHMETIC_INVALID",
  "ORDER_ID_DUPLICATE",
]);

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

function hasReceiptIntegrityIssue(findings: readonly ReconciliationFinding[]): boolean {
  return findings.some((finding) => receiptIntegrityCodes.has(finding.code));
}

function canProjectReceipt(payment: OrderPayment, findings: readonly ReconciliationFinding[]): boolean {
  if (hasReceiptIntegrityIssue(findings)) return false;
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
    const findings = reconciledOrder?.findings ?? [];

    getOrderPaymentHistory(order).forEach((payment) => {
      if (!canProjectReceipt(payment, findings)) return;

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

  knownReceipts.sort((first, second) => (
    first.receivedAt.localeCompare(second.receivedAt)
    || first.orderId.localeCompare(second.orderId)
    || first.receiptId.localeCompare(second.receiptId)
  ));
  historicalDateUnknownReceipts.sort((first, second) => (
    first.orderId.localeCompare(second.orderId) || first.receiptId.localeCompare(second.receiptId)
  ));

  const pendingOrders = selectOperationalPendingOrders(orders);
  const pendingOrderIds = new Set(pendingOrders.map((order) => order.id));
  const orderBalances = orders.map((order) => {
    const reconciledOrder = reconciliationByOrderId.get(order.id);
    const balanceInfo = getOrderBalanceInfo(order);
    const hasDefinitiveBalance = reconciledOrder?.classification === "VALID"
      || reconciledOrder?.classification === "LEGACY_COMPATIBLE";

    return {
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentStatus: getPaymentStatus(order),
      balanceCents: hasDefinitiveBalance && balanceInfo.type === "remaining"
        ? legacyReaisToMoneyCents(balanceInfo.amount, "Saldo do pedido")
        : hasDefinitiveBalance
          ? legacyReaisToMoneyCents(balanceInfo.rawBalance, "Saldo do pedido")
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
