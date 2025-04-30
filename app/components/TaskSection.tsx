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
    onEditTask: (task: Task) => void
    refreshTasks: () => void
    updateTasksLocally: (tasks: Task[]) => void;
}

export default function TaskSection({ section, tasks, onEditTask, refreshTasks, updateTasksLocally }: TaskSectionProps) {
    const { user } = useAuth()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        })
    )

    const handleMakeSubtask = async (currentTask: Task) => {
        if (!user) return;

        const index = tasks.findIndex(t => t.id === currentTask.id)
        if (index <= 0) return alert("Não há tarefa acima para agrupar.")

        const aboveTask = tasks[index - 1]
        const resolvedParentId = aboveTask.parentId ?? aboveTask.id

        // Se já é subtask, promover
        const isAlreadySubtask = !!currentTask.parentId

        await updateDoc(doc(db, `users/${user.uid}/tasks-list`, currentTask.id), {
            parentId: isAlreadySubtask ? null : resolvedParentId,
        })

        refreshTasks()
    }


    const handleDragEnd = async (event: any) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = tasks.findIndex(task => task.id === active.id)
        const newIndex = tasks.findIndex(task => task.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)
        updateTasksLocally(reorderedTasks)

        try {
            const updates = reorderedTasks.map((task, i) =>
                updateDoc(doc(db, `users/${user!.uid}/tasks-list`, task.id), { order: i })
            )
            await Promise.all(updates)
            console.log('🔥 Ordem atualizada no Firestore com sucesso!')
        } catch (error) {
            console.error('Erro ao atualizar ordem:', error)
        }
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
                    <ul className="space-y-1">
                        {tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onEditTask={onEditTask}
                                onMakeSubtask={handleMakeSubtask}
                                refreshTasks={refreshTasks}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </section>
    )
}
