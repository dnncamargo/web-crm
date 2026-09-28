import { Person } from "@/app/utils/interfaces";

type AssociatedPeopleModalProps = {
  personIds: string[];
  people: Person[];
  onDisassociatePerson: (personId: string) => void;
  onClose: () => void;
};

export function AssociatedPeopleModal({
  personIds,
  people,
  onDisassociatePerson,
  onClose,
}: AssociatedPeopleModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Pessoas Associadas</h2>
        {personIds.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma pessoa associada.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {personIds.map((id) => {
              const person = people.find((p) => p.id === id);
              if (!person) return null;
              return (
                <li key={id} className="flex items-center justify-between">
                  <span>{person.name}</span>
                  <div className="space-x-2">
                    <a
                      href={`/person/${id}`}
                      className="text-blue-500 text-sm underline"
                    >
                      Detalhes
                    </a>
                    <button
                      onClick={() => onDisassociatePerson(id)}
                      className="text-red-500 text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
