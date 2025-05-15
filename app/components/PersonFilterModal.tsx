'use client';

import { useState } from 'react';

export interface PersonFilter {
  enabled: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasBirthday: boolean;
  hasAddressByCep: boolean;
  hasNote: boolean;
  isFavorite: boolean;
  hasContactFrequency: boolean;
  whatRelationshipType: string[];
}

interface PersonFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PersonFilter;
  setFilters: (filters: PersonFilter) => void;
  availableRelationshipTypes: string[]; // exemplo: ["Amigo", "Paciente"]
}

export default function PersonFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  availableRelationshipTypes,
}: PersonFilterModalProps) {
  if (!isOpen) return null;

  const toggleEnabled = () => {
    setFilters({ ...filters, enabled: !filters.enabled });
  };

  const toggleRelationshipType = (type: string) => {
    const alreadySelected = filters.whatRelationshipType.includes(type);
    setFilters({
      ...filters,
      whatRelationshipType: alreadySelected
        ? filters.whatRelationshipType.filter((t) => t !== type)
        : [...filters.whatRelationshipType, type],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg text-white font-semibold">Filtros de Pessoas</h2>

        <div className="flex items-center justify-between">
          <span className="text-white text-sm">Ativar filtros</span>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
              filters.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                filters.enabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="space-y-2 text-white">
          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasPhone}
              onChange={(e) =>
                setFilters({ ...filters, hasPhone: e.target.checked })
              }
              className="mr-2"
            />
            Com telefone
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasEmail}
              onChange={(e) =>
                setFilters({ ...filters, hasEmail: e.target.checked })
              }
              className="mr-2"
            />
            Com e-mail
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasBirthday}
              onChange={(e) =>
                setFilters({ ...filters, hasBirthday: e.target.checked })
              }
              className="mr-2"
            />
            Com aniversário
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasAddressByCep}
              onChange={(e) =>
                setFilters({ ...filters, hasAddressByCep: e.target.checked })
              }
              className="mr-2"
            />
            Com endereço via CEP
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasNote}
              onChange={(e) =>
                setFilters({ ...filters, hasNote: e.target.checked })
              }
              className="mr-2"
            />
            Com anotações
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.isFavorite}
              onChange={(e) =>
                setFilters({ ...filters, isFavorite: e.target.checked })
              }
              className="mr-2"
            />
            Favoritos
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasContactFrequency}
              onChange={(e) =>
                setFilters({ ...filters, hasContactFrequency: e.target.checked })
              }
              className="mr-2"
            />
            Com frequência de contato
          </label>

          {/* Tipos de relacionamento */}
          <div className="text-sm">
            <p className="text-white mb-1">Tipo de relacionamento</p>
            <div className="flex flex-wrap gap-2">
              {availableRelationshipTypes.map((type) => {
                const selected = filters.whatRelationshipType.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleRelationshipType(type)}
                    className={`px-2 py-1 rounded-full border text-xs transition-colors duration-200 ${
                      selected ? 'bg-blue-600 text-white' : 'bg-white text-black'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-blue-600 hover:underline text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
