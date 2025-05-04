'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { updateDoc, doc, addDoc, deleteDoc, collection } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig'
import { useAuth } from '../components/AuthProvider'
import { Task } from '../utils/interfaces'
import CalendarEventCreator from './CalendarEventCreator'

type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

type OptionalField = {
  id: string;                 // UUID para controle único
  type: 'text' | 'textarea' | 'url' | 'location' | 'person' | 'tasks';
  label: string;             // Ex: "Descrição", "URL", "Endereço Alternativo"
  value: string | TaskItem[]; // string para os outros tipos, array para tasks
};

interface EditTaskModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function EditTaskModal({ task, isOpen, onClose, onUpdated }: EditTaskModalProps) {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]; // "2025-04-25"
  const defaultTime = new Date().toTimeString().slice(0, 5); // "14:00"
  const [content, setContent] = useState(task.content || '')
  const [addingDate, setAddingDate] = useState(false)
  const [allDay, setAllDay] = useState(false); /** @state {boolean} allDay - Indica se o evento é de dia inteiro (sem hora específica). */
  const [startDate, setStartDate] = useState(today); /** @state {string} startDate - Data de início do evento no formato 'YYYY-MM-DD'. */
  const [endDate, setEndDate] = useState(today); /** @state {string} endDate - Data de término do evento no formato 'YYYY-MM-DD'. */
  const [startTime, setStartTime] = useState(defaultTime); /** @state {string} startTime - Hora de início do evento no formato 'HH:MM'. */
  const [endTime, setEndTime] = useState(defaultTime); /** @state {string} endTime - Hora de término do evento no formato 'HH:MM'. */
  const [error, setError] = useState('');

  if (!isOpen || !user || !task) return null

  useEffect(() => {
    if (task) {
      setContent(task.content)
      dateControl(); // Chama a função de controle de data para garantir que as datas estejam corretas.
    }
  }, [task, startDate, startTime, endDate, endTime, allDay])

  const handleUpdate = async () => {
    if (!content.trim()) {
      alert('Digite algo para a tarefa.');
      return;
    }

    if (!user) return;

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
        await addDoc(collection(db, `users/${user.uid}/events-history`), newEvent);
        await deleteDoc(doc(db, `users/${user.uid}/tasks-list/${task.id}`));
        onUpdated();
        onClose();
      } catch (error) {
        console.error('Erro ao criar evento:', error);
      }
      return;
    }

    try {
      await updateDoc(doc(db, `users/${user.uid}/tasks-list/${task.id}`), {
        content: content.trim(),
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const dateControl = () => {
    // Só faz a checagem se não for all-day (ou seja, está lidando com horário)
    if (allDay) {
      // All-day: endDate sempre ≥ startDate
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        setEndDate(startDate);
      }
      setStartTime('');
      setEndTime('');
      setError('');
      return;
    }

    // Horário: monta as datas completas
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) {
      // Se end está inválido, define end para +30min após start
      const newEnd = new Date(start.getTime() + 30 * 60000);
      setEndDate(newEnd.toISOString().split('T')[0]);
      setEndTime(newEnd.toTimeString().slice(0, 5));
      setError('');
    } else {
      setError('');
    }
  }

  /**
   * @function validateEvent
   * @description Valida os campos obrigarórios do formulário.
   * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
   */
  function validateEvent(): string | null {
    if (!content.trim()) return 'O título do evento é obrigatório';
    if (!startDate || !endDate) return 'Informe as datas de início e término';

    if (!allDay) {
      if (!startTime || !endTime) return 'Informe os horários de início e término';

      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      if (start >= end) return 'O horário de término deve ser após o horário de início';
    }
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Editar Tarefa</h2>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleUpdate();
            }
          }}
          placeholder="Descrição da tarefa"
          className="border w-full p-2 rounded mb-4"
        />

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={addingDate}
            onChange={() => setAddingDate(!addingDate)}
          />
          Criar evento a partir da tarefa
        </label>

        {addingDate && (
          <CalendarEventCreator
            allDay={allDay}
            setAllDay={setAllDay}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            error={error}
            setError={setError}
          />
        )}


        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-black">Cancelar</button>
          <button onClick={handleUpdate} className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
            Atualizar
          </button>
        </div>
      </div>
    </motion.div >
  )
}
