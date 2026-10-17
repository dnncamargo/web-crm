import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  calculateOrderSubtotal,
  calculateOrderTotal,
  getAutomaticCreditApplied,
  getOrderCashPaid,
  getOrderGeneratedCreditAmount,
  getClientAvailableCredit,
  getOrderBalanceInfo,
  getOrderItemProductName,
  getPaymentStatus,
} from "../orderUtils";
import { Button } from "../../../components/ui/Button";
import { SlidePanel } from "../../../components/ui/SlidePanel";
import { formatCurrencyBR, parseCurrencyInput } from "../../../utils/money";
import type { Address, NewAddressData } from "../../addresses/addressTypes";
import { AddressForm } from "../../addresses/components/AddressForm";
import type { Client } from "../../clients/clientTypes";
import type { NewClientData } from "../../clients/clientTypes";
import { ClientQuickForm } from "../../clients/components/ClientQuickForm";
import { normalizeClientSearch } from "../../clients/useClients";
import type { Product } from "../../products/productTypes";
import type { NewOrderData, Order, OrderItem, OrderStatus } from "../orderTypes";
import { AddressPickerContent } from "../../addresses/components/AddressPickerContent";
import type { Tag } from "../../tags/tagTypes";

interface OrderFormItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  notes: string;
  tagIds: string[];
  showNotes: boolean;
  showTags: boolean;
}

interface OrderFormProps {
  order?: Order;
  orders: Order[];
  clients: Client[];
  clientsLoading?: boolean;
  onCreateClient?: (data: NewClientData) => Promise<{ id: string }>;
  panelLevel?: 1 | 2;
  addresses: Address[];
  products: Product[];
  itemTags?: Tag[];
  onCancel: () => void;
  onSave: (data: NewOrderData) => Promise<void>;
  onCreateAddress?: (data: NewAddressData) => Promise<{ id: string }>;
  onDirtyChange?: (dirty: boolean) => void;
}

function currencyToInput(value?: number | null) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(".", ",");
}

function parseMoneyOrZero(value: string) {
  return parseCurrencyInput(value) ?? 0;
}

function formatAddressLabel(address: Address) {
  const number = address.number ? `, ${address.number}` : "";
  const neighborhood = address.neighborhood ? ` · ${address.neighborhood}` : "";
  const city = address.city ? ` · ${address.city}` : "";

  return `${address.label}: ${address.street}${number}${neighborhood}${city}`;
}

function getAddressSnapshot(address: Address) {
  return {
    label: address.label,
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    reference: address.reference,
  };
}

function getFinancialSignature(
  clientId: string,
  items: OrderFormItem[],
  deliveryFee: string,
) {
  return JSON.stringify({
    clientId,
    deliveryFee: parseMoneyOrZero(deliveryFee),
    items: items.map(({ productId, quantity, unit, unitPrice }) => ({
      productId,
      quantity: Number(quantity.replace(",", ".")),
      unit: unit.trim(),
      unitPrice: parseMoneyOrZero(unitPrice),
    })),
  });
}

const DEFAULT_ITEM_UNIT = "unidade";

type OrderItemWithUnit = OrderItem & {
  unit?: string;
};

function getProductUnit(product?: Product) {
  return product?.unit?.trim() || DEFAULT_ITEM_UNIT;
}

export function OrderForm({ order, orders, clients, clientsLoading = false, addresses, products, itemTags = [], onCancel, onSave, onCreateAddress, onCreateClient, panelLevel = 1, onDirtyChange }: OrderFormProps) {
  const [clientId, setClientId] = useState(order?.clientId ?? "");
  const [clientSearch, setClientSearch] = useState(order?.clientName ?? clients.find((client) => client.id === order?.clientId)?.name ?? "");
  const [clientListOpen, setClientListOpen] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(-1);
  const [clientPanelOpen, setClientPanelOpen] = useState(false);
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [addressId, setAddressId] = useState(order?.addressId ?? "");
  const [addressSelectionTouched, setAddressSelectionTouched] = useState(false);
  const [deliveryDateTime, setDeliveryDateTime] = useState(order?.deliveryDateTime ?? "");
  const [deliveryFee, setDeliveryFee] = useState(currencyToInput(order?.deliveryFee ?? 0));
  const [initialPayment, setInitialPayment] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.orderStatus ?? "active");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [addressPanelMode, setAddressPanelMode] = useState<"choose" | "create" | null>(null);
  const [createdAddress, setCreatedAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const initialItems: OrderFormItem[] = order?.items.length
    ? order.items.map((item) => {
        const savedItem = item as OrderItemWithUnit;

        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: String(item.quantity),
          unit: savedItem.unit ?? DEFAULT_ITEM_UNIT,
          unitPrice: currencyToInput(item.unitPrice),
          notes: item.notes ?? "",
          tagIds: item.tagIds ?? [],
          showNotes: Boolean(item.notes),
          showTags: Boolean(item.tagIds?.length),
        };
      })
    : [
        {
          id: crypto.randomUUID(),
          productId: "",
          productName: "",
          quantity: "1",
          unit: DEFAULT_ITEM_UNIT,
          unitPrice: "",
          notes: "",
          tagIds: [],
          showNotes: false,
          showTags: false,
        },
      ];
  const [items, setItems] = useState<OrderFormItem[]>(initialItems);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(order?.items.length ? null : (initialItems[0]?.id ?? null));

  const [initialFormSignature] = useState(() =>
      JSON.stringify({
        clientId: order?.clientId ?? "",
        clientSearch: order?.clientName ?? clients.find((client) => client.id === order?.clientId)?.name ?? "",
        addressId: order?.addressId ?? "",
        deliveryDateTime: order?.deliveryDateTime ?? "",
        deliveryFee: currencyToInput(order?.deliveryFee ?? 0),
        initialPayment: "",
        orderStatus: order?.orderStatus ?? "active",
        notes: order?.notes ?? "",
        items: initialItems,
      }),
  );

  const currentFormSignature = JSON.stringify({
    clientId,
    clientSearch,
    addressId,
    deliveryDateTime,
    deliveryFee,
    initialPayment,
    orderStatus,
    notes,
    items,
  });

  const [initialFinancialSignature] = useState(() =>
    getFinancialSignature(
      order?.clientId ?? "",
      initialItems,
      currencyToInput(order?.deliveryFee ?? 0),
    ),
  );

  const currentFinancialSignature = getFinancialSignature(
    clientId,
    items,
    deliveryFee,
  );

  const financialChanged = currentFinancialSignature !== initialFinancialSignature;

  useEffect(() => {
    onDirtyChange?.(currentFormSignature !== initialFormSignature);
  }, [currentFormSignature, initialFormSignature, onDirtyChange]);

  const selectableClients = useMemo(
    () => {
      const availableClients = createdClient && !clients.some((client) => client.id === createdClient.id)
        ? [...clients, createdClient]
        : clients;
      return availableClients.filter((client) => client.active || client.id === order?.clientId);
    },
    [clients, createdClient, order?.clientId],
  );

  const normalizedClientSearch = normalizeClientSearch(clientSearch);
  const matchingClients = useMemo(() => {
    if (!normalizedClientSearch) return [];
    return selectableClients
      .map((client) => {
        const normalizedName = normalizeClientSearch(client.name);
        const normalizedContacts = (client.contacts ?? []).map((contact) => normalizeClientSearch(contact.value));
        return { client, exact: normalizedName === normalizedClientSearch, matches: normalizedName.includes(normalizedClientSearch) || normalizedContacts.some((contact) => contact.includes(normalizedClientSearch)) };
      })
      .filter(({ matches }) => matches)
      .sort((first, second) => Number(second.exact) - Number(first.exact) || first.client.name.localeCompare(second.client.name, "pt-BR"))
      .slice(0, 8)
      .map(({ client }) => client);
  }, [normalizedClientSearch, selectableClients]);
  const exactClient = (createdClient && !clients.some((client) => client.id === createdClient.id) ? [...clients, createdClient] : clients)
    .find((client) => normalizeClientSearch(client.name) === normalizedClientSearch);
  const exactClientIsInactive = Boolean(exactClient && !exactClient.active && exactClient.id !== order?.clientId);
  const canCreateClient = Boolean(normalizedClientSearch && !clientsLoading && !exactClient && onCreateClient);

  const activeAddresses = useMemo(() => addresses.filter((address) => address.active), [addresses]);
  const orderAddressId = order?.addressId;

  const selectableAddresses = useMemo(() => {
    const currentAddress = orderAddressId
      ? addresses.find((address) => address.id === orderAddressId)
      : undefined;

    if (currentAddress && !currentAddress.active) {
      return [currentAddress, ...activeAddresses];
    }

    return activeAddresses;
  }, [activeAddresses, addresses, orderAddressId]);

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const selectableProducts = useMemo(() => {
    const currentProductId = order?.items.map((item) => item.productId) ?? [];
    const inactiveCurrentProducts = products.filter(
      (product) => currentProductId.includes(product.id) && !product.active,
    );

    return [...inactiveCurrentProducts, ...activeProducts];
  }, [activeProducts, order?.items, products]);

  const itemUnitOptions = useMemo(() => {
  const productUnits = activeProducts
      .map((product) => product.unit?.trim())
      .filter((unit): unit is string => Boolean(unit));

    return Array.from(new Set([DEFAULT_ITEM_UNIT, ...productUnits]));
  }, [activeProducts]);

  const selectedClient = selectableClients.find((client) => client.id === clientId);
  const selectedAddress = addresses.find((address) => address.id === addressId) ??
    (createdAddress?.id === addressId ? createdAddress : undefined);

  const parsedItems: OrderItem[] = items
    .map((item) => {
      const product = products.find((currentProduct) => currentProduct.id === item.productId);
      const quantity = Number(item.quantity.replace(",", "."));
      const unitPrice = parseMoneyOrZero(item.unitPrice);
      const productName = getOrderItemProductName(item, products);

      return {
        id: item.id,
        productId: item.productId,
        productName,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unit: item.unit.trim() || getProductUnit(product),
        unitPrice,
        total: (Number.isFinite(quantity) ? quantity : 0) * unitPrice,
        notes: item.showNotes ? item.notes.trim() : "",
        tagIds: item.showTags ? item.tagIds : [],
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0);

  const expandedItem = items.find((item) => item.id === expandedItemId) ?? null;

  const expandedItemIndex = expandedItem ? items.findIndex((item) => item.id === expandedItem.id) : -1;

  const isEditingItem = expandedItem !== null && expandedItemIndex >= 0;

  const subtotal = calculateOrderSubtotal(parsedItems);
  const parsedDeliveryFee = parseMoneyOrZero(deliveryFee);
  const parsedInitialPayment = parseMoneyOrZero(initialPayment);
  const cashPaid = order ? getOrderCashPaid(order) : parsedInitialPayment;
  const total = calculateOrderTotal(parsedItems, parsedDeliveryFee);

  const shouldPreserveSettledCredit = Boolean(
    order && !financialChanged && getPaymentStatus(order) === "paid",
  );
  const availableClientCredit = selectedClient && !shouldPreserveSettledCredit
    ? getClientAvailableCredit(orders, selectedClient.id, order?.id)
    : 0;

  const automaticCreditApplied = shouldPreserveSettledCredit
    ? order?.creditApplied ?? 0
    : getAutomaticCreditApplied(availableClientCredit, total);

  const balanceInfo = getOrderBalanceInfo({
    total,
    amountPaid: cashPaid,
    payments: order?.payments,
    creditApplied: automaticCreditApplied,
  });

  const creditGenerated = balanceInfo.type === "credit" ? balanceInfo.amount : 0;

  const statusLabel = balanceInfo.type === "credit" ? "Crédito gerado" : balanceInfo.type === "settled" ? "Quitado" : "Restante";

  const statusAmount = balanceInfo.amount;

  function updateItem(itemId: string, data: Partial<OrderFormItem>) {
    setItems((currentItems) => currentItems.map((item) => (item.id === itemId ? { ...item, ...data } : item)));
  }

  function handleProductChange(itemId: string, productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);

    updateItem(itemId, {
      productId,
      productName: selectedProduct?.name ?? "",
      unit: getProductUnit(selectedProduct),
      unitPrice:
        selectedProduct?.suggestedPrice !== undefined &&
        selectedProduct.suggestedPrice !== null
          ? currencyToInput(selectedProduct.suggestedPrice)
          : "",
    });
  }

  function toggleItemTag(itemId: string, tagId: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const tagIds = item.tagIds.includes(tagId) ? item.tagIds.filter((currentTagId) => currentTagId !== tagId) : [...item.tagIds, tagId];

        return {
          ...item,
          tagIds,
        };
      }),
    );
  }

  function showItemTags(itemId: string) {
    updateItem(itemId, { showTags: true });
  }

  function removeItemTags(itemId: string) {
    updateItem(itemId, {
      showTags: false,
      tagIds: [],
    });
  }

  function showItemNotes(itemId: string) {
    updateItem(itemId, { showNotes: true });
  }

  function removeItemNotes(itemId: string) {
    updateItem(itemId, {
      showNotes: false,
      notes: "",
    });
  }

  function addItem() {
    const newItem: OrderFormItem = {
      id: crypto.randomUUID(),
      productId: "",
      productName: "",
      quantity: "1",
      unit: DEFAULT_ITEM_UNIT,
      unitPrice: "",
      notes: "",
      tagIds: [],
      showNotes: false,
      showTags: false,
    };

    setItems((currentItems) => [...currentItems, newItem]);
    setExpandedItemId(newItem.id);
  }

  function removeItem(itemId: string) {
    setItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.id !== itemId)
    );

    setExpandedItemId((currentId) => (currentId === itemId ? null : currentId));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (savingRef.current || !selectedClient || !deliveryDateTime || parsedItems.length === 0) {
      return;
    }

    const creditFields: Partial<NewOrderData> = shouldPreserveSettledCredit
      ? {
          creditApplied: order?.creditApplied,
          creditGenerated: order ? getOrderGeneratedCreditAmount(order) : null,
        }
      : {
          creditApplied: automaticCreditApplied > 0 ? automaticCreditApplied : null,
          creditGenerated: creditGenerated > 0 ? creditGenerated : null,
        };

    const originalAddressId = order?.addressId ?? "";
    const addressChanged = addressId !== originalAddressId || (
      addressSelectionTouched &&
      !addressId &&
      !originalAddressId &&
      Boolean(order?.addressSnapshot)
    );
    const nextAddressSnapshot = addressChanged
      ? selectedAddress
        ? getAddressSnapshot(selectedAddress)
        : null
      : order?.addressSnapshot ?? null;
    const nextAddressId = addressChanged ? selectedAddress?.id ?? null : order?.addressId ?? null;

    setSaving(true);
    savingRef.current = true;

    try {
      await onSave({
      clientId: selectedClient.id,
      clientName: selectedClient.name,

      addressId: nextAddressId,
      addressSnapshot: nextAddressSnapshot,

      deliveryDateTime,
      items: parsedItems,

      subtotal,
      deliveryFee: parsedDeliveryFee,
      total,
      amountPaid: cashPaid,
      payments: order
        ? order.payments
        : parsedInitialPayment > 0
          ? [{ id: crypto.randomUUID(), amount: parsedInitialPayment, receivedAt: new Date().toISOString() }]
          : [],

      ...creditFields,

      orderStatus,
      notes: notes.trim(),
      tagIds: order?.tagIds ?? [],
      });
      onDirtyChange?.(false);
      onCancel();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function getProductName(productId: string) {
    const item = items.find((currentItem) => currentItem.productId === productId);

    return item ? getOrderItemProductName(item, products) : products.find((product) => product.id === productId)?.name ?? "";
  }

  function getItemTotal(item: OrderFormItem) {
    const parsedQuantity = Number(item.quantity.replace(",", "."));
    const parsedUnitPrice = parseMoneyOrZero(item.unitPrice);
    return (Number.isFinite(parsedQuantity) ? parsedQuantity : 0) * parsedUnitPrice;
  }

  function getItemSummary(item: OrderFormItem, index: number) {
    const productName = getProductName(item.productId);
    const itemTotal = getItemTotal(item);
    if (!productName) {
      return `Item ${index + 1} sem produto`;
    }
    return `${item.quantity || "0"} ${item.unit || DEFAULT_ITEM_UNIT} · ${productName} · ${formatCurrencyBR(itemTotal)}`;
  }

  function requestRemoveItem(item: OrderFormItem, index: number) {
    if (items.length === 1) {
      return;
    }

    const itemSummary = getItemSummary(item, index);

    const shouldRemove = window.confirm(`Remover este item do pedido?\n\n${itemSummary}`);

    if (!shouldRemove) {
      return;
    }

    removeItem(item.id);
  }

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setAddressSelectionTouched(true);
    setClientListOpen(false);
    setActiveClientIndex(-1);

    const nextClient = selectableClients.find((client) => client.id === nextClientId);
    setClientSearch(nextClient?.name ?? "");

    const primaryAddress = nextClient?.primaryAddressId
      ? addresses.find((address) => address.id === nextClient.primaryAddressId && address.active)
      : undefined;

    if (primaryAddress) {
      setAddressId(primaryAddress.id);
      return;
    }

    const associatedAddresses = nextClient
      ? addresses.filter((address) => address.active && address.clientId === nextClient.id)
      : [];

    if (associatedAddresses.length === 1) {
      setAddressId(associatedAddresses[0].id);
      return;
    }

    if (!nextClient) {
      setAddressId("");
      return;
    }

    setAddressId("");
  }

  function handleClientSearchChange(value: string) {
    if (clientId) handleClientChange("");
    setClientSearch(value);
    setClientListOpen(true);
    setActiveClientIndex(-1);
  }

  function handleClientSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setClientListOpen(true);
      setActiveClientIndex((index) => Math.max(0, Math.min(index + 1, matchingClients.length - 1 + Number(canCreateClient))));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setClientListOpen(true);
      setActiveClientIndex((index) => index < 0 ? -1 : Math.max(index - 1, 0));
    } else if (event.key === "Enter" && clientListOpen && matchingClients[activeClientIndex]) {
      event.preventDefault();
      handleClientChange(matchingClients[activeClientIndex].id);
    } else if (event.key === "Enter" && clientListOpen && canCreateClient && (matchingClients.length === 0 || activeClientIndex === matchingClients.length)) {
      event.preventDefault();
      setClientListOpen(false);
      setClientPanelOpen(true);
    } else if (event.key === "Escape") {
      setClientListOpen(false);
    }
  }

  async function handleCreateClient(data: NewClientData) {
    if (!onCreateClient) return { id: "" };
    const created = await onCreateClient(data);
    const client: Client = { ...data, id: created.id };
    setCreatedClient(client);
    setClientId(client.id);
    setClientSearch(client.name);
    setClientListOpen(false);
    setClientPanelOpen(false);
    setAddressId("");
    setAddressSelectionTouched(true);
    return created;
  }

  async function handleCreateAddress(data: NewAddressData) {
    if (!onCreateAddress) {
      return;
    }

    const createdAddress = await onCreateAddress(data);
    setCreatedAddress({ id: createdAddress.id, ...data });
    setAddressId(createdAddress.id);
    setAddressSelectionTouched(true);
    setAddressPanelMode(null);
  }

  return (
    <>
      <form className="panel-view" onSubmit={handleSubmit}>
        <div className="panel-columns panel-columns-3">
          {/* Dados do pedido */}
          <section className="panel-column panel-column-scroll">
            <div className="panel-section-title">
              <span>Dados do pedido</span>
              <small>Cliente, entrega e status.</small>
            </div>

            <div className="input-group single-column">
              <div className="order-client-autocomplete">
                <label htmlFor="order-client-search">Cliente</label>
                <input
                  id="order-client-search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={clientListOpen && Boolean(normalizedClientSearch)}
                  aria-controls="order-client-options"
                  aria-activedescendant={clientListOpen && matchingClients[activeClientIndex]
                    ? `order-client-option-${activeClientIndex}`
                    : clientListOpen && canCreateClient && activeClientIndex === matchingClients.length
                      ? "order-client-create-option"
                      : undefined}
                  value={clientSearch}
                  onFocus={() => setClientListOpen(true)}
                  onChange={(event) => handleClientSearchChange(event.target.value)}
                  onKeyDown={handleClientSearchKeyDown}
                  onBlur={() => setTimeout(() => setClientListOpen(false), 120)}
                  placeholder="Digite o nome do cliente ou o telefone"
                />
                {clientListOpen && normalizedClientSearch && (
                  <div className="order-client-options" id="order-client-options" role="group" aria-label="Clientes encontrados">
                    {matchingClients.length > 0 && <div role="listbox" aria-label="Sugestões de clientes">
                      {matchingClients.map((client, index) => (
                        <button
                          id={`order-client-option-${index}`}
                          key={client.id}
                          type="button"
                          role="option"
                          aria-selected={client.id === clientId}
                          className="order-client-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleClientChange(client.id)}
                        >
                          <strong>{client.name}</strong>
                          <span>{client.contacts?.find((contact) => contact.isPrimary)?.value ?? "Cliente"}</span>
                        </button>
                      ))}
                    </div>}
                    {clientsLoading ? <span className="order-client-empty">Carregando clientes…</span> : matchingClients.length === 0 && <span className="order-client-empty">Nenhum cliente encontrado.</span>}
                    {!clientsLoading && exactClientIsInactive ? (
                      <span className="order-client-empty">Este cliente já existe, mas está inativo. Ative-o para usar em novos pedidos.</span>
                    ) : canCreateClient ? (
                      <button
                        id="order-client-create-option"
                        type="button"
                        className="order-client-create"
                        aria-current={activeClientIndex === matchingClients.length ? "true" : undefined}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setClientListOpen(false);
                          setClientPanelOpen(true);
                        }}
                      >
                        + Cadastrar cliente “{clientSearch.trim()}”
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              <label>
                Endereço de entrega
                <select
                  value={addressId}
                  onChange={(event) => {
                    setAddressId(event.target.value);
                    setAddressSelectionTouched(true);
                  }}
                >
                  <option value="">Retirada pelo cliente</option>

                  {addressId && !selectedAddress && (
                    <option value={addressId}>
                      Endereço original não localizado
                    </option>
                  )}

                  {selectableAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {formatAddressLabel(address)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-field-actions">
                <Button type="button" variant="ghost" onClick={() => { setClientPanelOpen(false); setAddressPanelMode("choose"); }}>
                  Escolher endereço
                </Button>

                <Button type="button" variant="ghost" onClick={() => { setClientPanelOpen(false); setAddressPanelMode("create"); }} disabled={!selectedClient || !onCreateAddress}>
                  + Endereço
                </Button>
              </div>

              <label>
                Data e hora da entrega
                <input type="datetime-local" value={deliveryDateTime} onChange={(event) => setDeliveryDateTime(event.target.value)} />
              </label>

              <label>
                Status do pedido
                <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as OrderStatus)}>
                  <option value="active">Ativo</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
            </div>
          </section>
          {/* Itens do pedido */}
          <section
            className={
              isEditingItem
                ? "panel-column order-items-column order-items-column-editing"
                : "panel-column order-items-column"
            }
          >
            {!isEditingItem && (
              <>
                <div className="panel-section-title order-items-title">
                  <span>Itens do pedido</span>
                  <small>Produtos, quantidades e preços negociados.</small>
                </div>

                <div className="order-items-list-scroll">
                  <div className="order-items-list">
                    {items.map((item, index) => (
                      <div className="expandable-card order-item-collapsed-card" key={item.id}>
                        <div className="expandable-card-header">
                          <button
                            type="button"
                            className="expandable-card-trigger"
                            onClick={() => setExpandedItemId(item.id)}
                          >
                            <span>{getItemSummary(item, index)}</span>
                            <small>Editar</small>
                          </button>

                          <button
                            type="button"
                            className="text-link compact-link"
                            onClick={() => requestRemoveItem(item, index)}
                            disabled={items.length === 1}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeProducts.length === 0 && (
                      <p className="muted-text">
                        Nenhum produto ativo cadastrado. Cadastre produtos antes de
                        registrar pedidos.
                      </p>
                    )}
                  </div>
                </div>

                <div className="panel-column-actions order-items-actions">
                  <Button type="button" variant="ghost" onClick={addItem}>
                    + Adicionar item
                  </Button>
                </div>
              </>
            )}

            {isEditingItem && expandedItem && (
              <div className="order-item-expanded-shell">
                <div className="expandable-card expanded order-item-expanded-card">
                  <div className="expandable-card-header">
                    <button
                      type="button"
                      className="expandable-card-trigger"
                      onClick={() => setExpandedItemId(null)}
                    >
                      <span>{getItemSummary(expandedItem, expandedItemIndex)}</span>
                      <small>Recolher</small>
                    </button>

                    <button
                      type="button"
                      className="text-link compact-link"
                      onClick={() => requestRemoveItem(expandedItem, expandedItemIndex)}
                      disabled={items.length === 1}
                    >
                      Remover
                    </button>
                  </div>

                  <div className="expandable-card-body">
                    <div className="input-group single-column">
                      <label>
                        Produto
                        <select
                          value={expandedItem.productId}
                          onChange={(event) =>
                            handleProductChange(expandedItem.id, event.target.value)
                          }
                        >
                          <option value="">Selecione um produto</option>

                          {expandedItem.productId &&
                            !selectableProducts.some((product) => product.id === expandedItem.productId) && (
                              <option value={expandedItem.productId}>
                                {expandedItem.productName || "Produto não localizado"}
                              </option>
                            )}

                          {selectableProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.categoryLabel ? ` · ${product.categoryLabel}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="order-item-quantity-unit-row">
                        <label>
                          Quantidade
                          <input
                            value={expandedItem.quantity}
                            onChange={(event) =>
                              updateItem(expandedItem.id, { quantity: event.target.value })
                            }
                            placeholder="Ex: 1"
                          />
                        </label>

                        <label>
                          Unidade
                          <select
                            value={expandedItem.unit}
                            onChange={(event) =>
                              updateItem(expandedItem.id, { unit: event.target.value })
                            }
                          >
                            {!itemUnitOptions.includes(expandedItem.unit) && (
                              <option value={expandedItem.unit}>{expandedItem.unit}</option>
                            )}

                            {itemUnitOptions.map((unitOption) => (
                              <option key={unitOption} value={unitOption}>
                                {unitOption}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label>
                        Preço negociado
                        <input
                          value={expandedItem.unitPrice}
                          onChange={(event) =>
                            updateItem(expandedItem.id, { unitPrice: event.target.value })
                          }
                          placeholder="Ex: 80,00"
                        />
                      </label>
                    </div>

                    {activeProducts.length === 0 && (
                      <p className="muted-text">
                        Nenhum produto ativo cadastrado. Cadastre produtos antes de
                        registrar pedidos.
                      </p>
                    )}

                    <div className="panel-optional-actions">
                      {!expandedItem.showTags && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => showItemTags(expandedItem.id)}
                        >
                          + Adicionar etiquetas
                        </Button>
                      )}

                      {!expandedItem.showNotes && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => showItemNotes(expandedItem.id)}
                        >
                          + Adicionar comentário
                        </Button>
                      )}
                    </div>

                    {expandedItem.showTags && (
                      <div className="panel-optional-field">
                        <header>
                          <div>
                            <strong>Etiquetas do item</strong>
                            <span>Use para cuidados, alertas ou detalhes específicos.</span>
                          </div>

                          <button
                            type="button"
                            className="text-link compact-link"
                            onClick={() => removeItemTags(expandedItem.id)}
                          >
                            Remover
                          </button>
                        </header>

                        {itemTags.length > 0 ? (
                          <div className="panel-chip-grid">
                            {itemTags.map((tag) => {
                              const selected = expandedItem.tagIds.includes(tag.id);

                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  className={selected ? "panel-chip selected" : "panel-chip"}
                                  aria-pressed={selected}
                                  onClick={() => toggleItemTag(expandedItem.id, tag.id)}
                                >
                                  #{tag.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="muted-text">
                            Nenhuma etiqueta disponível para itens de pedido.
                          </p>
                        )}
                      </div>
                    )}

                    {expandedItem.showNotes && (
                      <div className="panel-optional-field">
                        <header>
                          <div>
                            <strong>Comentário do item</strong>
                            <span>Use para observações específicas deste produto.</span>
                          </div>

                          <button
                            type="button"
                            className="text-link compact-link"
                            onClick={() => removeItemNotes(expandedItem.id)}
                          >
                            Remover
                          </button>
                        </header>

                        <label className="panel-field">
                          <textarea
                            value={expandedItem.notes}
                            onChange={(event) =>
                              updateItem(expandedItem.id, { notes: event.target.value })
                            }
                            placeholder="Ex: sem cobertura, escrever nome, massa branca..."
                            rows={3}
                          />
                        </label>
                      </div>
                    )}

                    <div className="panel-inline-footer">
                      <span>
                        Total do item:{" "}
                        <strong>{formatCurrencyBR(getItemTotal(expandedItem))}</strong>
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setExpandedItemId(null)}
                        disabled={!expandedItem.productId}
                      >
                        Concluir item
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>          
          {/* Taxa, pago, resumo e observações */}
          <section className="panel-column">
            <div className="panel-column-scroll">
              <section className="panel-section">
                <div className="panel-section-title">
                  <span>Pagamento</span>
                  <small>{order ? "O dinheiro recebido é histórico; novos valores usam Registrar pagamento." : "Controle de pagamento inicial, entrega, crédito e combinados."}</small>
                </div>

                <div className="panel-field-row">
                  <label className="panel-field-card">
                    Taxa de entrega
                    <input value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} placeholder="Ex: 10,00" />
                  </label>

                  {order ? (
                    <div className="panel-field-card">
                      Dinheiro recebido
                      <strong>{formatCurrencyBR(cashPaid)}</strong>
                    </div>
                  ) : (
                    <label className="panel-field-card">
                      Pagamento inicial
                      <input value={initialPayment} onChange={(event) => setInitialPayment(event.target.value)} placeholder={automaticCreditApplied > 0 ? "Opcional" : "Ex: 50,00"} />
                    </label>
                  )}
                </div>
              </section>

              <section className="panel-section">
                <div className="compact-summary-box">
                  <span>Subtotal: {formatCurrencyBR(subtotal)}</span>

                  <span>Entrega: {formatCurrencyBR(parsedDeliveryFee)}</span>

                  <span>Dinheiro recebido: {formatCurrencyBR(cashPaid)}</span>

                  {automaticCreditApplied > 0 && (
                    <span>Crédito usado: {formatCurrencyBR(automaticCreditApplied)}</span>
                  )}

                  <span className="summary-status">
                    {statusLabel}: {formatCurrencyBR(statusAmount)}
                  </span>

                  <strong className="summary-total">Total: {formatCurrencyBR(total)}</strong>
                </div>
              </section>

              <section className="panel-section">
                <label className="panel-textarea">
                  Observações do pedido
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes gerais, combinados, horários, forma de pagamento..." rows={4} />
                </label>
              </section>
            </div>
          </section>{" "}
        </div>

        <div className="panel-footer">
          <Button type="submit" disabled={saving || !selectedClient || !deliveryDateTime || parsedItems.length === 0}>
            {saving ? "Salvando..." : "Salvar pedido"}
          </Button>
        </div>
      </form>
      <SlidePanel
        open={clientPanelOpen}
        level={panelLevel === 1 ? 2 : 3}
        size="normal"
        title="Cadastrar cliente"
        description="Cadastre o cliente e ele será selecionado neste pedido."
        onClose={() => setClientPanelOpen(false)}
      >
        {clientPanelOpen && onCreateClient && (
          <ClientQuickForm
            favorite={false}
            initialName={clientSearch.trim()}
            onCancel={() => setClientPanelOpen(false)}
            onSave={handleCreateClient}
          />
        )}
      </SlidePanel>
      <SlidePanel
        open={addressPanelMode !== null}
        level={3}
        size="wide"
        title={addressPanelMode === "create" ? "Adicionar endereço" : "Escolher endereço"}
        description={addressPanelMode === "create" ? "Cadastre um endereço para usar neste pedido." : "Selecione um endereço cadastrado para este pedido."}
        onClose={() => setAddressPanelMode(null)}
      >
        {addressPanelMode === "choose" && (
          <AddressPickerContent
            addresses={selectableAddresses}
            selectedAddressId={addressId}
            unresolvedAddressLabel={
              addressId && !selectedAddress
                ? order?.addressSnapshot
                  ? `${order.addressSnapshot.street}${order.addressSnapshot.number ? `, ${order.addressSnapshot.number}` : ""} · ${order.addressSnapshot.city}`
                  : "Os dados físicos preservados no pedido continuam disponíveis."
                : undefined
            }
            onCancel={() => setAddressPanelMode(null)}
            onConfirm={(nextAddressId) => {
              setAddressId(nextAddressId);
              setAddressSelectionTouched(true);
              setAddressPanelMode(null);
            }}
            onRequestCreateAddress={selectedClient && onCreateAddress ? () => setAddressPanelMode("create") : undefined}
          />
        )}

        {addressPanelMode === "create" && selectedClient && onCreateAddress && <AddressForm client={selectedClient} onCancel={() => setAddressPanelMode(null)} onSave={handleCreateAddress} />}
      </SlidePanel>{" "}
    </>
  );
}
