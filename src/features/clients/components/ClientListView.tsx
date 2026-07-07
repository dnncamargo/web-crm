import { Badge } from "../../../components/ui/Badge";
import type { Client, ContactFrequency } from "../clientTypes";

interface ClientListViewProps {
  clients: Client[];
  tagLabelsById: Record<string, string>;
  onRequestViewClient: (client: Client) => void;
  onFavoriteChange: (client: Client, favorite: boolean) => Promise<void>;
}

const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function formatDateTimeBR(value?: string | null) {
  if (!value) {
    return "Sem interação";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function ClientListView({
  clients,
  tagLabelsById,
  onRequestViewClient,
  onFavoriteChange,
}: ClientListViewProps) {
  return (
    <div className="client-list-view">
      {clients.map((client) => {
        const primaryContact = client.contacts?.find(
          (contact) => contact.isPrimary
        );

        const visibleTags = (client.tagIds ?? []).slice(0, 8);

        return (
          <article
            className={
              client.active
                ? "client-list-row-card"
                : "client-list-row-card muted-card"
            }
            key={client.id}
          >
            <button
              type="button"
              className="client-list-row-button"
              onClick={() => onRequestViewClient(client)}
            >
              <div className="client-list-main-info">
                <strong>{client.name}</strong>

                <span>
                  {primaryContact
                    ? `${primaryContact.label ?? "Contato principal"} · ${
                        primaryContact.value
                      }`
                    : "Sem contato principal"}
                </span>
              </div>

              <div className="client-list-badges">
                <Badge>{frequencyLabels[client.contactFrequency]}</Badge>

                {!client.active && <Badge>Inativo</Badge>}
                {!primaryContact && <Badge>sem-contato</Badge>}
                {!client.birthDate && <Badge>sem-aniversário</Badge>}

                {visibleTags.map((tagId) => (
                  <Badge key={tagId}>#{tagLabelsById[tagId] ?? tagId}</Badge>
                ))}
              </div>
            </button>

            <aside className="client-list-side">
              <button
                type="button"
                className={client.favorite ? "star-button active" : "star-button"}
                onClick={() => onFavoriteChange(client, !client.favorite)}
                aria-label={
                  client.favorite
                    ? "Remover dos favoritos"
                    : "Marcar como favorito"
                }
              >
                ★
              </button>

              <div className="client-list-last-interaction">
                <span>Última interação</span>
                <small>{formatDateTimeBR(client.lastInteractionAt)}</small>
              </div>
            </aside>
          </article>
        );
      })}
    </div>
  );
}