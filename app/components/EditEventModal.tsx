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
  const [date, setDate] = useState(event.date);
  const [hour, setHour] = useState(event.hour);
  const [title, setTitle] = useState(event.title);
  const [zipcode, setZipcode] = useState(event.zipcode || '');
  const [address, setAddress] = useState(event.address);
  const [number, setNumber] = useState(event.number || '');
  const [complement, setComplement] = useState(event.complement || '');
  const [district, setDistrict] = useState(event.district || '');
  const [city, setCity] = useState(event.city || '');
  const [state, setState] = useState(event.state || '');
  const [useAddressAPI, setUseAddressAPI] = useState(false);
  const [description, setDescription] = useState(event.description || '');

  useEffect(() => {
    setDate(event.date);
    setHour(event.hour);
    setAddress(event.address);
    setDescription(event.description || '');
  }, [event]);

  const handleSave = async () => {
    const docRef = doc(db, 'events-history', event.id);
    await updateDoc(docRef, { date, hour, address, description, title, zipcode, number, complement, district, city, state });
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'events-history', event.id));
    onUpdated();
    onClose();
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
      <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Editar Evento</h3>

        <form onSubmit={handleSave} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="form-input mb-2" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input mb-2" />
          <input type="time" value={hour} onChange={(e) => setHour(e.target.value)} className="form-input mb-2" />

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

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="form-input mb-2" />

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
