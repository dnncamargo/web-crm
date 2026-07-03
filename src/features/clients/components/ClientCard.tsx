import { useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import type { Address } from "../../addresses/addressTypes";
import type { Client, ContactFrequency } from "../clientTypes";
import { formatDateBR } from "../../../utils/dateFormat";

const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

interface ClientCardProps {
  client: Client;
  addresses: Address[];
  onFavoriteChange: (client: Client, favorite: boolean) => Promise<void>;
  onActiveChange: (client: Client, active: boolean) => Promise<void>;
  onRequestEditClient: (client: Client) => void;
  onRequestCreateAddress: (client: Client) => void;
  onRequestEditAddress: (client: Client, address: Address) => void;
}

export function ClientCard({ client, addresses, onFavoriteChange, onActiveChange, onRequestEditClient, onRequestCreateAddress, onRequestEditAddress }: ClientCardProps) {
  const [expanded, setExpanded] = useState(false);

  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);

  const primaryAddress = addresses.find((address) => address.id === client.primaryAddressId) ?? addresses.find((address) => address.isPrimaryForClient);

  const visibleTags = client.tagIds?.slice(0, 3) ?? [];

  return (
    <Card className={!client.active ? "muted-card" : ""}>
      <div className="client-card-header">
        <div>
          <h2>{client.name}</h2>
          <p>{primaryContact ? `${primaryContact.label ?? "Contato principal"} · ${primaryContact.value}` : "Sem contato principal"}</p>
        </div>

        <button
          type="button"
          className={client.favorite ? "star-button active" : "star-button"}
          onClick={() => onFavoriteChange(client, !client.favorite)}
          aria-label={client.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        >
          ★
        </button>
      </div>

      <div className="client-meta">
        <span>{frequencyLabels[client.contactFrequency]}</span>
        <span>{client.lastInteractionAt ? `Última interação: ${client.lastInteractionAt}` : "Sem interação registrada"}</span>
      </div>

      <div className="badge-row">
        {!primaryContact && <Badge>sem-contato</Badge>}
        {!primaryAddress && <Badge>sem-endereco</Badge>}
        {!client.birthDate && <Badge>sem-aniversario</Badge>}

        {visibleTags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      {expanded && (
        <div className="client-expanded-area">
          <div className="details-grid">
            <div className="detail-block">
              <span>Contato principal</span>
              <strong>{primaryContact?.value || "Não informado"}</strong>
            </div>

            <div className="detail-block">
              <span>Endereço principal</span>
              <strong>{primaryAddress ? `${primaryAddress.label} · ${primaryAddress.street}${primaryAddress.number ? `, ${primaryAddress.number}` : ""}` : "Não informado"}</strong>
            </div>

            <div className="detail-block">
              <span>Aniversário</span>
              <strong>{client.birthDate ? formatDateBR(client.birthDate) : "Não informado"}</strong>
            </div>

            <div className="detail-block">
              <span>Pedidos registrados</span>
              <strong>{client.totalOrders ?? 0}</strong>
            </div>
          </div>

          {client.notes && (
            <div className="notes-preview">
              <span>Anotações</span>
              <p>{client.notes}</p>
            </div>
          )}

          <div className="subtle-list">
            <span>Contatos cadastrados</span>

            {client.contacts?.length ? (
              client.contacts.map((contact) => (
                <small key={contact.id}>
                  {contact.isPrimary ? "Principal · " : ""}
                  {contact.label ?? contact.type}: {contact.value}
                </small>
              ))
            ) : (
              <small>Nenhum contato cadastrado</small>
            )}
          </div>

          <div className="subtle-list">
            <div className="subtle-list-header">
              <span>Endereços cadastrados</span>

              <button type="button" className="text-link compact-link" onClick={() => onRequestCreateAddress(client)}>
                Adicionar
              </button>
            </div>

            {addresses.length ? (
              addresses.map((address) => {
                const isPrimary = address.id === client.primaryAddressId;

                return (
                  <div className="subtle-list-item" key={address.id}>
                    <small>
                      {isPrimary ? "Principal · " : ""}
                      {address.label}: {address.street}
                      {address.number ? `, ${address.number}` : ""}
                      {address.neighborhood ? ` · ${address.neighborhood}` : ""}
                      {address.city ? ` · ${address.city}` : ""}
                    </small>

                    <button type="button" className="text-link compact-link" onClick={() => onRequestEditAddress(client, address)}>
                      Editar
                    </button>
                  </div>
                );
              })
            ) : (
              <small>Nenhum endereço cadastrado</small>
            )}
          </div>

          <div className="expanded-actions">
            <Button type="button" variant="secondary" onClick={() => onRequestEditClient(client)}>
              Editar cliente
            </Button>

            <Button type="button" variant="ghost" onClick={() => onRequestCreateAddress(client)}>
              Adicionar endereço
            </Button>


          </div>
        </div>
      )}

      <div className="card-actions">
        <Button type="button" variant="secondary">
          Novo pedido
        </Button>

        <Button type="button" variant="ghost">
          Interação
        </Button>

        <button type="button" className="text-link" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Mostrar menos" : "Mostrar mais"}
        </button>
      </div>

      <div className="card-footer">
        <Switch label="Cliente ativo" checked={client.active} onChange={(checked) => onActiveChange(client, checked)} />
      </div>
    </Card>
  );
}
