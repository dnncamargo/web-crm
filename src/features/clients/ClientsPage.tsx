import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Switch } from "../../components/ui/Switch";
import { useAddresses } from "../addresses/useAddresses";
import type { Client, ContactFrequency } from "./clientTypes";
import { useClients } from "./useClients";
import { useTags } from "../tags/useTags";
import type { Address, NewAddressData } from "../addresses/addressTypes";
import { AddressForm } from "../addresses/components/AddressForm";
import { ClientEditForm } from "./components/ClientEditForm";
import { SlidePanel } from "../../components/ui/SlidePanel";

type ClientPanelState =
  | { type: "create-client" }
  | { type: "view-client"; client: Client }
  | { type: "create-address"; client: Client }
  | { type: "edit-address"; client: Client; address: Address }
  | null;

export function ClientsPage() {
  const { activeTags } = useTags();
  const clientTags = useMemo(() => activeTags.filter((tag) => tag.entity === "client" || tag.entity === "global"), [activeTags]);
  const tagLabelsById = useMemo(() => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])), [activeTags]);

  const { clients, loading, error, addClient, editClient, setFavorite, setActive } = useClients(tagLabelsById);
  const { getAddressesByClient, addAddress, editAddress } = useAddresses();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [favorite, setFavoriteLocal] = useState(false);
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>("none");
  const [submitting, setSubmitting] = useState(false);
  const [panel, setPanel] = useState<ClientPanelState>(null);
  const [stackedEditClient, setStackedEditClient] = useState<Client | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlyWithContactFrequency, setShowOnlyWithContactFrequency] = useState(false);
  const [showOnlyWithBirthDate, setShowOnlyWithBirthDate] = useState(false);

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      if (showOnlyFavorites && !client.favorite) return false;
      if (showOnlyActive && !client.active) return false;
      if (showOnlyWithContactFrequency && client.contactFrequency === "none") return false;
      if (showOnlyWithBirthDate && !client.birthDate) return false;
      return true;
    });
  }, [clients, showOnlyActive, showOnlyFavorites, showOnlyWithBirthDate, showOnlyWithContactFrequency]);

  function closePanel() {
    setPanel(null);
    setStackedEditClient(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      return;
    }

    setSubmitting(true);

    const primaryContactId = trimmedPhone ? crypto.randomUUID() : null;

    await addClient({
      name: trimmedName,
      active: true,
      favorite,
      birthDate: "",
      contactFrequency,
      contacts:
        trimmedPhone && primaryContactId
          ? [
              {
                id: primaryContactId,
                type: "whatsapp",
                value: trimmedPhone,
                label: "WhatsApp principal",
                isPrimary: true,
              },
            ]
          : [],
      primaryContactId,
      primaryAddressId: null,
      tagIds: [],
      notes: "",
    });

    setName("");
    setPhone("");
    setFavoriteLocal(false);
    setContactFrequency("none");
    setSubmitting(false);
    closePanel();
  }

  async function handlePanelEditClient(data: Parameters<typeof editClient>[1]) {
    if (!stackedEditClient) {
      return;
    }

    await editClient(stackedEditClient.id, data);
    closePanel();
  }

  async function handlePanelCreateAddress(data: NewAddressData) {
    if (!panel || panel.type !== "create-address") {
      return;
    }

    const createdAddress = await addAddress(data);

    if (data.isPrimaryForClient) {
      await editClient(panel.client.id, {
        primaryAddressId: createdAddress.id,
      });
    }

    closePanel();
  }

  async function handlePanelEditAddress(data: NewAddressData) {
    if (!panel || panel.type !== "edit-address") {
      return;
    }

    await editAddress(panel.address.id, data);

    if (data.isPrimaryForClient) {
      await editClient(panel.client.id, {
        primaryAddressId: panel.address.id,
      });
    }

    if (!data.isPrimaryForClient && panel.client.primaryAddressId === panel.address.id) {
      await editClient(panel.client.id, {
        primaryAddressId: null,
      });
    }

    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, contatos principais, favoritos e frequência de relacionamento."
        action={
          <div className="header-actions">
            <button type="button" className={showFilters ? "round-filter-button active" : "round-filter-button"} onClick={() => setShowFilters((current) => !current)} aria-label="Filtros">
              F
            </button>

            <Button type="button" variant="secondary" onClick={() => setPanel({ type: "create-client" })}>
              + Cliente
            </Button>
          </div>
        }
      />

      {showFilters && (
        <Card>
          <div className="toolbar">
            <button type="button" className={showOnlyFavorites ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}>
              Favoritos
            </button>
            <button type="button" className={showOnlyActive ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyActive(!showOnlyActive)}>
              Ativos
            </button>
            <button type="button" className={showOnlyWithContactFrequency ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyWithContactFrequency(!showOnlyWithContactFrequency)}>
              Com frequência
            </button>
            <button type="button" className={showOnlyWithBirthDate ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyWithBirthDate(!showOnlyWithBirthDate)}>
              Com aniversário
            </button>
          </div>
        </Card>
      )}

      {loading && <p className="muted-text">Carregando clientes...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && visibleClients.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhum cliente encontrado.</strong>
            <span>Cadastre o primeiro cliente ou ajuste os filtros atuais.</span>
          </div>
        </Card>
      )}

      <div className="entity-list">
        {visibleClients.map((client) => {
          const primaryContact = client.contacts?.find((contact) => contact.isPrimary);

          return (
            <button type="button" className={!client.active ? "entity-list-row muted-card" : "entity-list-row"} key={client.id} onClick={() => setPanel({ type: "view-client", client })}>
              <div>
                <strong>{client.name}</strong>
                <span>{primaryContact ? `${primaryContact.label ?? "Contato principal"} · ${primaryContact.value}` : "Sem contato principal"}</span>
              </div>

              <small>{client.favorite ? "Favorito" : `${client.totalOrders ?? 0} pedidos`}</small>
            </button>
          );
        })}
      </div>

      <SlidePanel
        open={panel !== null}
        size={panel?.type === "view-client" ? "wide" : "fullscreen"}
        title={panel?.type === "create-client" ? "Adicionar cliente" : panel?.type === "view-client" ? "Detalhes do cliente" : panel?.type === "create-address" ? "Adicionar endereço" : panel?.type === "edit-address" ? "Editar endereço" : ""}
        description={
          panel?.type === "create-client"
            ? "Cadastre um novo cliente."
            : panel?.type === "view-client"
              ? "Consulte os dados do cliente antes de editar."
              : panel?.type === "create-address"
                ? "Cadastre um endereço reutilizável para cliente, entrega ou pedido."
                : panel?.type === "edit-address"
                  ? "Atualize este endereço reutilizável."
                  : ""
        }
        onClose={closePanel}
      >
        {panel?.type === "create-client" && (
          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="form-section-title">
              <span>Novo cliente</span>
              <small>Cadastro rápido para começar</small>
            </div>
            <div className="input-group">
              <label>
                Nome <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Maria Oliveira" />
              </label>
              <label>
                WhatsApp principal <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 22 99999-9999" />
              </label>
              <label>
                Frequência de contato
                <select value={contactFrequency} onChange={(event) => setContactFrequency(event.target.value as ContactFrequency)}>
                  <option value="none">Sem frequência</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
            </div>
            <Switch label="Marcar como favorito" checked={favorite} onChange={setFavoriteLocal} />
            <div className="form-actions">
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting ? "Salvando..." : "Salvar cliente"}
              </Button>
            </div>
          </form>
        )}

        {panel?.type === "view-client" && (() => {
          const client = panel.client;
          const addresses = getAddressesByClient(client.id);
          const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
          const primaryAddress = addresses.find((address) => address.id === client.primaryAddressId) ?? addresses.find((address) => address.isPrimaryForClient);

          return (
            <div className="detail-section">
              <div className="details-grid">
                <div className="detail-block"><span>Cliente</span><strong>{client.name}</strong></div>
                <div className="detail-block"><span>Contato principal</span><strong>{primaryContact?.value || "Não informado"}</strong></div>
                <div className="detail-block"><span>Endereço principal</span><strong>{primaryAddress ? `${primaryAddress.label} · ${primaryAddress.street}${primaryAddress.number ? `, ${primaryAddress.number}` : ""}` : "Não informado"}</strong></div>
                <div className="detail-block"><span>Pedidos</span><strong>{client.totalOrders ?? 0}</strong></div>
              </div>

              <div className="subtle-list">
                <span>Etiquetas</span>
                {client.tagIds?.length ? client.tagIds.map((tagId) => <small key={tagId}>#{tagLabelsById[tagId] ?? tagId}</small>) : <small>Nenhuma etiqueta associada</small>}
              </div>

              {client.notes && <div className="notes-preview"><span>Anotações</span><p>{client.notes}</p></div>}

              <div className="subtle-list">
                <div className="subtle-list-header">
                  <span>Endereços cadastrados</span>
                  <button type="button" className="text-link compact-link" onClick={() => setPanel({ type: "create-address", client })}>
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
                      </small>
                      <button type="button" className="text-link compact-link" onClick={() => setPanel({ type: "edit-address", client, address })}>
                        Editar
                      </button>
                    </div>
                  ))
                ) : (
                  <small>Nenhum endereço cadastrado</small>
                )}
              </div>

              <div className="switch-group">
                <Switch label="Cliente ativo" checked={client.active} onChange={(checked) => setActive(client, checked)} />
                <Switch label="Favorito" checked={client.favorite} onChange={(checked) => setFavorite(client, checked)} />
              </div>

              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setStackedEditClient(client)}>
                  Editar
                </Button>
              </div>
            </div>
          );
        })()}

        {panel?.type === "create-address" && <AddressForm client={panel.client} onCancel={closePanel} onSave={handlePanelCreateAddress} />}
        {panel?.type === "edit-address" && <AddressForm client={panel.client} address={panel.address} onCancel={closePanel} onSave={handlePanelEditAddress} />}
      </SlidePanel>

      <SlidePanel
        open={stackedEditClient !== null}
        level={2}
        size="fullscreen"
        title="Editar cliente"
        description="Atualize os dados principais mantendo os detalhes visíveis ao fundo."
        onClose={() => setStackedEditClient(null)}
      >
        {stackedEditClient && <ClientEditForm client={stackedEditClient} availableTags={clientTags} onCancel={() => setStackedEditClient(null)} onSave={handlePanelEditClient} />}
      </SlidePanel>
    </div>
  );
}
