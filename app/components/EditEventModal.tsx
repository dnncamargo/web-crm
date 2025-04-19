'use client';

import { Event } from '../utils/interfaces';
import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface EditEventModalProps {
  isOpen: boolean;
  event: Event;
  onClose: () => void;
  onUpdated: () => void;
}

const EditEventModal = ({ isOpen, onClose, event, onUpdated }: EditEventModalProps) => {
  const [data, setData] = useState(event.data);
  const [hora, setHora] = useState(event.hora);
  const [endereco, setEndereco] = useState(event.endereco);
  const [observacoes, setObservacoes] = useState(event.observacoes || '');

  useEffect(() => {
    setData(event.data);
    setHora(event.hora);
    setEndereco(event.endereco);
    setObservacoes(event.observacoes || '');
  }, [event]);

  const handleSave = async () => {
    const docRef = doc(db, 'events', event.id);
    await updateDoc(docRef, { data, hora, endereco, observacoes });
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'events', event.id));
    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Editar Evento</h3>

        <form onSubmit={handleSave} className="space-y-3">

            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="form-input mb-2" />
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="form-input mb-2" />
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" className="form-input mb-2" />
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" className="form-input mb-2" />

            <div className="flex justify-end gap-2">
                <button onClick={handleDelete} className="btn-tertiary">Excluir Evento</button>
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
            </div>
        </form>
        </div>
    </div>
  );
};

export default EditEventModal;
