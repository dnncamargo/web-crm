import type { Task } from "./taskTypes";

export type TaskDueStatus = "done" | "overdue" | "today" | "future" | "no-date";

export function formatTaskDateBR(value?: string | null) {
  if (!value) {
    return "Sem prazo";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function getTodayDateKey() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTaskDueStatus(task: Task): TaskDueStatus {
  if (task.done) {
    return "done";
  }

  if (!task.dueDate) {
    return "no-date";
  }

  const todayKey = getTodayDateKey();

  if (task.dueDate < todayKey) {
    return "overdue";
  }

  if (task.dueDate === todayKey) {
    return "today";
  }

  return "future";
}

export function getTaskDueStatusLabel(status: TaskDueStatus) {
  const labels: Record<TaskDueStatus, string> = {
    done: "Concluída",
    overdue: "Atrasada",
    today: "Hoje",
    future: "Agendada",
    "no-date": "Sem prazo",
  };

  return labels[status];
}

export function getSubtaskProgress(task: Pick<Task, "subtasks">) {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((subtask) => subtask.done).length;

  return {
    done,
    total,
    label: `${done}/${total}`,
  };
}