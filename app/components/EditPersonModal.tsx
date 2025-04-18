'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface EditPersonModalProps {
  personId: string;
  onClose: () => void;
  initialData: any; // você pode tipar depois se quiser
  onUpdated: () => void;
}

const EditPersonModal = ({ personId, onClose, initialData, onUpdated }: EditPersonModalProps) => {
  const [nome, setNome] = useState(initialData.nome);
  const [telefone, setTelefone] = useState(initialData.telefone);
  const [email, setEmail] = useState(initialData.email);
  const [cep, setCep] = useState(initialData.cep || '');
  const [endereco, setEndereco] = useState(initialData.endereco || '');
  const [numero, setNumero] = useState(initialData.numero || '');
  const [complemento, setComplemento] = useState(initialData.complemento || '');
  const [bairro, setBairro] = useState(initialData.bairro || '');
  const [cidade, setCidade] = useState(initialData.cidade || '');
  const [uf, setUf] = useState(initialData.uf || '');
  const [dataNascimento, setDataNascimento] = useState(initialData.dataNascimento || '');

  const buscarEnderecoPorCep = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setEndereco(data.logradouro);
          setBairro(data.bairro);
          setCidade(data.localidade);
          setUf(data.uf);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const personRef = doc(db, 'clientes', personId);
      await updateDoc(personRef, {
        nome,
        telefone,
        email,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        dataNascimento,
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar pessoa:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-10">
      <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-semibold mb-4">Editar Pessoa</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="form-input" required />
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" className="form-input" required />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="form-input" required />
          <input value={cep} onChange={(e) => setCep(e.target.value)} onBlur={() => buscarEnderecoPorCep(cep)} placeholder="CEP" className="form-input" />
          <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" className="form-input" />
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número" className="form-input" />
          <input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Complemento" className="form-input" />
          <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" className="form-input" />
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className="form-input" />
          <input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="UF" className="form-input" />
          <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="form-input" />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPersonModal;
