// app/components/TaskCard.tsx
'use client';

import { Task } from '../utils/interfaces'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { useAuth } from './AuthProvider'
import { Bars3Icon } from '@heroicons/react/24/outline';

interface TaskCardProps {
  task: Task
  refreshTasks: () => void
}

export default function TaskCard({ task, refreshTasks }: TaskCardProps) {
  const { user } = useAuth()

  const { attributes, listeners, setNodeRef, transform, transition, setActivatorNodeRef } = useSortable({ id: task.id })

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
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: transition || undefined,
      }}
      className="grid grid-cols-[auto_1fr_auto] gap-3 bg-white p-3 rounded shadow group"
    >
      {/* Alça de Drag */}
      <div
        aria-label="Reordenar tarefa"
        className="cursor-grab active:cursor-grabbing"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      >
        <Bars3Icon className="w-7 h-7" />
      </div>

      {/* Área de Texto */}
      <span className={`flex items-center text-wrap mr-4 
                        ${task.status === 2 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {task.content}
      </span>

      {/* Botão de Excluir */}
      <button
        onClick={handleDelete}
        className="text-red-500 hover:text-red-700"
      >
        Excluir
      </button>
    </li>


    /* Contexto sem Drag & Drop */
    /*     <li className="flex items-center justify-between bg-white p-4 rounded shadow">
          <span className="flex items-center text-justify mr-4">{task.content}</span>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700"
          >
            Excluir
          </button>
        </li> */
  )
}


/*import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/app/utils/interfaces';
import { PencilIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { GripVerticalIcon } from 'lucide-react'

interface TaskCardProps {
  task: Task;
  refreshTasks: () => void;
  onToggleStatus: (task: Task, status: Task['status']) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onMakeSubtask: (task: Task) => void;
}

export default function TaskCard({ task, onToggleStatus, onEditTask, onDeleteTask, onMakeSubtask }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if ('touches' in e) {
      setDragX(e.touches[0].clientX - startX);
    } else {
      setDragX(e.clientX - startX);
    }
  };

  const handleDragStart = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if ('touches' in e) {
      startX = e.touches[0].clientX;
    } else {
      startX = e.clientX;
    }
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    if (dragX > 150) {
      onDeleteTask(task); // Swipe completo para direita = Excluir
    } else if (dragX > 90) {
      onToggleStatus(task, 2); // 60% Swipe -> Doing
    } else if (dragX > 40) {
      onToggleStatus(task, task.status === 2 ? 0 : 2); // 30% Swipe -> Done/Not Started
    } else if (dragX < -90) {
      onMakeSubtask(task); // 60% Swipe para esquerda -> Tornar Subtask
    } else if (dragX < -40) {
      onEditTask(task); // 30% Swipe para esquerda -> Editar
    }
    setIsDragging(false);
    setDragX(0);
  };

  let startX = 0;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      {/* Fundo das ações 
      <div className="absolute inset-0 flex justify-between items-center px-4 bg-gray-200 text-gray-700">
        {dragX > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            {dragX > 90 ? (
              <span className="text-blue-600 font-bold">Doing</span>
            ) : (
              <span className="text-green-600 font-bold">Feito</span>
            )}
          </motion.div>
        )}

        {dragX < 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            {dragX < -90 ? (
              <span className="text-purple-600 font-bold">Subtarefa</span>
            ) : (
              <span className="text-yellow-600 font-bold">Editar</span>
            )}
          </motion.div>
        )}
      </div>

      {/* Card da tarefa 
      <motion.div
        className="relative flex items-center bg-white rounded-lg p-3 shadow cursor-grab select-none"
        style={{ x: isDragging ? dragX : 0 }}
        drag="x"
        dragConstraints={{ left: 0, right: 300 }}
        dragElastic={0.2}
        onTouchStart={handleDragStart}
        onTouchMove={handleDrag}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={isDragging ? handleDrag : undefined}
        onMouseUp={handleDragEnd}
      >
        {/* Grip de arrastar *
        <button {...listeners} className="mr-3 text-gray-400 hover:text-gray-700">
          <GripVerticalIcon className="h-5 w-5" />
        </button>

        {/* Conteúdo da tarefa *
        <div className="flex-1">
          <p className={`text-sm ${task.status === 2 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.content}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
*/