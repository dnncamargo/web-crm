// app/task-list/page.tsx
'use client'

import { useEffect, useState } from "react"
import { collection, doc, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "../utils/firebaseConfig"
import { useAuth } from "../components/AuthProvider"
import { Task } from "../utils/interfaces"
import MainMenu from "../components/MainMenu"
import { DocumentCheckIcon } from "@heroicons/react/24/outline"
import { PlusIcon } from "lucide-react"
import AddTaskModal from "../components/AddTaskModal"
import TaskSection from "../components/TaskSection"

export default function TasksList() {
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)

    useEffect(() => {
        if (user) fetchTasks()
    }, [user]);

    const fetchTasks = async () => {
        if (!user) return

        const q = query(
            collection(db, `users/${user.uid}/tasks-list`),
            orderBy('order')
        )

        const querySnapshot = await getDocs(q)
        const fetchedTasks = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Task[]

        console.log('Fetched Tasks:', fetchedTasks)  // <<<< AQUI!

        setTasks(fetchedTasks)
    }

    return (
        <main className="main-container-body main-container-bg">
            <MainMenu />

            <h1 className="text-2xl font-bold mb-4">Tarefas</h1>
            <div className="space-y-6">
                {tasks.length <= 0 ? <p className="text-gray-500">Nenhuma tarefa.</p>: null}

                <TaskSection
                    section="Em Andamento"
                    status={1}
                    tasks={tasks.filter(t => t.status === 1)}
                    refreshTasks={fetchTasks}
                    updateTasksLocally={setTasks}
                //onToggleStatus={handleToggleStatus}
                //onEditTask={handleEditTask}
                //onDeleteTask={handleDeleteTask}
                //onMakeSubtask={handleMakeSubtask}
                />
                <TaskSection
                    section="Não Iniciadas"
                    status={0}
                    tasks={tasks.filter(t => t.status === 0)}
                    refreshTasks={fetchTasks}
                    updateTasksLocally={setTasks}
                //onToggleStatus={handleToggleStatus}
                //onEditTask={handleEditTask}
                //onDeleteTask={handleDeleteTask}
                //onMakeSubtask={handleMakeSubtask}
                />
                <TaskSection
                    section="Concluídas"
                    status={2}
                    tasks={tasks.filter(t => t.status === 2)}
                    refreshTasks={fetchTasks}
                    updateTasksLocally={setTasks}
                //onToggleStatus={handleToggleStatus}
                //onEditTask={handleEditTask}
                //onDeleteTask={handleDeleteTask}
                //onMakeSubtask={handleMakeSubtask}
                />
            </div>

            <AddTaskModal
                isOpen={isAddTaskModalOpen}
                onClose={() => setIsAddTaskModalOpen(false)}
                onAdded={fetchTasks}
            />
            {/* Botão flutuante de Nova Tarefa */}
            <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 z-10 rounded-full bg-yellow-600 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-yellow-800 transition"

                aria-label="Nova Tarefa"
            >
                <DocumentCheckIcon className="w-6 h-6 absolute mr-1" />
                <PlusIcon className="w-4 h-4 absolute ml-5 mb-5" />
            </button>
        </main>
    )
}


/*'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import { Task } from '../utils/interfaces'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import MainMenu from '../components/MainMenu'
import TaskSection from '../components/TaskSection'
import AddTaskModal from '../components/AddTaskModal'
import { DocumentCheckIcon, PlusIcon } from '@heroicons/react/24/outline'

export default function TasksList() {
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)


    useEffect(() => {
        if (user) fetchTasks()
    }, [user])

    const fetchTasks = async () => {
        if (!user) return
      
        const q = query(
          collection(db, `users/${user.uid}/tasks-list`),
          //orderBy('order')
        )
        
        const querySnapshot = await getDocs(q)
        const fetchedTasks = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[]
      
        console.log('Fetched Tasks:', fetchedTasks)  // <<<< AQUI!
      
        setTasks(fetchedTasks)
      }      

    const handleToggleStatus = async (task: Task, status: Task['status']) => {
        if (!user) return
        const taskRef = doc(db, `users/${user.uid}/tasks-list`, task.id)
        await updateDoc(taskRef, { status })
        fetchTasks()
    }

    const handleEditTask = async (task: Task) => {
        if (!user) return
        const taskRef = doc(db, `users/${user.uid}/tasks-list`, task.id)
        await updateDoc(taskRef, { content: task.content })
        fetchTasks()
    }

    const handleDeleteTask = async (task: Task) => {
        if (!user) return
        const taskRef = doc(db, `users/${user.uid}/tasks-list`, task.id)
        await deleteDoc(taskRef)
        fetchTasks()
    }

    const handleMakeSubtask = async (task: Task) => {
        if (!user) return
        const subtaskRef = doc(collection(db, `users/${user.uid}/tasks-list`))
        await updateDoc(subtaskRef, { ...task, parentId: task.id })
        fetchTasks()
    }

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    )

    const handleDragEnd = (event: any) => {
        const { active, over } = event
        if (active.id !== over.id) {
            // TODO: rearranjar ordem local e atualizar no Firestore
        }
    }

    return (
        <main className="main-container-body main-container-bg">
            <MainMenu />

            <h1 className="text-2xl font-bold mb-4">Tarefas</h1>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-6">
                    <TaskSection
                        section="Em andamento"
                        status={1}
                        tasks={tasks.filter(t => t.status === 1)}
                        refreshTasks={fetchTasks}
                        onToggleStatus={handleToggleStatus}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onMakeSubtask={handleMakeSubtask}
                    />
                    <TaskSection
                        section="Não Iniciadas"
                        status={0}
                        tasks={tasks.filter(t => t.status === 0)}
                        refreshTasks={fetchTasks}
                        onToggleStatus={handleToggleStatus}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onMakeSubtask={handleMakeSubtask}
                    />
                    <TaskSection
                        section="Concluídas"
                        status={2}
                        tasks={tasks.filter(t => t.status === 2)}
                        refreshTasks={fetchTasks}
                        onToggleStatus={handleToggleStatus}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onMakeSubtask={handleMakeSubtask}
                    />
                </div>
            </DndContext>
            <AddTaskModal
                isOpen={isAddTaskModalOpen}
                onClose={() => setIsAddTaskModalOpen(false)}
                onAdded={fetchTasks}
            />
            {/* Botão flutuante de Nova Tarefa *
            <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-yellow-600 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-yellow-800 transition"
                
                aria-label="Nova Tarefa"
            >
                <DocumentCheckIcon className="w-6 h-6 absolute mr-1" />
                <PlusIcon className="w-4 h-4 absolute ml-5 mb-5" />
            </button>
        </main>
    )
}*/
