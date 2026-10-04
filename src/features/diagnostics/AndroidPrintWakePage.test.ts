import { describe, expect, it } from "vitest";

import { PrintCompanionError } from "../printers/printCompanionTypes";
import { getAndroidPrintWakeErrorDetails } from "./androidPrintWakeErrors";

describe("Android print wake diagnostics", () => {
  it("publishes wake_timeout instead of pairing_expired", () => {
    const details = getAndroidPrintWakeErrorDetails(new PrintCompanionError(
      "pairing_expired",
      "A ativação do companion expirou.",
      { companionCode: "wake_timeout" },
    ));

    expect(details.publicCode).toBe("wake_timeout");
    expect(details.message).toBe("O companion não respondeu ao health dentro de 15 segundos.");
    expect(details.showDownload).toBe(true);
  });
});
