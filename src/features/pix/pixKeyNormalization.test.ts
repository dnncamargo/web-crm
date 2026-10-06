import { describe, expect, it } from "vitest";

import {
  normalizePixKey,
  PixDomainValidationError,
  resolveNormalizedPixKey,
} from "./pixKeyNormalization";

describe("Pix key normalization", () => {
  it("normalizes numeric CPF and CNPJ without presentation punctuation", () => {
    expect(normalizePixKey("taxId", "123.456.789-00")).toBe("12345678900");
    expect(normalizePixKey("taxId", "12.345.678/0001-90")).toBe("12345678000190");
  });

  it("preserves alphanumeric CNPJ characters and uppercases them", () => {
    expect(normalizePixKey("taxId", "12.ABC.345/01DE-35")).toBe("12ABC34501DE35");
    expect(() => normalizePixKey("taxId", "12ABC34501DEAB")).toThrow(PixDomainValidationError);
  });

  it("normalizes local and international Brazilian mobile phones", () => {
    expect(normalizePixKey("phone", "22 99999-9999")).toBe("+5522999999999");
    expect(normalizePixKey("phone", "+55 22 99999-9999")).toBe("+5522999999999");
    expect(normalizePixKey("phone", "5522999999999")).toBe("+5522999999999");
    expect(normalizePixKey("phone", "55 99999-9999")).toBe("+5555999999999");
  });

  it("rejects malformed phones", () => {
    expect(() => normalizePixKey("phone", "22 9999-9999")).toThrow(PixDomainValidationError);
    expect(() => normalizePixKey("phone", "+1 22 99999-9999")).toThrow(PixDomainValidationError);
  });

  it("trims but otherwise preserves a valid e-mail address", () => {
    expect(normalizePixKey("email", " contato@Exemplo.com ")).toBe("contato@Exemplo.com");
    expect(() => normalizePixKey("email", "sem-email")).toThrow("E-mail Pix inválido.");
  });

  it("rejects an absent selected value", () => {
    expect(() => resolveNormalizedPixKey({ keySource: "email" }, { displayName: "Loja" }))
      .toThrow("não foi informada no Perfil da loja");
  });
});
