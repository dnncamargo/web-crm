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

      <div className="table-container">
        <Link href="/add-client">Adicionar Cliente</Link>
      
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
                <td className="td-base">
                  <Link href={`/edit-client/${cliente.id}`}>Editar</Link>
                  <button onClick={() => handleDelete(cliente.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
