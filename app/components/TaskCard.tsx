'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task } from '../utils/interfaces'
import { CheckIcon } from '@heroicons/react/24/outline'

interface Props {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}

export default function TaskCard({ task, onToggle, onDelete }: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}) {

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded shadow flex justify-items-stretch justify-between">
      {/* Checkbox */}
      <div
        className="mt-2 mr-2 gap-3 cursor-pointer"
        onClick={() => onToggle(task)}>
        <div
          className={`w-5 h-5 border-2 rounded 
            ${task.completed ? 'bg-[#e4544c] border-[#e4544c]' : 'border-gray-400'} 
            flex items-center justify-center`}>
          {task.completed && <CheckIcon className="w-4 h-4 text-white" />}
        </div>
      </div>
      <div>
        {/* Área de Texto */}
        <p className={`font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>
          {task.title}
        </p>
      </div>
      {/* Botão de Concluir */}
      {/* <button onClick={() => onToggle(task)} className="text-sm text-blue-500">
        {task.completed ? 'Desfazer' : 'Concluir'}
      </button> */}
      <button
        onClick={() => onDelete(task)}
        className="flex items-end text-xs text-gray-400 group-hover:opacity-100"
      >
        Excluir
      </button>
    </li>
  )
}
