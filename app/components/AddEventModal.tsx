'use client';

import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface AddEventModalProps {
  personId?: string;
  onClose: () => void;
  isOpen: boolean;
  onAdded: () => void;
}

const AddEventModal: React.FC<AddEventModalProps> = ({ personId, onClose, isOpen, onAdded }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [hour, setHour] = useState('12:00');
  const [allDay, setAllDay] = useState(false);
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [zipcode, setZipcode] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [associatePerson, setAssociatePerson] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [person, setPerson] = useState<Person[]>([]);

  if (!isOpen) return null;

  useEffect(() => {
    const fetchPeople = async () => {
      const querySnapshot = await getDocs(collection(db, 'people-directory'));
      const peopleData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Person[];
      setPerson(peopleData);
    };

    if (isOpen) {
      fetchPeople();

      // se vier personId, associa automaticamente
      if (personId) {
        setAssociatePerson(true);
        setSelectedPersonId(personId);
      } else {
        setAssociatePerson(false);
        setSelectedPersonId('');
      }
    }
  }, [isOpen, personId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events-history'), {
        ...(associatePerson && selectedPersonId && { personId: selectedPersonId }),
        title,
        date,
        hour,
        zipcode,
        address,
        number,
        complement,
        district,
        city,
        state,
        description,
        createdAt: new Date(),
      });
      onAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
    }
  };

  const toggleAllDay = () => {
    if (!allDay) {
      setHour('');
    }
    setAllDay(!allDay);
  };

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
        alert('Erro ao buscar CEP.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Adicionar Evento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required className="form-input" />

          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={allDay} onChange={toggleAllDay} />
            <span>Dia inteiro</span>
          </label>

          {allDay && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
          )}
          
          {!allDay && (
            <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input flex-1" />
            </div>

            <div className="flex items-center gap-1 flex-1">
              <input type="time" value={hour} onChange={(e) => setHour(e.target.value)} required className="form-input flex-1" />
            </div>
          </div>
          )}

          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={useAddressAPI} onChange={() => setUseAddressAPI(!useAddressAPI)} />
            <span>Usar CEP</span>
          </label>

          {!useAddressAPI && (
            <input type='text' placeholder='Local' value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
          )}

          {useAddressAPI && (
            <>
              <input type="text" placeholder="CEP" value={zipcode} onChange={(e) => setZipcode(e.target.value)} onBlur={() => searchAddress(zipcode)} className="form-input" />
              <input type="text" placeholder="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
              <input type="text" placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} className="form-input" />
              <input type="text" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} className="form-input" />
              <input type="text" placeholder="Bairro" value={district} onChange={(e) => setDistrict(e.target.value)} className="form-input" />
              <input type="text" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="form-input" />
            </>
          )}

          <textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} className="form-input"></textarea>
          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={associatePerson} onChange={() => setAssociatePerson(!associatePerson)} />
            <span>Associar a uma pessoa</span>
          </label>

          {associatePerson && (
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Selecione a pessoa</option>
              {person.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          )}
          //todo: adicionar o endereço do cadastro da pessoa

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
