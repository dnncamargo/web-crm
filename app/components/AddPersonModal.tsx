'use client'

import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface AddPersonModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddPersonModal = ({ onClose, onAdded }: AddPersonModalProps) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'clientes'), {
        nome,
        telefone,
        email,
        createdAt: serverTimestamp(),
      });
      onAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar pessoa:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Adicionar Pessoa</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="form-input" required />
          <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="form-input" required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />

          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="btn-secondary">Voltar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPersonModal;
