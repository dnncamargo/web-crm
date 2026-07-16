import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import type { Address } from "../../addresses/addressTypes";
import type { Client, ContactFrequency } from "../clientTypes";
import type { Tag } from "../../tags/tagTypes";
import { formatDateBR } from "../../../utils/dateFormat";

const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequÃªncia",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

interface ClientCardProps {
  client: Client;
  addresses: Address[];
  availableTags: Tag[];
  tagLabelsById: Record<string, string>;
  expanded: boolean;
  onToggleExpanded: (clientId: string) => void;
  onFavoriteChange: (client: Client, favorite: boolean) => Promise<void>;
  onActiveChange: (client: Client, active: boolean) => Promise<void>;
  onRequestEditClient: (client: Client) => void;
  onRequestCreateAddress: (client: Client) => void;
  onRequestEditAddress: (client: Client, address: Address) => void;
}

export function ClientCard({
  client,
  addresses,
  expanded,
  onToggleExpanded,
  tagLabelsById,
  onFavoriteChange,
  onActiveChange,
  onRequestEditClient,
  onRequestCreateAddress,
  onRequestEditAddress,
}: ClientCardProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);

  const primaryAddress = addresses.find((address) => address.id === client.primaryAddressId) ?? addresses.find((address) => address.isPrimaryForClient);
  const visibleTags = (client.tagIds ?? []).slice(0, 3);

  return (
    <Card className={!client.active ? "muted-card" : ""}>
      <div className="client-card-header">
        <div>
          <h2>{client.name}</h2>
          <p>{primaryContact ? `${primaryContact.label ?? "Contato principal"} Â· ${primaryContact.value}` : "Sem contato principal"}</p>
        </div>

        <button
          type="button"
          className={client.favorite ? "star-button active" : "star-button"}
          onClick={() => onFavoriteChange(client, !client.favorite)}
          aria-label={client.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        >
          â˜…
        </button>
      </div>

      <div className="client-meta">
        <span>{frequencyLabels[client.contactFrequency]}</span>
        <span>{client.lastInteractionAt ? `Ãšltima interaÃ§Ã£o: ${client.lastInteractionAt}` : "Sem interaÃ§Ã£o registrada"}</span>
      </div>

      <div className="entity-badges">
        {!primaryContact && <Badge>sem-contato</Badge>}
        {!primaryAddress && <Badge>sem-endereco</Badge>}
        {!client.birthDate && <Badge>sem-aniversario</Badge>}

        {visibleTags.map((tagId) => (
          <Badge key={tagId}>{(tagLabelsById[tagId] ?? tagId).replace(/^#+/, "")}</Badge>
        ))}
      </div>

      {expanded && (
        <div className="client-expanded-area">
          <div className="panel-block-grid">
            <div className="panel-block">
              <span>Contato principal</span>
              <strong>{primaryContact?.value || "NÃ£o informado"}</strong>
            </div>

            <div className="panel-block">
              <span>EndereÃ§o principal</span>
              <strong>{primaryAddress ? `${primaryAddress.label} Â· ${primaryAddress.street}${primaryAddress.number ? `, ${primaryAddress.number}` : ""}` : "NÃ£o informado"}</strong>
            </div>

            <div className="panel-block">
              <span>AniversÃ¡rio</span>
              <strong>{client.birthDate ? formatDateBR(client.birthDate) : "NÃ£o informado"}</strong>
            </div>

            <div className="panel-block">
              <span>Pedidos registrados</span>
              <strong>{client.totalOrders ?? 0}</strong>
            </div>
          </div>

          <div className="panel-list">
            <span>Etiquetas</span>

            {client.tagIds?.length ? client.tagIds.map((tagId) => <small key={tagId}>#{(tagLabelsById[tagId] ?? tagId).replace(/^#+/, "")}</small>) : <small>Nenhuma etiqueta associada</small>}
          </div>

          {client.notes && (
            <div className="panel-note">
              <span>AnotaÃ§Ãµes</span>
              <p>{client.notes}</p>
            </div>
          )}

          <div className="panel-list">
            <span>Contatos cadastrados</span>

            {client.contacts?.length ? (
              client.contacts.map((contact) => (
                <small key={contact.id}>
                  {contact.isPrimary ? "Principal Â· " : ""}
                  {contact.label ?? contact.type}: {contact.value}
                </small>
              ))
            ) : (
              <small>Nenhum contato cadastrado</small>
            )}
          </div>

          <div className="panel-list">
            <div className="panel-section-title">
              <span>EndereÃ§os cadastrados</span>

              <button type="button" className="text-link compact-link" onClick={() => onRequestCreateAddress(client)}>
                Adicionar
              </button>
            </div>

            {addresses.length ? (
              addresses.map((address) => {
                const isPrimary = address.id === client.primaryAddressId;

                return (
                  <div className="panel-list-row" key={address.id}>
                    <small>
                      {isPrimary ? "Principal Â· " : ""}
                      {address.label}: {address.street}
                      {address.number ? `, ${address.number}` : ""}
                      {address.neighborhood ? ` Â· ${address.neighborhood}` : ""}
                      {address.city ? ` Â· ${address.city}` : ""}
                    </small>

                    <button type="button" className="text-link compact-link" onClick={() => onRequestEditAddress(client, address)}>
                      Editar
                    </button>
                  </div>
                );
              })
            ) : (
              <small>Nenhum endereÃ§o cadastrado</small>
            )}
          </div>

          <div className="expanded-actions">
            <Button type="button" variant="secondary" onClick={() => onRequestEditClient(client)}>
              Editar cliente
            </Button>

            <Button type="button" variant="ghost" onClick={() => onRequestCreateAddress(client)}>
              Adicionar endereÃ§o
            </Button>
          </div>
        </div>
      )}

      <div className="card-actions">
        <Button type="button" variant="secondary">
          Novo pedido
        </Button>

        <Button type="button" variant="ghost">
          InteraÃ§Ã£o
        </Button>

        <button type="button" className="text-link" onClick={() => onToggleExpanded(client.id)}>
          {expanded ? "Mostrar menos" : "Mostrar mais"}
        </button>
      </div>

      <div className="card-footer">
        <Switch label="Cliente ativo" checked={client.active} onChange={(checked) => onActiveChange(client, checked)} />
      </div>
    </Card>
  );
}

