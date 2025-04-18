'use client';

import { Event } from '../utils/interfaces';
import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import BottomSheet from './BottomSheet';

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  evento: Event;
  onUpdated: () => void;
}

const EditEventModal = ({ isOpen, onClose, evento, onUpdated }: EditEventModalProps) => {
  const [data, setData] = useState(evento.data);
  const [hora, setHora] = useState(evento.hora);
  const [endereco, setEndereco] = useState(evento.endereco);
  const [observacoes, setObservacoes] = useState(evento.observacoes || '');

  useEffect(() => {
    setData(evento.data);
    setHora(evento.hora);
    setEndereco(evento.endereco);
    setObservacoes(evento.observacoes || '');
  }, [evento]);

  const handleSave = async () => {
    const docRef = doc(db, 'events', evento.id);
    await updateDoc(docRef, { data, hora, endereco, observacoes });
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'events', evento.id));
    onUpdated();
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Editar Evento">
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="form-input mb-2" />
      <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="form-input mb-2" />
      <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" className="form-input mb-2" />
      <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" className="form-input mb-2" />

      <button onClick={handleSave} className="btn-primary w-full mt-2">Salvar Alterações</button>
      <button onClick={handleDelete} className="w-full mt-2 bg-red-100 text-red-600 rounded-md py-2">Excluir Evento</button>
    </BottomSheet>
  );
};

export default EditEventModal;
