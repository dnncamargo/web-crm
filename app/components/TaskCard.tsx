'use client'

import { Task } from '../utils/interfaces'

interface Props {
  task: Task
  onToggleComplete: (task: Task) => void
}

export default function TaskCard({ task, onToggleComplete }: Props) {
  return (
    <li className="bg-white p-3 rounded shadow flex items-center justify-between">
      <div>
        <p className={`font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>
          {task.title}
        </p>
      </div>
      <button onClick={() => onToggleComplete(task)} className="text-sm text-blue-500">
        {task.completed ? 'Desfazer' : 'Concluir'}
      </button>
    </li>
  )
}
