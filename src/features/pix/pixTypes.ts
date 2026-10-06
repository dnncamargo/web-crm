import type { StoreProfile } from "../store-profile/storeProfileTypes";

export type PixKeySource = "taxId" | "phone" | "email";
export type PixRecipientType = "business" | "person";

export interface PixPersonRecipient {
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  city: string;
}

export interface PixSettings {
  recipientType: PixRecipientType;
  keySource: PixKeySource;
  personRecipient?: PixPersonRecipient;
}

export const PIX_KEY_SOURCES = ["taxId", "phone", "email"] as const;
export const PIX_RECIPIENT_TYPES = ["business", "person"] as const;

export const PIX_KEY_SOURCE_LABELS: Record<PixKeySource, string> = {
  taxId: "Documento",
  phone: "Telefone",
  email: "E-mail",
};

export const PIX_RECIPIENT_TYPE_LABELS: Record<PixRecipientType, string> = {
  business: "Pessoa jurídica",
  person: "Pessoa física",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPixKeySource(value: unknown): value is PixKeySource {
  return PIX_KEY_SOURCES.some((source) => source === value);
}

export function isPixRecipientType(value: unknown): value is PixRecipientType {
  return PIX_RECIPIENT_TYPES.some((recipientType) => recipientType === value);
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function normalizePersonRecipient(value: unknown): PixPersonRecipient | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = normalizeOptionalString(value.name);
  const city = normalizeOptionalString(value.city);
  const taxId = normalizeOptionalString(value.taxId);
  const phone = normalizeOptionalString(value.phone);
  const email = normalizeOptionalString(value.email);

  if (!name && !city && !taxId && !phone && !email) {
    return undefined;
  }

  return {
    name: name ?? "",
    city: city ?? "",
    ...(taxId ? { taxId } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

export function normalizePixSettings(value: unknown): PixSettings | null {
  if (!isRecord(value) || !isPixKeySource(value.keySource)) {
    return null;
  }

  if (value.recipientType !== undefined && !isPixRecipientType(value.recipientType)) {
    return null;
  }

  const personRecipient = normalizePersonRecipient(value.personRecipient);

  return {
    recipientType: value.recipientType === undefined ? "business" : value.recipientType,
    keySource: value.keySource,
    ...(personRecipient ? { personRecipient } : {}),
  };
}

export function resolvePixKeyValue(
  settings: PixSettings | null,
  profile: StoreProfile,
): string | null {
  if (!settings) {
    return null;
  }

  const recipient = settings.recipientType === "person"
    ? settings.personRecipient
    : profile;

  if (!recipient) {
    return null;
  }

  const value = settings.keySource === "taxId"
    ? recipient.taxId
    : settings.keySource === "phone"
      ? recipient.phone
      : recipient.email;
  return typeof value === "string" && value.trim() ? value : null;
}
