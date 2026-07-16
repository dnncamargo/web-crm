import { useMemo, useState } from "react";
import { Filter } from "lucide-react";

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
import { ClientForm } from "./components/ClientForm";
import { ClientFiltersPanel } from "./components/ClientFiltersPanel";
import { ClientInteractionForm } from "./components/ClientInteractionForm";
import { ClientListView } from "./components/ClientListView";
import { useClients } from "./useClients";

type ClientMainPanelState = { type: "create-client" } | { type: "view-client"; client: Client } | null;

type ClientStackedPanelState =
  | { type: "edit-client"; client: Client }
  | { type: "register-interaction"; client: Client }
  | { type: "create-address"; client: Client }
  | { type: "edit-address"; client: Client; address: Address }
  | null;

export function ClientsPage() {
  const { activeTags } = useTags();

  const clientTags = useMemo(() => activeTags.filter((tag) => tag.entity === "client" || tag.entity === "global"), [activeTags]);

  const tagLabelsById = useMemo(() => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])), [activeTags]);

  const { clients, loading, error, addClient, editClient, setFavorite, setActive } = useClients(tagLabelsById);

  const { getAddressesByClient, addAddress, editAddress } = useAddresses();

  const [panel, setPanel] = useState<ClientMainPanelState>(null);
  const [stackedPanel, setStackedPanel] = useState<ClientStackedPanelState>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlyWithContactFrequency, setShowOnlyWithContactFrequency] = useState(false);
  const [showOnlyWithBirthDate, setShowOnlyWithBirthDate] = useState(false);
  const [createClientFavorite, setCreateClientFavorite] = useState(false);

  const visibleClients = useMemo(
    () =>
      filterVisibleClients(clients, {
        showOnlyFavorites,
        showOnlyActive,
        showOnlyWithContactFrequency,
        showOnlyWithBirthDate,
      }),
    [clients, showOnlyActive, showOnlyFavorites, showOnlyWithBirthDate, showOnlyWithContactFrequency],
  );

  const mainPanelSize = panel?.type === "view-client" ? "wide" : "normal";

  const stackedPanelSize = stackedPanel?.type === "register-interaction" ? "normal" : "wide";

  const stackedPanelTitle =
    stackedPanel?.type === "edit-client"
      ? "Editar cliente"
      : stackedPanel?.type === "register-interaction"
        ? "Registrar interação"
        : stackedPanel?.type === "create-address"
          ? "Adicionar endereço"
          : stackedPanel?.type === "edit-address"
            ? "Editar endereço"
            : "";

  const stackedPanelDescription =
    stackedPanel?.type === "edit-client"
      ? "Atualize os dados principais mantendo os detalhes visíveis ao fundo."
      : stackedPanel?.type === "register-interaction"
        ? "Atualize rapidamente o histórico de contato deste cliente."
        : stackedPanel?.type === "create-address"
          ? "Cadastre um endereço reutilizável para este cliente."
          : stackedPanel?.type === "edit-address"
            ? "Atualize este endereço reutilizável."
            : "";

  function closePanel() {
    setPanel(null);
    setStackedPanel(null);
    setCreateClientFavorite(false);
  }

  function closeStackedPanel() {
    setStackedPanel(null);
  }

  function openViewClient(client: Client) {
    setPanel({ type: "view-client", client });
    setStackedPanel(null);
  }

  function updateViewedClient(clientId: string, data: UpdateClientData) {
    setPanel((currentPanel) => {
      if (currentPanel?.type !== "view-client" || currentPanel.client.id !== clientId) {
        return currentPanel;
      }

      return {
        type: "view-client",
        client: {
          ...currentPanel.client,
          ...data,
        },
      };
    });
  }

  function updateClientInPanels(clientId: string, data: Partial<Client>) {
    setPanel((currentPanel) => {
      if (currentPanel?.type !== "view-client" || currentPanel.client.id !== clientId) {
        return currentPanel;
      }

      return {
        ...currentPanel,
        client: {
          ...currentPanel.client,
          ...data,
        },
      };
    });

    setStackedPanel((currentPanel) => {
      if (!currentPanel || currentPanel.type === "create-address" || currentPanel.type === "edit-address" || currentPanel.client.id !== clientId) {
        return currentPanel;
      }

      return {
        ...currentPanel,
        client: {
          ...currentPanel.client,
          ...data,
        },
      };
    });
  }

  async function toggleClientFavorite(client: Client) {
    const nextFavorite = !client.favorite;

    await setFavorite(client, nextFavorite);
    updateClientInPanels(client.id, { favorite: nextFavorite });
  }

  function renderFavoriteButton({ favorite, onClick }: { favorite: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        className={favorite ? "star-button panel-star-button active" : "star-button panel-star-button"}
        aria-label={favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        onClick={onClick}
      >
        ★
      </button>
    );
  }

  function getMainPanelHeaderAction() {
    if (panel?.type === "create-client") {
      return renderFavoriteButton({
        favorite: createClientFavorite,
        onClick: () => setCreateClientFavorite((current) => !current),
      });
    }

    if (panel?.type === "view-client") {
      return renderFavoriteButton({
        favorite: panel.client.favorite,
        onClick: () => void toggleClientFavorite(panel.client),
      });
    }

    return undefined;
  }

  function getStackedPanelHeaderAction() {
    if (stackedPanel?.type === "edit-client" || stackedPanel?.type === "register-interaction") {
      return renderFavoriteButton({
        favorite: stackedPanel.client.favorite,
        onClick: () => void toggleClientFavorite(stackedPanel.client),
      });
    }

    return undefined;
  }

  async function handleCreateClient(data: NewClientData) {
    await addClient(data);
    closePanel();
  }

  async function handlePanelEditClient(data: UpdateClientData) {
    const editPanel = stackedPanel;

    if (!editPanel || editPanel.type !== "edit-client") {
      return;
    }

    await editClient(editPanel.client.id, data);
    updateViewedClient(editPanel.client.id, data);
    closeStackedPanel();
  }

  async function handlePanelCreateAddress(data: NewAddressData) {
    const addressPanel = stackedPanel;

    if (!addressPanel || addressPanel.type !== "create-address") {
      return;
    }

    const createdAddress = await addAddress(data);

    if (data.isPrimaryForClient) {
      const clientUpdate = {
        primaryAddressId: createdAddress.id,
      };

      await editClient(addressPanel.client.id, clientUpdate);
      updateViewedClient(addressPanel.client.id, clientUpdate);
    }

    closeStackedPanel();
  }

  async function handlePanelEditAddress(data: NewAddressData) {
    const addressPanel = stackedPanel;

    if (!addressPanel || addressPanel.type !== "edit-address") {
      return;
    }

    await editAddress(addressPanel.address.id, data);

    if (data.isPrimaryForClient) {
      const clientUpdate = {
        primaryAddressId: addressPanel.address.id,
      };

      await editClient(addressPanel.client.id, clientUpdate);
      updateViewedClient(addressPanel.client.id, clientUpdate);
    }

    if (!data.isPrimaryForClient && addressPanel.client.primaryAddressId === addressPanel.address.id) {
      const clientUpdate = {
        primaryAddressId: null,
      };

      await editClient(addressPanel.client.id, clientUpdate);
      updateViewedClient(addressPanel.client.id, clientUpdate);
    }

    closeStackedPanel();
  }

  async function handleRegisterInteraction(data: UpdateClientData) {
    const interactionPanel = stackedPanel;

    if (!interactionPanel || interactionPanel.type !== "register-interaction") {
      return;
    }

    await editClient(interactionPanel.client.id, data);
    updateViewedClient(interactionPanel.client.id, data);
    closeStackedPanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, contatos principais, favoritos e frequência de relacionamento."
        action={
          <div className="header-actions">
            <button type="button" className={showFilters ? "round-filter-button active" : "round-filter-button"} onClick={() => setShowFilters((current) => !current)} aria-label="Filtros">
              <Filter size={18} aria-hidden="true" />
            </button>

            <Button type="button" variant="primary" 
              onClick={() => {
                setCreateClientFavorite(false);
                setPanel({ type: "create-client" });
              }}
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
          onToggleFavorites={() => setShowOnlyFavorites((current) => !current)}
          onToggleActive={() => setShowOnlyActive((current) => !current)}
          onToggleWithContactFrequency={() => setShowOnlyWithContactFrequency((current) => !current)}
          onToggleWithBirthDate={() => setShowOnlyWithBirthDate((current) => !current)}
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

      <ClientListView clients={visibleClients} tagLabelsById={tagLabelsById} onRequestViewClient={openViewClient} onFavoriteChange={setFavorite} />

      <SlidePanel
        open={panel !== null}
        level={1}
        size={mainPanelSize}
        title={panel?.type === "create-client" ? "Adicionar cliente" : panel?.type === "view-client" ? "Detalhes do cliente" : ""}
        description={panel?.type === "create-client" ? "Cadastre um novo cliente." : panel?.type === "view-client" ? "Consulte os dados do cliente antes de editar." : ""}
        onClose={closePanel}
        headerAction={getMainPanelHeaderAction()}
      >
        {panel?.type === "create-client" && 
          <ClientQuickForm 
            favorite={createClientFavorite} 
            onCancel={closePanel} 
            onSave={handleCreateClient} 
          />
        }

        {panel?.type === "view-client" && (
          <ClientDetailsPanelContent
            client={panel.client}
            addresses={getAddressesByClient(panel.client.id)}
            tagLabelsById={tagLabelsById}
            onEdit={() =>
              setStackedPanel({
                type: "edit-client",
                client: panel.client,
              })
            }
            onRegisterInteraction={() =>
              setStackedPanel({
                type: "register-interaction",
                client: panel.client,
              })
            }
            onCreateAddress={() =>
              setStackedPanel({
                type: "create-address",
                client: panel.client,
              })
            }
            onEditAddress={(address) =>
              setStackedPanel({
                type: "edit-address",
                client: panel.client,
                address,
              })
            }
            onSetActive={async (checked) => {
              await setActive(panel.client, checked);
              updateViewedClient(panel.client.id, { active: checked });
            }}
            onSetFavorite={async (checked) => {
              await setFavorite(panel.client, checked);
              updateViewedClient(panel.client.id, { favorite: checked });
            }}
          />
        )}
      </SlidePanel>

      <SlidePanel 
        open={stackedPanel !== null} 
        level={2} size={stackedPanelSize} 
        title={stackedPanelTitle} 
        description={stackedPanelDescription} 
        onClose={closeStackedPanel} 
        closeOnBackdrop={false} 
        headerAction={getStackedPanelHeaderAction()}
      >
        {stackedPanel?.type === "edit-client" && <ClientForm client={stackedPanel.client} availableTags={clientTags} onCancel={closeStackedPanel} onSave={handlePanelEditClient} />}

        {stackedPanel?.type === "register-interaction" && <ClientInteractionForm client={stackedPanel.client} onCancel={closeStackedPanel} onSave={handleRegisterInteraction} />}

        {stackedPanel?.type === "create-address" && <AddressForm client={stackedPanel.client} onCancel={closeStackedPanel} onSave={handlePanelCreateAddress} />}

        {stackedPanel?.type === "edit-address" && <AddressForm client={stackedPanel.client} address={stackedPanel.address} onCancel={closeStackedPanel} onSave={handlePanelEditAddress} />}
      </SlidePanel>
    </div>
  );
}
