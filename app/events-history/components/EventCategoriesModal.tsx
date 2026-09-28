type EventCategoriesModalProps = {
  onClose: () => void;
  availableCategories: string[];
  selectedCategories: string[];
  toggleCategory: (cat: string) => void;
  handleAddCategory: (category: string) => void;
};

export function EventCategoriesModal({
  onClose,
  availableCategories,
  selectedCategories,
  toggleCategory,
  handleAddCategory,
}: EventCategoriesModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Selecionar Categorias</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={(e) => {
                e.preventDefault();
                toggleCategory(cat);
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCategories.includes(cat)
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={async (e) => {
            e.preventDefault();
            const newCat = prompt("Nova categoria:")?.trim();
            if (newCat) {
              await handleAddCategory(newCat);
              toggleCategory(newCat);
            }
          }}
          className="text-blue-600 text-sm mb-4"
        >
          + Nova Categoria
        </button>

        <div className="flex justify-end space-x-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
