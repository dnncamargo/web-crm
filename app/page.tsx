'use client';

import Link from "next/link";
import { collection, getDocs } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';

import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Home() {

  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);

  const fetchClientes = async () => {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setClientes(dados);
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clientes', id));
      await fetchClientes(); 
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
    }
  };
  
  return (
    <main className="main-container">

      <h1 className="title">CRM</h1>

      <div>
        <Link href="/add-client" className="btn-icon">Adicionar Cliente</Link>
      
        <table className="table-base">
          <thead>
            <tr>
              <th className="th-base">Nome</th>
              <th className="th-base">Telefone</th>
              <th className="th-base">Email</th>
              <th className="th-base">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(cliente => (
              <tr key={cliente.id}>
                <td className="td-base">{cliente.nome}</td>
                <td className="td-base">{cliente.telefone}</td>
                <td className="td-base">{cliente.email}</td>
                <td className="td-base flex items-center justify-end space-x-2 actions-cell">
                  <Link href={`/edit-client/${cliente.id}`}
                    className="text-indigo-600 hover:text-indigo-900 flex items-center">
                      <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Editar</span>
                  </Link>
                <button onClick={
                      () => handleDelete(cliente.id)
                      }
                      className="text-red-600 hover:text-red-900 flex items-center">
                      <TrashIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
