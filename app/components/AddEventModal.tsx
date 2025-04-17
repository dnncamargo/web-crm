import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface AddEventModalProps {
  clientId: string;
  onClose: () => void;
}

const AddEventModal: React.FC<AddEventModalProps> = ({ clientId, onClose }) => {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events'), {
        clientId,
        data,
        hora,
        endereco,
        observacoes,
        createdAt: new Date(),
      });
      // Atualizar a lista de eventos do cliente (isso pode ser feito via state ou refetching)
      onClose(); // Fechar o modal
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Adicionar Evento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="data" className="form-label">Data</label>
            <input type="date" id="data" value={data} onChange={(e) => setData(e.target.value)} required className="form-input" />
          </div>
          <div>
            <label htmlFor="hora" className="form-label">Hora</label>
            <input type="time" id="hora" value={hora} onChange={(e) => setHora(e.target.value)} required className="form-input" />
          </div>
          <div>
            <label htmlFor="endereco" className="form-label">Endereço</label>
            <input type="text" id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="form-input" />
          </div>
          <div>
            <label htmlFor="observacoes" className="form-label">Observações</label>
            <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="form-input"></textarea>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Evento</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEventModal;