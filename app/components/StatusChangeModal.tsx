// components/StatusChangeModal.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface StatusChangeModalProps {
  isOpen: boolean
  mode: 'subtask' | 'parent'
  onPromoteSubtask?: () => void
  onApplyAll: () => void
  onCancel: () => void
}

export default function StatusChangeModal({
  isOpen,
  mode,
  onPromoteSubtask,
  onApplyAll,
  onCancel,
}: StatusChangeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg space-y-4"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
          >
            <h2 className="text-lg font-semibold text-gray-800">
              {mode === 'subtask'
                ? 'Alterar status da subtarefa'
                : 'Alterar status da tarefa pai'}
            </h2>

            <p className="text-sm text-gray-600">
              {mode === 'subtask'
                ? 'Deseja aplicar o novo status apenas à esta subtarefa ou também à tarefa pai e suas outras subtarefas?'
                : 'Deseja aplicar o novo status também às suas subtarefas?'}
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>

              {mode === 'subtask' && (
                <button
                  onClick={onPromoteSubtask}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Promover a tarefa
                </button>
              )}

              <button
                onClick={onApplyAll}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {mode === 'subtask'
                  ? 'Aplicar a todas as tarefas'
                  : 'Aplicar às subtarefas'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
