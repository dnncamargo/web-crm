import { describe, expect, it } from "vitest";

import { parseProductionCorrectPaymentCommand } from "../../api/_financial/validation";

function request(body: unknown) {
  return new Request("http://localhost/api/financial/correct-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validCommand = {
  orderId: "order-123",
  clientId: "client-123",
  paymentId: "payment-123",
  expectedAmountCents: 3000,
  expectedReceivedAt: "2026-10-16T12:00:00.000Z",
  amountCents: 3500,
  receivedAt: "2026-10-17T13:45:00.000Z",
};

describe("production payment correction validation", () => {
  it("accepts only the target payment's previous and desired states", async () => {
    await expect(parseProductionCorrectPaymentCommand(request(validCommand))).resolves.toEqual(validCommand);
  });

  it("rejects client-supplied aggregator values and unknown properties", async () => {
    await expect(parseProductionCorrectPaymentCommand(request({
      ...validCommand,
      presentedRevision: 3,
      presentedAvailableCreditCents: 500,
    }))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(parseProductionCorrectPaymentCommand(request({
      ...validCommand,
      creditGenerated: 10000,
    }))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  it("rejects invalid receipt dates and non-positive amounts", async () => {
    await expect(parseProductionCorrectPaymentCommand(request({
      ...validCommand,
      receivedAt: "2026-10-17T13:45",
    }))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(parseProductionCorrectPaymentCommand(request({
      ...validCommand,
      amountCents: 0,
    }))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });
});
