import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { formatDateBR } from "../../../utils/dateFormat";
import type { Address } from "../../addresses/addressTypes";
import type { Client, ContactFrequency } from "../clientTypes";

interface ClientDetailsPanelContentProps {
  client: Client;
  addresses: Address[];
  tagLabelsById: Record<string, string>;
  onEdit: () => void;
  onRegisterInteraction: () => void;
  onCreateAddress: () => void;
  onEditAddress: (address: Address) => void;
  onSetActive: (checked: boolean) => Promise<void>;
  onSetFavorite: (checked: boolean) => Promise<void>;
}

const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function formatDateTimeBR(value?: string | null) {
  if (!value) {
    return "Sem interação registrada";
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

export function ClientDetailsPanelContent({
  client,
  addresses,
  tagLabelsById,
  onEdit,
  onRegisterInteraction,
  onCreateAddress,
  onEditAddress,
  onSetActive,
  onSetFavorite,
}: ClientDetailsPanelContentProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);

  const primaryAddress =
    addresses.find((address) => address.id === client.primaryAddressId) ??
    addresses.find((address) => address.isPrimaryForClient);

  return (
    <div className="detail-section">
      <div className="details-grid">
        <div className="detail-block">
          <span>Cliente</span>
          <strong>{client.name}</strong>
        </div>

        <div className="detail-block">
          <span>Contato principal</span>
          <strong>{primaryContact?.value || "Não informado"}</strong>
        </div>

        <div className="detail-block">
          <span>Endereço principal</span>
          <strong>
            {primaryAddress
              ? `${primaryAddress.label} · ${primaryAddress.street}${
                  primaryAddress.number ? `, ${primaryAddress.number}` : ""
                }`
              : "Não informado"}
          </strong>
        </div>

        <div className="detail-block">
          <span>Aniversário</span>
          <strong>
            {client.birthDate ? formatDateBR(client.birthDate) : "Não informado"}
          </strong>
        </div>

        <div className="detail-block">
          <span>Frequência de contato</span>
          <strong>{frequencyLabels[client.contactFrequency]}</strong>
        </div>

        <div className="detail-block">
          <span>Última interação</span>
          <strong>{formatDateTimeBR(client.lastInteractionAt)}</strong>
        </div>

        <div className="detail-block">
          <span>Pedidos</span>
          <strong>{client.totalOrders ?? 0}</strong>
        </div>
      </div>

      <div className="badge-row">
        <Badge>{client.active ? "Ativo" : "Inativo"}</Badge>
        {client.favorite && <Badge>Favorito</Badge>}
        <Badge>{frequencyLabels[client.contactFrequency]}</Badge>
      </div>

      <div className="subtle-list">
        <span>Etiquetas</span>

        {client.tagIds?.length ? (
          client.tagIds.map((tagId) => (
            <small key={tagId}>#{tagLabelsById[tagId] ?? tagId}</small>
          ))
        ) : (
          <small>Nenhuma etiqueta associada</small>
        )}
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

          <button
            type="button"
            className="text-link compact-link"
            onClick={onCreateAddress}
          >
            Adicionar
          </button>
        </div>

        {addresses.length ? (
          addresses.map((address) => (
            <div className="subtle-list-item" key={address.id}>
              <small>
                {address.id === client.primaryAddressId ? "Principal · " : ""}
                {address.label}: {address.street}
                {address.number ? `, ${address.number}` : ""}
                {address.neighborhood ? ` · ${address.neighborhood}` : ""}
                {address.city ? ` · ${address.city}` : ""}
              </small>

              <button
                type="button"
                className="text-link compact-link"
                onClick={() => onEditAddress(address)}
              >
                Editar
              </button>
            </div>
          ))
        ) : (
          <small>Nenhum endereço cadastrado</small>
        )}
      </div>

      <div className="switch-group">
        <Switch
          label="Cliente ativo"
          checked={client.active}
          onChange={onSetActive}
        />

        <Switch
          label="Favorito"
          checked={client.favorite}
          onChange={onSetFavorite}
        />
      </div>

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onRegisterInteraction}>
          Interação
        </Button>

        <Button type="button" variant="secondary" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </div>
  );
}