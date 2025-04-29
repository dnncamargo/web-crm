'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { useAuth } from '../components/AuthProvider'
import { Task } from '../utils/interfaces'

interface EditTaskModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function EditTaskModal({ task, isOpen, onClose, onUpdated }: EditTaskModalProps) {
  const { user } = useAuth()
  const [content, setContent] = useState(task.content || '')
  const [addingDate, setAddingDate] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')

  if (!isOpen || !user || !task) return null

  useEffect(() => {
    if (task) {
      setContent(task.content)
    }
  }, [task]) 

  const handleUpdate = async () => {
    if (!content.trim()) {
      alert('Digite algo para a tarefa.')
      return
    }

    const updates: any = {
      content: content.trim(),
    }

    // Se quiser criar um evento associado
    if (addingDate && startDate) {
      updates.event = `${startDate}T${startTime || '12:00'}`
    }

    try {
      await updateDoc(doc(db, `users/${user.uid}/tasks-list/${task.id}`), updates)
      onUpdated()
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Editar Tarefa</h2>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleUpdate();
            }
          }}
          placeholder="Descrição da tarefa"
          className="border w-full p-2 rounded mb-4"
        />

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={addingDate}
            onChange={() => setAddingDate(!addingDate)}
          />
          Criar evento a partir da tarefa
        </label>

        {addingDate && (
          <div className="space-y-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border w-full p-2 rounded"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border w-full p-2 rounded"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-black">Cancelar</button>
          <button onClick={handleUpdate} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Atualizar
          </button>
        </div>
      </div>
    </motion.div>
  )
}
