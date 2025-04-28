'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { Task } from '../utils/interfaces'
import { useAuth } from './AuthProvider'
import { db } from '../utils/firebaseConfig'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'

interface TaskCardProps {
  task: Task
  refreshTasks: () => void
}

export default function TaskCard({ task, refreshTasks }: TaskCardProps) {
  const { user } = useAuth()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({ id: task.id })

  const [x, setX] = useState(0)
  const [showActions, setShowActions] = useState<'left' | 'right' | null>(null)

  const handleResetPosition = () => {
    setX(0)
    setShowActions(null)
  }

  const handleStatusSwitch = async (newStatus: 0 | 1 | 2) => {
    if (!user) return
    await updateDoc(doc(db, `users/${user.uid}/tasks-list`, task.id), {
      status: newStatus,
    })
    refreshTasks()
    handleResetPosition()
  }

  const handleEditTask = () => {
    console.log('Abrir modal de edição...')
    // Aqui abriríamos o modal futuramente
    handleResetPosition()
  }

  const handleDelete = async () => {
    if (!user) return
    if (confirm('Deseja excluir esta tarefa?')) {
      await deleteDoc(doc(db, `users/${user.uid}/tasks-list`, task.id))
      refreshTasks()
    }
  }

  return (
    <li ref={setNodeRef} className="relative overflow-hidden rounded shadow bg-white">

      {/* Botões de Ação (atrás do cartão) */}
      <div className="absolute inset-0 flex items-center justify-between px-4 bg-gray-100 z-0">
        {/* Ações à Esquerda */}
        {showActions === 'left' && (
          <button
            onClick={handleEditTask}
            className="text-blue-600 font-semibold"
          >
            Editar
          </button>
        )}
        {/* Ações à Direita */}
        {showActions === 'right' && (
          <button
            onClick={() => handleStatusSwitch(task.status === 2 ? 0 : 2)}
            className="text-green-600 font-semibold"
          >
            {task.status === 2 ? 'Reabrir' : 'Concluir'}
          </button>
        )}
      </div>

      {/* Área arrastável */}
      <motion.div
        drag="x"
        dragElastic={0.9}
        dragConstraints={{ left: 0, right: 0 }}
        animate={{ x }}
        onDrag={(event, info) => {
          setX(info.offset.x)
        }}
        onDragEnd={(event, info) => {
          const threshold = 50

          if (info.offset.x > threshold) {
            setX(80) // Magnetiza 80px para direita
            setShowActions('right')
          } else if (info.offset.x < -threshold) {
            setX(-80) // Magnetiza 80px para esquerda
            setShowActions('left')
          } else {
            handleResetPosition()
          }
        }}
        className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 bg-white rounded"
      >
        {/* Grip para arrastar verticalmente */}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <Bars3Icon className="w-7 h-7 text-gray-500" />
        </div>

        {/* Texto da tarefa */}
        <span className={`flex items-center text-wrap mr-4 
          ${task.status === 2 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.content}
        </span>

        {/* Botão Excluir */}
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700"
        >
          Excluir
        </button>
      </motion.div>

    </li>
  )
}
