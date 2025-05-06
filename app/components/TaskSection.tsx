'use client'

import { useAuth } from "../components/AuthProvider"
import { updateDoc, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
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
    const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        })
    )

    const handlePromoteSubtask = async (subtask: Task, parentTaskId: string) => {
        if (!uid) return;
        const parentRef = doc(db, `users/${uid}/tasks-list`, parentTaskId);
        const parentSnap = await getDoc(parentRef);

        if (!parentSnap.exists()) return;

        const parentTask = parentSnap.data() as Task;

        // Remove a subtask do pai
        const updatedParent: Task = {
            ...parentTask,
            subtasks: (parentTask.subtasks || []).filter(st => st.id !== subtask.id)
        };

        // Criar subtask como nova tarefa principal
        const promotedTask: Task = {
            parentTaskId: "", // zerar a parentTaskId
            ...subtask,
            subtasks: [] // assume que subtarefas não têm subtarefas
        };

        await Promise.all([
            setDoc(doc(db, `users/${uid}/tasks-list`, updatedParent.id), updatedParent),
            setDoc(doc(db, `users/${uid}/tasks-list`, promotedTask.id), promotedTask)
        ]);
        console.log("⏫ Subtask promovida", subtask)
    };

    const handleMakeSubtask = async (currentTask: Task) => {
        if (!uid) return;
        // Transformar a tarefa como subtask da tarefa acima
        const index = tasks.findIndex(t => t.id === currentTask.id);
        if (index <= 0) return alert("Não há tarefa acima para agrupar.");

        const aboveTask = tasks[index - 1];
        currentTask.parentTaskId = aboveTask.id // armazenar o id da tarefa pai

        // Remover currentTask da lista principal
        const updatedTasks = tasks.filter(t => t.id !== currentTask.id);

        // Atualizar aboveTask com nova subtask
        const updatedAboveTask: Task = {
            ...aboveTask,
            subtasks: [...(aboveTask.subtasks || []), currentTask]
        };

        await Promise.all([
            setDoc(doc(db, `users/${uid}/tasks-list`, updatedAboveTask.id), updatedAboveTask),
            deleteDoc(doc(db, `users/${uid}/tasks-list`, currentTask.id))
        ]);

        refreshTasks();
        console.log("⏬ Task agora é Subtask", currentTask)
    };

    const handleStatusSwitch = async (task: Task, newStatus: 0 | 1 | 2) => {
        if (!uid) return;
    
        const isParent = task.subtasks !== undefined;
        const isSubtask = task.parentTaskId !== undefined && task.parentTaskId !== null;
    
        // 1. CASO 1: Tarefa sem dependências
        if (!isParent && !isSubtask) {
            // Tarefa independente → apenas altera o status
            const updatedTask = { ...task, status: newStatus };
            await setDoc(doc(db, `users/${uid}/tasks-list`, task.id), updatedTask);
            refreshTasks();
            return;
        }
    
        // 2. CASO 2: Tarefa pai com subtasks
        if (isParent) {
            const confirm = window.confirm(
                "Esta tarefa possui subtarefas.\n\nDeseja alterar o status de todas elas para refletir essa mudança?"
            );
            if (!confirm) return;
    
            const updatedTask: Task = {
                ...task,
                status: newStatus,
                subtasks: (task.subtasks || []).map(sub => ({ ...sub, status: newStatus }))
            };
    
            await setDoc(doc(db, `users/${uid}/tasks-list`, task.id), updatedTask);
            refreshTasks();
            return;
        }
    
        // 3. CASO 3: Subtarefa
        if (isSubtask) {
            const parentTask = tasks.find(t => t.id === task.parentTaskId);
            if (!parentTask) return;
    
            const choice = window.confirm(
                "Esta é uma subtarefa.\n\n" +
                "Deseja:\n" +
                "- OK: aplicar o novo status à tarefa pai e todas as subtarefas\n" +
                "- Cancelar: transformar esta subtarefa em tarefa independente e alterar apenas o status dela"
            );
    
            if (choice) {
                // Atualiza o status do pai e todas as subtarefas
                const updatedParent: Task = {
                    ...parentTask,
                    status: newStatus,
                    subtasks: (parentTask.subtasks || []).map(sub => ({ ...sub, status: newStatus }))
                };
    
                await setDoc(doc(db, `users/${uid}/tasks-list`, updatedParent.id), updatedParent);
            } else {
                // Remover da lista de subtasks e inserir como task independente
                await handlePromoteSubtask({ ...task, status: newStatus }, parentTask.id);
            }
    
            refreshTasks();
        }
    };

    const handleDeleteTask = async (task: Task) => {
        if (!uid) return;
        console.log(task.id)
    
        const isParent = task.subtasks && task.subtasks.length > 0;
        const isSubtask = !isParent && tasks.some(t => t.subtasks?.some(sub => sub.id === task.id));

        if (isParent && task.subtasks?.length) {
            const confirmed = window.confirm(
                `Esta tarefa possui ${task.subtasks.length} subtarefas. Todas serão excluídas junto com ela.\n\nDeseja continuar?`
            );
            if (!confirmed) return;
    
            await deleteDoc(doc(db, `users/${uid}/tasks-list`, task.id));
            refreshTasks();
            return;
        }
    
        if (isSubtask) {
            const parent = tasks.find(t => t.subtasks?.some(sub => sub.id === task.id));
            if (!parent) return;
    
            const confirmed = window.confirm(
                "Esta tarefa é uma subtarefa. Deseja removê-la do grupo, promovê-la a tarefa principal e então excluí-la?"
            );
            if (!confirmed) return;
    
            // Promove e então exclui
            await handlePromoteSubtask(task, parent.id);
            await deleteDoc(doc(db, `users/${uid}/tasks-list`, task.id));
            refreshTasks();
            return;
        }
    
        // Task independente sem dependências
        const confirmed = window.confirm("Deseja excluir esta tarefa?");
        if (!confirmed) return;
    
        await deleteDoc(doc(db, `users/${uid}/tasks-list`, task.id));
        refreshTasks();
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
                updateDoc(doc(db, `users/${uid}/tasks-list`, task.id), { order: i })
            )
            await Promise.all(updates)
            console.log('🔥 Ordem atualizada no Firestore com sucesso!')
        } catch (error) {
            console.error('Erro ao atualizar ordem:', error)
        }
    }


    if (!uid) return null
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
                        {tasks.map(task => (
                            <li key={task.id}>
                                <TaskCard
                                    task={task}
                                    onEditTask={onEditTask}
                                    onPromoteSubtask={() => handlePromoteSubtask(task, task.id)}
                                    onMakeSubtask={handleMakeSubtask}
                                    onStatusSwitch={(newStatus) => handleStatusSwitch(task, newStatus)}
                                    parentTaskId={null} // ✅ tarefas pai não têm parentTaskId
                                    onDelete={() => handleDeleteTask(task)}
                                    refreshTasks={refreshTasks}
                                />
                                {task.subtasks?.map(subtask => (
                                    <div key={subtask.id} className="">
                                        <TaskCard
                                            task={subtask}
                                            onEditTask={onEditTask}
                                            onPromoteSubtask={() => handlePromoteSubtask(subtask, task.id)}
                                            onMakeSubtask={handleMakeSubtask}
                                            onStatusSwitch={(newStatus) => handleStatusSwitch(subtask, newStatus)}
                                            parentTaskId={task.id} // ✅ subtasks têm o ID do pai
                                            onDelete={() => handleDeleteTask(subtask)}
                                            refreshTasks={refreshTasks}
                                        />
                                    </div>
                                ))}
                            </li>
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </section>
    )
}
