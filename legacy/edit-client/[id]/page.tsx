'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import AddEventModal from '@/app/components/AddEventModal';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

export default function EditClient() {
  const { id } = useParams();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

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
        } else {
          alert('CEP não encontrado.');
          setEndereco('');
          setBairro('');
          setCidade('');
          setUf('');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert('Erro ao buscar CEP.');
      }
    } else if (cep.length > 8) {
      alert('CEP inválido.');
      setEndereco('');
      setBairro('');
      setCidade('');
      setUf('');
      setCep(cep.slice(0, 8)); // Trunca para 8 dígitos
    }
  };

  // Buscar dados do cliente pelo ID
  useEffect(() => {
    const fetchCliente = async () => {
      const docRef = doc(db, 'clientes', id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setNome(data.nome);
        setTelefone(data.telefone);
        setEmail(data.email);
        setCep(data.cep || '');
        const enderecoCompleto = data.endereco ? data.endereco.split(', ') : [];
        setEndereco(enderecoCompleto[0] || '');
        setNumero(enderecoCompleto[1]?.split(' ')[0] || '');
        setComplemento(enderecoCompleto[1]?.substring(enderecoCompleto[1]?.indexOf(' ') + 1) || '');
        setBairro(data.bairro || '');
        setCidade(data.cidade || '');
        setUf(data.uf || '');
        setDataNascimento(data.dataNascimento || '');

      } else {
        console.log('Cliente não encontrado!');
      }
    };

    fetchCliente();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const clienteRef = doc(db, 'clientes', id as string);
      await updateDoc(clienteRef, {
        nome,
        telefone,
        email,
        endereco: `${endereco}, ${numero} ${complemento}`,
        cep,
        bairro,
        cidade,
        uf,
        dataNascimento
      });
      router.push('/');
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
    }
  };

  const openAddEventModal = () => {
    setIsAddEventModalOpen(true);
  };

  const closeAddEventModal = () => {
    setIsAddEventModalOpen(false);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow-md rounded-lg">
      <h1 className="title">Editar Cliente</h1>

      <div className="mb-4">
        <button
          onClick={openAddEventModal}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusCircleIcon className="h-5 w-5" aria-hidden="true" />
          <span>Adicionar Evento</span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nome" className="form-label">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="telefone" className="form-label">Telefone</label>
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="email" className="form-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="cep" className="form-label">CEP</label>
          <input
            type="text"
            id="cep"
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            onBlur={() => buscarEnderecoPorCep(cep)}
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="endereco" className="form-label">Endereço</label>
          <input type="text" id="endereco" value={endereco} readOnly className="form-input" />
        </div>

        <div className="flex space-x-2">
          <div className="flex-1">
            <label htmlFor="numero" className="form-label">Número</label>
            <input type="text" id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} className="form-input" />
          </div>
          <div className="flex-1">
            <label htmlFor="complemento" className="form-label">Complemento</label>
            <input type="text" id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="form-input" />
          </div>
        </div>

        <div>
          <label htmlFor="bairro" className="form-label">Bairro</label>
          <input type="text" id="bairro" value={bairro} readOnly className="form-input" />
        </div>

        <div>
          <label htmlFor="cidade" className="form-label">Cidade</label>
          <input type="text" id="cidade" value={cidade} readOnly className="form-input" />
        </div>

        <div>
          <label htmlFor="uf" className="form-label">UF</label>
          <input type="text" id="uf" value={uf} readOnly className="form-input" />
        </div>

        <div>
          <label htmlFor="dataNascimento" className="form-label">Data de Nascimento</label>
          <input type="date" id="dataNascimento" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="form-input" />
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

      {isAddEventModalOpen && (
        <AddEventModal clientId={id as string} onClose={closeAddEventModal} />
      )}

    </div>
  );
}
