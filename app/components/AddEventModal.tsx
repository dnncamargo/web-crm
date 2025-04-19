import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface AddEventModalProps {
  personId?: string;
  onClose: () => void;
  isOpen: boolean;
}

const AddEventModal: React.FC<AddEventModalProps> = ({ personId, onClose }) => {
  const [useZipCodeAPI, setUseZipCodeAPI] = useState(false);
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [address, setAddress] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events-history'), {
        ...(personId && { personId }),
        date,
        hour,
        address,
        notes,
        createdAt: new Date(),
      });

      onClose(); // Fechar o modal
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
    }
  };

  const searchAddress = async (zipcode: string) => {
    if (zipcode.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`)
        const data = await response.json()
        if (!data.erro) {
          setAddress(data.logradouro)
        } else {
          alert('CEP não encontrado.')
          setAddress('')
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error)
        alert('Erro ao buscar CEP.')
      }
    } else if (zipcode.length > 8) {
      alert('CEP inválido.')
      setZipcode(zipcode.slice(0, 8))
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Adicionar Evento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="date" placeholder="Data" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input" />
          <input type="time" placeholder="Hora" value={hour} onChange={(e) => setHour(e.target.value)} required className="form-input" />

          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={useZipCodeAPI} onChange={() => setUseZipCodeAPI(!useZipCodeAPI)} />
            <span>Usar CEP</span>
          </label>
          
          {!useZipCodeAPI && (
            <input type='text' placeholder='Local' value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
          )}

          {useZipCodeAPI && (
            <>
              <input
                type="text"
                placeholder="CEP"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
                onBlur={() => searchAddress(zipcode)}
                className="form-input"
              />
            </>
          )}

          {useZipCodeAPI && (
            <>
              <input type="text" placeholder="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
              <input type="text" placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} className="form-input" />
              <input type="text" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} className="form-input" />
              <input type="text" placeholder="Bairro" value={district} onChange={(e) => setDistrict(e.target.value)} className="form-input" />
              <input type="text" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="form-input" />
            </>
          )}

          <textarea placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input"></textarea>

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