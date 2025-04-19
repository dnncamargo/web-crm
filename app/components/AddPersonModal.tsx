'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface AddPersonModalProps {
  onClose: () => void;
  isOpen: boolean;
  onAdded: () => void;
}

const AddPersonModal: React.FC<AddPersonModalProps> = ({ onClose, isOpen, onAdded }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [zipcode, setZipcode] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [birthday, setBirthday] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const searchAddress = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(data.logradouro);
          setDistrict(data.bairro);
          setCity(data.localidade);
          setState(data.uf);
        } else {
          alert('CEP não encontrado.');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'people-directory'), {
        name,
        phone,
        email,
        ...(showMore && {
          zipcode,
          address,
          number,
          complement,
          district,
          city,
          state,
          birthday,
          note,
        }),
        createdAt: new Date(),
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
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-blue-500 text-lg">Cancelar</button>
          <h3 className="text-lg font-semibold">Novo Cadastro</h3>
          <button onClick={handleSubmit} className="text-blue-500 text-lg">Salvar</button>
        </div>

        <div className="bg-gray-50 rounded-lg overflow-hidden border">
          <input type="text" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
          <input type="text" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-transparent focus:outline-none" />
        </div>

        {/* Switch Mostrar Mais */}
        <div className="flex justify-between items-center py-4 border-gray-200">
          <span>Mostrar mais campos</span>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className={clsx('w-12 h-6 rounded-full transition flex items-center p-1', showMore ? 'bg-blue-500' : 'bg-gray-300')}
          >
            <div className={clsx('bg-white w-4 h-4 rounded-full shadow transform transition', showMore ? 'translate-x-6' : 'translate-x-0')} />
          </button>
        </div>

        {showMore && (
          <>

            {/* Endereço */}
            <div className="border-gray-200 pt-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <input type="checkbox" checked={useAddressAPI} onChange={() => setUseAddressAPI(!useAddressAPI)} />
                <span>Usar CEP</span>
              </div>

              {useAddressAPI && (
                <div className="bg-gray-50 rounded-lg overflow-hidden border">
                  <input type="text" placeholder="CEP" value={zipcode} onChange={(e) => setZipcode(e.target.value)} onBlur={() => searchAddress(zipcode)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
                  <input type="text" placeholder="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
                  <input type="text" placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
                  <input type="text" placeholder="Bairro" value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
                  <input type="text" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="w-full p-4 bg-transparent focus:outline-none" />
                </div>
              )}
            </div>

            {/* Outros campos */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg overflow-hidden border w-full max-w-[200px]">
                <input type="date" 
                value={birthday} 
                onChange={(e) => setBirthday(e.target.value)} 
                className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
              </div>
              <div className="bg-gray-50 rounded-lg overflow-hidden border">
                <textarea
                  placeholder="Notas"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-4 bg-transparent focus:outline-none resize-none"
                  rows={4}
                />
              </div>
            </div>

          </>
        )}
      </div>

    </motion.div>
  );
};

export default AddPersonModal;
