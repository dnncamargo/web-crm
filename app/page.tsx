'use client';

import Link from "next/link";
import CustomerCard from "./components/CustomerCard";
import { collection, getDocs } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';

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
      await fetchClientes(); // agora funciona sem erro de escopo
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
    }
  };
  

  return (
    <main>

      <h1>CRM</h1>

      <CustomerCard />

      <div>
        <Link href="/add-client">Adicionar Cliente</Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(cliente => (
            <tr key={cliente.id}>
              <td>{cliente.nome}</td>
              <td>{cliente.telefone}</td>
              <td>{cliente.email}</td>
              <td>
                <Link href={`/edit-client/${cliente.id}`}>Editar</Link>
                <button onClick={() => handleDelete(cliente.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
