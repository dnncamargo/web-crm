import { describe, expect, it } from "vitest";

import {
  calculateCrc16CcittFalse,
  createStaticPixPayload,
  createStaticPixPayloadFromSettings,
  encodeTlv,
} from "./pixBrCode";
import { PixDomainValidationError } from "./pixKeyNormalization";
import type { StoreProfile } from "../store-profile/storeProfileTypes";

const goldenInput = {
  key: "123e4567-e12b-12d1-a456-426655440000",
  merchantName: "Fulano de Tal",
  merchantCity: "BRASILIA",
};

describe("BR Code primitives", () => {
  it("encodes primitive and nested TLV fields with their exact lengths", () => {
    expect(encodeTlv("00", "01")).toBe("000201");
    expect(encodeTlv("26", "0004test0103abc")).toBe("26150004test0103abc");
  });

  it("calculates the CRC-16/CCITT-FALSE golden vector", () => {
    expect(calculateCrc16CcittFalse(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304",
    )).toBe("1D3D");
  });
});

describe("static Pix BR Code payload", () => {
  it("matches the official Banco Central static QR Code example", () => {
    expect(createStaticPixPayload(goldenInput)).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("omits amount when absent and formats a supplied amount with two decimals", () => {
    const withoutAmount = createStaticPixPayload(goldenInput);
    const withAmount = createStaticPixPayload({ ...goldenInput, amount: 10 });

    expect(withoutAmount).not.toContain("5406");
    expect(withAmount).toContain("540510.00");
  });

  it("accepts valid custom txids and rejects invalid or overlong values", () => {
    expect(createStaticPixPayload({ ...goldenInput, txid: "ORDER123" })).toContain("62120508ORDER123");
    expect(() => createStaticPixPayload({ ...goldenInput, txid: "ORDER-123" }))
      .toThrow(PixDomainValidationError);
    expect(() => createStaticPixPayload({ ...goldenInput, txid: "12345678901234567890123456" }))
      .toThrow(PixDomainValidationError);
  });

  it("rejects invalid amounts and merchant field lengths", () => {
    expect(() => createStaticPixPayload({ ...goldenInput, amount: -1 })).toThrow(
      "não negativo",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, merchantName: "X".repeat(26) }))
      .toThrow("no máximo 25 caracteres");
    expect(() => createStaticPixPayload({ ...goldenInput, merchantCity: "X".repeat(16) }))
      .toThrow("no máximo 15 caracteres");
  });

  it("rejects genuine fractions of a cent without rejecting arithmetic noise", () => {
    expect(() => createStaticPixPayload({ ...goldenInput, amount: 12.345 })).toThrow(
      "duas casas decimais",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, amount: 1.005 })).toThrow(
      "duas casas decimais",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, amount: 0.001 })).toThrow(
      "duas casas decimais",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, amount: Number.NaN })).toThrow(
      "não negativo",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, amount: Number.POSITIVE_INFINITY })).toThrow(
      "não negativo",
    );
    expect(() => createStaticPixPayload({ ...goldenInput, amount: Number.MAX_VALUE })).toThrow(
      "10 dígitos",
    );

    expect(createStaticPixPayload({ ...goldenInput, amount: 0.1 + 0.2 })).toContain("54040.30");
    expect(createStaticPixPayload({ ...goldenInput, amount: 12.34 })).toContain("540512.34");
  });

  it("composes profile and settings without changing persisted values", () => {
    const profile: StoreProfile = {
      displayName: "Loja de Exemplo",
      legalName: "  Empresa Legal LTDA ",
      taxId: "12.ABC.345/01DE-35",
      phone: "22 99999-9999",
      email: "contato@exemplo.com",
      address: { city: "São José" },
    };

    const payload = createStaticPixPayloadFromSettings({
      settings: { keySource: "taxId" },
      profile,
    });

    expect(payload).toContain("011412ABC34501DE35");
    expect(payload).toContain("5918Empresa Legal LTDA");
    expect(payload).toContain("6008Sao Jose");
    expect(profile.taxId).toBe("12.ABC.345/01DE-35");
  });

  it.each([
    ["taxId", "12.345.678/0001-90", "12345678000190"],
    ["phone", "(22) 99999-9999", "+5522999999999"],
    ["email", "contato@exemplo.com", "contato@exemplo.com"],
  ] as const)("composes the selected %s source", (source, value, normalizedValue) => {
    const profile: StoreProfile = {
      displayName: "Loja",
      [source]: value,
      address: { city: "Campos" },
    };

    expect(createStaticPixPayloadFromSettings({ settings: { keySource: source }, profile }))
      .toContain(normalizedValue);
  });

  it("uses displayName when legalName is absent", () => {
    const payload = createStaticPixPayloadFromSettings({
      settings: { keySource: "email" },
      profile: {
        displayName: "Loja Pública",
        email: "contato@exemplo.com",
        address: { city: "Campos" },
      },
    });

    expect(payload).toContain("5912Loja Publica");
  });

  it("requires a city in the Store Profile", () => {
    expect(() => createStaticPixPayloadFromSettings({
      settings: { keySource: "email" },
      profile: { displayName: "Loja", email: "contato@exemplo.com" },
    })).toThrow("cidade no Perfil da loja");
  });
});
