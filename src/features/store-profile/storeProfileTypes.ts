export interface StoreProfileAddress {
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface StoreProfile {
  displayName: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: StoreProfileAddress;
}

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  displayName: "Delícias do Porto",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function normalizeAddress(value: unknown): StoreProfileAddress | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const address: StoreProfileAddress = {
    postalCode: normalizeOptionalString(value.postalCode),
    street: normalizeOptionalString(value.street),
    number: normalizeOptionalString(value.number),
    complement: normalizeOptionalString(value.complement),
    neighborhood: normalizeOptionalString(value.neighborhood),
    city: normalizeOptionalString(value.city),
    state: normalizeOptionalString(value.state),
  };

  const hasAddressValue = Object.values(address).some((field) => field !== undefined);
  return hasAddressValue ? address : undefined;
}

export function normalizeStoreProfile(value: unknown): StoreProfile {
  const data = isRecord(value) ? value : {};

  return {
    displayName: normalizeOptionalString(data.displayName) ?? DEFAULT_STORE_PROFILE.displayName,
    legalName: normalizeOptionalString(data.legalName),
    taxId: normalizeOptionalString(data.taxId),
    phone: normalizeOptionalString(data.phone),
    email: normalizeOptionalString(data.email),
    address: normalizeAddress(data.address),
  };
}

export function normalizeStoreProfileForSave(profile: StoreProfile): StoreProfile {
  const displayName = profile.displayName.trim();

  if (!displayName) {
    throw new Error("Informe o nome da loja.");
  }

  return {
    displayName,
    legalName: normalizeOptionalString(profile.legalName),
    taxId: normalizeOptionalString(profile.taxId),
    phone: normalizeOptionalString(profile.phone),
    email: normalizeOptionalString(profile.email),
    address: normalizeAddress(profile.address),
  };
}
