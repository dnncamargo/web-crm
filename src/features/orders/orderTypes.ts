export type OrderStatus = "active" | "completed" | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface OrderAddressSnapshot {
  label: string;
  cep?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state?: string;
  reference?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
  notes?: string;
  tagIds?: string[];
}

export interface Order {
  id: string;

  clientId: string;
  clientName: string;

  addressId?: string | null;
  addressSnapshot?: OrderAddressSnapshot | null;

  deliveryDateTime: string;

  items: OrderItem[];

  subtotal: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;

  creditApplied?: number | null;
  creditGenerated?: number | null;

  orderStatus: OrderStatus;

  notes?: string;
  tagIds: string[];

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewOrderData {
  clientId: string;
  clientName: string;

  addressId?: string | null;
  addressSnapshot?: OrderAddressSnapshot | null;

  deliveryDateTime: string;
  items: OrderItem[];

  subtotal: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;

  creditApplied?: number | null;
  creditGenerated?: number | null;

  orderStatus: OrderStatus;
  notes?: string;
  tagIds: string[];
}

export type UpdateOrderData = Partial<NewOrderData>;
