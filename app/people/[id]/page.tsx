'use client'

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import MainMenu from '@/app/components/MainMenu';

const PersonDetails = () => {
  const { id } = useParams();
  const router = useRouter();
  const [person, setPerson] = useState<any>(null);

  useEffect(() => {
    const fetchPerson = async () => {
      const docRef = doc(db, 'clientes', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPerson(docSnap.data());
      }
    };
    fetchPerson();
  }, [id]);

  if (!person) return <p className="p-6">Carregando dados...</p>;

  return (
    <div className="p-6">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Detalhes da Pessoa</h1>

      <div className="bg-white p-4 rounded-lg shadow space-y-2">
        <p><strong>Nome:</strong> {person.nome}</p>
        <p><strong>Telefone:</strong> {person.telefone}</p>
        <p><strong>Email:</strong> {person.email}</p>
        <p><strong>CEP:</strong> {person.cep}</p>
        <p><strong>Endereço:</strong> {person.endereco}</p>
        <p><strong>Bairro:</strong> {person.bairro}</p>
        <p><strong>Cidade:</strong> {person.cidade}</p>
        <p><strong>UF:</strong> {person.uf}</p>
        <p><strong>Data de Nascimento:</strong> {person.dataNascimento}</p>

        <button onClick={() => router.back()} className="btn-secondary mt-4">Voltar</button>
      </div>
    </div>
  );
};

export default PersonDetails;
