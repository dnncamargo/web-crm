'use client'

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
import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { Task } from '../utils/interfaces'
import MainMenu from '../components/MainMenu'
import TaskCard from '../components/TaskCard'

export default function TasksList() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [newTask, setNewTask] = useState('')

    const fetchTasks = async () => {
        const querySnapshot = await getDocs(collection(db, 'tasks-list'))
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

            // todo: salvar a nova ordem no Firestore
        }
    }

    const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newTask.trim() !== '') {
            await addDoc(collection(db, 'tasks-list'), { title: newTask, completed: false })
            setNewTask('')
            fetchTasks()
        }
    }

    const handleToggleComplete = async (task: Task) => {
        await updateDoc(doc(db, 'tasks-list', task.id), { completed: !task.completed })
        fetchTasks()
    }

    const handleDeleteTask = async (task: Task) => {
        await deleteDoc(doc(db, 'tasks-list', task.id))
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
            <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}>
                <SortableContext 
                    items={tasks.map(t => t.id)} 
                    strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2">
                        {tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onToggle={handleToggleComplete}
                                onDelete={handleDeleteTask} />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>

        </main>
    )
}
