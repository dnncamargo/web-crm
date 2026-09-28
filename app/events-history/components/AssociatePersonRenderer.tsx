import { Person } from "@/app/utils/interfaces";

type AssociatePersonRendererProps = {
  personIds: string[];
  people: Person[];
  onOpenPersonList: () => void;
};

export function AssociatePersonRenderer({
  personIds,
  people,
  onOpenPersonList,
}: AssociatePersonRendererProps) {
  if (personIds.length === 0) {
    return null;
  }

  const firstPerson = people.find((p) => p.id === personIds[0]);

  const remainingCount = personIds.length - 1;

  const label = firstPerson
    ? `${firstPerson.name}${remainingCount > 0 ? ` + ${remainingCount} pessoa${remainingCount > 1 ? 's' : ''}` : ''}`
    : `${personIds.length} pessoa${personIds.length > 1 ? 's' : ''}`;

  return (
    <div className="mt-6 p-2 bg-gray-50 rounded-lg overflow-hidden border">
      <span className="text-sm font-medium">Pessoas Associadas: </span>
      <button
        type="button"
        onClick={onOpenPersonList}
        className="text-blue-600 text-sm underline"
      >
        {label}
      </button>
    </div>
  );
}
