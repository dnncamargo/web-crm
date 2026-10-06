import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pixService", () => ({
  savePixSettings: vi.fn(),
  subscribeToPixSettings: vi.fn(),
}));

vi.mock("../store-profile/storeProfileService", () => ({
  subscribeToStoreProfile: vi.fn(),
}));

import { PixPage } from "./PixPage";

describe("PixPage layout", () => {
  it("renders a source selector and read-only value preview", () => {
    const markup = renderToStaticMarkup(<PixPage />);

    expect(markup).toContain("Pix");
    expect(markup).toContain("Configure os dados usados para pagamentos via Pix.");
    expect(markup).toContain("Chave Pix");
    expect(markup).toContain('id="pix-key-source"');
    expect(markup).toContain("Selecione...");
    expect(markup).toContain("Documento");
    expect(markup).toContain("Telefone");
    expect(markup).toContain("E-mail");
    expect(markup).toContain("Valor utilizado");
    expect(markup).toContain("Nenhuma fonte selecionada.");
    expect(markup).toContain("Salvar");
  });
});
