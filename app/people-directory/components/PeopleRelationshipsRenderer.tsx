type PeopleRelationshipsRendererProps = {
  selectedRelationships: string[];
};

export function PeopleRelationshipsRenderer({
  selectedRelationships,
}: PeopleRelationshipsRendererProps) {
  if (selectedRelationships.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {selectedRelationships.map((rel) => (
        <span
          key={rel}
          className="bg-blue-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold"
        >
          {rel}
        </span>
      ))}
    </div>
  );
}
