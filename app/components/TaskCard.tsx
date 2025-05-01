'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowTurnDownRightIcon,
  ArrowTurnLeftUpIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  FlagIcon,
  PlayCircleIcon
} from '@heroicons/react/24/outline'
import { GripVerticalIcon } from 'lucide-react'
import { Task } from '../utils/interfaces'
import { useAuth } from './AuthProvider'
import { db } from '../utils/firebaseConfig'
import { doc, deleteDoc } from 'firebase/firestore'

interface TaskCardProps {
  task: Task
  onEditTask: (task: Task) => void // Função para abrir o modal de edição
  onMakeSubtask: (task: Task) => void
  onStatusSwitch: (status: number | any) => void
  refreshTasks: () => void // Função para atualizar a lista de tarefas
}

export default function TaskCard({ task, onEditTask, onMakeSubtask, onStatusSwitch, refreshTasks }: TaskCardProps) {
  const { user } = useAuth()
  const { attributes, listeners, setNodeRef, transform, transition, setActivatorNodeRef } = useSortable({ id: task.id })

  const [x, setX] = useState(0)
  const [showActionsOn, setShowActionsOn] = useState<'left' | 'right' | null>(null)

  const threshold = 80  // deslocamento mínimo para considerar um gesto de arraste para ação
  const deleteSwipe = 160 // distância mínima para considerar como tentativa de exclusão

  const handleResetPosition = () => {
    setX(0)
    setShowActionsOn(null)
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

  const handleStatusSwitch = (status: number | any) => {
    onStatusSwitch(status)
    handleResetPosition()
  }

  const handleDelete = async () => {
    if (!user) return
    if (confirm('Deseja excluir esta tarefa?')) {
      await deleteDoc(doc(db, `users/${user.uid}/tasks-list`, task.id))
      refreshTasks()
    } else {
      handleResetPosition()
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
            <div>
              {task.status === 0 && (
                <>
                  <button onClick={() => handleStatusSwitch(1)}>
                    {/* Switch: Processing */}
                    <PlayCircleIcon className="w-5 h-5 text-blue-600" />
                  </button>
                  <button onClick={() => handleStatusSwitch(2)}>
                    {/* Switch: Checked */}
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  </button>
                </>
              )}

              {task.status === 1 && (
                <>
                  <button onClick={() => handleStatusSwitch(0)}>
                    {/* Switch: Not Started */}
                    <FlagIcon className="w-5 h-5 text-gray-400" />
                  </button>
                  <button onClick={() => handleStatusSwitch(2)}>
                    {/* Switch: Checked */}
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  </button>
                </>
              )}

              {task.status === 2 && (
                <>
                  <button onClick={() => handleStatusSwitch(0)}>
                    {/* Switch: Not Started */}
                    <FlagIcon className="w-5 h-5 text-gray-500" />
                  </button>
                  <button onClick={() => handleStatusSwitch(1)}>
                    {/* Switch: Processing */}
                    <PlayCircleIcon className="w-5 h-5 text-blue-600" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 transition-all duration-300 ease-in-out">
          {showActionsOn === 'right' && (
            <>
              {/* Switch: Subtask / Task Parent */}
              <button onClick={makeSubtask}>
                {task.parentId == null ?
                  <ArrowTurnDownRightIcon className="w-5 h-5 text-purple-500" /> :
                  <ArrowTurnLeftUpIcon className="w-5 h-5 text-purple-500" />}
              </button>
              {/* Modal Editar Task */}
              <button onClick={handleEditTask}>
                <PencilSquareIcon className="w-5 h-5 text-yellow-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Área principal arrastável / clicável */}
      <motion.div
        drag="x"
        dragElastic={0.7}
        dragConstraints={{ left: -deleteSwipe, right: deleteSwipe }}
        animate={{ x }}
        onClick={(e) => {
          const { left, width } = e.currentTarget.getBoundingClientRect()
          const xPos = e.clientX - left
          if (xPos > width / 2) {
            setX(-threshold)
            setShowActionsOn('right')
          } else {
            setX(threshold)
            setShowActionsOn('left')
          }
        }}
        onDrag={(event, info) => {
          const limitedX = Math.max(-deleteSwipe, Math.min(deleteSwipe, info.offset.x))
          setX(limitedX)
        }}
        onDragEnd={(event, info) => {
          const offset = info.offset.x

          if (offset < deleteSwipe) {
            handleDelete()
          } else {
            setX(0)
            setShowActionsOn(null)
          }
        }}
        className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center bg-white gap-3 p-3 cursor-pointer"
      >
        {/* Grip de arraste vertical */}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVerticalIcon className="w-7 h-7  text-gray-500" />
        </div>

        {/* Texto */}
        <span className={`flex items-center text-wrap mr-4 
            ${task.parentId ? 'text-sm text-gray-600 ml-2' : ''}
            ${task.status === 2 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.content}
        </span>

        {/* Botão Excluir */}
{/*         <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700"
        >
          Excluir
        </button> */}
      </motion.div>
    </li>
  )
}
