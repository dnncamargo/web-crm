'use client';

import { useState, KeyboardEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TaskItem } from '../../../types/optionalFields';

interface TaskListFieldProps {
  label: string;
  value: TaskItem[];
  onChange: (newValue: TaskItem[]) => void;
  onLabelChange: (newValue: string) => void;
}

export default function TaskListField({
  label,
  value = [],
  onChange,
  onLabelChange
}: TaskListFieldProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const toggleDone = (id: string) => {
    const updated = value.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    onChange(updated);
  };

  const updateTaskText = (id: string, title: string) => {
    const updated = value.map(task =>
      task.id === id ? { ...task, title } : task
    );
    onChange(updated);
  };

  const deleteTask = (id: string) => {
    onChange(value.filter(task => task.id !== id));
  };

  const addEmptyTask = () => {
    const newTask: TaskItem = {
      id: uuidv4(),
      text: '',
      done: false
    };
    onChange([...value, newTask]);
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
        {/* Label editável */}
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="font-semibold text-sm bg-gray-50 text-gray-700 mb-2 p-1 w-full"
          placeholder="Lista de Tarefas"
        />
        {value.map(task => (
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
              onClick={(e) => {
                e.preventDefault();
                deleteTask(task.id)
              }}
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
