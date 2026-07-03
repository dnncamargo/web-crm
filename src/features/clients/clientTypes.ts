export type ContactFrequency = "none" | "weekly" | "biweekly" | "monthly";

export type ContactType =
  | "whatsapp"
  | "telefone"
  | "instagram"
  | "email"
  | "outro";

export interface ClientContact {
  id: string;
  type: ContactType;
  value: string;
  label?: string;
  isPrimary: boolean;
}

export interface Client {
  id: string;

  name: string;
  active: boolean;
  favorite: boolean;

  birthDate?: string;
  contactFrequency: ContactFrequency;

  contacts: ClientContact[];

  primaryContactId?: string | null;
  primaryAddressId?: string | null;

  tagIds: string[];
  notes?: string;

  lastInteractionAt?: string;
  lastInteractionType?: "pedido" | "contato";
  lastOrderAt?: string;
  lastContactAt?: string;

  totalOrders?: number;
  totalSpent?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewClientData {
  name: string;
  active: boolean;
  favorite: boolean;
  birthDate?: string;
  contactFrequency: ContactFrequency;
  contacts: ClientContact[];
  primaryContactId?: string | null;
  primaryAddressId?: string | null;
  tagIds: string[];
  notes?: string;
}

export type UpdateClientData = Partial<NewClientData>;