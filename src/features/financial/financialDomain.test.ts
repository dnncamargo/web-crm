import { describe, expect, it } from "vitest";

import {
  confirmCreditApplication,
  createCreditEffect,
  preserveCreditApplicationOnNonFinancialEdit,
  projectFungibleCreditBalance,
  suggestCreditApplication,
  validateRetroactiveCreditReduction,
} from "./credit";
import {
  FinancialDomainError,
  calculateEffectivePaidCents,
  calculateGeneratedCreditCents,
  calculateOrderBalanceCents,
  calculateOrderSubtotalCents,
  calculateOrderTotalCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  sumMoneyCents,
} from "./money";

const cents = (value: number) => legacyReaisToMoneyCents(value);

function expectFinancialError(action: () => unknown, message: string) {
  expect(action).toThrow(FinancialDomainError);
  expect(action).toThrow(message);
}

describe("financial money core", () => {
  it("adds R$ 0,10 and R$ 0,20 deterministically", () => {
    expect(moneyCentsToLegacyReais(sumMoneyCents([cents(0.1), cents(0.2)]))).toBe(0.3);
  });

  it("sums multiple payments and calculates subtotal, total and settlement", () => {
    const cashPaid = sumMoneyCents([cents(30), cents(20), cents(50)]);
    const subtotal = calculateOrderSubtotalCents([cents(40), cents(50)]);
    const total = calculateOrderTotalCents(subtotal, cents(10));

    expect(cashPaid).toBe(cents(100));
    expect(total).toBe(cents(100));
    expect(calculateEffectivePaidCents(cashPaid, cents(0))).toBe(cents(100));
    expect(calculateOrderBalanceCents(total, cashPaid, cents(0))).toBe(cents(0));
  });

  it("generates credit from an excess payment while retaining applied credit", () => {
    expect(calculateGeneratedCreditCents(cents(100), cents(90), cents(20))).toBe(cents(10));
  });

  it("rejects invalid or sub-cent legacy monetary values without normalizing them", () => {
    expectFinancialError(() => legacyReaisToMoneyCents(Number.NaN), "deve ser finito");
    expectFinancialError(() => legacyReaisToMoneyCents(1.001), "precisão de centavos");
  });

  it("keeps compatibility with exact legacy reais values", () => {
    expect(moneyCentsToLegacyReais(cents(1234.56))).toBe(1234.56);
  });
});

describe("fungible client credit", () => {
  it("aggregates generated and consumed credit across distinct orders without lots", () => {
    const balance = projectFungibleCreditBalance([
      createCreditEffect({ generatedCents: cents(50), appliedCents: cents(0) }),
      createCreditEffect({ generatedCents: cents(0), appliedCents: cents(10) }),
      createCreditEffect({ generatedCents: cents(0), appliedCents: cents(20) }),
    ]);

    expect(balance.generatedCents).toBe(cents(50));
    expect(balance.consumedCents).toBe(cents(30));
    expect(balance.availableCents).toBe(cents(20));
  });

  it("allows a retroactive reduction covered by available credit", () => {
    expect(validateRetroactiveCreditReduction({
      availableCreditCents: cents(20),
      previousGeneratedCreditCents: cents(50),
      nextGeneratedCreditCents: cents(35),
    })).toEqual({ reductionCents: cents(15), nextAvailableCreditCents: cents(5) });
  });

  it("rejects a retroactive reduction that would consume already used credit", () => {
    expectFinancialError(() => validateRetroactiveCreditReduction({
      availableCreditCents: cents(20),
      previousGeneratedCreditCents: cents(50),
      nextGeneratedCreditCents: cents(20),
    }), "alteração financeira foi rejeitada");
  });

  it("does not modify previous consumer effects when a reduction is rejected", () => {
    const consumers = [
      createCreditEffect({ generatedCents: cents(0), appliedCents: cents(10) }),
      createCreditEffect({ generatedCents: cents(0), appliedCents: cents(20) }),
    ];

    expect(() => validateRetroactiveCreditReduction({
      availableCreditCents: cents(20),
      previousGeneratedCreditCents: cents(50),
      nextGeneratedCreditCents: cents(20),
    })).toThrow(FinancialDomainError);
    expect(consumers.map((consumer) => consumer.appliedCents)).toEqual([cents(10), cents(20)]);
  });
});

describe("explicit credit application", () => {
  it("suggests the available credit capped at the order total", () => {
    expect(suggestCreditApplication(cents(50), cents(120))).toEqual({ suggestedCents: cents(50) });
  });

  it("allows a partial operator-confirmed application", () => {
    expect(confirmCreditApplication({
      availableCreditCents: cents(50),
      orderTotalCents: cents(120),
      selectedCents: cents(30),
      confirmed: true,
    })).toEqual({
      appliedCents: cents(30),
      remainingOrderBalanceCents: cents(90),
      remainingAvailableCreditCents: cents(20),
    });
  });

  it("allows an explicitly confirmed refusal of credit", () => {
    expect(confirmCreditApplication({
      availableCreditCents: cents(50),
      orderTotalCents: cents(120),
      selectedCents: cents(0),
      confirmed: true,
    }).appliedCents).toBe(cents(0));
  });

  it("requires explicit confirmation and rejects a choice above the available credit", () => {
    expectFinancialError(() => confirmCreditApplication({
      availableCreditCents: cents(50), orderTotalCents: cents(120), selectedCents: cents(50), confirmed: false,
    }), "confirmação explícita");
    expectFinancialError(() => confirmCreditApplication({
      availableCreditCents: cents(20), orderTotalCents: cents(120), selectedCents: cents(50), confirmed: true,
    }), "excede o saldo disponível");
  });

  it("rejects a stale confirmed amount instead of decreasing it automatically", () => {
    expectFinancialError(() => confirmCreditApplication({
      availableCreditCents: cents(30), orderTotalCents: cents(120), selectedCents: cents(50), confirmed: true,
    }), "excede o saldo disponível");
  });

  it("preserves applied credit during a non-financial edit", () => {
    expect(preserveCreditApplicationOnNonFinancialEdit(cents(30))).toBe(cents(30));
  });

  it("does not redistribute applied credit when a later payment generates credit", () => {
    const appliedCredit = preserveCreditApplicationOnNonFinancialEdit(cents(30));
    const generatedCredit = calculateGeneratedCreditCents(cents(100), cents(80), appliedCredit);

    expect(appliedCredit).toBe(cents(30));
    expect(generatedCredit).toBe(cents(10));
  });
});
