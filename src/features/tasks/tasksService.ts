import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import type { NewTaskData, Task, UpdateTaskData } from "./taskTypes";

const tasksCollection = collection(db, "tasks");

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields) as T;
  }

  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}

export function listenTasks(
  onChange: (tasks: Task[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const tasksQuery = query(tasksCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    tasksQuery,
    (snapshot) => {
      const tasks = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Task[];

      onChange(tasks);
    },
    onError
  );
}

export async function createTask(data: NewTaskData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(tasksCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(taskId: string, data: UpdateTaskData) {
  const taskRef = doc(db, "tasks", taskId);
  const cleanedData = removeUndefinedFields(data);

  return updateDoc(taskRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleTaskDone(
  taskId: string,
  done: boolean,
  completedAt: string | null
) {
  const taskRef = doc(db, "tasks", taskId);

  return updateDoc(taskRef, {
    done,
    completedAt,
    updatedAt: serverTimestamp(),
  });
}