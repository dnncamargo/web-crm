'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Person } from '../utils/interfaces';

interface AddEventModalProps {
  onClose: () => void;
  isOpen: boolean;
  onAdded: () => void;
  initialPersonId?: string;
}

const AddEventModal: React.FC<AddEventModalProps> = ({ onClose, isOpen, onAdded, initialPersonId }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [hour, setHour] = useState('12:00');
  const [allDay, setAllDay] = useState(false);
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [zipcode, setZipcode] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [associatePerson, setAssociatePerson] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId || '');
  const [people, setPeople] = useState<Person[]>([]);

  if (!isOpen) return null;

  useEffect(() => {
    const fetchPeople = async () => {
      const querySnapshot = await getDocs(collection(db, 'people-directory'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[];
      setPeople(data);
    };
  
    if (isOpen) {
      fetchPeople();
      if (initialPersonId) {
        setAssociatePerson(true);
        setSelectedPersonId(initialPersonId);
      } else {
        setAssociatePerson(false);
        setSelectedPersonId('');
      }
    }
  }, [isOpen, initialPersonId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events-history'), {
        title,
        date,
        hour: allDay ? '' : hour,
        zipcode,
        address,
        number,
        district,
        city,
        state,
        description,
        ...(associatePerson && selectedPersonId && { personId: selectedPersonId }),
        createdAt: new Date(),
      });
      onAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
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
          <h3 className="text-lg font-semibold">Novo Evento</h3>
          <button onClick={handleSubmit} className="text-blue-500 text-lg">Salvar</button>
        </div>

        {/* Seção: Título e Local */}

        {!useAddressAPI && (
          <>
            <div className="bg-gray-50 rounded-lg overflow-hidden border">
              <input
                type="text"
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Local ou chamada de vídeo"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-4 bg-transparent focus:outline-none"
              />
            </div>
          </>
        )}

        {useAddressAPI && (
          <>
            <div className="bg-gray-50 rounded-lg overflow-hidden border">
              <input
                type="text"
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 bg-transparent focus:outline-none resize-none"
              />
            </div>
          </>
        )}

        {/* Seção: All-day e Data */}

        <div className=" border-gray-200 pt-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span>Dia inteiro</span>
            <button
              type="button"
              onClick={() => {
                setAllDay(!allDay);
                if (!allDay) setHour('');
                else setHour('12:00');
              }}
              className={clsx(
                'w-12 h-6 rounded-full transition flex items-center p-1',
                allDay ? 'bg-blue-500' : 'bg-gray-300'
              )}
            >
              <div
                className={clsx(
                  'bg-white w-4 h-4 rounded-full shadow transform transition',
                  allDay ? 'translate-x-6' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          <div className="flex space-x-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input bg-gray-50 rounded-lg overflow-hidden border flex-1" />
            {!allDay && (
              <input type="time" value={hour} onChange={(e) => setHour(e.target.value)} className="form-input bg-gray-50 rounded-lg overflow-hidden border w-28" />
            )}
          </div>
        </div>

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

        {/* Seção: Descrição */}
        <div className="bg-gray-50 rounded-lg overflow-hidden border">
          <textarea
            placeholder="Notas"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-4 bg-transparent focus:outline-none resize-none"
            rows={4}
          />
        </div>


        {/* Associar Pessoa */}

        <div className="border-gray-200 pt-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span>Associar a uma pessoa</span>
            <button
              type="button"
              onClick={() => {
                setAssociatePerson(!associatePerson);
                if (!associatePerson) setSelectedPersonId('');
              }}
              className={clsx(
                'w-12 h-6 rounded-full transition flex items-center p-1',
                associatePerson ? 'bg-blue-500' : 'bg-gray-300'
              )}
            >
              <div
                className={clsx(
                  'bg-white w-4 h-4 rounded-full shadow transform transition',
                  associatePerson ? 'translate-x-6' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {associatePerson && (
            <div className="mt-2">
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="">Selecione a pessoa</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};

export default AddEventModal;
