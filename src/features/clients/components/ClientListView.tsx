import { Badge } from "../../../components/ui/Badge";
import {
  formatClientDateTimeBR,
  frequencyLabels,
} from "../clientFormatters";
import type { Client } from "../clientTypes";

interface ClientListViewProps {
  clients: Client[];
  tagLabelsById: Record<string, string>;
  onRequestViewClient: (client: Client) => void;
  onFavoriteChange: (client: Client, favorite: boolean) => Promise<void>;
}

export function ClientListView({
  clients,
  tagLabelsById,
  onRequestViewClient,
  onFavoriteChange,
}: ClientListViewProps) {
  return (
    <div className="entity-list-view">
      {clients.map((client) => {
        const primaryContact = client.contacts?.find(
          (contact) => contact.isPrimary
        );

        const visibleTags = (client.tagIds ?? []).slice(0, 8);

        return (
          <article
            className={
              client.active
                ? "entity-row entity-row-with-side-action"
                : "entity-row entity-row-with-side-action muted-card"
            }
            key={client.id}
          >
            <button
              type="button"
              className="entity-row-clickable"
              onClick={() => onRequestViewClient(client)}
            >
              <div className="entity-row-main">
                <strong className="entity-title">{client.name}</strong>

                <span className="entity-subtitle">
                  {primaryContact
                    ? `${primaryContact.label ?? "Contato principal"} · ${
                        primaryContact.value
                      }`
                    : "Sem contato principal"}
                </span>
              </div>

              <div className="entity-badges">
                <Badge>{frequencyLabels[client.contactFrequency]}</Badge>

                {!client.active && <Badge>Inativo</Badge>}
                {!primaryContact && <Badge>sem-contato</Badge>}
                {!client.birthDate && <Badge>sem-aniversário</Badge>}

                {visibleTags.map((tagId) => (
                  <Badge key={tagId}>#{tagLabelsById[tagId] ?? tagId}</Badge>
                ))}
              </div>
            </button>

            <aside className="entity-row-side">
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

              <div className="entity-side-note">
                <span>Última interação</span>
                <small>{formatClientDateTimeBR(client.lastInteractionAt)}</small>
              </div>
            </aside>
          </article>
        );
      })}
    </div>
  );
}