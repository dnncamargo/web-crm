'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';

export default function EditClient() {
  const { id } = useParams();
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

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
        email
      });
      router.push('/');
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
    }
  };
  return (
    <div>
      <h1>Editar Cliente</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Telefone</label>
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}
