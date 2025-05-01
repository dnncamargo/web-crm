'use client'

import { useAuth } from "../components/AuthProvider"
import { useState } from "react"
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
    const [modalTask, setModalTask] = useState<Task | null>(null)
    const [modalMode, setModalMode] = useState<'subtask' | 'parent' | null>(null)
    const [pendingStatus, setPendingStatus] = useState<0 | 1 | 2 | null>(null)

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

    const handleStatusSwitch = async (task: Task, newStatus: 0 | 1 | 2) => {
        if (!user) return;

        const isParent = !task.parentId;

        if (isParent) {
            // Atualiza a task pai
            await updateDoc(doc(db, `users/${user.uid}/tasks-list`, task.id), { status: newStatus });

            // Busca e atualiza todas as subtasks
            const subtasks = tasks.filter(t => t.parentId === task.id);
            for (const sub of subtasks) {
                await updateDoc(doc(db, `users/${user.uid}/tasks-list`, sub.id), { status: newStatus });
            }

            refreshTasks();
        } else {
            const confirmacao = window.confirm(
                "Esta é uma subtarefa. Deseja:\n\n" +
                "- OK: aplicar o novo status à tarefa pai e suas subtarefas\n" +
                "- Cancelar: cancelar a ação\n" +
                "Ou pressione 'Cancelar' para escolher manualmente"
            );

            if (confirmacao) {
                // Atualiza a task pai e subtasks
                const parentTask = tasks.find(t => t.id === task.parentId);
                if (!parentTask) return;

                const allToUpdate = [parentTask, ...tasks.filter(t => t.parentId === parentTask.id)];
                for (const t of allToUpdate) {
                    await updateDoc(doc(db, `users/${user.uid}/tasks-list`, t.id), { status: newStatus });
                }
                refreshTasks();
            } else {
                const leaveSubtask = window.confirm("Deseja tornar esta subtarefa uma tarefa normal?");
                if (leaveSubtask) {
                    await updateDoc(doc(db, `users/${user.uid}/tasks-list`, task.id), {
                        parentId: null,
                        status: newStatus
                    });
                    refreshTasks();
                }
            }
        }
    };

    const handleStatusSwitch_new = (task: Task, newStatus: 0 | 1 | 2) => {
        const isSubtask = !!task.parentId
        const isParent = !task.parentId && tasks.some(t => t.parentId === task.id)
      
        if (isSubtask || isParent) {
          setModalTask(task)
          setModalMode(isSubtask ? 'subtask' : 'parent')
          setPendingStatus(newStatus)
        } else {
          updateTaskStatus([task], newStatus)
        }
      }

      const updateTaskStatus = async (affectedTasks: Task[], newStatus: 0 | 1 | 2) => {
        if (!user) return
        await Promise.all(
          affectedTasks.map(t =>
            updateDoc(doc(db, `users/${user.uid}/tasks-list`, t.id), {
              status: newStatus,
              ...(t.parentId && newStatus === 2 ? { parentId: null } : {}),
            })
          )
        )
        refreshTasks()
        closeModal()
      }
      
      const closeModal = () => {
        setModalTask(null)
        setModalMode(null)
        setPendingStatus(null)
      }
      

      const handlePromoteSubtask = async () => {
        if (!user || !modalTask || pendingStatus === null) return
        await updateDoc(doc(db, `users/${user.uid}/tasks-list`, modalTask.id), {
          parentId: null,
          status: pendingStatus,
        })
        refreshTasks()
        closeModal()
      }
      
      const handleApplyToAll = () => {
        if (!modalTask || pendingStatus === null) return
      
        if (modalMode === 'subtask') {
          const parent = tasks.find(t => t.id === modalTask.parentId)
          const subtasks = tasks.filter(t => t.parentId === parent?.id)
          if (parent) updateTaskStatus([parent, ...subtasks], pendingStatus)
        } else if (modalMode === 'parent') {
          const subtasks = tasks.filter(t => t.parentId === modalTask.id)
          updateTaskStatus([modalTask, ...subtasks], pendingStatus)
        }
      }
      

    /**
     * Ordena a lista de tarefas, colocando as tarefas pai antes de suas respectivas subtarefas.
     *
     * @returns {Task[]} Uma nova array contendo as tarefas ordenadas.
     */
    const getOrderedTasksWithSubtasks = () => {
        const ordered: Task[] = []; // Inicializa uma array vazia para armazenar as tarefas ordenadas.

        // Filtra a lista de tarefas para obter apenas as tarefas que não possuem um parentId (tarefas de nível superior).
        const parents = tasks.filter(t => !t.parentId);

        // Itera sobre cada tarefa pai encontrada.
        for (const parent of parents) {
            ordered.push(parent); // Adiciona a tarefa pai à lista ordenada.

            // Filtra a lista de tarefas para obter todas as tarefas cujo parentId corresponde ao id da tarefa pai atual.
            const children = tasks.filter(t => t.parentId === parent.id);

            // Adiciona todas as subtarefas encontradas à lista ordenada, logo após a tarefa pai.
            ordered.push(...children); // O operador spread (...) expande a array de subtarefas, adicionando cada uma individualmente.
        }

        return ordered; // Retorna a nova array contendo as tarefas ordenadas.
    };

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
                modifiers={[restrictToVerticalAxis]}
                onDragStart={() => {
                    // Desativa scroll da página
                    document.body.style.overflow = 'hidden';
                  }}
                  onDragEnd={(event) => {
                    // Reativa scroll da página
                    document.body.style.overflow = '';
                    handleDragEnd(event);
                  }}
            >
                <SortableContext
                    items={tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="space-y-1">
                        {getOrderedTasksWithSubtasks().map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onEditTask={onEditTask}
                                onMakeSubtask={handleMakeSubtask}
                                onStatusSwitch={(newStatus) => handleStatusSwitch(task, newStatus)}
                                refreshTasks={refreshTasks}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </section>
    )
}
