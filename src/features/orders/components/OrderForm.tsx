import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { getAutomaticCreditApplied, getClientAvailableCredit, getOrderBalanceInfo } from "../orderUtils";
import { Button } from "../../../components/ui/Button";
import { SlidePanel } from "../../../components/ui/SlidePanel";
import { formatCurrencyBR, parseCurrencyInput } from "../../../utils/money";
import type { Address, NewAddressData } from "../../addresses/addressTypes";
import { AddressForm } from "../../addresses/components/AddressForm";
import type { Client } from "../../clients/clientTypes";
import type { Product } from "../../products/productTypes";
import type { NewOrderData, Order, OrderItem, OrderStatus } from "../orderTypes";
import type { Tag } from "../../tags/tagTypes";

interface OrderFormItem {
  id: string;
  productId: string;
  quantity: string;
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
  const owner = address.clientName ? `${address.clientName} · ` : "";
  const number = address.number ? `, ${address.number}` : "";
  const neighborhood = address.neighborhood ? ` · ${address.neighborhood}` : "";
  const city = address.city ? ` · ${address.city}` : "";

  return `${owner}${address.label}: ${address.street}${number}${neighborhood}${city}`;
}

export function OrderForm({ order, orders, clients, addresses, products, itemTags = [], onCancel, onSave, onCreateAddress, onDirtyChange }: OrderFormProps) {
  const [clientId, setClientId] = useState(order?.clientId ?? "");
  const [addressId, setAddressId] = useState(order?.addressId ?? "");
  const [deliveryDateTime, setDeliveryDateTime] = useState(order?.deliveryDateTime ?? "");
  const [deliveryFee, setDeliveryFee] = useState(currencyToInput(order?.deliveryFee ?? 0));
  const [amountPaid, setAmountPaid] = useState(currencyToInput(order?.amountPaid ?? 0));
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.orderStatus ?? "active");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [addressPanelMode, setAddressPanelMode] = useState<"choose" | "create" | null>(null);
  const [saving, setSaving] = useState(false);

  const initialItems: OrderFormItem[] = order?.items.length
    ? order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: currencyToInput(item.unitPrice),
        notes: item.notes ?? "",
        tagIds: item.tagIds ?? [],
        showNotes: Boolean(item.notes),
        showTags: Boolean(item.tagIds?.length),
      }))
    : [
        {
          id: crypto.randomUUID(),
          productId: "",
          quantity: "1",
          unitPrice: "",
          notes: "",
          tagIds: [],
          showNotes: false,
          showTags: false,
        },
      ];
  const [items, setItems] = useState<OrderFormItem[]>(initialItems);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(order?.items.length ? null : (initialItems[0]?.id ?? null));

  const initialFormSignature = useMemo(
    () =>
      JSON.stringify({
        clientId: order?.clientId ?? "",
        addressId: order?.addressId ?? "",
        deliveryDateTime: order?.deliveryDateTime ?? "",
        deliveryFee: currencyToInput(order?.deliveryFee ?? 0),
        amountPaid: currencyToInput(order?.amountPaid ?? 0),
        orderStatus: order?.orderStatus ?? "active",
        notes: order?.notes ?? "",
        items: initialItems,
      }),
    [],
  );

  const currentFormSignature = JSON.stringify({
    clientId,
    addressId,
    deliveryDateTime,
    deliveryFee,
    amountPaid,
    orderStatus,
    notes,
    items,
  });

  useEffect(() => {
    onDirtyChange?.(currentFormSignature !== initialFormSignature);
  }, [currentFormSignature, initialFormSignature, onDirtyChange]);

  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);

  const activeAddresses = useMemo(() => addresses.filter((address) => address.active), [addresses]);

  const selectableAddresses = useMemo(() => {
    if (!clientId) {
      return activeAddresses;
    }

    return activeAddresses.filter((address) => address.clientId === clientId);
  }, [activeAddresses, clientId]);

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedAddress = addresses.find((address) => address.id === addressId);

  const parsedItems: OrderItem[] = items
    .map((item) => {
      const product = products.find((currentProduct) => currentProduct.id === item.productId);
      const quantity = Number(item.quantity.replace(",", "."));
      const unitPrice = parseMoneyOrZero(item.unitPrice);

      return {
        id: item.id,
        productId: item.productId,
        productName: product?.name ?? "",
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unitPrice,
        total: (Number.isFinite(quantity) ? quantity : 0) * unitPrice,
        notes: item.showNotes ? item.notes.trim() : "",
        tagIds: item.showTags ? item.tagIds : [],
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0);

  const subtotal = parsedItems.reduce((sum, item) => sum + item.total, 0);
  const parsedDeliveryFee = parseMoneyOrZero(deliveryFee);
  const parsedAmountPaid = parseMoneyOrZero(amountPaid);
  const total = subtotal + parsedDeliveryFee;

  const availableClientCredit = selectedClient ? getClientAvailableCredit(orders, selectedClient.id, order?.id) : 0;

  const automaticCreditApplied = getAutomaticCreditApplied(availableClientCredit, total);

  const balanceInfo = getOrderBalanceInfo({
    total,
    amountPaid: parsedAmountPaid,
    creditApplied: automaticCreditApplied,
  });

  const creditGenerated = balanceInfo.type === "credit" ? balanceInfo.amount : 0;

  function updateItem(itemId: string, data: Partial<OrderFormItem>) {
    setItems((currentItems) => currentItems.map((item) => (item.id === itemId ? { ...item, ...data } : item)));
  }

  function handleProductChange(itemId: string, productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);

    updateItem(itemId, {
      productId,
      unitPrice: selectedProduct?.suggestedPrice !== undefined && selectedProduct.suggestedPrice !== null ? currencyToInput(selectedProduct.suggestedPrice) : "",
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
      quantity: "1",
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
    setItems((currentItems) => (currentItems.length === 1 ? currentItems : currentItems.filter((item) => item.id !== itemId)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient || !deliveryDateTime || parsedItems.length === 0) {
      return;
    }

    const creditFields: Partial<NewOrderData> = {};

    if (automaticCreditApplied > 0) {
      creditFields.creditApplied = automaticCreditApplied;
    } else if (order?.creditApplied) {
      creditFields.creditApplied = null;
    }

    if (creditGenerated > 0) {
      creditFields.creditGenerated = creditGenerated;
    } else if (order?.creditGenerated) {
      creditFields.creditGenerated = null;
    }

    setSaving(true);

    await onSave({
      clientId: selectedClient.id,
      clientName: selectedClient.name,

      addressId: selectedAddress?.id ?? null,
      addressSnapshot: selectedAddress
        ? {
            label: selectedAddress.label,
            cep: selectedAddress.cep,
            street: selectedAddress.street,
            number: selectedAddress.number,
            complement: selectedAddress.complement,
            neighborhood: selectedAddress.neighborhood,
            city: selectedAddress.city,
            state: selectedAddress.state,
            reference: selectedAddress.reference,
          }
        : null,

      deliveryDateTime,
      items: parsedItems,

      subtotal,
      deliveryFee: parsedDeliveryFee,
      total,
      amountPaid: parsedAmountPaid,

      ...creditFields,

      orderStatus,
      notes: notes.trim(),
      tagIds: order?.tagIds ?? [],
    });

    setSaving(false);
    onDirtyChange?.(false);
    onCancel();
  }

  function getProductName(productId: string) {
    return products.find((product) => product.id === productId)?.name ?? "";
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
    return `${item.quantity || "0"} × ${productName} · ${formatCurrencyBR(itemTotal)}`;
  }

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);

    const nextClient = clients.find((client) => client.id === nextClientId);

    if (!nextClient?.primaryAddressId) {
      setAddressId("");
      return;
    }

    const primaryAddressExists = addresses.some((address) => address.id === nextClient.primaryAddressId && address.active);

    setAddressId(primaryAddressExists ? nextClient.primaryAddressId : "");
  }

  async function handleCreateAddress(data: NewAddressData) {
    if (!onCreateAddress) {
      return;
    }

    const createdAddress = await onCreateAddress(data);
    setAddressId(createdAddress.id);
    setAddressPanelMode(null);
  }

  return (
    <>
      <form className="order-form-v2" onSubmit={handleSubmit}>
        <div className="order-form-columns">
          {/* Dados do pedido */}
          <section className="order-form-column">
            <div className="form-section-title">
              <span>Dados do pedido</span>
              <small>Cliente, entrega e status.</small>
            </div>

            <div className="input-group single-column">
              <label>
                Cliente
                <select value={clientId} onChange={(event) => handleClientChange(event.target.value)}>
                  <option value="">Selecione um cliente</option>

                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Endereço de entrega
                <select value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                  <option value="">Sem endereço definido</option>

                  {selectableAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {formatAddressLabel(address)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-field-actions">
                <Button type="button" variant="ghost" onClick={() => setAddressPanelMode("choose")}>
                  Escolher endereço
                </Button>

                <Button type="button" variant="ghost" onClick={() => setAddressPanelMode("create")} disabled={!selectedClient || !onCreateAddress}>
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
          <section className="order-form-column order-form-items-column">
            <div className="form-section-title">
              <span>Itens do pedido</span>
              <small>Produtos, quantidades e preços negociados.</small>
            </div>

            <div className="order-form-items-scroll">
              <div className="order-form-items">
                {items.map((item, index) => {
                  const expanded = expandedItemId === item.id;
                  const itemTotal = getItemTotal(item);

                  return (
                    <div className={expanded ? "order-item-form-card expanded" : "order-item-form-card"} key={item.id}>
                      <div className="order-item-summary-row">
                        <button type="button" className="order-item-summary-button" onClick={() => setExpandedItemId((currentId) => (currentId === item.id ? null : item.id))}>
                          <span>{getItemSummary(item, index)}</span>
                          <small>{expanded ? "Recolher" : "Editar"}</small>
                        </button>

                        <button type="button" className="text-link compact-link" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                          Remover
                        </button>
                      </div>

                      {expanded && (
                        <div className="order-item-editor">
                          <div className="input-group single-column">
                            <label>
                              Produto
                              <select value={item.productId} onChange={(event) => handleProductChange(item.id, event.target.value)}>
                                <option value="">Selecione um produto</option>

                                {activeProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                    {product.categoryLabel ? ` · ${product.categoryLabel}` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Quantidade
                              <input value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="Ex: 1" />
                            </label>

                            <label>
                              Preço negociado
                              <input value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} placeholder="Ex: 80,00" />
                            </label>
                          </div>

                          <div className="order-item-extra-actions">
                            {!item.showTags && (
                              <Button type="button" variant="ghost" onClick={() => showItemTags(item.id)}>
                                + Adicionar etiquetas
                              </Button>
                            )}

                            {!item.showNotes && (
                              <Button type="button" variant="ghost" onClick={() => showItemNotes(item.id)}>
                                + Adicionar comentário
                              </Button>
                            )}
                          </div>

                          {item.showTags && (
                            <div className="order-item-optional-field">
                              <header>
                                <div>
                                  <strong>Etiquetas do item</strong>
                                  <span>Use para cuidados, alertas ou detalhes específicos.</span>
                                </div>

                                <button type="button" className="text-link compact-link" onClick={() => removeItemTags(item.id)}>
                                  Remover
                                </button>
                              </header>

                              {itemTags.length > 0 ? (
                                <div className="selectable-chip-grid order-item-tags-grid">
                                  {itemTags.map((tag) => {
                                    const selected = item.tagIds.includes(tag.id);

                                    return (
                                      <button
                                        key={tag.id}
                                        type="button"
                                        className={selected ? "selectable-chip selected" : "selectable-chip"}
                                        aria-pressed={selected}
                                        onClick={() => toggleItemTag(item.id, tag.id)}
                                      >
                                        #{tag.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="muted-text">Nenhuma etiqueta disponível para itens de pedido.</p>
                              )}
                            </div>
                          )}

                          {item.showNotes && (
                            <div className="order-item-optional-field">
                              <header>
                                <div>
                                  <strong>Comentário do item</strong>
                                  <span>Use para observações específicas deste produto.</span>
                                </div>

                                <button type="button" className="text-link compact-link" onClick={() => removeItemNotes(item.id)}>
                                  Remover
                                </button>
                              </header>

                              <label className="textarea-field">
                                <textarea
                                  value={item.notes}
                                  onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                                  placeholder="Ex: sem cobertura, escrever nome, massa branca..."
                                  rows={3}
                                />
                              </label>
                            </div>
                          )}

                          <div className="order-item-footer">
                            <span>
                              Total do item: <strong>{formatCurrencyBR(itemTotal)}</strong>
                            </span>

                            <Button type="button" variant="ghost" onClick={() => setExpandedItemId(null)} disabled={!item.productId}>
                              Concluir item
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {activeProducts.length === 0 && <p className="muted-text">Nenhum produto ativo cadastrado. Cadastre produtos antes de registrar pedidos.</p>}
              </div>
            </div>

            <Button type="button" variant="ghost" onClick={addItem}>
              + Adicionar item
            </Button>
          </section>

          {/* Taxa, pago, resumo e observações */}
          <section className="order-form-column order-form-payment-column">
            <div className="form-section-title">
              <span>Pagamento</span>
              <small>Controle de sinal, entrega, crédito e combinados.</small>
            </div>

            <div className="order-payment-fields">
              <label>
                Taxa de entrega
                <input value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} placeholder="Ex: 10,00" />
              </label>

              <label>
                Valor pago
                <input value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} placeholder="Ex: 50,00" />
              </label>
            </div>

            <div className="order-summary-box order-summary-box-compact">
              <span>Subtotal: {formatCurrencyBR(subtotal)}</span>
              <span>Entrega: {formatCurrencyBR(parsedDeliveryFee)}</span>
              <span>Pago: {formatCurrencyBR(parsedAmountPaid)}</span>
              <span>
                {balanceInfo.label}: {formatCurrencyBR(balanceInfo.amount)}
                {balanceInfo.type === "credit"}
              </span>
              <strong>Total: {formatCurrencyBR(total)}</strong>
            </div>

            <label className="textarea-field order-notes-field">
              Observações do pedido
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes gerais, combinados, horários, forma de pagamento..." rows={6} />
            </label>
          </section>
        </div>

        <div className="order-form-footer">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>

          <Button type="submit" disabled={saving || !selectedClient || !deliveryDateTime || parsedItems.length === 0}>
            {saving ? "Salvando..." : "Salvar pedido"}
          </Button>
        </div>
      </form>
      <SlidePanel
        open={addressPanelMode !== null}
        level={3}
        size="normal"
        title={addressPanelMode === "create" ? "Adicionar endereço" : "Escolher endereço"}
        description={addressPanelMode === "create" ? "Cadastre um endereço para usar neste pedido." : "Selecione um endereço cadastrado ou deixe o pedido sem endereço."}
        onClose={() => setAddressPanelMode(null)}
      >
        {addressPanelMode === "choose" && (
          <div className="address-picker-panel">
            <button
              type="button"
              className={!addressId ? "address-option selected" : "address-option"}
              onClick={() => {
                setAddressId("");
                setAddressPanelMode(null);
              }}
            >
              <strong>Sem endereço definido</strong>
              <span>O pedido pode ser salvo sem endereço.</span>
            </button>

            {selectableAddresses.map((address) => (
              <button
                type="button"
                className={address.id === addressId ? "address-option selected" : "address-option"}
                key={address.id}
                onClick={() => {
                  setAddressId(address.id);
                  setAddressPanelMode(null);
                }}
              >
                <strong>{address.label}</strong>
                <span>{formatAddressLabel(address)}</span>
              </button>
            ))}

            {selectableAddresses.length === 0 && <p className="muted-text">Nenhum endereço cadastrado para este cliente.</p>}
          </div>
        )}

        {addressPanelMode === "create" && selectedClient && onCreateAddress && <AddressForm client={selectedClient} onCancel={() => setAddressPanelMode(null)} onSave={handleCreateAddress} />}
      </SlidePanel>
    </>
  );
}
