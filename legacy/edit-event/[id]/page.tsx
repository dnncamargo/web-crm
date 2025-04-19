'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';

interface Cliente {
  id: string;
  nome: string;
  enderecoCadastro?: string;
}

const EditEventPage = () => {
  const { id } = useParams();
  const router = useRouter();

  const [clientId, setClientId] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [clientesCadastrados, setClientesCadastrados] = useState<Cliente[]>([]);
  const [usarEnderecoCadastro, setUsarEnderecoCadastro] = useState(false);
  const [enderecoCadastroCliente, setEnderecoCadastroCliente] = useState('');

  useEffect(() => {
    const fetchClientes = async () => {
      const querySnapshot = await getDocs(collection(db, 'clientes'));
      const clientesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
        enderecoCadastro: doc.data().endereco
      })) as Cliente[];
      setClientesCadastrados(clientesData);
    };

    const fetchEvento = async () => {
      const docRef = doc(db, 'events', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const evento = docSnap.data();
        setClientId(evento.clientId);
        setData(evento.data);
        setHora(evento.hora);
        setEndereco(evento.endereco);
        setObservacoes(evento.observacoes);
      }
    };

    fetchClientes();
    fetchEvento();
  }, [id]);

  useEffect(() => {
    const fetchEnderecoCliente = async (clientId: string) => {
      if (clientId) {
        const docRef = doc(db, 'clientes', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEnderecoCadastroCliente(docSnap.data().endereco || '');
          if (usarEnderecoCadastro) {
            setEndereco(docSnap.data().endereco || '');
          }
        }
      } else {
        setEnderecoCadastroCliente('');
        if (usarEnderecoCadastro) {
          setEndereco('');
        }
      }
    };

    fetchEnderecoCliente(clientId);
  }, [clientId, usarEnderecoCadastro]);

  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setClientId(e.target.value);
    setUsarEnderecoCadastro(false);
    setEndereco('');
  };

  const handleUsarEnderecoCadastroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsarEnderecoCadastro(e.target.checked);
    if (e.target.checked) {
      setEndereco(enderecoCadastroCliente);
    } else {
      setEndereco('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'events', id as string);
      await updateDoc(docRef, {
        clientId,
        data,
        hora,
        endereco,
        observacoes
      });
      router.push('/');
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow-md rounded-lg">
      <h1 className="title">Editar Evento</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="clientId" className="form-label">Cliente</label>
          <select
            id="clientId"
            value={clientId}
            onChange={handleClienteChange}
            required
            className="form-input"
          >
            <option value="">Selecione um cliente</option>
            {clientesCadastrados.map(cliente => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="endereco" className="form-label">Endereço</label>
          <input
            type="text"
            id="endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="form-input"
            readOnly={usarEnderecoCadastro}
          />
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={usarEnderecoCadastro}
              onChange={handleUsarEnderecoCadastroChange}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
            <span>Usar endereço do cadastro</span>
          </label>
        </div>

        <div>
          <label htmlFor="data" className="form-label">Data</label>
          <input
            type="date"
            id="data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="hora" className="form-label">Hora</label>
          <input
            type="time"
            id="hora"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="observacoes" className="form-label">Observações</label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="form-input"
          />
        </div>
        <button
          type="submit"
          className="btn-primary mt-4"
        >
          Salvar Alterações
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary ml-2"
        >
          Voltar
        </button>
      </form>
    </div>
  );
};

export default EditEventPage;
