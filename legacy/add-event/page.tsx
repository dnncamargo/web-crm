'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface Cliente {
    id: string;
    nome: string;
    enderecoCadastro?: string;
}

const AddEventPage = () => {
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
            try {
                const querySnapshot = await getDocs(collection(db, 'clientes'));
                const clientesData = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, enderecoCadastro: doc.data().endereco })) as Cliente[];
                setClientesCadastrados(clientesData);
            } catch (error) {
                console.error('Erro ao buscar clientes:', error);
            }
        };

        fetchClientes();
    }, []);

    useEffect(() => {
        const fetchEnderecoCliente = async (id: string) => {
            if (id) {
                try {
                    const docRef = doc(db, 'clientes', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setEnderecoCadastroCliente(docSnap.data()?.endereco || '');
                        if (usarEnderecoCadastro) {
                            setEndereco(docSnap.data()?.endereco || '');
                        }
                    } else {
                        setEnderecoCadastroCliente('');
                        if (usarEnderecoCadastro) {
                            setEndereco('');
                        }
                    }
                } catch (error) {
                    console.error('Erro ao buscar endereço do cliente:', error);
                    setEnderecoCadastroCliente('');
                    if (usarEnderecoCadastro) {
                        setEndereco('');
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
        setUsarEnderecoCadastro(false); // Resetar o checkbox ao mudar de cliente
        setEndereco(''); // Limpar o endereço digitado
    };

    const handleUsarEnderecoCadastroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsarEnderecoCadastro(e.target.checked);
        if (e.target.checked) {
            setEndereco(enderecoCadastroCliente);
        } else {
            setEndereco(''); // Limpar o endereço se desmarcar
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) {
            alert('Por favor, selecione um cliente.');
            return;
        }
        try {
            await addDoc(collection(db, 'events'), {
                clientId,
                data,
                hora,
                endereco,
                observacoes,
                createdAt: serverTimestamp(),
            });
            router.push('/'); // Redireciona para a página inicial após adicionar o evento
        } catch (error) {
            console.error('Erro ao adicionar evento:', error);
        }
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white shadow-md rounded-lg">
            <h1 className="title">Adicionar Novo Evento</h1>
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
                        readOnly={usarEnderecoCadastro} // Tornar o campo readonly se o checkbox estiver marcado
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
                    <input type="date" id="data" value={data} onChange={(e) => setData(e.target.value)} required className="form-input" />
                </div>
                <div>
                    <label htmlFor="hora" className="form-label">Hora</label>
                    <input type="time" id="hora" value={hora} onChange={(e) => setHora(e.target.value)} required className="form-input" />
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
                    Adicionar Evento
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

export default AddEventPage;