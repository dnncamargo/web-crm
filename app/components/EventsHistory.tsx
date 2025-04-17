"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';


interface Event {
    id?: string;
    clientId: string;
    data: string;
    hora: string;
    endereco: string;
    observacoes: string;
    createdAt: Date;
}

const EventsHistory = () => {
    const [eventos, setEventos] = useState<Event[]>([]);

    const fetchTodosEventos = async () => {
        const q = query(collection(db, 'events'), orderBy('data', 'asc'), orderBy('hora', 'asc'));
        const querySnapshot = await getDocs(q);
        const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
        setEventos(eventosData);
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await deleteDoc(doc(db, 'events', eventId));
            fetchTodosEventos(); // Recarrega a lista após a exclusão
        } catch (error) {
            console.error('Erro ao excluir evento:', error);
        }
    };

    useEffect(() => {
        fetchTodosEventos();
    }, []);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
                <thead className="bg-gray-800 text-white">
                    <tr>
                        <th className="py-3 px-4 text-left">Data</th>
                        <th className="py-3 px-4 text-left">Hora</th>
                        <th className="py-3 px-4 text-left">Endereço</th>
                        <th className="py-3 px-4 text-left">Observações</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {eventos.map(evento => (
                        <tr key={evento.id} className="border-b hover:bg-gray-100">
                            <td className="py-3 px-4">{format(new Date(evento.data), 'dd/MM/yyyy', { locale: ptBR })}</td>
                            <td className="py-3 px-4">{evento.hora}</td>
                            <td className="py-3 px-4">{evento.endereco}</td>
                            <td className="py-3 px-4">{evento.observacoes}</td>
                            <td className="py-3 px-4 text-right flex justify-end space-x-2">
                                <Link href={`/edit-event/${evento.id}`} className="text-indigo-600 hover:text-indigo-900">
                                    <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                                    <span className="sr-only">Editar</span>
                                </Link>
                                <button
                                    onClick={() => handleDeleteEvent(evento.id as string)}
                                    className="text-red-600 hover:text-red-900"
                                >
                                    <TrashIcon className="h-5 w-5" aria-hidden="true" />
                                    <span className="sr-only">Excluir</span>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default EventsHistory;