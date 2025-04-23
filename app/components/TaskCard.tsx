'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task } from '../utils/interfaces'
import { CheckIcon, Bars3Icon } from '@heroicons/react/24/outline'

interface Props {
  task: Task
  onToggle: (task: Task) => void
  onUpdate: (task: Task, newContent: string) => void
  onDelete: (task: Task) => void
}

export default function TaskCard({ task, onToggle, onUpdate, onDelete }: {
  task: Task
  onToggle: (task: Task) => void
  onUpdate: (task: Task, newContent: string) => void
  onDelete: (task: Task) => void
}) {

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.content)

  const handleEdit = () => setIsEditing(true)

  const { attributes, listeners, setNodeRef, transform, transition, setActivatorNodeRef } = useSortable({ id: task.id })

  const handleSave = () => {
    if (editValue.trim() !== '') {
      onUpdate(task, editValue.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setIsEditing(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_1fr_auto] gap-3 bg-white p-3 rounded shadow group">

      {/* Alça de drag */}
      <div 
        className="cursor-grab active:cursor-grabbing"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}>
        <Bars3Icon className={"w-7 h-7"} />
      </div>

      {/* Checkbox */}
      <div
        className="gap-3 cursor-pointer"
        onClick={() => onToggle(task)}>
        <div
          className={`w-5 h-5 border-2 rounded 
            ${task.completed ? 'bg-[#e4544c] border-[#e4544c]' : 'border-gray-400'} 
            flex items-center justify-center`}>
          {task.completed && <CheckIcon className="w-4 h-4 text-white" />}
        </div>
      </div>

      {/* Área de Texto */}
      <div onClick={handleEdit} className="grid">
        {isEditing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="w-full text-sm bg-transparent focus:outline-none border-b border-gray-200"
          />
        ) : (
          <button
            onClick={handleEdit}
            className="w-full text-left text-sm hover:bg-gray-50 rounded px-1">
            <span className={`${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.content}
            </span></button>
        )}
      </div>

      {/* Botão de Excluir */}
      <button
        onClick={() => onDelete(task)}
        className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 justify-self-end self-end"
      >
        Excluir
      </button>

    </li>
  )
}