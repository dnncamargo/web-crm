'use client'

import { useAuth } from "../components/AuthProvider"
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers' // <=== AQUI
import { Task } from '../utils/interfaces'
import TaskCard from './TaskCard'

interface TaskSectionProps {
    section: string
    status: 0 | 1 | 2
    tasks: Task[]
    refreshTasks: () => void
}

export default function TaskSection({ section, tasks, refreshTasks }: TaskSectionProps) {
    const { user } = useAuth()
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5,
            },
        })
    )
    
    const handleDragEnd = async (event: any) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        
        const oldIndex = tasks.findIndex(task => task.id === active.id)
        const newIndex = tasks.findIndex(task => task.id === over.id)
        
        if (oldIndex === -1 || newIndex === -1) return
        
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)
        
        // Atualizar as ordens no Firestore
        for (let i = 0; i < reorderedTasks.length; i++) {
            const task = reorderedTasks[i]
            await updateDoc(doc(db, `users/${user!.uid}/tasks-list`, task.id), {
                order: i,
            })
        }
        
        refreshTasks()
    }
    
    if (!user) return null
    return (
        <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-700">{section}</h2>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]} // <=== AQUI
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="space-y-2">
                        {tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                refreshTasks={refreshTasks}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </section>
    )
}
