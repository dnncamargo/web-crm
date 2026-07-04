export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
}

export interface Task {
  id: string;

  title: string;
  description?: string;

  clientId?: string | null;
  clientName?: string | null;

  dueDate?: string | null;

  done: boolean;
  subtasks: Subtask[];

  tagIds: string[];

  convertedToOrderId?: string | null;

  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: string | null;
}

export interface NewTaskData {
  title: string;
  description?: string;

  clientId?: string | null;
  clientName?: string | null;

  dueDate?: string | null;

  done: boolean;
  subtasks: Subtask[];

  tagIds: string[];

  convertedToOrderId?: string | null;
  completedAt?: string | null;
}

export type UpdateTaskData = Partial<NewTaskData>;