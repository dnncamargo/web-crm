import type { Client } from "../../clients/clientTypes";
import {
  formatDateKeyBR,
  getClientLastInteractionDateKey,
  getClientNextContactDateKey,
} from "../todayUtils";

interface TodayContactSuggestionsPanelProps {
  contactSuggestions: Client[];
}

export function TodayContactSuggestionsPanel({
  contactSuggestions,
}: TodayContactSuggestionsPanelProps) {
  return (
    <div className="entity-list-group">
      <header>
        <div>
          <h2>SugestÃµes de contato</h2>
          <p>Clientes com frequÃªncia de contato vencida</p>
        </div>
      </header>

      {contactSuggestions.length === 0 ? (
        <p className="muted-text">Nenhum contato sugerido agora.</p>
      ) : (
        <div className="entity-list-view">
          {contactSuggestions.map((client) => {
            const lastInteractionDateKey = getClientLastInteractionDateKey(client);
            const nextContactDateKey = getClientNextContactDateKey(client);

            return (
              <article className="entity-row" key={client.id}>
                <div>
                  <strong>{client.name}</strong>
                  <span>
                    {lastInteractionDateKey
                      ? `Ãšltima interaÃ§Ã£o: ${formatDateKeyBR(
                          lastInteractionDateKey
                        )}`
                      : "Sem interaÃ§Ã£o registrada"}
                  </span>
                </div>

                <small>
                  {nextContactDateKey
                    ? formatDateKeyBR(nextContactDateKey)
                    : "Sem previsÃ£o"}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
