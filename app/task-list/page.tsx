'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { Task } from '../utils/interfaces'
import MainMenu from '../components/MainMenu'
import { CheckIcon } from '@heroicons/react/24/outline'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')

  const fetchTasks = async () => {
    const querySnapshot = await getDocs(collection(db, 'tasks'))
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]
    setTasks(data)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTask.trim() !== '') {
      await addDoc(collection(db, 'tasks'), { title: newTask, completed: false })
      setNewTask('')
      fetchTasks()
    }
  }

  const handleToggleComplete = async (task: Task) => {
    await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed })
    fetchTasks()
  }

  const handleDeleteTask = async (task: Task) => {
    await deleteDoc(doc(db, 'tasks', task.id))
    fetchTasks()
  }

  return (
    <main className="p-4 space-y-6 bg-gray-50 min-h-screen">
      <MainMenu />
      <h1 className="text-2xl font-bold">Tarefas</h1>

      {/* Campo para adicionar nova tarefa */}
      <div className="flex items-center gap-3 bg-white p-3 rounded shadow">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={handleAddTask}
          placeholder="Nova tarefa..."
          className="flex-1 bg-transparent focus:outline-none"
        />
      </div>

      {/* Lista de tarefas */}
      <ul className="space-y-2">
        {tasks.map(task => (
          <li
            key={task.id}
            className="flex items-center justify-between bg-white p-3 rounded shadow group"
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => handleToggleComplete(task)}
            >
              <div
                className={`w-5 h-5 border-2 rounded ${
                  task.completed ? 'bg-[#e4544c] border-[#e4544c]' : 'border-gray-400'
                } flex items-center justify-center`}
              >
                {task.completed && <CheckIcon className="w-4 h-4 text-white" />}
              </div>
              <p
                className={`text-sm ${
                  task.completed ? 'line-through text-gray-400' : 'text-gray-800'
                }`}
              >
                {task.title}
              </p>
            </div>

            <button
              onClick={() => handleDeleteTask(task)}
              className="text-xs text-gray-400 opacity-0 group-hover:opacity-100"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
