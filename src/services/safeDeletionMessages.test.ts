import { describe, expect, it } from "vitest";

import { getSafeDeletionErrorMessage } from "./safeDeletionMessages";

describe("safe deletion API error messages", () => {
  it("separates ordinary eligibility from confirmed-set cleanup failures", () => {
    expect(getSafeDeletionErrorMessage("ORDER_FINANCIALS_INCONCLUSIVE")).toContain("exclusão normal");
    expect(getSafeDeletionErrorMessage("TEST_DATA_NOT_CANCELLED")).toContain("três Pedidos");
    expect(getSafeDeletionErrorMessage("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE")).toContain("exclusivamente");
  });

  it("does not expose unknown server errors", () => {
    expect(getSafeDeletionErrorMessage("INTERNAL_ERROR")).toBe("Não foi possível excluir o registro. Atualize os dados e tente novamente.");
    expect(getSafeDeletionErrorMessage("private database detail")).toBe("Não foi possível excluir o registro. Atualize os dados e tente novamente.");
  });
});
