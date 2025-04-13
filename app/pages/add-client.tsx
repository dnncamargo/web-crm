import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function AddClient() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const novoCliente = {
      nome,
      telefone,
      email,
    };

    console.log('Cliente cadastrado:', novoCliente);
    router.push('/'); // redireciona pra home após envio
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-6">Adicionar Cliente</h1>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block mb-1">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full p-2 rounded bg-gray-800 border border-gray-600"
          />
        </div>

        <div>
          <label className="block mb-1">Telefone</label>
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
            className="w-full p-2 rounded bg-gray-800 border border-gray-600"
          />
        </div>

        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 rounded bg-gray-800 border border-gray-600"
          />
        </div>

        <button
          type="submit"
          className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
        >
          Cadastrar
        </button>
      </form>
    </div>
  );
}
