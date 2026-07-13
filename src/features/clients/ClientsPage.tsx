import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { useAddresses } from "../addresses/useAddresses";
import type { Address, NewAddressData } from "../addresses/addressTypes";
import { AddressForm } from "../addresses/components/AddressForm";
import { useTags } from "../tags/useTags";
import type { Client, NewClientData, UpdateClientData } from "./clientTypes";
import { filterVisibleClients } from "./clientFormatters";
import { ClientQuickForm } from "./components/ClientQuickForm";
import { ClientDetailsPanelContent } from "./components/ClientDetailsPanelContent";
import { ClientEditForm } from "./components/ClientForm";
import { ClientFiltersPanel } from "./components/ClientFiltersPanel";
import { ClientInteractionForm } from "./components/ClientInteractionForm";
import { ClientListView } from "./components/ClientListView";
import { useClients } from "./useClients";

type ClientPanelState =
  | { type: "create-client" }
  | { type: "view-client"; client: Client }
  | { type: "create-address"; client: Client }
  | { type: "edit-address"; client: Client; address: Address }
  | null;

export function ClientsPage() {
  const { activeTags } = useTags();

  const clientTags = useMemo(
    () =>
      activeTags.filter(
        (tag) => tag.entity === "client" || tag.entity === "global"
      ),
    [activeTags]
  );

  const tagLabelsById = useMemo(
    () => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])),
    [activeTags]
  );

  const {
    clients,
    loading,
    error,
    addClient,
    editClient,
    setFavorite,
    setActive,
  } = useClients(tagLabelsById);

  const { getAddressesByClient, addAddress, editAddress } = useAddresses();

  const [panel, setPanel] = useState<ClientPanelState>(null);
  const [stackedEditClient, setStackedEditClient] =
    useState<Client | null>(null);
  const [interactionClient, setInteractionClient] =
    useState<Client | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlyWithContactFrequency, setShowOnlyWithContactFrequency] =
    useState(false);
  const [showOnlyWithBirthDate, setShowOnlyWithBirthDate] = useState(false);

  const visibleClients = useMemo(
    () =>
      filterVisibleClients(clients, {
        showOnlyFavorites,
        showOnlyActive,
        showOnlyWithContactFrequency,
        showOnlyWithBirthDate,
      }),
    [
      clients,
      showOnlyActive,
      showOnlyFavorites,
      showOnlyWithBirthDate,
      showOnlyWithContactFrequency,
    ]
  );

  const mainPanelSize =
    panel?.type === "view-client" && stackedEditClient
      ? "fullscreen"
      : panel?.type === "view-client"
        ? "wide"
        : "fullscreen";

  function closePanel() {
    setPanel(null);
    setStackedEditClient(null);
    setInteractionClient(null);
  }

  function openViewClient(client: Client) {
    setPanel({ type: "view-client", client });
  }

  async function handleCreateClient(data: NewClientData) {
    await addClient(data);
    closePanel();
  }

  async function handlePanelEditClient(data: UpdateClientData) {
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

    if (
      !data.isPrimaryForClient &&
      panel.client.primaryAddressId === panel.address.id
    ) {
      await editClient(panel.client.id, {
        primaryAddressId: null,
      });
    }

    closePanel();
  }

  async function handleRegisterInteraction(data: UpdateClientData) {
    if (!interactionClient) {
      return;
    }

    await editClient(interactionClient.id, data);

    if (
      panel?.type === "view-client" &&
      panel.client.id === interactionClient.id
    ) {
      setPanel({
        type: "view-client",
        client: {
          ...panel.client,
          ...data,
        },
      });
    }

    setInteractionClient(null);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, contatos principais, favoritos e frequência de relacionamento."
        action={
          <div className="header-actions">
            <button
              type="button"
              className={
                showFilters
                  ? "round-filter-button active"
                  : "round-filter-button"
              }
              onClick={() => setShowFilters((current) => !current)}
              aria-label="Filtros"
            >
              F
            </button>

            <Button
              type="button"
              variant="primary"
              onClick={() => setPanel({ type: "create-client" })}
            >
              + Cliente
            </Button>
          </div>
        }
      />

      {showFilters && (
        <ClientFiltersPanel
          showOnlyFavorites={showOnlyFavorites}
          showOnlyActive={showOnlyActive}
          showOnlyWithContactFrequency={showOnlyWithContactFrequency}
          showOnlyWithBirthDate={showOnlyWithBirthDate}
          onToggleFavorites={() =>
            setShowOnlyFavorites((current) => !current)
          }
          onToggleActive={() => setShowOnlyActive((current) => !current)}
          onToggleWithContactFrequency={() =>
            setShowOnlyWithContactFrequency((current) => !current)
          }
          onToggleWithBirthDate={() =>
            setShowOnlyWithBirthDate((current) => !current)
          }
        />
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

      <ClientListView
        clients={visibleClients}
        tagLabelsById={tagLabelsById}
        onRequestViewClient={openViewClient}
        onFavoriteChange={setFavorite}
      />

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
          <ClientQuickForm
            onCancel={closePanel}
            onSave={handleCreateClient}
          />
        )}

        {panel?.type === "view-client" && (
          <ClientDetailsPanelContent
            client={panel.client}
            addresses={getAddressesByClient(panel.client.id)}
            tagLabelsById={tagLabelsById}
            onEdit={() => setStackedEditClient(panel.client)}
            onRegisterInteraction={() => setInteractionClient(panel.client)}
            onCreateAddress={() =>
              setPanel({ type: "create-address", client: panel.client })
            }
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

        {panel?.type === "create-address" && (
          <AddressForm
            client={panel.client}
            onCancel={closePanel}
            onSave={handlePanelCreateAddress}
          />
        )}

        {panel?.type === "edit-address" && (
          <AddressForm
            client={panel.client}
            address={panel.address}
            onCancel={closePanel}
            onSave={handlePanelEditAddress}
          />
        )}
      </SlidePanel>

      <SlidePanel
        open={stackedEditClient !== null}
        level={2}
        size="fullscreen"
        title="Editar cliente"
        description="Atualize os dados principais mantendo os detalhes visíveis ao fundo."
        onClose={() => setStackedEditClient(null)}
      >
        {stackedEditClient && (
          <ClientEditForm
            client={stackedEditClient}
            availableTags={clientTags}
            onCancel={() => setStackedEditClient(null)}
            onSave={handlePanelEditClient}
          />
        )}
      </SlidePanel>

      <SlidePanel
        open={interactionClient !== null}
        level={2}
        size="normal"
        title="Registrar interação"
        description="Atualize rapidamente o histórico de contato deste cliente."
        onClose={() => setInteractionClient(null)}
      >
        {interactionClient && (
          <ClientInteractionForm
            client={interactionClient}
            onCancel={() => setInteractionClient(null)}
            onSave={handleRegisterInteraction}
          />
        )}
      </SlidePanel>
    </div>
  );
}