'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { useAuth } from '../components/AuthProvider'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
}

export default function AddTaskModal({ isOpen, onClose, onAdded }: AddTaskModalProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)

  if (!isOpen || !user) return null

  const handleAdd = async () => {
    if (!content.trim()) {
      alert('Digite algo para a tarefa.')
      return
    }

    setAdding(true)
    try {
      await addDoc(collection(db, `users/${user.uid}/tasks-list`), {
        content: content.trim(),
        status: 0,
        createdAt: new Date(),
      })
      onAdded()
      setContent('') // 🧹 limpa o campo
      onClose()
    } catch (error) {
      console.error('Erro ao adicionar tarefa:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleCancel = () => {
    setContent('') // 🧹 limpa o campo
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Nova Tarefa</h2>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Descrição da tarefa"
          className="border w-full p-2 rounded mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={handleCancel} className="px-4 py-2 text-gray-600 hover:text-black">
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-800"
          >
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
