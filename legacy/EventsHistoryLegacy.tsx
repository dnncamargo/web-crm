import EventsHistory from '@/app/components/EventsHistory';

const EventsHistoryPage = () => {
  return (
    <div className="p-6">
      <h1 className="title">Histórico de Eventos</h1>
      <EventsHistory />
    </div>
  );
};

export default EventsHistoryPage;



"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

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
  const router = useRouter();
  const [eventos, setEventos] = useState<Event[]>([]);

  const fetchTodosEventos = async () => {
    const q = query(collection(db, 'events'), orderBy('data', 'asc'), orderBy('hora', 'asc'));
    const querySnapshot = await getDocs(q);
    const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    setEventos(eventosData);
  };

  useEffect(() => {
    fetchTodosEventos();
  }, []);

  // Função segura para formatar data no formato DD/MM/YYYY ou retornar "Indefinido"
  const formatarData = (data: any) => {
    if (!data) return 'Indefinido';

    // Se for string no formato 'YYYY-MM-DD'
    if (typeof data === 'string' && data.includes('-')) {
      const partes = data.split('-');
      if (partes.length !== 3) return 'Inválida';
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    // Se for objeto Date
    if (data instanceof Date) {
      return data.toLocaleDateString('pt-BR');
    }

    // Se for Timestamp do Firestore ou outro objeto com método toDate()
    if (data.toDate) {
      return data.toDate().toLocaleDateString('pt-BR');
    }

    return 'Inválida';
  };

  return (
    <div className="overflow-x-auto">

      <div className="space-y-3">
        {eventos.map(evento => (
          <div key={evento.id} className="bg-white p-4 rounded-lg shadow flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{evento.endereco}</h2>
            <p>{evento.data} às {evento.hora}</p>
            <p className="text-gray-500">{evento.observacoes}</p>
            <button onClick={() => router.push(`/edit-event/${evento.id}`)} className="btn-secondary">Editar</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsHistory;
