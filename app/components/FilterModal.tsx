'use client'

import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';

export interface Filters {
  enabled: boolean;
  startDate: string;
  endDate: string;
  hasRating: number;
  hasTasks: boolean;
  hasNotes: boolean;
  hasAddressByCEP: boolean;
}

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: any
  setFilters: (filters: any) => void
}

export default function FilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
}: FilterModalProps) {
  if (!isOpen) return null

  const toggleEnabled = () => {
    setFilters({ ...filters, enabled: !filters.enabled })
  }

  const isEndBeforeStart =
    filters.startDate &&
    filters.endDate &&
    new Date(filters.endDate) < new Date(filters.startDate)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg text-white font-semibold">Filtros</h2>

        {/* Switch iOS nativo */}
        <div className="flex items-center justify-between">
          <span className="text-white text-sm">Ativar filtros</span>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${filters.enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${filters.enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        {/* Datas */}
        <div>
          <label className="text-sm text-gray-300">Data inicial</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters({ ...filters, startDate: e.target.value || null })
            }
            className="w-full border p-2 rounded mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-gray-300">Data final</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters({ ...filters, endDate: e.target.value || null })
            }
            className="w-full border p-2 rounded mt-1"
          />
          {isEndBeforeStart && (
            <p className="text-red-500 text-sm mt-1">
              A data final não pode ser anterior à inicial.
            </p>
          )}
        </div>

        {/* Checkboxes adicionais */}
        <div className="space-y-2 text-white">
          {/*           <label className="block">
            <input
              type="checkbox"
              checked={filters.hasRating > 0}
              onChange={(e) =>
                setFilters({ ...filters, hasRating: e.target.checked ? 1 : 0 })
              }
              className="mr-2"
            />
            Com avaliação
          </label> */}

          {/* Filtro por avaliação */}
          <div className="text-white">
            <div className="flex space-x-2 gap-2">
              <p className="text-sm">Avaliação do Evento</p>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) =>
                  star <= filters.hasRating ? (
                    <StarSolid
                      key={star}
                      className="h-5 w-5 text-yellow-500 cursor-pointer"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          hasRating: filters.hasRating === star ? 0 : star,
                        })
                      }
                    />
                  ) : (
                    <StarOutline
                      key={star}
                      className="h-5 w-5 text-gray-400 cursor-pointer"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          hasRating: star,
                        })
                      }
                    />
                  )
                )}
              </div>
            </div>
          </div>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasTasks === true}
              onChange={(e) =>
                setFilters({ ...filters, hasTasks: e.target.checked })
              }
              className="mr-2"
            />
            Com tarefas
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasNotes === true}
              onChange={(e) =>
                setFilters({ ...filters, hasNotes: e.target.checked })
              }
              className="mr-2"
            />
            Com anotações
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={filters.hasAddressByCEP === true}
              onChange={(e) =>
                setFilters({ ...filters, hasAddressByCEP: e.target.checked })
              }
              className="mr-2"
            />
            Com endereço via CEP
          </label>
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
  )
}