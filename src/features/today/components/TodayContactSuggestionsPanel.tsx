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
    <div className="today-panel">
      <header>
        <div>
          <h2>Sugestões de contato</h2>
          <p>Clientes com frequência de contato vencida</p>
        </div>
      </header>

      {contactSuggestions.length === 0 ? (
        <p className="muted-text">Nenhum contato sugerido agora.</p>
      ) : (
        <div className="today-list">
          {contactSuggestions.map((client) => {
            const lastInteractionDateKey = getClientLastInteractionDateKey(client);
            const nextContactDateKey = getClientNextContactDateKey(client);

            return (
              <article className="today-list-item" key={client.id}>
                <div>
                  <strong>{client.name}</strong>
                  <span>
                    {lastInteractionDateKey
                      ? `Última interação: ${formatDateKeyBR(
                          lastInteractionDateKey
                        )}`
                      : "Sem interação registrada"}
                  </span>
                </div>

                <small>
                  {nextContactDateKey
                    ? formatDateKeyBR(nextContactDateKey)
                    : "Sem previsão"}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}