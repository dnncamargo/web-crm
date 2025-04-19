'use client'

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';

const MainMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    }

  const linkClass = (path: string) =>
    `px-4 py-2 rounded ${
      pathname === path ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <nav className="flex items-center justify-between py-4 mb-6 border-b border-gray-300">

    
      
        <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-900">
            CRM
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex gap-2 items-center">
          <Link href="/clientes" className={linkClass('/clientes')}>Clientes</Link>
          <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
          <Link href="/add-client" className={linkClass('/add-client')}>+ Cliente</Link>
          <Link href="/add-event" className={linkClass('/add-event')}>+ Evento</Link>
        </div>

        {/* Botão mobile */}
        <div className="md:hidden">
          <button
            onClick={toggleMenu}
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            {isOpen ? (
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>

      {/* Menu mobile */}
      {isOpen && (
        <div className="md:hidden mt-2 px-2 space-y-1">
          <Link href="/clientes" className={`block py-2 px-3 rounded ${pathname === '/clientes' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>Clientes</Link>
          <Link href="/events-history" className={`block py-2 px-3 rounded ${pathname === '/events-history' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>Eventos</Link>
          <Link href="/add-client" className={`block py-2 px-3 rounded ${pathname === '/add-client' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>+ Cliente</Link>
          <Link href="/add-event" className={`block py-2 px-3 rounded ${pathname === '/add-event' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>+ Evento</Link>
        </div>
      )}
    </nav>
  );
};

export default MainMenu;


/*
return (
    <nav className="flex items-center justify-between py-4 mb-6 border-b border-gray-300">

    
      
        <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-900">
            CRM
        </Link>


      <div className="flex gap-2">
        <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
        <Link href="/clientes" className={linkClass('/clientes')}>Clientes</Link>
      </div>
    </nav>
  );