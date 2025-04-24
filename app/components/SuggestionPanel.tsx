// components/SuggestionPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { addDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { motion } from 'framer-motion';
import { differenceInDays, isAfter, parseISO, add } from 'date-fns'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Person, Event, EventSuggestion } from '../utils/interfaces'
import SuggestionCard from './SuggestionCard';

interface SuggestionPanelProps {
    onClose: () => void;
    onEventCreated: () => void;
}

export default function SuggestionPanel({ onClose, onEventCreated }: SuggestionPanelProps) {
    const [suggestions, setSuggestions] = useState<EventSuggestion[]>([])

    useEffect(() => {
        fetchSuggestions()
    }, [])

    const fetchSuggestions = async () => {
        // buscar pessoas e eventos
        // aplicar a lógica de filtro
        // atualizar o estado
        const peopleSnap = await getDocs(collection(db, 'people-directory'))
        const eventsSnap = await getDocs(collection(db, 'events-history'))

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
                .sort((a, b) => (new Date(b.date)).getTime() - (new Date(a.date)).getTime())[0]

            {/* Aniversário nos próximos 7 dias */ }
            if (birthday) {
                const upcoming = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate())
                const daysUntil = differenceInDays(upcoming, now)
                if (daysUntil >= 0 && daysUntil <= 7) {
                    suggestions.push({
                        reason: 'birthday',
                        person,
                        suggestedDate: upcoming.toISOString()
                    })
                }
            }

            {/* Frequência de contato vencida */ }
            const nextContact = getNextContactDate(lastEvent?.date ? new Date(lastEvent.date) : null, person.contactFrequency)
            if (nextContact && isAfter(now, nextContact)) {
                suggestions.push({
                    reason: 'contactFrequency',
                    person,
                    suggestedDate: now.toISOString()
                })
            }

            {/* Favoritos sem eventos há muito tempo */ }
            if (person.favorite && (!lastEvent || differenceInDays(now, new Date(lastEvent.date)) > 90)) {
                suggestions.push({
                    reason: 'inactiveFavorite',
                    person,
                    suggestedDate: now.toISOString()
                })
            }
        }
        return suggestions
    }

    const handleAccept = async (suggestion: EventSuggestion) => {
        // Podemos futuramente abrir um modal para edição
        await addDoc(collection(db, 'events-history'), {
            title: `Contato com ${suggestion.person.name}`,
            personId: suggestion.person.id,
            date: suggestion.suggestedDate.split('T')[0],
            hour: '12:00', // ou deixe para o usuário editar futuramente
            createdAt: new Date(),
        });

        onEventCreated(); // Chama a função de callback para atualizar o painel principal

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
