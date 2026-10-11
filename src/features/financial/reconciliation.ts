import {
  FinancialDomainError,
  calculateGeneratedCreditCents,
  calculateOrderBalanceCents,
  calculateOrderSubtotalCents,
  calculateOrderTotalCents,
  legacyReaisToMoneyCents,
  subtractMoneyCents,
  sumMoneyCents,
} from "./money.js";
import { projectFungibleCreditBalance } from "./credit.js";
import type { CreditEffectInput } from "./credit.js";
import type { MoneyCents } from "./money.js";

/** Read-only shape accepted from a local export or synthetic fixture. */
export interface ReconciliationOrderDocument {
  id: string;
  clientId: unknown;
  orderStatus: unknown;
  amountPaid: unknown;
  payments?: unknown;
  creditApplied?: unknown;
  creditGenerated?: unknown;
  total: unknown;
  subtotal?: unknown;
  deliveryFee?: unknown;
  items?: unknown;
}

/** Experimental projection only; it is never created or changed by this module. */
export interface ClientFinancialSnapshot {
  clientId: string;
  state?: unknown;
  availableCreditCents?: unknown;
  revision?: unknown;
}

export type ReconciliationClassification =
  | "VALID"
  | "LEGACY_COMPATIBLE"
  | "INCONSISTENT"
  | "INDETERMINATE"
  | "BLOCKED_BY_PRODUCT_DECISION";

export type ReconciliationRecordType = "order" | "client" | "aggregator";

export interface ReconciliationFinding {
  code: string;
  classification: ReconciliationClassification;
  description: string;
  recordType: ReconciliationRecordType;
  recordId: string;
  clientId?: string;
  field?: string;
}

export interface ReconciledOrder {
  orderId: string;
  clientId?: string;
  classification: ReconciliationClassification;
  cashPaidCents: number | null;
  balanceCents: number | null;
  calculatedGeneratedCreditCents: number | null;
  findings: ReconciliationFinding[];
}

export interface ClientCreditReconstruction {
  clientId: string;
  classification: ReconciliationClassification;
  conclusive: boolean;
  availableCreditCents: number | null;
  deficitCents: number | null;
  aggregatorComparison: "not_available" | "not_compared" | "matches" | "divergent";
  findings: ReconciliationFinding[];
}

export interface ReconciliationSummary {
  ordersAnalyzed: number;
  clientsAnalyzed: number;
  validRecords: number;
  legacyRecords: number;
  inconsistentRecords: number;
  conclusiveReconstructions: number;
  inconclusiveReconstructions: number;
  aggregatorDivergences: number;
  humanInterventionRequired: number;
  productDecisionLimitations: number;
}

export interface ReconciliationResult {
  summary: ReconciliationSummary;
  orders: ReconciledOrder[];
  clients: ClientCreditReconstruction[];
  findings: ReconciliationFinding[];
}

interface ParsedOrder {
  result: ReconciledOrder;
  sortKey: string;
  clientId?: string;
  canReconstructCredit: boolean;
  isCancelledWithCreditEffect: boolean;
  effect?: CreditEffectInput;
}

interface ClientState {
  orders: ParsedOrder[];
  findings: ReconciliationFinding[];
}

const classificationPriority: Record<ReconciliationClassification, number> = {
  VALID: 0,
  LEGACY_COMPATIBLE: 1,
  BLOCKED_BY_PRODUCT_DECISION: 2,
  INDETERMINATE: 3,
  INCONSISTENT: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTechnicalId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function stableValueKey(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (value === Number.POSITIVE_INFINITY) return "number:+Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "number:-Infinity";
  }
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return `${typeof value}:${JSON.stringify(value)}`;
  }
  if (Array.isArray(value)) return `[${value.map(stableValueKey).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValueKey(value[key])}`).join(",")}}`;
  }
  return `${typeof value}:${String(value)}`;
}

function addArithmeticFinding(
  findings: ReconciliationFinding[],
  base: Omit<ReconciliationFinding, "code" | "classification" | "description" | "field">,
  field: string,
): void {
  findings.push({
    ...base,
    code: "MONETARY_ARITHMETIC_INVALID",
    classification: "INCONSISTENT",
    description: "A operação monetária excede o intervalo seguro e não foi aproximada.",
    field,
  });
}

function recordClassification(findings: readonly ReconciliationFinding[]): ReconciliationClassification {
  return findings.reduce<ReconciliationClassification>((current, finding) => (
    classificationPriority[finding.classification] > classificationPriority[current]
      ? finding.classification
      : current
  ), "VALID");
}

function sortedFindings(findings: readonly ReconciliationFinding[]): ReconciliationFinding[] {
  return [...findings].sort((first, second) => (
    first.recordType.localeCompare(second.recordType)
    || first.recordId.localeCompare(second.recordId)
    || first.code.localeCompare(second.code)
    || (first.field ?? "").localeCompare(second.field ?? "")
  ));
}

function centsFromLegacy(
  value: unknown,
  field: string,
  findings: ReconciliationFinding[],
  base: Omit<ReconciliationFinding, "code" | "classification" | "description" | "field">,
  allowNegative = false,
): MoneyCents | null {
  if (typeof value !== "number") {
    findings.push({
      ...base,
      code: "MONETARY_VALUE_INVALID",
      classification: "INCONSISTENT",
      description: "O valor monetário não é um número compatível com centavos inteiros.",
      field,
    });
    return null;
  }

  try {
    const cents = legacyReaisToMoneyCents(value, field);
    if (!allowNegative && cents < 0) {
      findings.push({
        ...base,
        code: "MONETARY_VALUE_NEGATIVE",
        classification: "INCONSISTENT",
        description: "O valor monetário não pode ser negativo neste fato financeiro.",
        field,
      });
      return null;
    }
    return cents;
  } catch (error) {
    if (error instanceof FinancialDomainError) {
      findings.push({
        ...base,
        code: "MONETARY_VALUE_INVALID",
        classification: "INCONSISTENT",
        description: "O valor monetário não é finito, seguro ou compatível com centavos inteiros.",
        field,
      });
      return null;
    }
    throw error;
  }
}

function examineItems(
  items: unknown,
  orderId: string,
  clientId: string | undefined,
  findings: ReconciliationFinding[],
): MoneyCents[] | null {
  const base = { recordType: "order" as const, recordId: orderId, clientId };
  if (!Array.isArray(items)) {
    findings.push({
      ...base,
      code: "ORDER_ITEMS_INVALID",
      classification: "INCONSISTENT",
      description: "Os itens do pedido não formam uma lista válida para verificar os totais.",
      field: "items",
    });
    return null;
  }

  const totals: MoneyCents[] = [];
  items.forEach((item, index) => {
    const itemField = `items[${index}]`;
    if (!isRecord(item)) {
      findings.push({
        ...base,
        code: "ORDER_ITEM_INVALID",
        classification: "INCONSISTENT",
        description: "Um item do pedido não possui a estrutura financeira esperada.",
        field: itemField,
      });
      return;
    }

    const total = centsFromLegacy(item.total, `${itemField}.total`, findings, base);
    if (total !== null) totals.push(total);

    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 0) {
      findings.push({
        ...base,
        code: "ORDER_ITEM_QUANTITY_INVALID",
        classification: "INCONSISTENT",
        description: "A quantidade do item não é um número finito não negativo.",
        field: `${itemField}.quantity`,
      });
      return;
    }

    const unitPrice = centsFromLegacy(item.unitPrice, `${itemField}.unitPrice`, findings, base);
    if (unitPrice === null || total === null) return;

    const lineProduct = item.quantity * (unitPrice / 100);
    if (!Number.isFinite(lineProduct)) {
      addArithmeticFinding(findings, base, itemField);
      return;
    }
    try {
      const productCents = legacyReaisToMoneyCents(lineProduct, `${itemField}.quantity × unitPrice`);
      if (productCents !== total) {
        findings.push({
          ...base,
          code: "ORDER_ITEM_TOTAL_MISMATCH",
          classification: "INCONSISTENT",
          description: "O total do item diverge da multiplicação matematicamente verificável de quantidade e preço unitário.",
          field: itemField,
        });
      }
    } catch (error) {
      if (error instanceof FinancialDomainError) {
        if (error.code !== "MONETARY_VALUE_REQUIRES_CENT_PRECISION") {
          addArithmeticFinding(findings, base, itemField);
          return;
        }
        findings.push({
          ...base,
          code: "ORDER_ITEM_ROUNDING_DECISION_REQUIRED",
          classification: "BLOCKED_BY_PRODUCT_DECISION",
          description: "Quantidade e preço unitário exigem uma regra comercial de arredondamento ainda não aprovada.",
          field: itemField,
        });
        return;
      }
      throw error;
    }
  });

  return totals.length === items.length ? totals : null;
}

function parseOrder(order: ReconciliationOrderDocument): ParsedOrder {
  const findings: ReconciliationFinding[] = [];
  const clientId = isTechnicalId(order.clientId) ? order.clientId : undefined;
  const base = { recordType: "order" as const, recordId: order.id, clientId };

  if (!clientId) {
    findings.push({
      ...base,
      code: "ORDER_CLIENT_ID_INVALID",
      classification: "INCONSISTENT",
      description: "O pedido não possui um identificador técnico de cliente válido.",
      field: "clientId",
    });
  }

  const isCancelled = order.orderStatus === "cancelled";
  if (!isCancelled && order.orderStatus !== "active" && order.orderStatus !== "completed") {
    findings.push({
      ...base,
      code: "ORDER_STATUS_INVALID",
      classification: "INCONSISTENT",
      description: "O status operacional do pedido não é reconhecido.",
      field: "orderStatus",
    });
  }

  const amountPaid = centsFromLegacy(order.amountPaid, "amountPaid", findings, base);
  const total = centsFromLegacy(order.total, "total", findings, base);
  const creditApplied = centsFromLegacy(order.creditApplied ?? 0, "creditApplied", findings, base);
  const persistedCreditGenerated = order.creditGenerated == null
    ? null
    : centsFromLegacy(order.creditGenerated, "creditGenerated", findings, base);

  const itemTotals = examineItems(order.items, order.id, clientId, findings);
  const subtotal = order.subtotal === undefined
    ? null
    : centsFromLegacy(order.subtotal, "subtotal", findings, base);
  const deliveryFee = order.deliveryFee === undefined
    ? null
    : centsFromLegacy(order.deliveryFee, "deliveryFee", findings, base);
  if (order.subtotal === undefined || order.deliveryFee === undefined) {
    findings.push({
      ...base,
      code: "ORDER_COMMERCIAL_TOTALS_INCOMPLETE",
      classification: "INDETERMINATE",
      description: "O pedido não possui subtotal ou taxa de entrega para verificar a coerência comercial; não há compatibilidade legada aprovada para omitir esses fatos.",
      field: order.subtotal === undefined ? "subtotal" : "deliveryFee",
    });
  }
  if (itemTotals !== null && subtotal !== null) {
    try {
      const calculatedSubtotal = calculateOrderSubtotalCents(itemTotals);
      if (calculatedSubtotal !== subtotal) {
        findings.push({
          ...base,
          code: "ORDER_SUBTOTAL_DIVERGENT",
          classification: "INCONSISTENT",
          description: "O subtotal persistido diverge da soma dos totais dos itens.",
          field: "subtotal",
        });
      }
      if (total !== null && deliveryFee !== null && calculateOrderTotalCents(calculatedSubtotal, deliveryFee) !== total) {
        findings.push({
          ...base,
          code: "ORDER_TOTAL_DIVERGENT",
          classification: "INCONSISTENT",
          description: "O total persistido diverge do subtotal dos itens somado à taxa de entrega.",
          field: "total",
        });
      }
    } catch (error) {
      if (error instanceof FinancialDomainError) {
        addArithmeticFinding(findings, base, "items");
      } else {
        throw error;
      }
    }
  }

  let cashPaid: MoneyCents | null = null;
  if (order.payments === undefined) {
    findings.push({
      ...base,
      code: "PAYMENTS_LEGACY_ABSENT",
      classification: "LEGACY_COMPATIBLE",
      description: "O pedido legado não possui payments; amountPaid foi usado como compatibilidade de leitura.",
      field: "payments",
    });
    cashPaid = amountPaid;
  } else if (!Array.isArray(order.payments)) {
    findings.push({
      ...base,
      code: "PAYMENTS_INVALID_STRUCTURE",
      classification: "INCONSISTENT",
      description: "payments existe, mas não é uma lista de recebimentos.",
      field: "payments",
    });
  } else {
    const paymentIds = new Set<string>();
    const paymentAmounts: MoneyCents[] = [];
    let validPayments = true;
    order.payments.forEach((payment, index) => {
      const paymentField = `payments[${index}]`;
      if (!isRecord(payment)) {
        findings.push({
          ...base,
          code: "PAYMENT_INVALID_STRUCTURE",
          classification: "INCONSISTENT",
          description: "Um recebimento não possui a estrutura esperada.",
          field: paymentField,
        });
        validPayments = false;
        return;
      }
      if (!isTechnicalId(payment.id)) {
        findings.push({
          ...base,
          code: "PAYMENT_ID_INVALID",
          classification: "INCONSISTENT",
          description: "Um recebimento não possui identificador técnico válido.",
          field: `${paymentField}.id`,
        });
        validPayments = false;
      } else if (paymentIds.has(payment.id)) {
        findings.push({
          ...base,
          code: "PAYMENT_ID_DUPLICATE",
          classification: "INCONSISTENT",
          description: "Há identificadores de recebimento duplicados no mesmo pedido.",
          field: `${paymentField}.id`,
        });
        validPayments = false;
      } else {
        paymentIds.add(payment.id);
      }

      const paymentAmount = centsFromLegacy(payment.amount, `${paymentField}.amount`, findings, base);
      if (paymentAmount === null || paymentAmount <= 0) {
        if (paymentAmount !== null) {
          findings.push({
            ...base,
            code: "PAYMENT_AMOUNT_NON_POSITIVE",
            classification: "INCONSISTENT",
            description: "Um recebimento precisa ter valor positivo em centavos inteiros.",
            field: `${paymentField}.amount`,
          });
        }
        validPayments = false;
      } else {
        paymentAmounts.push(paymentAmount);
      }

      if (payment.receivedAt === null) {
        findings.push({
          ...base,
          code: "PAYMENT_DATE_HISTORICALLY_UNKNOWN",
          classification: "LEGACY_COMPATIBLE",
          description: "O recebimento tem data histórica desconhecida, preservada como null.",
          field: `${paymentField}.receivedAt`,
        });
      } else if (typeof payment.receivedAt !== "string" || !isValidDate(payment.receivedAt)) {
        findings.push({
          ...base,
          code: "PAYMENT_DATE_INVALID_OR_MISSING",
          classification: "INCONSISTENT",
          description: "O recebimento não possui uma data/hora válida nem uma data histórica explicitamente desconhecida.",
          field: `${paymentField}.receivedAt`,
        });
        validPayments = false;
      }
    });

    if (order.payments.length === 0 && amountPaid === 0) {
      findings.push({
        ...base,
        code: "PAYMENTS_EMPTY_WITH_ZERO_CACHE",
        classification: "VALID",
        description: "payments vazio com amountPaid zero representa um pedido sem recebimentos.",
        field: "payments",
      });
    }
    if (validPayments) {
      try {
        cashPaid = sumMoneyCents(paymentAmounts);
        if (amountPaid !== null && cashPaid !== amountPaid) {
          findings.push({
            ...base,
            code: "AMOUNT_PAID_PAYMENTS_MISMATCH",
            classification: "INCONSISTENT",
            description: "amountPaid diverge da soma canônica de payments.",
            field: "amountPaid",
          });
        }
      } catch (error) {
        if (error instanceof FinancialDomainError) {
          addArithmeticFinding(findings, base, "payments");
        } else {
          throw error;
        }
      }
    }
  }

  let balance: MoneyCents | null = null;
  let calculatedGeneratedCredit: MoneyCents | null = null;
  if (total !== null && cashPaid !== null && creditApplied !== null) {
    try {
      balance = calculateOrderBalanceCents(total, cashPaid, creditApplied);
      calculatedGeneratedCredit = calculateGeneratedCreditCents(total, cashPaid, creditApplied);
      if (persistedCreditGenerated !== null && persistedCreditGenerated !== calculatedGeneratedCredit) {
        findings.push({
          ...base,
          code: "CREDIT_GENERATED_MISMATCH",
          classification: "INCONSISTENT",
          description: "creditGenerated persistido diverge do crédito calculado pelos fatos válidos.",
          field: "creditGenerated",
        });
      }
      if (creditApplied > 0 && calculatedGeneratedCredit > 0) {
        findings.push({
          ...base,
          code: "CREDIT_APPLIED_AND_GENERATED",
          classification: "VALID",
          description: "O pedido registra aplicação e geração de crédito, combinação permitida pelo contrato atual.",
        });
      }
    } catch (error) {
      if (error instanceof FinancialDomainError) {
        addArithmeticFinding(findings, base, "total");
      } else {
        throw error;
      }
    }
  }

  if (isCancelled) {
    findings.push({
      ...base,
      code: "CANCELLED_ORDER_SETTLEMENT_REQUIRED",
      classification: "BLOCKED_BY_PRODUCT_DECISION",
      description: "O pedido cancelado preserva seus fatos, mas exige acerto financeiro explícito antes de uma conclusão definitiva.",
      field: "orderStatus",
    });
  }

  const classification = recordClassification(findings);
  const canReconstructCredit = clientId !== undefined
    && total !== null
    && cashPaid !== null
    && creditApplied !== null
    && calculatedGeneratedCredit !== null
    && !findings.some((finding) => finding.classification !== "VALID" && finding.classification !== "LEGACY_COMPATIBLE")
    && !isCancelled;
  const isCancelledWithCreditEffect = isCancelled && (
    (creditApplied ?? 0) > 0
    || (calculatedGeneratedCredit ?? persistedCreditGenerated ?? 0) > 0
  );

  return {
    sortKey: stableValueKey(order),
    clientId,
    canReconstructCredit,
    isCancelledWithCreditEffect,
    effect: canReconstructCredit && calculatedGeneratedCredit !== null && creditApplied !== null
      ? { generatedCents: calculatedGeneratedCredit, appliedCents: creditApplied }
      : undefined,
    result: {
      orderId: order.id,
      clientId,
      classification,
      cashPaidCents: cashPaid,
      balanceCents: balance,
      calculatedGeneratedCreditCents: calculatedGeneratedCredit,
      findings: sortedFindings(findings),
    },
  };
}

function summarizeRecords(orders: readonly ReconciledOrder[], clients: readonly ClientCreditReconstruction[]): ReconciliationSummary {
  const findings = [...orders.flatMap((order) => order.findings), ...clients.flatMap((client) => client.findings)];
  return {
    ordersAnalyzed: orders.length,
    clientsAnalyzed: clients.length,
    validRecords: orders.filter((order) => order.classification === "VALID").length,
    legacyRecords: orders.filter((order) => order.classification === "LEGACY_COMPATIBLE").length,
    inconsistentRecords: orders.filter((order) => order.classification === "INCONSISTENT").length,
    conclusiveReconstructions: clients.filter((client) => client.conclusive).length,
    inconclusiveReconstructions: clients.filter((client) => !client.conclusive).length,
    aggregatorDivergences: clients.filter((client) => client.aggregatorComparison === "divergent").length,
    humanInterventionRequired: findings.filter((finding) => (
      finding.classification === "INCONSISTENT" || finding.classification === "INDETERMINATE"
    )).length,
    productDecisionLimitations: findings.filter((finding) => (
      finding.classification === "BLOCKED_BY_PRODUCT_DECISION"
    )).length,
  };
}

/**
 * Rebuilds a diagnostic from supplied documents only. It never imports Firebase
 * and never mutates the order or aggregator objects it receives.
 */
export function reconcileFinancialDocuments(
  orderDocuments: readonly ReconciliationOrderDocument[],
  aggregatorSnapshots: readonly ClientFinancialSnapshot[] = [],
): ReconciliationResult {
  const parsedOrders = orderDocuments.map(parseOrder).sort((first, second) => (
    first.result.orderId.localeCompare(second.result.orderId)
    || first.sortKey.localeCompare(second.sortKey)
  ));
  const ordersById = new Map<string, ParsedOrder[]>();
  parsedOrders.forEach((order) => {
    const duplicates = ordersById.get(order.result.orderId) ?? [];
    duplicates.push(order);
    ordersById.set(order.result.orderId, duplicates);
  });
  ordersById.forEach((duplicates) => {
    if (duplicates.length < 2) return;
    duplicates.forEach((order) => {
      order.result.findings.push({
        code: "ORDER_ID_DUPLICATE",
        classification: "INCONSISTENT",
        description: "Há mais de um documento de entrada com o mesmo identificador de pedido; nenhum efeito foi contabilizado.",
        recordType: "order",
        recordId: order.result.orderId,
        clientId: order.clientId,
        field: "id",
      });
      order.result.findings = sortedFindings(order.result.findings);
      order.result.classification = recordClassification(order.result.findings);
      order.canReconstructCredit = false;
      order.effect = undefined;
    });
  });
  const clients = new Map<string, ClientState>();
  parsedOrders.forEach((order) => {
    if (!order.clientId) return;
    const state = clients.get(order.clientId) ?? { orders: [], findings: [] };
    state.orders.push(order);
    clients.set(order.clientId, state);
  });

  const snapshots = new Map<string, ClientFinancialSnapshot>();
  const ambiguousSnapshotClientIds = new Set<string>();
  aggregatorSnapshots.forEach((snapshot) => {
    if (!isTechnicalId(snapshot.clientId)) return;
    if (ambiguousSnapshotClientIds.has(snapshot.clientId)) {
      return;
    }
    if (snapshots.has(snapshot.clientId)) {
      snapshots.delete(snapshot.clientId);
      ambiguousSnapshotClientIds.add(snapshot.clientId);
      return;
    }
    snapshots.set(snapshot.clientId, snapshot);
  });

  const clientResults = [...clients.entries()].map(([clientId, state]) => {
    const findings = [...state.findings];
    const base = { recordType: "client" as const, recordId: clientId, clientId };
    const invalidFacts = state.orders.some((order) => order.result.classification === "INCONSISTENT");
    const unresolvedCommercialDependency = state.orders.some((order) => (
      order.result.classification === "INDETERMINATE" || order.result.classification === "BLOCKED_BY_PRODUCT_DECISION"
    ));
    const unresolvedCancellation = state.orders.some((order) => order.isCancelledWithCreditEffect);
    if (invalidFacts) {
      findings.push({
        ...base,
        code: "CLIENT_CREDIT_RECONSTRUCTION_INDETERMINATE",
        classification: "INDETERMINATE",
        description: "Há fatos financeiros inválidos em pedidos do cliente; o saldo não pode ser afirmado com segurança.",
      });
    }
    if (unresolvedCancellation) {
      findings.push({
        ...base,
        code: "CANCELLED_CREDIT_SETTLEMENT_UNRESOLVED",
        classification: "INDETERMINATE",
        description: "O saldo depende de crédito ligado a pedido cancelado sem contrato de acerto aprovado.",
      });
    }
    if (unresolvedCommercialDependency) {
      findings.push({
        ...base,
        code: "CLIENT_CREDIT_RECONSTRUCTION_COMMERCIAL_DEPENDENCY",
        classification: "INDETERMINATE",
        description: "A reconstrução depende de coerência comercial ou arredondamento ainda não resolvidos.",
      });
    }

    let conclusive = !invalidFacts && !unresolvedCancellation && !unresolvedCommercialDependency;
    let availableCreditCents: MoneyCents | null = null;
    let deficitCents: MoneyCents | null = null;
    const effects = state.orders.filter((order) => order.canReconstructCredit).flatMap((order) => (
      order.effect ? [order.effect] : []
    ));
    if (conclusive) {
      try {
        availableCreditCents = projectFungibleCreditBalance(effects).availableCents;
        findings.push({
          ...base,
          code: "CLIENT_CREDIT_RECONSTRUCTED",
          classification: "VALID",
          description: "A reconstrução de crédito é positiva ou zerada a partir dos fatos elegíveis.",
        });
      } catch (error) {
        if (!(error instanceof FinancialDomainError)) throw error;
        if (error.code !== "INSUFFICIENT_AVAILABLE_CREDIT") {
          conclusive = false;
          availableCreditCents = null;
          findings.push({
            ...base,
            code: "CLIENT_CREDIT_RECONSTRUCTION_ARITHMETIC_INVALID",
            classification: "INDETERMINATE",
            description: "A agregação de crédito excede o intervalo seguro; o saldo não foi aproximado.",
          });
        } else {
          try {
            const generated = sumMoneyCents(effects.map((effect) => effect.generatedCents));
            const consumed = sumMoneyCents(effects.map((effect) => effect.appliedCents));
            deficitCents = subtractMoneyCents(consumed, generated);
            findings.push({
              ...base,
              code: "CLIENT_CREDIT_DEFICIT",
              classification: "INCONSISTENT",
              description: "A reconstrução determinística encontrou crédito consumido acima do crédito gerado; o déficit não foi mascarado.",
            });
          } catch (deficitError) {
            if (!(deficitError instanceof FinancialDomainError)) throw deficitError;
            conclusive = false;
            availableCreditCents = null;
            deficitCents = null;
            findings.push({
              ...base,
              code: "CLIENT_CREDIT_RECONSTRUCTION_ARITHMETIC_INVALID",
              classification: "INDETERMINATE",
              description: "O déficit não cabe no intervalo seguro de centavos e não foi aproximado.",
            });
          }
        }
      }
    }

    let aggregatorComparison: ClientCreditReconstruction["aggregatorComparison"] = "not_available";
    const snapshot = snapshots.get(clientId);
    if (ambiguousSnapshotClientIds.has(clientId)) {
      aggregatorComparison = "not_compared";
      findings.push({
        ...base,
        code: "AGGREGATOR_DUPLICATE_SNAPSHOT",
        classification: "INDETERMINATE",
        description: "Há mais de um snapshot experimental para o mesmo cliente; nenhum foi escolhido automaticamente.",
      });
    } else if (!snapshot) {
      findings.push({
        ...base,
        code: "AGGREGATOR_ABSENT",
        classification: "LEGACY_COMPATIBLE",
        description: "Não existe agregador experimental; a ausência não prova corrupção e não foi inicializada.",
      });
    } else if (snapshot.state === "blocked") {
      aggregatorComparison = "not_compared";
      findings.push({
        ...base,
        code: "AGGREGATOR_BLOCKED",
        classification: "INDETERMINATE",
        description: "O agregador experimental está bloqueado e não pode ser comparado automaticamente.",
      });
    } else if (snapshot.state !== "ready") {
      aggregatorComparison = "not_compared";
      findings.push({
        ...base,
        code: "AGGREGATOR_UNINITIALIZED",
        classification: "INDETERMINATE",
        description: "O agregador experimental está ausente de estado ready; nenhuma inicialização foi realizada.",
      });
    } else if (typeof snapshot.availableCreditCents !== "number"
      || !Number.isSafeInteger(snapshot.availableCreditCents)
      || snapshot.availableCreditCents < 0
      || typeof snapshot.revision !== "number"
      || !Number.isSafeInteger(snapshot.revision)
      || snapshot.revision < 0) {
      aggregatorComparison = "not_compared";
      findings.push({
        ...base,
        code: "AGGREGATOR_READY_CONTRACT_INVALID",
        classification: "INCONSISTENT",
        description: "O agregador ready não possui saldo e revision válidos em centavos inteiros seguros.",
      });
    } else if (!conclusive || availableCreditCents === null) {
      aggregatorComparison = "not_compared";
    } else if (snapshot.availableCreditCents === availableCreditCents) {
      aggregatorComparison = "matches";
    } else {
      aggregatorComparison = "divergent";
      findings.push({
        ...base,
        code: "AGGREGATOR_RECONSTRUCTION_MISMATCH",
        classification: "INCONSISTENT",
        description: "O agregador experimental diverge da reconstrução conclusiva e exige revisão humana.",
      });
    }

    return {
      clientId,
      classification: recordClassification(findings),
      conclusive,
      availableCreditCents,
      deficitCents,
      aggregatorComparison,
      findings: sortedFindings(findings),
    } satisfies ClientCreditReconstruction;
  }).sort((first, second) => first.clientId.localeCompare(second.clientId));

  const orders = parsedOrders.map((order) => order.result);
  const findings = sortedFindings([...orders.flatMap((order) => order.findings), ...clientResults.flatMap((client) => client.findings)]);
  return { summary: summarizeRecords(orders, clientResults), orders, clients: clientResults, findings };
}
