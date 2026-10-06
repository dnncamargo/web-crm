import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({
    value,
    size,
    marginSize,
    title,
  }: {
    value: string;
    size: number;
    marginSize: number;
    title: string;
  }) => (
    <svg
      data-payload={value}
      data-size={size}
      data-margin-size={marginSize}
      aria-label={title}
    />
  ),
}));

vi.mock("./pixService", () => ({
  savePixSettings: vi.fn(),
  subscribeToPixSettings: vi.fn(),
}));

vi.mock("../store-profile/storeProfileService", () => ({
  subscribeToStoreProfile: vi.fn(),
}));

import { PixPage } from "./PixPage";
import { PixQrCode } from "./components/PixQrCode";
import { createStaticPixPayloadFromSettings } from "./pixBrCode";
import { derivePixPreview } from "./pixPreview";

const validProfile = {
  displayName: "Loja",
  taxId: "12.345.678/0001-90",
  address: { city: "Saquarema" },
};

describe("PixPage layout", () => {
  it("renders a source selector and read-only value preview", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter><PixPage /></MemoryRouter>,
    );

    expect(markup).toContain("Pix");
    expect(markup).toContain("Configure os dados usados para pagamentos via Pix.");
    expect(markup).toContain("Recebedor");
    expect(markup).toContain("Pessoa jurídica");
    expect(markup).toContain("Pessoa física");
    expect(markup).toContain("Chave Pix");
    expect(markup).toContain('id="pix-key-source"');
    expect(markup).toContain("Selecione...");
    expect(markup).toContain("Documento");
    expect(markup).toContain("Telefone");
    expect(markup).toContain("E-mail");
    expect(markup).toContain("Valor utilizado");
    expect(markup).toContain("Pagamento Pix");
    expect(markup).toContain("Nenhuma fonte selecionada.");
    expect(markup).toContain("Salvar");
    expect(markup).not.toContain("Pix Copia e Cola");
    expect(markup).not.toContain("Copiar código Pix");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("data-payload");
  });

  it("derives one payload for a valid Pix preview", () => {
    const settings = { recipientType: "business" as const, keySource: "taxId" as const };
    const expectedPayload = createStaticPixPayloadFromSettings({
      settings,
      profile: validProfile,
    });

    expect(derivePixPreview(settings, validProfile)).toEqual({
      payload: expectedPayload,
      error: "",
    });
  });

  it("does not produce a payload for invalid Store Profile data", () => {
    const result = derivePixPreview(
      { recipientType: "business", keySource: "taxId" },
      { ...validProfile, taxId: "documento inválido" },
    );

    expect(result.payload).toBeNull();
    expect(result.error).toContain("Documento Pix");
  });

  it("does not produce a payload without a selected source", () => {
    expect(derivePixPreview(null, validProfile)).toEqual({
      payload: null,
      error: "",
    });
  });

  it("updates the preview payload when the selected source changes", () => {
    const profile = { ...validProfile, email: "pix@loja.com" };
    const documentPayload = derivePixPreview({ recipientType: "business", keySource: "taxId" }, profile).payload;
    const emailPayload = derivePixPreview({ recipientType: "business", keySource: "email" }, profile).payload;

    expect(documentPayload).not.toBeNull();
    expect(emailPayload).not.toBeNull();
    expect(emailPayload).not.toBe(documentPayload);
  });

  it("derives a Person preview from the Pix-specific recipient", () => {
    const result = derivePixPreview({
      recipientType: "person",
      keySource: "email",
      personRecipient: {
        name: "Ana Silva",
        email: "ana@exemplo.com",
        city: "Campos",
      },
    }, validProfile);

    expect(result.error).toBe("");
    expect(result.payload).toContain("ana@exemplo.com");
    expect(result.payload).toContain("Ana Silva");
  });

  it("reports missing Person configuration without exposing a QR", () => {
    const result = derivePixPreview({
      recipientType: "person",
      keySource: "phone",
      personRecipient: { name: "", city: "", phone: "" },
    }, validProfile);

    expect(result.payload).toBeNull();
    expect(result.error).toContain("Telefone não informado no recebedor Pessoa física");
  });

  it("passes the exact payload and the four-module quiet zone to QRCodeSVG", () => {
    const payload = "0002016304ABCD";
    const markup = renderToStaticMarkup(<PixQrCode payload={payload} />);

    expect(markup).toContain(`data-payload="${payload}"`);
    expect(markup).toContain('data-margin-size="4"');
    expect(markup).toContain('aria-label="QR Code Pix"');
  });

  it("renders the QR preview without exposing raw payload UI", () => {
    const payload = "0002016304ABCD";
    const markup = renderToStaticMarkup(<PixQrCode payload={payload} />);

    expect(markup).toContain(`data-payload="${payload}"`);
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Copiar código Pix");
  });
});
