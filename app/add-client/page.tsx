'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import Link from 'next/link';

export default function AddClient() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

     try {
      await addDoc(collection(db, 'clientes'), {
        nome,
        telefone,
        email
      });
      router.push('/');
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
    }

    router.push('/'); // redireciona pra home após envio
  };

  return (
    <div>
      <h1>Adicionar Cliente</h1>

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
          Cadastrar
        </button>
      </form>
    </div>
  );
}
