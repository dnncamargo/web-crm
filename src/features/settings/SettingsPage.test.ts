import { describe, expect, it } from "vitest";

import { SETTINGS_ITEMS } from "./settingsNavigation";

describe("settings home", () => {
  it("offers the canonical store profile, appearance and printer destinations", () => {
    expect(SETTINGS_ITEMS.map((item) => item.label)).toEqual([
      "Perfil da loja",
      "Aparência",
      "Impressoras",
    ]);
    expect(SETTINGS_ITEMS.map((item) => item.to)).toEqual([
      "/configuracoes/perfil-da-loja",
      "/configuracoes/aparencia",
      "/configuracoes/impressoras",
    ]);
  });
});
