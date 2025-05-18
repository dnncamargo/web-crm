// hooks/useEventForm.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../utils/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

export function useEventForm(initialPersonId?: string) {
    const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */

    const today = new Date().toISOString().split('T')[0]; // "2025-04-25"
    const defaultTime = new Date().toTimeString().slice(0, 5); // "14:00"

    const [title, setTitle] = useState(''); /** @state {string} title - Título do evento. */
    const [allDay, setAllDay] = useState(false); /** @state {boolean} allDay - Indica se o evento é de dia inteiro (sem hora específica). */
    const [startDate, setStartDate] = useState(today); /** @state {string} startDate - Data de início do evento no formato 'YYYY-MM-DD'. */
    const [endDate, setEndDate] = useState(today); /** @state {string} endDate - Data de término do evento no formato 'YYYY-MM-DD'. */
    const [startTime, setStartTime] = useState(defaultTime); /** @state {string} startTime - Hora de início do evento no formato 'HH:MM'. */
    const [endTime, setEndTime] = useState(defaultTime); /** @state {string} endTime - Hora de término do evento no formato 'HH:MM'. */
    const [useAddressAPI, setUseAddressAPI] = useState(false); /** @state {boolean} useAddressAPI - Controla se a busca de endereço via CEP está habilitada. */
    const [zipcode, setZipcode] = useState('');  /** @state {string} zipcode - Código postal do local do evento. */
    const [address, setAddress] = useState(''); /** @state {string} address - Endereço do local do evento. */
    const [number, setNumber] = useState(''); /** @state {string} number - Número do local do evento. */
    const [district, setDistrict] = useState(''); /** @state {string} district - Bairro do local do evento. */
    const [city, setCity] = useState(''); /** @state {string} city - Cidade do local do evento. */
    const [state, setState] = useState(''); /** @state {string} state - Estado (UF) do local do evento. */
    const [associatePerson, setAssociatePerson] = useState(false); /** @state {boolean} associatePerson - Controla a seção de associação de uma pessoa ao evento. */
    const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId || ''); /** @state {string} selectedPersonId - ID da pessoa selecionada para associar ao evento. */
    //const [optionalFields, setOptionalFields] = useState<OptionalField[]>([]);
    const [error, setError] = useState('');

    /**
     * @function validateEvent
     * @description Valida os campos obrigarórios do formulário.
     * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
     */
    function validateEvent(): string | null {
        if (!title.trim()) return 'O título do evento é obrigatório';
        if (!startDate || !endDate) return 'Informe as datas de início e término';

        if (!allDay) {
            if (!startTime || !endTime) return 'Informe os horários de início e término';

            const start = new Date(`${startDate}T${startTime}`);
            const end = new Date(`${endDate}T${endTime}`);
            if (start >= end) return 'O horário de término deve ser após o horário de início';
        }
        return null;
    }

    function formatEvent(): any {
        const base = {
            title: title.trim(),
            allDay,
            startDate,
            endDate,
            startTime,
            endTime,
            zipcode,
            address,
            number,
            district,
            city,
            state,
            useAddressAPI,
            location: [address, number, city, state].filter(Boolean).join(', ') || "",
            //category: selectedCategories,
            //optionalFields: [...optionalFields],
            createdAt: new Date(),
        }

        if (associatePerson && selectedPersonId) {
            (base as any).personId = selectedPersonId
        }

        if (allDay) {
            return {
                ...base,
                start: { date: startDate },
                end: { date: getNextDay(endDate) }, // precisa somar um dia inteiro para eventos allDay
            }
        } else {
            return {
                ...base,
                start: {
                    dateTime: `${startDate}T${startTime.padEnd(5, '0')}`,
                    timeZone: 'America/Sao_Paulo',
                },
                end: {
                    dateTime: `${endDate}T${endTime.padEnd(5, '0')}`,
                    timeZone: 'America/Sao_Paulo',
                },
            }
        }
    }

    function getNextDay(dateStr: string): string {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
    }

    async function createEvent() {
        const error = validateEvent();
        if (error) {
            setError(error);
            return false;
        }

        const formatted = formatEvent();
        await addDoc(collection(db, `users/${uid}/event-history`), formatted);
        return true;
    }

    return {
        // estados
        title, setTitle,
        allDay, setAllDay,
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        useAddressAPI, setUseAddressAPI,
        zipcode, setZipcode,
        address, setAddress,
        number, setNumber,
        district, setDistrict,
        city, setCity,
        state, setState,
        associatePerson, setAssociatePerson,
        selectedPersonId, setSelectedPersonId,
        error, setError,
        createEvent,
        validateEvent,
    };
}
