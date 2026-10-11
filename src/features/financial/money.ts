export type MoneyCents = number & { readonly __moneyCents: unique symbol };

export type FinancialDomainErrorCode =
  | "INVALID_MONETARY_VALUE"
  | "MONETARY_VALUE_REQUIRES_CENT_PRECISION"
  | "MONETARY_ARITHMETIC_OVERFLOW"
  | "NEGATIVE_MONETARY_VALUE"
  | "INSUFFICIENT_AVAILABLE_CREDIT"
  | "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED"
  | "CREDIT_REDUCTION_VALIDATOR_REQUIRES_REDUCTION"
  | "CREDIT_APPLICATION_CONFIRMATION_REQUIRED"
  | "CREDIT_APPLICATION_EXCEEDS_ORDER_TOTAL"
  | "CREDIT_BALANCE_CHANGED";

export class FinancialDomainError extends Error {
  readonly code: FinancialDomainErrorCode;

  constructor(code: FinancialDomainErrorCode, message: string) {
    super(message);
    this.name = "FinancialDomainError";
    this.code = code;
  }
}

function asMoneyCents(value: number): MoneyCents {
  return value as MoneyCents;
}

export function assertValidMoneyCents(value: number, fieldName = "Valor monetário"): asserts value is MoneyCents {
  if (!Number.isSafeInteger(value)) {
    throw new FinancialDomainError(
      "INVALID_MONETARY_VALUE",
      `${fieldName} deve ser um número inteiro de centavos válido.`,
    );
  }
}

export function assertNonNegativeMoneyCents(value: MoneyCents, fieldName = "Valor monetário"): void {
  assertValidMoneyCents(value, fieldName);

  if (value < 0) {
    throw new FinancialDomainError(
      "NEGATIVE_MONETARY_VALUE",
      `${fieldName} não pode ser negativo.`,
    );
  }
}

/** Converts the current persisted representation in reais without rounding it silently. */
export function legacyReaisToMoneyCents(value: number, fieldName = "Valor monetário"): MoneyCents {
  if (!Number.isFinite(value)) {
    throw new FinancialDomainError(
      "INVALID_MONETARY_VALUE",
      `${fieldName} deve ser finito.`,
    );
  }

  const cents = Math.round(value * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new FinancialDomainError(
      "INVALID_MONETARY_VALUE",
      `${fieldName} está fora do intervalo monetário suportado.`,
    );
  }

  if (Math.abs(value - cents / 100) > Number.EPSILON * 16) {
    throw new FinancialDomainError(
      "MONETARY_VALUE_REQUIRES_CENT_PRECISION",
      `${fieldName} precisa ter precisão de centavos; nenhum arredondamento foi aplicado.`,
    );
  }

  return asMoneyCents(cents);
}

export function moneyCentsToLegacyReais(value: MoneyCents, fieldName = "Valor monetário"): number {
  assertValidMoneyCents(value, fieldName);
  return value / 100;
}

export function sumMoneyCents(values: readonly MoneyCents[]): MoneyCents {
  const sum = values.reduce((current, value) => {
    assertValidMoneyCents(value);
    const next = current + value;

    if (!Number.isSafeInteger(next)) {
      throw new FinancialDomainError(
        "MONETARY_ARITHMETIC_OVERFLOW",
        "A soma monetária excede o intervalo seguro de centavos.",
      );
    }

    return next;
  }, 0);

  return asMoneyCents(sum);
}

export function subtractMoneyCents(minuend: MoneyCents, subtrahend: MoneyCents): MoneyCents {
  assertValidMoneyCents(minuend);
  assertValidMoneyCents(subtrahend);

  const difference = minuend - subtrahend;

  if (!Number.isSafeInteger(difference)) {
    throw new FinancialDomainError(
      "MONETARY_ARITHMETIC_OVERFLOW",
      "A subtração monetária excede o intervalo seguro de centavos.",
    );
  }

  return asMoneyCents(difference);
}

export function calculateOrderSubtotalCents(itemTotals: readonly MoneyCents[]): MoneyCents {
  return sumMoneyCents(itemTotals);
}

export function calculateOrderTotalCents(subtotalCents: MoneyCents, deliveryFeeCents: MoneyCents): MoneyCents {
  return sumMoneyCents([subtotalCents, deliveryFeeCents]);
}

export function calculateEffectivePaidCents(cashPaidCents: MoneyCents, creditAppliedCents: MoneyCents): MoneyCents {
  return sumMoneyCents([cashPaidCents, creditAppliedCents]);
}

export function calculateOrderBalanceCents(
  orderTotalCents: MoneyCents,
  cashPaidCents: MoneyCents,
  creditAppliedCents: MoneyCents,
): MoneyCents {
  return subtractMoneyCents(orderTotalCents, calculateEffectivePaidCents(cashPaidCents, creditAppliedCents));
}

export function calculateGeneratedCreditCents(
  orderTotalCents: MoneyCents,
  cashPaidCents: MoneyCents,
  creditAppliedCents: MoneyCents,
): MoneyCents {
  assertNonNegativeMoneyCents(orderTotalCents, "Total do pedido");
  assertNonNegativeMoneyCents(cashPaidCents, "Dinheiro recebido");
  assertNonNegativeMoneyCents(creditAppliedCents, "Crédito aplicado");

  const balance = calculateOrderBalanceCents(orderTotalCents, cashPaidCents, creditAppliedCents);
  return asMoneyCents(Math.max(-balance, 0));
}

export function calculateApplicableCreditCents(
  availableCreditCents: MoneyCents,
  orderTotalCents: MoneyCents,
): MoneyCents {
  assertNonNegativeMoneyCents(availableCreditCents, "Crédito disponível");
  assertNonNegativeMoneyCents(orderTotalCents, "Total do pedido");

  return asMoneyCents(Math.min(availableCreditCents, orderTotalCents));
}
