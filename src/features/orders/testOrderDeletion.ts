export const testOrderDeletionConfirmation = "EXCLUIR CONJUNTO DE TESTE";

export const confirmedTestOrderDeletionFixtures = [
  { id: "Kw3hWUWO6FxsbHCImN3A", totalCents: 3200, cashPaidCents: 2000 },
  { id: "LbRzs64Vd0EgFdKFCgIn", totalCents: 8000, cashPaidCents: 12000 },
  { id: "vaV313JdOHe83uJX8ZQ1", totalCents: 4000, cashPaidCents: 0 },
] as const;

export type ConfirmedTestOrderDeletionFixture = {
  id: string;
  totalCents: number;
  cashPaidCents: number;
};

export function isConfirmedTestOrderId(id: string): boolean {
  return confirmedTestOrderDeletionFixtures.some((fixture) => fixture.id === id);
}
