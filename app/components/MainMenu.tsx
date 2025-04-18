import Link from 'next/link';
import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';

const MainMenu = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };
    return (
        <nav className="bg-gray-100 py-4 mb-4 rounded-md shadow-sm">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-grow md:flex-grow-0 flex justify-center md:justify-start">
                        <h1 className="title">CRM</h1>
                    </div>
                    <div className="flex items-center">
                        <div className="hidden md:block">
                            <div className="ml-10 flex items-baseline space-x-4">
                                <Link href="/add-client" className="text-blue-500 hover:text-blue-700">Adicionar Cliente</Link>
                                <Link href="/add-event" className="text-green-500 hover:text-green-700">Adicionar Evento</Link>
                                <Link href="/events-history" className="text-purple-500 hover:text-purple-700">Histórico de Eventos</Link>
                            </div>
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={toggleMenu} type="button" className="bg-gray-100 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" aria-expanded="false">
                            <span className="sr-only">Abrir menu principal</span>
                            {isOpen ? <XMarkIcon className="h-6 w-6" aria-hidden="true" /> : <Bars3Icon className="h-6 w-6" aria-hidden="true" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${isOpen ? 'md:hidden' : 'hidden'}`}>
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                    <Link href="/add-client" className="block bg-gray-200 text-blue-500 hover:bg-gray-300 py-2 px-3 rounded-md">Adicionar Cliente</Link>
                    <Link href="/add-event" className="block bg-gray-200 text-green-500 hover:bg-gray-300 py-2 px-3 rounded-md">Adicionar Evento</Link>
                    <Link href="/events-history" className="block bg-gray-200 text-purple-500 hover:bg-gray-300 py-2 px-3 rounded-md">Histórico de Eventos</Link>
                </div>
            </div>
        </nav>
    );
};

export default MainMenu;