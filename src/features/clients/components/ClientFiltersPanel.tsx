import { Card } from "../../../components/ui/Card";

interface ClientFiltersPanelProps {
  search: string;
  showOnlyFavorites: boolean;
  showOnlyActive: boolean;
  showOnlyWithContactFrequency: boolean;
  showOnlyWithBirthDate: boolean;
  onSearchChange: (value: string) => void;
  onToggleFavorites: () => void;
  onToggleActive: () => void;
  onToggleWithContactFrequency: () => void;
  onToggleWithBirthDate: () => void;
}

export function ClientFiltersPanel({
  search,
  showOnlyFavorites,
  showOnlyActive,
  showOnlyWithContactFrequency,
  showOnlyWithBirthDate,
  onSearchChange,
  onToggleFavorites,
  onToggleActive,
  onToggleWithContactFrequency,
  onToggleWithBirthDate,
}: ClientFiltersPanelProps) {
  return (
    <Card>
      <div className="toolbar search-filter-toolbar">
        <input
          className="toolbar-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar clientes"
          aria-label="Buscar clientes"
        />

        <button
          type="button"
          className={showOnlyFavorites ? "filter-pill active" : "filter-pill"}
          onClick={onToggleFavorites}
        >
          Favoritos
        </button>

        <button
          type="button"
          className={showOnlyActive ? "filter-pill active" : "filter-pill"}
          onClick={onToggleActive}
        >
          Ativos
        </button>

        <button
          type="button"
          className={
            showOnlyWithContactFrequency
              ? "filter-pill active"
              : "filter-pill"
          }
          onClick={onToggleWithContactFrequency}
        >
          Com frequência
        </button>

        <button
          type="button"
          className={
            showOnlyWithBirthDate ? "filter-pill active" : "filter-pill"
          }
          onClick={onToggleWithBirthDate}
        >
          Com aniversário
        </button>
      </div>
    </Card>
  );
}
