import type { PixKeySource, PixRecipientType, PixSettings } from "./pixTypes";
import { resolvePixKeyValue } from "./pixTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";

export class PixDomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PixDomainValidationError";
  }
}

function normalizeTaxId(rawValue: string): string {
  const value = rawValue
    .trim()
    .replace(/[\s./-]/g, "")
    .toUpperCase();

  if (/^\d{11}$/.test(value)) {
    return value;
  }

  if (/^[A-Z0-9]{12}\d{2}$/.test(value)) {
    return value;
  }

  throw new PixDomainValidationError(
    "Documento Pix deve conter exatamente 11 dígitos (CPF) ou 14 caracteres alfanuméricos (CNPJ).",
  );
}

function normalizePhone(rawValue: string): string {
  const value = rawValue.trim().replace(/[\s().-]/g, "");
  const digits = value.startsWith("+") ? value.slice(1) : value;

  if (!/^\d+$/.test(digits)) {
    throw new PixDomainValidationError(
      "Telefone Pix deve conter somente um telefone celular brasileiro válido.",
    );
  }

  const hasCountryCode = digits.length === 13 && digits.startsWith("55");
  const localNumber = hasCountryCode ? digits.slice(2) : digits;

  if (!/^\d{2}9\d{8}$/.test(localNumber)) {
    throw new PixDomainValidationError(
      "Telefone Pix deve ter DDD e 11 dígitos de celular brasileiro.",
    );
  }

  if (value.startsWith("+") && !hasCountryCode) {
    throw new PixDomainValidationError(
      "Telefone Pix internacional deve usar o código de país +55.",
    );
  }

  return `+55${localNumber}`;
}

function normalizeEmail(rawValue: string): string {
  const value = rawValue.trim();

  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new PixDomainValidationError("E-mail Pix inválido.");
  }

  return value;
}

export function normalizePixKey(source: PixKeySource, rawValue: string): string {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new PixDomainValidationError("A chave Pix selecionada não foi informada no Perfil da loja.");
  }

  switch (source) {
    case "taxId":
      return normalizeTaxId(rawValue);
    case "phone":
      return normalizePhone(rawValue);
    case "email":
      return normalizeEmail(rawValue);
  }
}

export function normalizePixKeyForRecipient(
  recipientType: PixRecipientType,
  source: PixKeySource,
  rawValue: string,
): string {
  const normalized = normalizePixKey(source, rawValue);

  if (source !== "taxId") {
    return normalized;
  }

  if (recipientType === "person" && !/^\d{11}$/.test(normalized)) {
    throw new PixDomainValidationError(
      "Documento de Pessoa física deve ser um CPF com 11 dígitos.",
    );
  }

  if (recipientType === "business" && !/^[A-Z0-9]{12}\d{2}$/.test(normalized)) {
    throw new PixDomainValidationError(
      "Documento de Pessoa jurídica deve ser um CNPJ com 14 posições.",
    );
  }

  return normalized;
}

export function resolveNormalizedPixKey(
  settings: PixSettings,
  profile: StoreProfile,
): string {
  const rawValue = resolvePixKeyValue(settings, profile);

  if (!rawValue) {
    throw new PixDomainValidationError(
      settings.recipientType === "person"
        ? "A fonte da chave Pix selecionada não foi informada no recebedor Pessoa física."
        : "A fonte da chave Pix selecionada não foi informada no Perfil da loja.",
    );
  }

  return normalizePixKeyForRecipient(settings.recipientType, settings.keySource, rawValue);
}
