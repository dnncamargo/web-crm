'use client';

import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';

interface EditPersonModalProps {
  personId: string;
  initialData: Person;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const EditPersonModal = ({ personId, initialData, onClose, onUpdated, onDeleted }: EditPersonModalProps) => {
  const [name, setName] = useState(initialData.name);
  const [phone, setPhone] = useState(initialData.phone);
  const [email, setEmail] = useState(initialData.email);
  const [zipcode, setZipcode] = useState(initialData.zipcode || '');
  const [address, setAddress] = useState(initialData.address || '');
  const [number, setNumber] = useState(initialData.number || '');
  const [complement, setComplement] = useState(initialData.complement || '');
  const [district, setDistrict] = useState(initialData.district || '');
  const [city, setCity] = useState(initialData.city || '');
  const [state, setState] = useState(initialData.state || '');
  const [birthday, setBirthday] = useState(initialData.birthday || '');

  const buscarEnderecoPorCep = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(data.logradouro);
          setDistrict(data.bairro);
          setCity(data.localidade);
          setState(data.uf);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const personRef = doc(db, 'people-directory', personId);
      await updateDoc(personRef, {
        name,
        phone,
        email,
        zipcode,
        address,
        number,
        complement,
        district,
        city,
        state,
        birthday,
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar pessoa:', error);
    }
  };

  const handleDelete = async () => {
    const personRef = doc(db, 'people-directory', personId);
    try {
      await deleteDoc(personRef);
      onClose();
      onUpdated();
      onDeleted();
    } catch (error) {
      console.error('Erro ao excluir pessoa:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Editar Pessoa</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="form-input" required />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="form-input" required />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="form-input" required />
          <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} onBlur={() => buscarEnderecoPorCep(zipcode)} placeholder="CEP" className="form-input" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço" className="form-input" />
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" className="form-input" />
          <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento" className="form-input" />
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Bairro" className="form-input" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="form-input" />
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" className="form-input" />
          <input value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="Data de Nascimento" className="form-input" />
            //todo: verificar se birthday é uma data ou timestamp e formatar corretamente

          <div className="flex justify-end gap-2">
            <button onClick={handleDelete} className="btn-tertiary">Excluir Cadastro</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPersonModal;
