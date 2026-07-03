export type TagEntity = "client" | "product" | "order" | "task" | "global";

export interface Tag {
  id: string;

  label: string;
  slug: string;

  entity: TagEntity;
  group?: string;

  active: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewTagData {
  label: string;
  slug: string;
  entity: TagEntity;
  group?: string;
  active: boolean;
}

export type UpdateTagData = Partial<NewTagData>;