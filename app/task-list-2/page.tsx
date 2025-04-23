'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { Task } from '../utils/interfaces'
import ProtectedRoute from '../components/ProtectedRoute'
import MainMenu from '../components/MainMenu'
import SortableItem from '../components/SortableItem'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export default function TasksList() {
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
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200, // tempo de toque antes de ativar o drag (ms)
        tolerance: 5, // movimento mínimo para ativar o drag (px)
      },
    }),  
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t.id === active.id)
      const newIndex = tasks.findIndex(t => t.id === over.id)
      const newTasks = arrayMove(tasks, oldIndex, newIndex)
      setTasks(newTasks)

      // todo: salvar a nova ordem no Firestore
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

  const handleUpdateTask = async (task: Task, newTitle: string) => {
    await updateDoc(doc(db, 'task-list', task.id), { title: newTitle })
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
                  onUpdate={handleUpdateTask}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

      </main>

    </ProtectedRoute>
  )
}
