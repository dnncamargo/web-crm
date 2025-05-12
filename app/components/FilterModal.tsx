'use client'
interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onChangeStartDate: (date: string) => void;
  onChangeEndDate: (date: string) => void;
}

export default function FilterModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
}: FilterModalProps) {
  if (!isOpen) return null;

  const isEndBeforeStart = startDate && endDate && new Date(endDate) < new Date(startDate);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-lg text-white font-semibold mb-4">Filtrar por data</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Data inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChangeStartDate(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Data final</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChangeEndDate(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        {isEndBeforeStart && (
          <p className="text-red-500 text-sm mb-2">A data final não pode ser anterior à inicial.</p>
        )}

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
