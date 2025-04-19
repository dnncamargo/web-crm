'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { motion } from 'framer-motion';

interface AddPersonModalProps {
  onClose: () => void;
  isOpen: boolean;
  onAdded: () => void;
}

const AddPersonModal: React.FC<AddPersonModalProps> = ({ onClose, isOpen, onAdded }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'people-directory'), {
        name,
        phone,
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
    <motion.div
      className="fixed inset-0 bg-white overflow-y-auto h-full w-full z-50"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={(event, info) => {
        if (info.point.y > 400) onClose();
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-blue-500 text-lg">Cancelar</button>
          <h3 className="text-lg font-semibold">Nova Pessoa</h3>
          <button onClick={handleSubmit} className="text-blue-500 text-lg">Salvar</button>
        </div>

        {/* Seção de dados básicos */}
        <div className="bg-gray-50 rounded-lg overflow-hidden border">
          <input
            type="text"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 bg-transparent focus:outline-none"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default AddPersonModal;
