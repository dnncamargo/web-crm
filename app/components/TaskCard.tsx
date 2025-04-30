'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowTurnDownRightIcon, ArrowTurnUpLeftIcon, PencilSquareIcon, Bars3Icon, CheckCircleIcon, FlagIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { Task } from '../utils/interfaces'
import { useAuth } from './AuthProvider'
import { db } from '../utils/firebaseConfig'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'

interface TaskCardProps {
  task: Task
  onEditTask: (task: Task) => void // Função para abrir o modal de edição
  onMakeSubtask: (task: Task) => void
  refreshTasks: () => void // Função para atualizar a lista de tarefas
}

export default function TaskCard({ task, onEditTask, onMakeSubtask, refreshTasks }: TaskCardProps) {
  const { user } = useAuth()
  const { attributes, listeners, setNodeRef, transform, transition, setActivatorNodeRef } = useSortable({ id: task.id })

  const [x, setX] = useState(0)
  const [showActionsOn, setShowActionsOn] = useState<'left' | 'right' | null>(null)

  const maxSwipe = 100 // quanto deve ser arrastado até o engate
  const threshold = 80 // espaçamento para abrir os botões de ação

  const handleResetPosition = () => {
    setX(0)
    setShowActionsOn(null)
  }

  const handleStatusSwitch = async (newStatus: 0 | 1 | 2) => {
    if (!user) return
    await updateDoc(doc(db, `users/${user.uid}/tasks-list`, task.id), {
      status: newStatus,
    })
    refreshTasks()
    handleResetPosition()
  }

  const makeSubtask = () => {
    onMakeSubtask(task)
    handleResetPosition()
  }

  const handleEditTask = () => {
    if (!user) return
    onEditTask(task) // Chama a função de edição passando a tarefa atual
    handleResetPosition()
  }

  const handleDelete = async () => {
    if (!user) return
    if (confirm('Deseja excluir esta tarefa?')) {
      await deleteDoc(doc(db, `users/${user.uid}/tasks-list`, task.id))
      refreshTasks()
    }
  }
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="relative overflow-hidden rounded shadow">

      {/* Botões de fundo */}
      <div className="absolute inset-0 flex justify-between items-center px-4 bg-gray-100 z-0 transition-opacity duration-300">
        <div className="flex gap-2 transition-all duration-300 ease-in-out">
          {showActionsOn === 'left' && (
            <>
              <button onClick={() => handleStatusSwitch(task.status === 2 ? 0 : 2)}>
                {task.status === 2 ? <FlagIcon className="w-5 h-5 text-gray-500" /> : <CheckCircleIcon className="w-5 h-5 text-green-600" />}
              </button>
              <button onClick={() => handleStatusSwitch(1)}>
                <PlayCircleIcon className="w-5 h-5 text-blue-600" />
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2 transition-all duration-300 ease-in-out">
          {showActionsOn === 'right' && (
            <>
              <button onClick={makeSubtask}>
                <ArrowTurnDownRightIcon className="w-5 h-5 text-orange-500" />
              </button>
              <button onClick={handleEditTask}>
                <PencilSquareIcon className="w-5 h-5 text-yellow-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Área arrastável */}
      <motion.div
        drag="x"
        dragElastic={1}
        dragConstraints={{ left: -maxSwipe, right: maxSwipe }}
        animate={{ x }}

        // Ao tocar
        onClick={(e) => {
          if (showActionsOn) {
            handleResetPosition()
          } else {
            const { left, width } = e.currentTarget.getBoundingClientRect()
            const xPos = e.clientX - left
            if (xPos > width / 2) {
              setX(-threshold)
              setShowActionsOn('right')
            } else {
              setX(threshold)
              setShowActionsOn('left')
            }
          }
        }}

        // Limitar movimento
        onDrag={(event, info) => {
          const limitedX = Math.max(-maxSwipe, Math.min(maxSwipe, info.offset.x))
          console.log('info.offset.x', info.offset.x)
          setX(limitedX)
          document.body.classList.add('overflow-hidden')
        }}
        // Ao soltar o card, verifica se o movimento foi maior que o limite
        onDragEnd={(event, info) => {
          const { offset } = info
          if (offset.x > threshold) {
            setX(threshold) // magnetiza 100px
            setShowActionsOn('left')
            console.log('Puxa para a direita: ', info.offset.x)
            console.log('posição x', x)
          } else if (offset.x < -threshold) {
            setX(-threshold)
            setShowActionsOn('right')
            console.log('Puxa para a esquerda: ', info.offset.x)
            console.log('posição x', x)
          } else {
            handleResetPosition()
          }
          document.body.classList.remove('overflow-hidden')
        }}
        onTap={handleResetPosition} // << Se clicar no Card, reseta
        className={`relative overflow-hidden rounded shadow z-10 grid grid-cols-[auto_1fr_auto] items-center
        ${task.parentId ? 'bg-gray-50 gap-0 pl-6 p-2'  : 'bg-white  gap-3 p-3'}`}
      >
        {/* Grip de arraste vertical */}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <Bars3Icon className="w-7 h-7 text-gray-500" />
        </div>

        {/* Texto */}
        <span className={`flex items-center text-wrap mr-4 
            ${task.parentId ? 'text-sm text-gray-600 ml-2' : ''}
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
