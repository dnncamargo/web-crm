// app/task-list/page.tsx
'use client'

import { useEffect, useState } from "react"
import { collection, doc, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "../utils/firebaseConfig"
import { useAuth } from "../components/AuthProvider"
import { Task } from "../utils/interfaces"
import { DocumentCheckIcon } from "@heroicons/react/24/outline"
import { PlusIcon } from "lucide-react"
import ProtectedRoute from '../components/ProtectedRoute'
import MainMenu from "../components/MainMenu"
import AddTaskModal from "../components/AddTaskModal"
import TaskSection from "../components/TaskSection"
import EditTaskModal from "../components/EditTaskModal"

export default function TasksList() {
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)
    const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)

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

        console.log('Fetched Tasks:', fetchedTasks)
        setTasks(fetchedTasks)
    }

    const handleUpdateSectionTasks = (status: 0 | 1 | 2, updatedTasks: Task[]) => {
        setTasks(prev => {
            const filtered = prev.filter(t => t.status !== status)
            return [...filtered, ...updatedTasks]
        })
    }

    /**
     * @function openEditTaskModal
     * @description Abre o modal de edição para a tarefa fornecida.
     * @param {Task} task - O objeto da tarefa a ser editada.
     * @returns {void}
     */
    const openEditTaskModal = (task: Task): void => {
        setSelectedTask(task);
        setIsEditTaskModalOpen(true);
    };

    return (
        <ProtectedRoute>


            <main className="main-container-body main-container-bg">
                <MainMenu />

                <h1 className="text-2xl font-bold mb-4">Tarefas</h1>
                <div className="space-y-6">
                    {tasks.length <= 0 ? <p className="text-gray-500">Nenhuma tarefa.</p> : null}

                    <TaskSection
                        section="Em Andamento"
                        status={1}
                        tasks={tasks.filter(t => t.status === 1)}
                        onEditTask={openEditTaskModal}
                        refreshTasks={fetchTasks}
                        updateTasksLocally={(updatedTasks) => handleUpdateSectionTasks(1, updatedTasks)}
                    />
                    <TaskSection
                        section="Não Iniciadas"
                        status={0}
                        tasks={tasks.filter(t => t.status === 0)}
                        onEditTask={openEditTaskModal}
                        refreshTasks={fetchTasks}
                        updateTasksLocally={(updatedTasks) => handleUpdateSectionTasks(0, updatedTasks)}
                    />
                    <TaskSection
                        section="Concluídas"
                        status={2}
                        tasks={tasks.filter(t => t.status === 2)}
                        onEditTask={openEditTaskModal}
                        refreshTasks={fetchTasks}
                        updateTasksLocally={(updatedTasks) => handleUpdateSectionTasks(2, updatedTasks)}
                    />
                </div>

                {isAddTaskModalOpen && <AddTaskModal
                    isOpen={isAddTaskModalOpen}
                    onClose={() => setIsAddTaskModalOpen(false)}
                    onAdded={fetchTasks}
                />}

                {isEditTaskModalOpen && selectedTask && <EditTaskModal
                    task={selectedTask}
                    isOpen={isEditTaskModalOpen}
                    onClose={() => setIsEditTaskModalOpen(false)}
                    onUpdated={fetchTasks}
                />}

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
        </ProtectedRoute>
    )
}
