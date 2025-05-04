'use client';

import { useState, KeyboardEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';

type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

type Props = {
  tasks: TaskItem[];
  onChange: (newTasks: TaskItem[]) => void;
};

export function OptionalFieldTasksList({ tasks, onChange }: Props) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const toggleDone = (id: string) => {
    onChange(tasks.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    ));
  };

  const updateTaskText = (id: string, text: string) => {
    onChange(tasks.map(task =>
      task.id === id ? { ...task, text } : task
    ));
  };

  const deleteTask = (id: string) => {
    onChange(tasks.filter(task => task.id !== id));
  };

  const addEmptyTask = () => {
    const newTaskId = uuidv4();
    onChange([...tasks, { id: newTaskId, text: '', done: false }]);
    setEditingTaskId(newTaskId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, taskId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingTaskId(null);
    }
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {tasks.map(task => (
          <li key={task.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task.id)}
              className="h-4 w-4 text-green-600"
            />
            <input
              type="text"
              value={task.text}
              onChange={e => updateTaskText(task.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, task.id)}
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
              placeholder="Descrição da tarefa"
              autoFocus={editingTaskId === task.id}
            />
            <button
              onClick={() => deleteTask(task.id)}
              className="text-red-500 text-xs"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={(e) => {
          e.preventDefault();
          addEmptyTask();
        }}
        className="text-blue-600 text-sm underline mt-2"
      >
        + Nova tarefa
      </button>
    </div>
  );
}
