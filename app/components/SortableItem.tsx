'use client'

import { useState } from 'react'
import { CheckIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { Task } from '../utils/interfaces'
import { useSortable } from '@dnd-kit/sortable'

export default function SortableItem({ task, onToggle, onDelete, onUpdate }: {
    task: Task
    onToggle: (task: Task) => void
    onDelete: (task: Task) => void
    onUpdate: (task: Task, newTitle: string) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(task.title)
    const { attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        setActivatorNodeRef } =
        useSortable({ id: task.id });

    const handleEdit = () => setIsEditing(true)

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

    return (
        <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white p-3 rounded shadow group cursor-move">
            {/* Alça de drag */}
            <div ref={setActivatorNodeRef} {...listeners}>
                <Bars3Icon />
            </div>
            <div className="flex items-center gap-3" onClick={() => onToggle(task)}>
                <div className={`w-5 h-5 border-2 rounded ${task.completed ? 'bg-[#e4544c] border-[#e4544c]' : 'border-gray-400'} flex items-center justify-center`}>
                    {task.completed && <CheckIcon className="w-4 h-4 text-white" />}
                </div>
            </div>
            {/* Área de Texto */}
            <div className="w-full">
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
                        className="w-full text-left text-sm hover:bg-gray-50 rounded px-1"
                    >
                        <span className={`${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                        </span>
                    </button>
                )}
            </div>
            <button
                onClick={() => onDelete(task)}
                className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 justify-self-end"
            >
                Excluir
            </button>
        </li>
    )
}
