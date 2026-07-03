import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Switch } from "../../components/ui/Switch";
import { ClientCard } from "./components/ClientCard";
import { useAddresses } from "../addresses/useAddresses";
import type { Client, ContactFrequency } from "./clientTypes";
import { useClients } from "./useClients";
import { useTags } from "../tags/useTags";

import type { Address, NewAddressData } from "../addresses/addressTypes";
import { AddressForm } from "../addresses/components/AddressForm";
import { ClientEditForm } from "./components/ClientEditForm";
import { SlidePanel } from "../../components/ui/SlidePanel";

type ClientPanelState = { type: "edit-client"; client: Client } | { type: "create-address"; client: Client } | { type: "edit-address"; client: Client; address: Address } | null;

export function ClientsPage() {
  const { activeTags } = useTags();

  const clientTags = useMemo(() => activeTags.filter((tag) => tag.entity === "client" || tag.entity === "global"), [activeTags]);

  const tagLabelsById = useMemo(() => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])), [activeTags]);

  const { filteredClients, search, setSearch, showOnlyFavorites, setShowOnlyFavorites, loading, error, addClient, editClient, setFavorite, setActive } = useClients(tagLabelsById);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { getAddressesByClient, addAddress, editAddress } = useAddresses();
  const [favorite, setFavoriteLocal] = useState(false);
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>("none");
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [panel, setPanel] = useState<ClientPanelState>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

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
  }

  function closePanel() {
    setPanel(null);
  }

  async function handlePanelEditClient(data: Parameters<typeof editClient>[1]) {
    if (!panel || panel.type !== "edit-client") {
      return;
    }

    await editClient(panel.client.id, data);
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

  function handleToggleExpandedClient(clientId: string) {
    setExpandedClientId((currentClientId) => (currentClientId === clientId ? null : clientId));
  }

  return (
    <div className="page-stack">
      {" "}
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, contatos principais, favoritos e frequência de relacionamento."
        action={
          <Button type="button" variant="secondary" onClick={() => setShowCreateForm((current) => !current)}>
            {" "}
            {showCreateForm ? "Ocultar cadastro" : "+ Cliente"}{" "}
          </Button>
        }
      />{" "}
      {showCreateForm && (
        <Card>
          {" "}
          <form className="form-stack" onSubmit={handleSubmit}>
            {" "}
            <div className="form-section-title">
              {" "}
              <span>Novo cliente</span> <small>Cadastro rápido para começar</small>{" "}
            </div>{" "}
            <div className="input-group">
              {" "}
              <label>
                {" "}
                Nome <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Maria Oliveira" />{" "}
              </label>{" "}
              <label>
                {" "}
                WhatsApp principal <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 22 99999-9999" />{" "}
              </label>{" "}
              <label>
                {" "}
                Frequência de contato{" "}
                <select value={contactFrequency} onChange={(event) => setContactFrequency(event.target.value as ContactFrequency)}>
                  {" "}
                  <option value="none">Sem frequência</option> <option value="weekly">Semanal</option> <option value="biweekly">Quinzenal</option> <option value="monthly">Mensal</option>{" "}
                </select>{" "}
              </label>{" "}
            </div>{" "}
            <Switch label="Marcar como favorito" checked={favorite} onChange={setFavoriteLocal} />{" "}
            <div className="form-actions">
              {" "}
              <Button type="submit" disabled={submitting || !name.trim()}>
                {" "}
                {submitting ? "Salvando..." : "Salvar cliente"}{" "}
              </Button>{" "}
            </div>{" "}
          </form>{" "}
        </Card>
      )}{" "}
      <Card>
        {" "}
        <div className="toolbar">
          {" "}
          <input className="local-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou etiqueta..." />{" "}
          <button type="button" className={showOnlyFavorites ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}>
            {" "}
            Favoritos{" "}
          </button>{" "}
        </div>{" "}
      </Card>{" "}
      {loading && <p className="muted-text">Carregando clientes...</p>} {error && <p className="error-text">{error}</p>}{" "}
      {!loading && filteredClients.length === 0 && (
        <Card>
          {" "}
          <div className="empty-state">
            {" "}
            <strong>Nenhum cliente encontrado.</strong> <span> Cadastre o primeiro cliente ou ajuste a busca/filtros atuais. </span>{" "}
          </div>{" "}
        </Card>
      )}{" "}
      <div className="cards-grid">
        {" "}
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            addresses={getAddressesByClient(client.id)}
            expanded={expandedClientId === client.id}
            availableTags={clientTags}
            tagLabelsById={tagLabelsById}
            onToggleExpanded={handleToggleExpandedClient}
            onFavoriteChange={setFavorite}
            onActiveChange={setActive}
            onRequestEditClient={(selectedClient) => setPanel({ type: "edit-client", client: selectedClient })}
            onRequestCreateAddress={(selectedClient) => setPanel({ type: "create-address", client: selectedClient })}
            onRequestEditAddress={(selectedClient, address) =>
              setPanel({
                type: "edit-address",
                client: selectedClient,
                address,
              })
            }
          />
        ))}{" "}
      </div>{" "}
      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-client" ? "Editar cliente" : panel?.type === "create-address" ? "Adicionar endereço" : panel?.type === "edit-address" ? "Editar endereço" : ""}
        description={
          panel?.type === "edit-client"
            ? "Atualize os dados principais do cliente."
            : panel?.type === "create-address"
              ? "Cadastre um endereço reutilizável para cliente, entrega ou pedido."
              : panel?.type === "edit-address"
                ? "Atualize este endereço reutilizável."
                : ""
        }
        onClose={closePanel}
      >
        {panel?.type === "edit-client" && <ClientEditForm client={panel.client} availableTags={clientTags} onCancel={closePanel} onSave={handlePanelEditClient} />}

        {panel?.type === "create-address" && <AddressForm client={panel.client} onCancel={closePanel} onSave={handlePanelCreateAddress} />}

        {panel?.type === "edit-address" && <AddressForm client={panel.client} address={panel.address} onCancel={closePanel} onSave={handlePanelEditAddress} />}
      </SlidePanel>
    </div>
  );
}
