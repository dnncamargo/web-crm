import { Person } from "@/app/utils/interfaces";

type AssociatePersonModalProps = {
  onClose: () => void;
  onAssociatePerson: (personId: string) => void;
  onDisassociatePerson: (personId: string) => void;
  associatedPersonIds: string[];
  people: Person[];
};

export function AssociatePersonModal({
  onClose,
  onAssociatePerson,
  onDisassociatePerson,
  associatedPersonIds,
  people,
}: AssociatePersonModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Selecionar Pessoas</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma pessoa cadastrada.</p>
          ) : (
            people.map(person => (
              <label key={person.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={associatedPersonIds.includes(person.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onAssociatePerson(person.id);
                    } else {
                      onDisassociatePerson(person.id);
                    }
                  }}
                />
                <span>{person.name}</span>
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
