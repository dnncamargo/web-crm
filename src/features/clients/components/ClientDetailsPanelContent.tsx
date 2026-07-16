import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { formatDateBR } from "../../../utils/dateFormat";
import type { Address } from "../../addresses/addressTypes";
import { formatClientDateTimeBR, frequencyLabels } from "../clientFormatters";
import type { Client } from "../clientTypes";

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

export function ClientDetailsPanelContent({
  client,
  addresses,
  tagLabelsById,
  onEdit,
  onRegisterInteraction,
  onCreateAddress,
  onEditAddress,
  onSetActive,
}: ClientDetailsPanelContentProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);

  const primaryAddress = addresses.find((address) => address.id === client.primaryAddressId) ?? addresses.find((address) => address.isPrimaryForClient);

  const tagLabels = client.tagIds?.map((tagId) => (tagLabelsById[tagId] ?? tagId).replace(/^#+/, "")) ?? [];

  const primaryAddressText = primaryAddress ? `${primaryAddress.label}: ${primaryAddress.street}${primaryAddress.number ? `, ${primaryAddress.number}` : ""}` : "Não informado";

  function formatAddressLine(address: Address) {
    return [address.street, address.number, address.neighborhood, address.city].filter(Boolean).join(" · ");
  }

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo do cliente</span>
              <small>Dados principais e histórico do relacionamento.</small>
            </div>

            <div className="compact-summary-box panel-details-summary">
              <span>
                Cliente: <strong>{client.name}</strong>
              </span>

              <span>
                Contato: <strong>{primaryContact?.value || "Não informado"}</strong>
              </span>

              <span>
                Aniversário: <strong>{client.birthDate ? formatDateBR(client.birthDate) : "Não informado"}</strong>
              </span>

              <span>
                Frequência: <strong>{frequencyLabels[client.contactFrequency]}</strong>
              </span>

              <span>
                Última interação: <strong>{formatClientDateTimeBR(client.lastInteractionAt)}</strong>
              </span>

              <span>
                Pedidos: <strong>{client.totalOrders ?? 0}</strong>
              </span>

              <span className="summary-full">
                Endereço principal: <strong>{primaryAddressText}</strong>
              </span>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Etiquetas</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              <Badge>{client.active ? "Ativo" : "Inativo"}</Badge>

              {client.favorite && <Badge>Favorito</Badge>}

              {tagLabels.length ? tagLabels.map((label) => <Badge key={label}>{label}</Badge>) : <Badge>Sem etiquetas</Badge>}
            </div>
          </section>

          {client.notes && (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Anotações</span>
              </div>

              <div className="panel-note">
                <p>{client.notes}</p>
              </div>
            </section>
          )}
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Contatos</span>
            </div>

            <div className="panel-list compact-list">
              {client.contacts?.length ? (
                client.contacts.map((contact) => (
                  <div className="panel-list-row compact-row" key={contact.id}>
                    <strong>
                      {contact.isPrimary ? "Principal · " : ""}
                      {contact.label ?? contact.type}
                    </strong>
                    <span>{contact.value}</span>
                  </div>
                ))
              ) : (
                <p className="panel-muted">Nenhum contato cadastrado.</p>
              )}
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Endereços</span>

              <button type="button" className="text-link compact-link" onClick={onCreateAddress}>
                + Adicionar endereço
              </button>
            </div>

            <div className="panel-list compact-list">
              {addresses.length ? (
                addresses.map((address) => (
                  <div className="panel-list-row compact-row" key={address.id}>
                    <strong>
                      {address.id === client.primaryAddressId ? "Principal · " : ""}
                      {address.label}
                    </strong>

                    <span>{formatAddressLine(address)}</span>

                    <button type="button" className="text-link compact-link" onClick={() => onEditAddress(address)}>
                      Editar endereço
                    </button>
                  </div>
                ))
              ) : (
                <p className="panel-muted">Nenhum endereço cadastrado.</p>
              )}
            </div>
          </section>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Cliente ativo" checked={client.active} onChange={onSetActive} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Cliente ativo" checked={client.active} onChange={onSetActive} />
        </div>

        <div className="panel-actions">
          <Button type="button" variant="ghost" onClick={onRegisterInteraction}>
            Interação
          </Button>

          <Button type="button" variant="primary" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
