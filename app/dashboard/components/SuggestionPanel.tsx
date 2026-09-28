// components/SuggestionPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { addDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig'
import { useAuth } from '../../components/auth/AuthProvider';
import { motion } from 'framer-motion';
import { differenceInDays, isAfter, parseISO, add } from 'date-fns'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Person, Event, EventSuggestion } from '../../utils/interfaces'
import SuggestionCard from './SuggestionCard';

interface SuggestionPanelProps {
    onClose: () => void;
    onEventCreated: () => void;
}

export default function SuggestionPanel({ onClose, onEventCreated }: SuggestionPanelProps) {
    const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
    const [suggestions, setSuggestions] = useState<EventSuggestion[]>([])

    useEffect(() => {
        if (uid) {
            fetchSuggestions()
        }
    }, [uid])

    if (!uid) {
        return <p>Carregando usuário...</p>;
    }

    const fetchSuggestions = async () => {
        // buscar pessoas e eventos
        // aplicar a lógica de filtro
        // atualizar o estado
        const peopleSnap = await getDocs(collection(db, `users/${uid}/people-directory`))
        const eventsSnap = await getDocs(collection(db, `users/${uid}/events-history`))

        const people = peopleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[]
        const events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[]

        const result = generateSuggestions(people, events)
        setSuggestions(result)
    }


    function getNextContactDate(lastContact: Date | null, frequency: Person['contactFrequency']) {
        if (!frequency || !lastContact) return null

        const freqMap = {
            weekly: 7,
            biweekly: 14,
            monthly: 30,
            quarterly: 90,
        }

        const days = freqMap[frequency]
        return add(lastContact, { days })
    }

    function generateSuggestions(people: Person[], events: Event[]): EventSuggestion[] {
        const now = new Date()
        const suggestions: EventSuggestion[] = []

        for (const person of people) {
            const birthday = person.birthday ? parseISO(person.birthday) : null
            const lastEvent = events
                .filter(e => e.personId === person.id)
                .sort((a, b) => (new Date(b.startDate)).getTime() - (new Date(a.startDate)).getTime())[0]

            {/* Aniversário nos próximos 7 dias */ }
            if (birthday) {
                const upcoming = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate())
                const daysFromNow = differenceInDays(now, upcoming)

                // Se for nos próximos 7 dias OU até 2 dias depois
                if ((daysFromNow >= -7 && daysFromNow <= 0) || (daysFromNow > 0 && daysFromNow <= 2)) {
                    suggestions.push({
                        reason: daysFromNow > 0 ? 'belatedBirthday' : 'birthday',
                        person,
                        suggestedDate: upcoming.toISOString()
                    })
                }
            }

            {/* Favorito sem data de aniversário */ }
            if (person.favorite && !person.birthday) {
                suggestions.push({
                    reason: 'favoriteMissingBirthday',
                    person,
                    suggestedDate: now.toISOString()
                })
            }
            else 
            {/* Favoritos sem eventos há muito tempo (somente se tiver data de aniversário) */ }
            if (person.favorite &&
                 (!lastEvent || differenceInDays(now, new Date(lastEvent.startDate)) > 90)) {
                suggestions.push({
                    reason: 'inactiveFavorite',
                    person,
                    suggestedDate: now.toISOString()
                })
            }

            {/* Frequência de contato vencida */ }
            const nextContact = getNextContactDate(lastEvent?.startDate ? new Date(lastEvent.startDate) : null, person.contactFrequency)
            if (nextContact && isAfter(now, nextContact)) {
                suggestions.push({
                    reason: 'contactFrequency',
                    person,
                    suggestedDate: now.toISOString()
                })
            }
        }
        return suggestions
    }

    const handleAccept = async (suggestion: EventSuggestion) => {
        if (suggestion.reason === 'favoriteMissingBirthday') {
            // Redirecionar para edição da pessoa ou abrir modal futuramente
            alert(`Adicionar data de nascimento para ${suggestion.person.name}.`);
            return;
        }

        await addDoc(collection(db, `users/${uid}/events-history`), {
            title: suggestion.reason === 'belatedBirthday'
                ? `Feliz aniversário atrasado para ${suggestion.person.name}`
                : `Contato com ${suggestion.person.name}`,
            personId: suggestion.person.id,
            date: suggestion.suggestedDate.split('T')[0],
            hour: '12:00',
            createdAt: new Date(),
        });

        onEventCreated();
        setSuggestions(prev => prev.filter(s => s !== suggestion));
    };

    const handleReject = (suggestion: EventSuggestion) => {
        // Por enquanto, apenas removemos da lista local
        setSuggestions(prev => prev.filter(s => s !== suggestion));
    };


    return (
        <motion.div
            animate={{ x: 120 }} // Posição final
            initial={{ x: '100%' }} // Inicia fora da tela
            exit={{ x: '100%' }}    // Sai para fora da tela
            transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.5 }} //Transição suave
            className="fixed top-0 right-0 w-full sm:w-96 h-full bg-white z-40 shadow-xl p-4 overflow-y-auto"
        >

            <div className='lateral-panel mt-4'>
                <div className='lateral-header flex p-2'>
                    <button
                        className='flex-none mr-2'
                        onClick={onClose}>
                        <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                    <h2 className="text-lg font-semibold flex-1">Sugestões de Evento</h2>
                </div>
                {/* Sugestões de eventos */}

                {Object.values(suggestions).flat().length === 0 && (
                    <p className="text-gray-600 text-center text-wrap ml-10 w-40">Adicione pessoas e eventos para ver sugestões.</p>
                )}

            </div>

            {suggestions.map((sug, i) => (
                <SuggestionCard
                    key={i}
                    suggestion={sug}
                    onAccept={() => handleAccept(sug)}
                    onReject={() => handleReject(sug)}
                />

            ))}
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400">✕</button>
        </motion.div>

    )
}
