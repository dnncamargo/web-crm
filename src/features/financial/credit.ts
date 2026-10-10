import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  calculateApplicableCreditCents,
  subtractMoneyCents,
  sumMoneyCents,
} from "./money";
import type { MoneyCents } from "./money";

export interface CreditEffectInput {
  generatedCents: MoneyCents;
  appliedCents: MoneyCents;
}

export interface CreditEffect extends CreditEffectInput {
  netChangeCents: MoneyCents;
}

export interface CreditBalanceProjection {
  generatedCents: MoneyCents;
  consumedCents: MoneyCents;
  availableCents: MoneyCents;
}

export interface RetroactiveCreditReductionInput {
  availableCreditCents: MoneyCents;
  previousGeneratedCreditCents: MoneyCents;
  nextGeneratedCreditCents: MoneyCents;
}

export interface RetroactiveCreditReductionResult {
  reductionCents: MoneyCents;
  nextAvailableCreditCents: MoneyCents;
}

export interface CreditApplicationSuggestion {
  suggestedCents: MoneyCents;
}

export interface ConfirmCreditApplicationInput {
  availableCreditCents: MoneyCents;
  orderTotalCents: MoneyCents;
  selectedCents: MoneyCents;
  confirmed: boolean;
}

export interface ConfirmedCreditApplication {
  appliedCents: MoneyCents;
  remainingOrderBalanceCents: MoneyCents;
  remainingAvailableCreditCents: MoneyCents;
}

export function createCreditEffect(input: CreditEffectInput): CreditEffect {
  assertNonNegativeMoneyCents(input.generatedCents, "Crédito gerado");
  assertNonNegativeMoneyCents(input.appliedCents, "Crédito aplicado");

  return {
    ...input,
    netChangeCents: subtractMoneyCents(input.generatedCents, input.appliedCents),
  };
}

export function projectFungibleCreditBalance(effects: readonly CreditEffectInput[]): CreditBalanceProjection {
  const generatedCents = sumMoneyCents(effects.map((effect) => {
    assertNonNegativeMoneyCents(effect.generatedCents, "Crédito gerado");
    return effect.generatedCents;
  }));
  const consumedCents = sumMoneyCents(effects.map((effect) => {
    assertNonNegativeMoneyCents(effect.appliedCents, "Crédito aplicado");
    return effect.appliedCents;
  }));

  if (consumedCents > generatedCents) {
    throw new FinancialDomainError(
      "INSUFFICIENT_AVAILABLE_CREDIT",
      "O crédito consumido excede o crédito gerado; o saldo disponível não pode ser negativo.",
    );
  }

  return {
    generatedCents,
    consumedCents,
    availableCents: subtractMoneyCents(generatedCents, consumedCents),
  };
}

export function validateRetroactiveCreditReduction(
  input: RetroactiveCreditReductionInput,
): RetroactiveCreditReductionResult {
  assertNonNegativeMoneyCents(input.availableCreditCents, "Crédito disponível");
  assertNonNegativeMoneyCents(input.previousGeneratedCreditCents, "Crédito gerado anterior");
  assertNonNegativeMoneyCents(input.nextGeneratedCreditCents, "Novo crédito gerado");

  const reductionCents = input.nextGeneratedCreditCents < input.previousGeneratedCreditCents
    ? subtractMoneyCents(input.previousGeneratedCreditCents, input.nextGeneratedCreditCents)
    : subtractMoneyCents(input.previousGeneratedCreditCents, input.previousGeneratedCreditCents);

  if (reductionCents > input.availableCreditCents) {
    throw new FinancialDomainError(
      "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED",
      "A redução de crédito excede o saldo disponível; a alteração financeira foi rejeitada.",
    );
  }

  return {
    reductionCents,
    nextAvailableCreditCents: subtractMoneyCents(input.availableCreditCents, reductionCents),
  };
}

export function suggestCreditApplication(
  availableCreditCents: MoneyCents,
  orderTotalCents: MoneyCents,
): CreditApplicationSuggestion {
  return { suggestedCents: calculateApplicableCreditCents(availableCreditCents, orderTotalCents) };
}

export function confirmCreditApplication(
  input: ConfirmCreditApplicationInput,
): ConfirmedCreditApplication {
  assertNonNegativeMoneyCents(input.availableCreditCents, "Crédito disponível");
  assertNonNegativeMoneyCents(input.orderTotalCents, "Total do pedido");
  assertNonNegativeMoneyCents(input.selectedCents, "Crédito escolhido");

  if (!input.confirmed) {
    throw new FinancialDomainError(
      "CREDIT_APPLICATION_CONFIRMATION_REQUIRED",
      "A aplicação de crédito exige confirmação explícita do operador.",
    );
  }

  if (input.selectedCents > input.orderTotalCents) {
    throw new FinancialDomainError(
      "CREDIT_APPLICATION_EXCEEDS_ORDER_TOTAL",
      "O crédito escolhido não pode exceder o total do pedido.",
    );
  }

  if (input.selectedCents > input.availableCreditCents) {
    throw new FinancialDomainError(
      "INSUFFICIENT_AVAILABLE_CREDIT",
      "O crédito escolhido excede o saldo disponível no momento da confirmação.",
    );
  }

  return {
    appliedCents: input.selectedCents,
    remainingOrderBalanceCents: subtractMoneyCents(input.orderTotalCents, input.selectedCents),
    remainingAvailableCreditCents: subtractMoneyCents(input.availableCreditCents, input.selectedCents),
  };
}

/** A non-financial edit has no authority to redistribute an existing credit application. */
export function preserveCreditApplicationOnNonFinancialEdit(existingAppliedCents: MoneyCents): MoneyCents {
  assertNonNegativeMoneyCents(existingAppliedCents, "Crédito aplicado existente");
  return existingAppliedCents;
}
