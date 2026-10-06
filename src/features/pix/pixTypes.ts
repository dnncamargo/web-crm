import type { StoreProfile } from "../store-profile/storeProfileTypes";

export type PixKeySource = "taxId" | "phone" | "email";

export interface PixSettings {
  keySource: PixKeySource;
}

export const PIX_KEY_SOURCES = ["taxId", "phone", "email"] as const;

export const PIX_KEY_SOURCE_LABELS: Record<PixKeySource, string> = {
  taxId: "Documento",
  phone: "Telefone",
  email: "E-mail",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPixKeySource(value: unknown): value is PixKeySource {
  return PIX_KEY_SOURCES.some((source) => source === value);
}

export function normalizePixSettings(value: unknown): PixSettings | null {
  if (!isRecord(value) || !isPixKeySource(value.keySource)) {
    return null;
  }

  return { keySource: value.keySource };
}

export function resolvePixKeyValue(
  settings: PixSettings | null,
  profile: StoreProfile,
): string | null {
  if (!settings) {
    return null;
  }

  const value = profile[settings.keySource];
  return typeof value === "string" && value.trim() ? value : null;
}
