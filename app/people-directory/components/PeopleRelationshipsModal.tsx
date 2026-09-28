type PeopleRelationshipsModalProps = {
  onClose: () => void;
  availableRelationships: string[];
  selectedRelationships: string[];
  toggleRelationship: (rel: string) => void;
  handleAddRelationship: (relationship: string) => void;
};

export function PeopleRelationshipsModal({
  onClose,
  availableRelationships,
  selectedRelationships,
  toggleRelationship,
  handleAddRelationship,
}: PeopleRelationshipsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Selecionar Relacionamento</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {availableRelationships.map((rel) => (
            <button
              key={rel}
              onClick={(e) => {
                e.preventDefault();
                toggleRelationship(rel);
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedRelationships.includes(rel)
                  ? "bg-green-700 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {rel}
            </button>
          ))}
        </div>

        <button
          onClick={async (e) => {
            e.preventDefault();
            const newRel = prompt("Novo relacionamento:")?.trim();
            if (newRel) {
              await handleAddRelationship(newRel);
              toggleRelationship(newRel);
            }
          }}
          className="text-green-600 text-sm mb-4"
        >
          + Novo Relacionamento
        </button>

        <div className="flex justify-end space-x-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="text-green-600 hover:underline text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
