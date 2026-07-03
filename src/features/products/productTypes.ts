export interface Product {
  id: string;

  name: string;

  categoryId?: string | null;
  categoryLabel?: string | null;

  unit?: string;
  suggestedPrice?: number | null;

  active: boolean;
  tagIds: string[];
  notes?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewProductData {
  name: string;

  categoryId?: string | null;
  categoryLabel?: string | null;

  unit?: string;
  suggestedPrice?: number | null;

  active: boolean;
  tagIds: string[];
  notes?: string;
}

export type UpdateProductData = Partial<NewProductData>;