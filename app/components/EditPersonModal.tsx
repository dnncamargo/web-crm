'use client';

import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface EditPersonModalProps {
  personId: string;
  initialData: Person;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  isOpen: boolean;
}

const EditPersonModal = ({ personId, initialData, onClose, onUpdated, isOpen, onDeleted }: EditPersonModalProps) => {
  const [name, setName] = useState(initialData.name);
  const [phone, setPhone] = useState(initialData.phone);
  const [email, setEmail] = useState(initialData.email);
  const [showMore, setShowMore] = useState(!!initialData.address);
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [zipcode, setZipcode] = useState(initialData.zipcode || '');
  const [address, setAddress] = useState(initialData.address || '');
  const [number, setNumber] = useState(initialData.number || '');
  const [complement, setComplement] = useState(initialData.complement || '');
  const [district, setDistrict] = useState(initialData.district || '');
  const [city, setCity] = useState(initialData.city || '');
  const [state, setState] = useState(initialData.state || '');
  const [birthday, setBirthday] = useState(initialData.birthday || '');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const searchAddress = async (zipCode: string) => {
    if (zipCode.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
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

  const handleSave = async () => {
    const personRef = doc(db, 'people-directory', personId);
    await updateDoc(personRef, {
      name, phone, email,
      ...(showMore && {
        zipcode, address, number, complement, district, city, state, birthday, note
      }),
    });
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    const personRef = doc(db, 'people-directory', personId);
    await deleteDoc(personRef);
    onUpdated();
    onClose();
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
          <h3 className="text-lg font-semibold">Editar Cadastro</h3>
          <button onClick={handleSave} className="text-blue-500 text-lg">Salvar</button>
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

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg overflow-hidden border w-full max-w-[200px]">
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full p-4 bg-transparent focus:outline-none" />
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
      
          {/* Excluir Pessoa */}
        <div className="flex justify-end mt-6">
          <button onClick={handleDelete} className="text-red-500">Excluir Cadastro</button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditPersonModal;
