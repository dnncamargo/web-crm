import { useEffect, useMemo, useState } from "react";

import type { NewTaskData, Task, UpdateTaskData } from "./taskTypes";
import {
  createTask,
  listenTasks,
  toggleTaskDone,
  updateTask,
} from "./tasksService";

export function useTasks(tagLabelsById: Record<string, string> = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyOpen, setShowOnlyOpen] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  useEffect(() => {
    const unsubscribe = listenTasks(
      (loadedTasks) => {
        setTasks(loadedTasks);
        setLoadingTasks(false);
      },
      (firebaseError) => {
        setTasksError(firebaseError.message);
        setLoadingTasks(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (showOnlyOpen && task.done) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const tagLabels = (task.tagIds ?? []).map(
          (tagId) => tagLabelsById[tagId] ?? tagId
        );

        const searchableText = [
          task.title,
          task.description,
          task.clientName,
          task.dueDate,
          ...tagLabels,
          ...(task.tagIds ?? []),
          ...task.subtasks.map((subtask) => subtask.title),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .sort((firstTask, secondTask) => {
        if (firstTask.done !== secondTask.done) {
          return firstTask.done ? 1 : -1;
        }

        if (!firstTask.dueDate && secondTask.dueDate) {
          return 1;
        }

        if (firstTask.dueDate && !secondTask.dueDate) {
          return -1;
        }

        if (firstTask.dueDate && secondTask.dueDate) {
          return firstTask.dueDate.localeCompare(secondTask.dueDate);
        }

        return firstTask.title.localeCompare(secondTask.title);
      });
  }, [tasks, search, showOnlyOpen, tagLabelsById]);

  async function addTask(data: NewTaskData) {
    await createTask(data);
  }

  async function editTask(taskId: string, data: UpdateTaskData) {
    await updateTask(taskId, data);
  }

  async function setTaskDone(task: Task, done: boolean) {
    await toggleTaskDone(task.id, done, done ? new Date().toISOString() : null);
  }

  return {
    tasks,
    filteredTasks,
    search,
    setSearch,
    showOnlyOpen,
    setShowOnlyOpen,
    loadingTasks,
    tasksError,
    addTask,
    editTask,
    setTaskDone,
  };
}