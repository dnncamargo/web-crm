type EventCategoriesRendererProps = {
  selectedCategories: string[];
};

export function EventCategoriesRenderer({
  selectedCategories,
}: EventCategoriesRendererProps) {
  if (selectedCategories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {selectedCategories.map((cat) => (
        <span
          key={cat}
          className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold"
        >
          {cat}
        </span>
      ))}
    </div>
  );
}
