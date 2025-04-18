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
  };

  const linkClass = (path: string) =>
    `px-4 py-2 rounded ${
      pathname === path
        ? 'bg-gray-800 text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <nav className="border-b py-4 mb-6 shadow-sm">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-900">
          CRM
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex gap-2 items-center">
          <Link href="/people" className={linkClass('/people')}>Clientes</Link>
          <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
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
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <div className="md:hidden mt-2 px-2 space-y-1">
          <Link href="/people" className={`block py-2 px-3 rounded ${pathname === '/people' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>Clientes</Link>
          <Link href="/events-history" className={`block py-2 px-3 rounded ${pathname === '/events-history' ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`} onClick={toggleMenu}>Eventos</Link>
        </div>
      )}
    </nav>
  );
};

export default MainMenu;
