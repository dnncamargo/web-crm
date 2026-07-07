import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { Switch } from "../../components/ui/Switch";
import { useAddresses } from "../addresses/useAddresses";
import type { Address, NewAddressData } from "../addresses/addressTypes";
import { AddressForm } from "../addresses/components/AddressForm";
import { useTags } from "../tags/useTags";
import type { Client, ContactFrequency } from "./clientTypes";
import { useClients } from "./useClients";
import { ClientDetailsPanelContent } from "./components/ClientDetailsPanelContent";
import { ClientEditForm } from "./components/ClientEditForm";
import { ClientListView } from "./components/ClientListView";

type ClientPanelState =
  | { type: "create-client" }
  | { type: "view-client"; client: Client }
  | { type: "create-address"; client: Client }
  | { type: "edit-address"; client: Client; address: Address }
  | null;

const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function toDateTimeLocalInputValue(value?: string | null) {
  const sourceDate = value ? new Date(value) : new Date();
  const date = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;

  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function formatInteractionDate(value?: string | null) {
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

export function ClientsPage() {
  const { activeTags } = useTags();

  const [interactionDateTime, setInteractionDateTime] = useState("");

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

  const [interactionClient, setInteractionClient] = useState<Client | null>(null);
  const [interactionNote, setInteractionNote] = useState("");
  const [savingInteraction, setSavingInteraction] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlyWithContactFrequency, setShowOnlyWithContactFrequency] = useState(false);
  const [showOnlyWithBirthDate, setShowOnlyWithBirthDate] = useState(false);

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      if (showOnlyFavorites && !client.favorite) return false;
      if (showOnlyActive && !client.active) return false;
      if (showOnlyWithContactFrequency && client.contactFrequency === "none") {
        return false;
      }
      if (showOnlyWithBirthDate && !client.birthDate) return false;

      return true;
    });
  }, [clients, showOnlyActive, showOnlyFavorites, showOnlyWithBirthDate, showOnlyWithContactFrequency]);

  function closeInteractionPanel() {
    setInteractionClient(null);
    setInteractionNote("");
    setInteractionDateTime("");
  }

  function closePanel() {
    setPanel(null);
    setStackedEditClient(null);
    closeInteractionPanel();
  }

  function openViewClient(client: Client) {
    setPanel({ type: "view-client", client });
  }

  function openInteractionPanel(client: Client) {
    setInteractionClient(client);
    setInteractionNote("");
    setInteractionDateTime(toDateTimeLocalInputValue());
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

  async function handleRegisterInteraction(event: FormEvent) {
    event.preventDefault();

    if (!interactionClient) {
      return;
    }

    const selectedInteractionDate = interactionDateTime ? new Date(interactionDateTime) : new Date();

    if (Number.isNaN(selectedInteractionDate.getTime())) {
      return;
    }

    const now = selectedInteractionDate.toISOString();
    const trimmedNote = interactionNote.trim();

    const nextNotes = trimmedNote ? [interactionClient.notes?.trim(), `Interação em ${formatInteractionDate(now)}: ${trimmedNote}`].filter(Boolean).join("\n\n") : (interactionClient.notes ?? "");

    setSavingInteraction(true);

    await editClient(interactionClient.id, {
      lastInteractionAt: now,
      lastContactAt: now,
      lastInteractionType: "contato",
      notes: nextNotes,
    });

    setSavingInteraction(false);

    if (panel?.type === "view-client" && panel.client.id === interactionClient.id) {
      setPanel({
        type: "view-client",
        client: {
          ...panel.client,
          lastInteractionAt: now,
          lastContactAt: now,
          lastInteractionType: "contato",
          notes: nextNotes,
        },
      });
    }

    closeInteractionPanel();
  }

  const mainPanelSize = panel?.type === "view-client" ? "wide" : "fullscreen";

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

      <ClientListView clients={visibleClients} tagLabelsById={tagLabelsById} onRequestViewClient={openViewClient} onFavoriteChange={setFavorite} />

      <SlidePanel
        open={panel !== null}
        level={1}
        size={mainPanelSize}
        title={
          panel?.type === "create-client"
            ? "Adicionar cliente"
            : panel?.type === "view-client"
              ? "Detalhes do cliente"
              : panel?.type === "create-address"
                ? "Adicionar endereço"
                : panel?.type === "edit-address"
                  ? "Editar endereço"
                  : ""
        }
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
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Maria Oliveira" />
              </label>

              <label>
                WhatsApp principal
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 22 99999-9999" />
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

        {panel?.type === "view-client" && (
          <ClientDetailsPanelContent
            client={panel.client}
            addresses={getAddressesByClient(panel.client.id)}
            tagLabelsById={tagLabelsById}
            onEdit={() => setStackedEditClient(panel.client)}
            onRegisterInteraction={() => openInteractionPanel(panel.client)}
            onCreateAddress={() => setPanel({ type: "create-address", client: panel.client })}
            onEditAddress={(address) =>
              setPanel({
                type: "edit-address",
                client: panel.client,
                address,
              })
            }
            onSetActive={(checked) => setActive(panel.client, checked)}
            onSetFavorite={(checked) => setFavorite(panel.client, checked)}
          />
        )}

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

      <SlidePanel
        open={interactionClient !== null}
        level={2}
        size="normal"
        title="Registrar interação"
        description="Atualize rapidamente o histórico de contato deste cliente."
        onClose={closeInteractionPanel}
      >
        {interactionClient && (
          <form className="form-stack interaction-form" onSubmit={handleRegisterInteraction}>
            <div className="notes-preview interaction-client-summary">
              <span>Cliente</span>
              <p>{interactionClient.name}</p>
            </div>

            <div className="details-grid">
              <div className="detail-block">
                <span>Última registrada</span>
                <strong>{formatInteractionDate(interactionClient.lastInteractionAt)}</strong>
              </div>

              <div className="detail-block">
                <span>Frequência</span>
                <strong>{frequencyLabels[interactionClient.contactFrequency]}</strong>
              </div>
            </div>

            <label className="datetime-field">
              Data e hora da interação
              <input type="datetime-local" value={interactionDateTime} onChange={(event) => setInteractionDateTime(event.target.value)} />
            </label>

            <label className="textarea-field">
              Comentário opcional
              <textarea
                value={interactionNote}
                onChange={(event) => setInteractionNote(event.target.value)}
                placeholder="Ex: Cliente respondeu no WhatsApp, pediu para lembrar no fim do mês..."
                rows={5}
              />
            </label>

            <div className="form-actions split-actions">
              <Button type="button" variant="ghost" onClick={closeInteractionPanel}>
                Cancelar
              </Button>

              <Button type="submit" disabled={savingInteraction}>
                {savingInteraction ? "Registrando..." : "Registrar interação"}
              </Button>
            </div>
          </form>
        )}
      </SlidePanel>
    </div>
  );
}
