import type { PixPersonRecipient, PixSettings } from "./pixTypes";
import {
  PixDomainValidationError,
  resolveNormalizedPixKey,
} from "./pixKeyNormalization";
import type { StoreProfile } from "../store-profile/storeProfileTypes";

const PIX_GUI = "br.gov.bcb.pix";
const DEFAULT_TXID = "***";
const MAX_TLV_VALUE_BYTES = 99;

export interface StaticPixBrCodeInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function encodeTlv(id: string, value: string): string {
  if (!/^\d{2}$/.test(id)) {
    throw new PixDomainValidationError("Identificador BR Code deve conter dois dígitos.");
  }

  const byteLength = getUtf8ByteLength(value);
  if (byteLength > MAX_TLV_VALUE_BYTES) {
    throw new PixDomainValidationError(
      `Valor do campo BR Code ${id} excede o limite de 99 bytes.`,
    );
  }

  return `${id}${String(byteLength).padStart(2, "0")}${value}`;
}

export function calculateCrc16CcittFalse(value: string): string {
  let crc = 0xffff;

  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizePayloadText(value: string, fieldName: string, maxLength: number): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized || !/^[\x20-\x7E]+$/.test(normalized)) {
    throw new PixDomainValidationError(`${fieldName} contém caracteres incompatíveis com o BR Code.`);
  }

  if (normalized.length > maxLength) {
    throw new PixDomainValidationError(
      `${fieldName} deve conter no máximo ${maxLength} caracteres.`,
    );
  }

  return normalized;
}

function resolveMerchantCity(profile: StoreProfile): string {
  const city = profile.address?.city;

  if (city === undefined || !city.trim()) {
    throw new PixDomainValidationError(
      "Informe a cidade no Perfil da loja para gerar o BR Code.",
    );
  }

  return normalizePayloadText(city, "Cidade do recebedor", 15);
}

export interface PixRecipientProjection {
  key: string;
  merchantName: string;
  merchantCity: string;
}

function resolvePersonRecipient(settings: PixSettings): PixPersonRecipient {
  if (!settings.personRecipient) {
    throw new PixDomainValidationError(
      "Configure o recebedor Pessoa física para gerar o BR Code.",
    );
  }

  if (!settings.personRecipient.name.trim()) {
    throw new PixDomainValidationError(
      "Informe o nome do recebedor Pessoa física para gerar o BR Code.",
    );
  }

  if (!settings.personRecipient.city.trim()) {
    throw new PixDomainValidationError(
      "Informe a cidade do recebedor Pessoa física para gerar o BR Code.",
    );
  }

  return settings.personRecipient;
}

export function resolvePixRecipient(
  settings: PixSettings,
  profile: StoreProfile,
): PixRecipientProjection {
  const personRecipient = settings.recipientType === "person"
    ? resolvePersonRecipient(settings)
    : null;

  return {
    key: resolveNormalizedPixKey(settings, profile),
    merchantName: personRecipient?.name ?? profile.displayName,
    merchantCity: personRecipient?.city ?? resolveMerchantCity(profile),
  };
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new PixDomainValidationError("Valor Pix deve ser um número finito e não negativo.");
  }

  const rawCents = amount * 100;

  if (!Number.isFinite(rawCents)) {
    throw new PixDomainValidationError("Valor Pix deve ter no máximo 10 dígitos antes da casa decimal.");
  }

  const cents = Math.round(rawCents);
  const floatingPointTolerance = Number.EPSILON * Math.max(1, Math.abs(rawCents)) * 16;

  if (Math.abs(rawCents - cents) > floatingPointTolerance) {
    throw new PixDomainValidationError("Valor Pix deve ter no máximo duas casas decimais.");
  }

  const integerPart = Math.floor(cents / 100);

  if (String(integerPart).length > 10) {
    throw new PixDomainValidationError("Valor Pix deve ter no máximo 10 dígitos antes da casa decimal.");
  }

  return `${integerPart}.${String(cents % 100).padStart(2, "0")}`;
}

function normalizeTxid(txid: string | undefined): string {
  if (txid === undefined || txid === "") {
    return DEFAULT_TXID;
  }

  if (!/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new PixDomainValidationError(
      "TXID deve conter de 1 a 25 caracteres alfanuméricos, sem espaços ou símbolos.",
    );
  }

  return txid;
}

export function createStaticPixPayload(input: StaticPixBrCodeInput): string {
  if (!input.key.trim()) {
    throw new PixDomainValidationError("Chave Pix é obrigatória para gerar o BR Code.");
  }

  const merchantAccountInformation = [
    encodeTlv("00", PIX_GUI),
    encodeTlv("01", input.key),
  ].join("");
  const additionalData = encodeTlv("05", normalizeTxid(input.txid));

  const fields = [
    encodeTlv("00", "01"),
    encodeTlv("26", merchantAccountInformation),
    encodeTlv("52", "0000"),
    encodeTlv("53", "986"),
    input.amount === undefined ? "" : encodeTlv("54", formatAmount(input.amount)),
    encodeTlv("58", "BR"),
    encodeTlv("59", normalizePayloadText(input.merchantName, "Nome do recebedor", 25)),
    encodeTlv("60", normalizePayloadText(input.merchantCity, "Cidade do recebedor", 15)),
    encodeTlv("62", additionalData),
  ].join("");
  const payloadWithCrcPlaceholder = `${fields}6304`;

  return `${payloadWithCrcPlaceholder}${calculateCrc16CcittFalse(payloadWithCrcPlaceholder)}`;
}

export interface StaticPixPayloadFromSettingsInput {
  settings: PixSettings;
  profile: StoreProfile;
  amount?: number;
  txid?: string;
}

export function createStaticPixPayloadFromSettings(
  input: StaticPixPayloadFromSettingsInput,
): string {
  const projection = resolvePixRecipient(input.settings, input.profile);

  return createStaticPixPayload({
    key: projection.key,
    merchantName: projection.merchantName,
    merchantCity: projection.merchantCity,
    amount: input.amount,
    txid: input.txid,
  });
}
