import Image from "next/image";

import Link from 'next/link';

<Link href="pages/add-client">
  <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded">
    Adicionar Cliente
  </button>
</Link>

export default function Home() {
  // Mock de dados de clientes
  const clientes = [
    { id: 1, nome: 'Ana Porto', telefone: '(21) 99999-0000', email: 'ana@porto.com' },
    { id: 2, nome: 'Carlos Silva', telefone: '(21) 98888-1111', email: 'carlos@exemplo.com' },
  ];


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-6">Delícias do Porto CRM</h1>

      <div className="mb-4 flex justify-end">
        <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded">
          Adicionar Cliente
        </button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-600 p-2">Nome</th>
            <th className="border border-gray-600 p-2">Telefone</th>
            <th className="border border-gray-600 p-2">Email</th>
            <th className="border border-gray-600 p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(cliente => (
            <tr key={cliente.id}>
              <td className="border border-gray-700 p-2">{cliente.nome}</td>
              <td className="border border-gray-700 p-2">{cliente.telefone}</td>
              <td className="border border-gray-700 p-2">{cliente.email}</td>
              <td className="border border-gray-700 p-2 flex gap-2">
                <button className="bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm">Editar</button>
                <button className="bg-red-600 hover:bg-red-500 text-white py-1 px-3 rounded text-sm">Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
