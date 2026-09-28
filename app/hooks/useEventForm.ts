// hooks/useEventForm.ts
import { Event } from '../utils/interfaces'
import { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import useEventDate from './useEventDate';
import { useOptionalFields } from './useOptionalFields';
import { useAssociatePerson } from './useAssociatePerson';
import { useEventCategories } from './useEventCategories';

interface UseEventFormProps {
    uid: string;
    event?: Event;
    initialPersonId?: string;
    dateControl: ReturnType<typeof useEventDate>;
    optionalFieldsControl: ReturnType<typeof useOptionalFields>;
    associatePersonControl: ReturnType<typeof useAssociatePerson>;
    eventCategoriesControl: ReturnType<typeof useEventCategories>;
}

export function useEventForm({ uid, event, dateControl, optionalFieldsControl, associatePersonControl, eventCategoriesControl }: UseEventFormProps) {

    const [title, setTitle] = useState(''); /** @state {string} title - Título do evento. */
    const [location, setLocation] = useState(''); /** @state {string} location - Localidade do evento. */

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

    const {
        associatedPersonIds,
    } = associatePersonControl

    const {
        selectedCategories,
    } = eventCategoriesControl;

    useEffect(() => {
        if (title.trim()) {
            setError('');
        }
    }, [title]);

    useEffect(() => {
        if (event) {
            setTitle(event.title || '');
            setLocation(event.location || '');

            dateControl.setAllDay(event.allDay || false);
            dateControl.setStartDate(event.startDate);
            dateControl.setEndDate(event.endDate);
            dateControl.setStartTime(event.startTime ?? '');
            dateControl.setEndTime(event.endTime ?? '');

            eventCategoriesControl.setSelectedCategories(event.categories || []);

            associatePersonControl.resetAssociatedPeople();
            associatePersonControl.setAssociatedPersonIds(event.personIds || []);
            optionalFieldsControl.resetOptionalFields(
                Array.isArray(event.optionalFields) ? event.optionalFields : []
            );

            dateControl.setStartDate(event.startDate); // ✅ hidratar start
            dateControl.setEndDate(event.endDate);     // ✅ hidratar end
        }
    }, [event]);


    /**
     * @function validateEvent
     * @description Valida os campos obrigarórios do formulário.
     * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
     */
    function validateEvent(): string | null {
        if (!title.trim()) return 'O título do evento é obrigatório';
        if (!startDate || !endDate) return 'Informe as datas de início e término';
        if (!allDay && (!startTime || !endTime)) return 'Informe os horários de início e término';
        return null;
    }

    function formatEvent(): any {
        const base = {
            title: title.trim(),
            location,
            allDay, timeZone,
            startDate, endDate,
            startTime, endTime,
            optionalFields,
            personIds: associatedPersonIds,
            categories: selectedCategories.length > 0 ? selectedCategories : null,
            createdAt: event?.createdAt || new Date(),
        }

        return base
    }

    async function createEvent() {
        const error = validateEvent();
        if (error) {
            setError(error);
            return false;
        }

        try {
            const eventRef = formatEvent();
            await addDoc(collection(db, `users/${uid}/events-history`), eventRef);

            resetOptionalFields();
            return true;

        } catch (e) {
            console.error('Erro ao salvar no Firestore:', e);
            setError('Erro ao salvar o evento. Verifique sua conexão.');
            return false;
        }
    }

    async function updateEvent() {
        const error = validateEvent();
        if (error) {
            setError(error);
            return false;
        }

        try {
            const eventRef = formatEvent();
            await updateDoc(doc(db, `users/${uid}/events-history/${event?.id}`), { ...eventRef });
            resetOptionalFields();
            return true;

        } catch (e) {
            console.error('Erro ao atualizar no Firestore:', e);
            setError('Erro ao atualizar o evento. Verifique sua conexão.');
            return false;
        }
    }

    return {
        title, setTitle,
        location, setLocation,
        error, setError,
        createEvent,
        updateEvent,
    };
}
