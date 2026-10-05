import { describe, expect, it } from "vitest";

import { SETTINGS_ITEMS } from "./settingsNavigation";

describe("settings home", () => {
  it("offers only the canonical appearance and printer destinations", () => {
    expect(SETTINGS_ITEMS.map((item) => item.label)).toEqual(["Aparência", "Impressoras"]);
    expect(SETTINGS_ITEMS.map((item) => item.to)).toEqual([
      "/configuracoes/aparencia",
      "/configuracoes/impressoras",
    ]);
  });
});
