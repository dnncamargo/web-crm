import { describe, expect, it } from "vitest";

import { SETTINGS_ITEMS } from "./settingsNavigation";

describe("settings home", () => {
  it("offers the canonical settings destinations in dependency order", () => {
    expect(SETTINGS_ITEMS.map((item) => item.label)).toEqual([
      "Perfil da loja",
      "Pix",
      "Aparência",
      "Impressoras",
    ]);
    expect(SETTINGS_ITEMS.map((item) => item.to)).toEqual([
      "/configuracoes/perfil-da-loja",
      "/configuracoes/pix",
      "/configuracoes/aparencia",
      "/configuracoes/impressoras",
    ]);
  });
});
