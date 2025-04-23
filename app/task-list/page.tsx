'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../utils/firebaseConfig'
import { Task } from '../utils/interfaces'
import ProtectedRoute from '../components/ProtectedRoute'
import MainMenu from '../components/MainMenu'
import { CheckIcon } from '@heroicons/react/24/outline'

function SortableItem({ task, onToggle, onDelete }: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white p-3 rounded shadow group cursor-move"
    >
      <div className="flex items-center gap-3" onClick={() => onToggle(task)}>
        <div className={`w-5 h-5 border-2 rounded ${task.completed ? 'bg-[#e4544c] border-[#e4544c]' : 'border-gray-400'} flex items-center justify-center`}>
          {task.completed && <CheckIcon className="w-4 h-4 text-white" />}
        </div>
      </div>
      <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {task.title}
      </p>
      <button onClick={() => onDelete(task)} className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 justify-self-end">
        Excluir
      </button>
    </li>
  )
}


export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')

  const fetchTasks = async () => {
    const querySnapshot = await getDocs(collection(db, 'task-list'))
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]
    setTasks(data)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t.id === active.id)
      const newIndex = tasks.findIndex(t => t.id === over.id)
      const newTasks = arrayMove(tasks, oldIndex, newIndex)
      setTasks(newTasks)

      // 🔁 Aqui você pode salvar a nova ordem no Firestore se desejar
    }
  }

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTask.trim() !== '') {
      await addDoc(collection(db, 'task-list'), { title: newTask, completed: false })
      setNewTask('')
      fetchTasks()
    }
  }

  const handleToggleComplete = async (task: Task) => {
    await updateDoc(doc(db, 'task-list', task.id), { completed: !task.completed })
    fetchTasks()
  }

  const handleDeleteTask = async (task: Task) => {
    await deleteDoc(doc(db, 'task-list', task.id))
    fetchTasks()
  }

  return (

    <ProtectedRoute>

      <main className="main-container-body">
        <MainMenu />
        <h1 className="title-1">Lista de Tarefas</h1>

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {tasks.map(task => (
                <SortableItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleComplete}
                  onDelete={handleDeleteTask}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

      </main>

    </ProtectedRoute>
  )
}
