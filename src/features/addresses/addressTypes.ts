export interface Address {
  id: string;

  label: string;

  cep?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state?: string;

  reference?: string;
  notes?: string;

  clientId?: string | null;
  clientName?: string | null;

  isPrimaryForClient?: boolean;

  active: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewAddressData {
  label: string;

  cep?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state?: string;

  reference?: string;
  notes?: string;

  clientId?: string | null;
  clientName?: string | null;

  isPrimaryForClient?: boolean;

  active: boolean;
}

export type UpdateAddressData = Partial<NewAddressData>;

export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}