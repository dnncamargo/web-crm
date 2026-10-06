import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./storeProfileService", () => ({
  getStoreProfile: vi.fn(),
  saveStoreProfile: vi.fn(),
}));

import { StoreProfilePage } from "./StoreProfilePage";

describe("StoreProfilePage layout", () => {
  it("renders the canonical two-column compact form", () => {
    const markup = renderToStaticMarkup(<StoreProfilePage />);

    for (const label of [
      "Nome fantasia *",
      "Razão social",
      "Documento",
      "Contato",
      "E-mail",
      "CEP",
      "Logradouro",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
    ]) {
      expect(markup).toContain(label);
    }

    const fieldOrder = [
      "Nome fantasia *",
      "Razão social",
      "Documento",
      "Contato",
      "E-mail",
      "CEP",
      "Logradouro",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
    ];

    const positions = fieldOrder.map((label) => markup.indexOf(label));

    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(markup).toContain('placeholder="CPF ou CNPJ"');
    expect(markup).toContain('type="tel"');
    expect(markup).toContain('type="email"');
    expect(markup.match(/class="panel-column"/g)).toHaveLength(2);
    expect(markup.match(/class="input-group single-column"/g)).toHaveLength(2);
    expect(markup).toContain('class="panel-columns panel-columns-2"');
    expect(markup).toContain('class="panel-footer store-profile-footer"');
  });
});
