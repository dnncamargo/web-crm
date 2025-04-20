'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Event, Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface EditEventModalProps {
  isOpen: boolean;
  event: Event;
  onClose: () => void;
  onUpdated: () => void;
}

const EditEventModal = ({ isOpen, event, onClose, onUpdated }: EditEventModalProps) => {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [hour, setHour] = useState(event.hour);
  const [allDay, setAllDay] = useState(!event.hour);
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [zipcode, setZipcode] = useState(event.zipcode || '');
  const [address, setAddress] = useState(event.address || '');
  const [number, setNumber] = useState(event.number || '');
  const [district, setDistrict] = useState(event.district || '');
  const [city, setCity] = useState(event.city || '');
  const [state, setState] = useState(event.state || '');
  const [description, setDescription] = useState(event.description || '');
  const [associatePerson, setAssociatePerson] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [people, setPeople] = useState<Person[]>([]);

  if (!isOpen) return null;

  useEffect(() => {
    const fetchPerson = async () => {
      const querySnapshot = await getDocs(collection(db, 'people-directory'));
      const personData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Person[];
      setPeople(personData);
    };

    if (isOpen) {
      document.body.classList.add('overflow-hidden'); // Previne scroll da tela de fundo
      fetchPerson();

      if (event.personId) {
        setAssociatePerson(true);
        setSelectedPersonId(event.personId);
      } else {
        setAssociatePerson(false);
        setSelectedPersonId('');
      }
    } else {
      document.body.classList.remove('overflow-hidden'); // Libera scroll da tela de fundo
    }
    return () => {
      document.body.classList.remove('overflow-hidden'); // Remove em caso de desmontagem
    }
  }, [isOpen]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateDoc(doc(db, 'events-history', event.id), {
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
    });
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'events-history', event.id));
    onUpdated();
    onClose();
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
          <h3 className="text-lg font-semibold">Editar Evento</h3>
          <button onClick={handleSave} className="text-blue-500 text-lg">Salvar</button>
        </div>

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

        {/* All-day + Data e Hora */}

        <div className="border-gray-200 pt-4 mb-6">
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
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input bg-gray-50 rounded-lg border flex-1" />
            {!allDay && (
              <input type="time" value={hour} onChange={(e) => setHour(e.target.value)} className="form-input bg-gray-50 rounded-lg border w-28" />
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

        {/* Notas */}
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

        {/* Excluir Evento */}
        <div className="flex justify-end mt-6">
          <button onClick={handleDelete} className="text-red-500">Excluir Evento</button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditEventModal;
