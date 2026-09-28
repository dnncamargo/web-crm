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
import { Task } from '../../utils/interfaces'
import { useAuth } from '../../components/auth/AuthProvider'

interface TaskCardProps {
  task: Task
  onEditTask: (task: Task) => void // Função para abrir o modal de edição
  onPromoteSubtask: (task: Task) => void
  onMakeSubtask: (task: Task) => void
  onStatusSwitch: (status: number | any) => void
  parentTaskId?: string | null // Adicionado para evitar erro
  onDelete: () => void
  refreshTasks: () => void // Função para atualizar a lista de tarefas
}

export default function TaskCard({ task, onEditTask, onPromoteSubtask, onMakeSubtask, onStatusSwitch, parentTaskId, onDelete, refreshTasks }: TaskCardProps) {
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

  const makeSubtask = async () => {
    await onMakeSubtask(task);
    handleResetPosition();
  }

  const promoteSubtask = async () => {
    if (!user) return;
    await onPromoteSubtask(task);
    refreshTasks();
  };

  const editTask = () => {
    if (!user) return
    onEditTask(task) // Chama a função de edição passando a tarefa atual
    handleResetPosition()
  }

  const statusSwitch = (status: number | any) => {
    onStatusSwitch(status)
    handleResetPosition()
  }

  const deleteTask = async () => {
    if (onDelete) onDelete();
    handleResetPosition(); // ou o fallback padrão
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
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
                  <button onClick={() => statusSwitch(2)}>
                    {/* Switch: Checked */}
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                  </button>
                  <button onClick={() => statusSwitch(1)}>
                    {/* Switch: Processing */}
                    <PlayCircleIcon className="w-5 h-5 text-blue-600" />
                  </button>
                </>
              )}

              {task.status === 1 && (
                <>
                  <button onClick={() => statusSwitch(0)}>
                    {/* Switch: Not Started */}
                    <FlagIcon className="w-5 h-5 text-gray-400 mr-2" />
                  </button>
                  <button onClick={() => statusSwitch(2)}>
                    {/* Switch: Checked */}
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  </button>
                </>
              )}

              {task.status === 2 && (
                <>
                  <button onClick={() => statusSwitch(0)}>
                    {/* Switch: Not Started */}
                    <FlagIcon className="w-5 h-5 text-gray-500 mr-2" />
                  </button>
                  <button onClick={() => statusSwitch(1)}>
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
              {parentTaskId ? (
                <button onClick={promoteSubtask}>
                  <ArrowTurnLeftUpIcon className="w-5 h-5 text-purple-500" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (task.subtasks && task.subtasks.length > 0) {
                      alert("Essa tarefa já possui subtarefas e não pode ser transformada em subtask.");
                      handleResetPosition();
                      return;
                    }
                    makeSubtask();
                  }}
                >
                  <ArrowTurnDownRightIcon className="w-5 h-5 text-purple-500" />
                </button>
              )}

              {/* Modal Editar Task */}
              <button onClick={editTask}>
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
          if (showActionsOn == null) {
            if (xPos > width / 2) {
              setX(-threshold)
              setShowActionsOn('right')
            } else {
              setX(threshold)
              setShowActionsOn('left')
            }
          } else { handleResetPosition() }
        }}
        onDrag={(event, info) => {
          const limitedX = Math.max(-deleteSwipe, Math.min(deleteSwipe, info.offset.x))
          setX(limitedX)
        }}
        onDragEnd={(event, info) => {
          const offset = info.offset.x

          if (offset > deleteSwipe) {
            deleteTask()
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
            ${task.status === 2 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.content}
        </span>
      </motion.div>
    </div>
  )
}

