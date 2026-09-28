// hooks/useTaskForm.ts
import { Task } from '../utils/interfaces'
import { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, addDoc, updateDoc, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import useEventDate from './useEventDate';
import { useOptionalFields } from './useOptionalFields';
import CalendarEventCreator from '../components/ui/CalendarEventCreator'

interface UseTaskFormProps {
  uid: string;
  task?: Task;
  dateControl: ReturnType<typeof useEventDate>;
  optionalFieldsControl: ReturnType<typeof useOptionalFields>;
}

export function useEventForm({ uid, task, dateControl, optionalFieldsControl }: UseTaskFormProps) {
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null); /** @state {string | null} error - Mensagem de erro, se houver. */

  const {
    allDay,
    startDate,
    endDate,
    startTime,
    endTime,
    getNextDay,
    timeZone,
  } = dateControl;

  const {
    optionalFields,
    resetOptionalFields,
  } = optionalFieldsControl

  useEffect(() => {
    if (content.trim()) {
      setError('');
    }
  }, [task]);

  useEffect(() => {
    if (task) {
      setContent(task.content || '');

      optionalFieldsControl.resetOptionalFields(
        Array.isArray(task.subtasks) ? task.subtasks : []
      );
    }
  }, [task]);

  const createTask = async () => {
    if (!content.trim()) {
      alert('Digite algo para a tarefa.')
      return
    }

    setAdding(true)
    try {
      // Primeiro, busca quantas tarefas "not_started" já existem
      const q = query(
        collection(db, `users/${uid}/tasks-list`),
        where('status', '==', 0) // status 0 = not_started
      );
      const snapshot = await getDocs(q);
      const currentTasksCount = snapshot.size;

      // Adiciona a nova task com order = quantidade atual
      await addDoc(collection(db, `users/${uid}/tasks-list`), {
        content: content.trim(),
        status: 0,
        order: currentTasksCount, // <----- aqui!!
        createdAt: new Date(),
      });

      onAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar tarefa:', error)
    } finally {
      setContent('') // 🧹 limpa o campo
      setAdding(false)
    }
  }




  const handleUpdate = async () => {
    if (!content.trim()) {
      alert('Digite algo para a tarefa.');
      return;
    }

    if (!uid) return;

    if (addingDate) {
      if (!startDate || !endDate) {
        alert('Informe as datas de início e término');
        return;
      }

      if (!allDay && (!startTime || !endTime)) {
        alert('Informe os horários de início e término');
        return;
      }

      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);

      if (!allDay && start >= end) {
        alert('O horário de término deve ser após o horário de início');
        return;
      }

      const optionalFields: OptionalField[] = [];

      if (task.subtasks && task.subtasks.length > 0) {
        const confirm = window.confirm(
          "Esta tarefa possui subtarefas.\n\nDeseja que todas elas se incorporem ao novo evento?"
        );
        if (!confirm) return;
        optionalFields.push({
          id: crypto.randomUUID(),
          type: 'tasks',
          label: 'Lista de Tarefas',
          value: task.subtasks.map(sub => ({
            id: sub.id,
            text: sub.content,
            done: sub.status == 0 ? false : true,
          })),
        });
      }

      const newEvent = {
        title: content.trim(),
        startDate,
        endDate,
        ...(allDay ? { allDay: true } : { startTime, endTime }),
        createdAt: new Date().toISOString(),
        optionalFields,
      };

      try {
        await addDoc(collection(db, `users/${uid}/events-history`), newEvent);
        await deleteDoc(doc(db, `users/${uid}/tasks-list/${task.id}`));
        onUpdated();
        onClose();
      } catch (error) {
        console.error('Erro ao criar evento:', error);
      }
      return;
    }

    try {
      await updateDoc(doc(db, `users/${uid}/tasks-list/${task.id}`), {
        content: content.trim(),
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const handleCancel = () => {
    setContent('') // 🧹 limpa o campo
    onClose()
  }
}
