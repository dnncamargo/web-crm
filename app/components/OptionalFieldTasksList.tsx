import { useState } from 'react';

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
  const [newTaskText, setNewTaskText] = useState('');

  const toggleDone = (id: string) => {
    onChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTask = (id: string) => {
    onChange(tasks.filter(t => t.id !== id));
  };

  const editTask = (id: string, newText: string) => {
    onChange(tasks.map(t => t.id === id ? { ...t, text: newText } : t));
  };

  const addTask = () => {
    if (newTaskText.trim() === '') return;
    onChange([...tasks, { id: crypto.randomUUID(), text: newTaskText.trim(), done: false }]);
    setNewTaskText('');
  };

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className="flex items-center gap-2">
          <button onClick={(e) => {toggleDone(task.id)}} className="text-lg">
            {task.done ? '✔️' : '🔲'}
          </button>
          <input
            value={task.text}
            onChange={e => editTask(task.id, e.target.value)}
            className="flex-1 bg-transparent border-b border-gray-300 px-1 text-sm"
          />
          <button onClick={(e) => { removeTask(task.id)}} className="text-red-500 text-sm">Remover</button>
        </div>
      ))}

      <div className="flex items-center gap-2 mt-2">
        <input
          value={newTaskText}
          onChange={e => setNewTaskText(e.target.value)}
          placeholder="Nova tarefa"
          className="flex-1 border px-2 py-1 text-sm"
        />
        <button onClick={(e) => {e.preventDefault(); addTask();}} className="text-blue-600 text-sm font-medium">Adicionar</button>
      </div>
    </div>
  );
}
