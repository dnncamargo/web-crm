import { Card } from "../../../components/ui/Card";

interface ClientFiltersPanelProps {
  showOnlyFavorites: boolean;
  showOnlyActive: boolean;
  showOnlyWithContactFrequency: boolean;
  showOnlyWithBirthDate: boolean;
  onToggleFavorites: () => void;
  onToggleActive: () => void;
  onToggleWithContactFrequency: () => void;
  onToggleWithBirthDate: () => void;
}

export function ClientFiltersPanel({
  showOnlyFavorites,
  showOnlyActive,
  showOnlyWithContactFrequency,
  showOnlyWithBirthDate,
  onToggleFavorites,
  onToggleActive,
  onToggleWithContactFrequency,
  onToggleWithBirthDate,
}: ClientFiltersPanelProps) {
  return (
    <Card>
      <div className="toolbar">
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