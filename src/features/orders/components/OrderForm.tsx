import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR, parseCurrencyInput } from "../../../utils/money";
import type { Address } from "../../addresses/addressTypes";
import type { Client } from "../../clients/clientTypes";
import type { Product } from "../../products/productTypes";
import type {
  NewOrderData,
  Order,
  OrderItem,
  OrderStatus,
} from "../orderTypes";

interface OrderFormItem {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

interface OrderFormProps {
  order?: Order;
  clients: Client[];
  addresses: Address[];
  products: Product[];
  onCancel: () => void;
  onSave: (data: NewOrderData) => Promise<void>;
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

export function OrderForm({
  order,
  clients,
  addresses,
  products,
  onCancel,
  onSave,
}: OrderFormProps) {
  const [clientId, setClientId] = useState(order?.clientId ?? "");
  const [addressId, setAddressId] = useState(order?.addressId ?? "");
  const [deliveryDateTime, setDeliveryDateTime] = useState(
    order?.deliveryDateTime ?? ""
  );
  const [deliveryFee, setDeliveryFee] = useState(
    currencyToInput(order?.deliveryFee ?? 0)
  );
  const [amountPaid, setAmountPaid] = useState(
    currencyToInput(order?.amountPaid ?? 0)
  );
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.orderStatus ?? "active"
  );
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<OrderFormItem[]>(
    order?.items.length
      ? order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: String(item.quantity),
          unitPrice: currencyToInput(item.unitPrice),
          notes: item.notes ?? "",
        }))
      : [
          {
            id: crypto.randomUUID(),
            productId: "",
            quantity: "1",
            unitPrice: "",
            notes: "",
          },
        ]
  );

  const activeClients = useMemo(
    () => clients.filter((client) => client.active),
    [clients]
  );

  const activeAddresses = useMemo(
    () => addresses.filter((address) => address.active),
    [addresses]
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products]
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedAddress = addresses.find((address) => address.id === addressId);

  const parsedItems: OrderItem[] = items
    .map((item) => {
      const product = products.find(
        (currentProduct) => currentProduct.id === item.productId
      );
      const quantity = Number(item.quantity.replace(",", "."));
      const unitPrice = parseMoneyOrZero(item.unitPrice);

      return {
        id: item.id,
        productId: item.productId,
        productName: product?.name ?? "",
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unitPrice,
        total: (Number.isFinite(quantity) ? quantity : 0) * unitPrice,
        notes: item.notes.trim(),
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0);

  const subtotal = parsedItems.reduce((sum, item) => sum + item.total, 0);
  const parsedDeliveryFee = parseMoneyOrZero(deliveryFee);
  const parsedAmountPaid = parseMoneyOrZero(amountPaid);
  const total = subtotal + parsedDeliveryFee;
  const remaining = Math.max(total - parsedAmountPaid, 0);

  function updateItem(itemId: string, data: Partial<OrderFormItem>) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...data } : item
      )
    );
  }

  function handleProductChange(itemId: string, productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);

    updateItem(itemId, {
      productId,
      unitPrice:
        selectedProduct?.suggestedPrice !== undefined &&
        selectedProduct.suggestedPrice !== null
          ? currencyToInput(selectedProduct.suggestedPrice)
          : "",
    });
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: crypto.randomUUID(),
        productId: "",
        quantity: "1",
        unitPrice: "",
        notes: "",
      },
    ]);
  }

  function removeItem(itemId: string) {
    setItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.id !== itemId)
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient || !deliveryDateTime || parsedItems.length === 0) {
      return;
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

      orderStatus,

      notes: notes.trim(),
      tagIds: order?.tagIds ?? [],
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="form-section-title">
        <span>Dados do pedido</span>
        <small>
          O preço do produto no pedido é negociável e não altera o cadastro do
          produto.
        </small>
      </div>

      <div className="input-group">
        <label>
          Cliente
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setAddressId("");
            }}
          >
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
          <select
            value={addressId}
            onChange={(event) => setAddressId(event.target.value)}
          >
            <option value="">Sem endereço definido</option>

            {activeAddresses.map((address) => (
              <option key={address.id} value={address.id}>
                {formatAddressLabel(address)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data e hora da entrega
          <input
            type="datetime-local"
            value={deliveryDateTime}
            onChange={(event) => setDeliveryDateTime(event.target.value)}
          />
        </label>

        <label>
          Status do pedido
          <select
            value={orderStatus}
            onChange={(event) => setOrderStatus(event.target.value as OrderStatus)}
          >
            <option value="active">Ativo</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
      </div>

      <div className="order-form-items">
        <div className="form-section-title">
          <span>Itens do pedido</span>
        </div>

        {items.map((item, index) => {
          const parsedQuantity = Number(item.quantity.replace(",", "."));
          const parsedUnitPrice = parseMoneyOrZero(item.unitPrice);
          const itemTotal =
            (Number.isFinite(parsedQuantity) ? parsedQuantity : 0) *
            parsedUnitPrice;

          return (
            <div className="order-item-form-card" key={item.id}>
              <div className="subtle-list-header">
                <span>Item {index + 1}</span>

                <button
                  type="button"
                  className="text-link compact-link"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                >
                  Remover
                </button>
              </div>

              <div className="input-group">
                <label>
                  Produto
                  <select
                    value={item.productId}
                    onChange={(event) =>
                      handleProductChange(item.id, event.target.value)
                    }
                  >
                    <option value="">Selecione um produto</option>

                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {product.categoryLabel
                          ? ` · ${product.categoryLabel}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantidade
                  <input
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, { quantity: event.target.value })
                    }
                    placeholder="Ex: 1"
                  />
                </label>

                <label>
                  Preço negociado
                  <input
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateItem(item.id, { unitPrice: event.target.value })
                    }
                    placeholder="Ex: 80,00"
                  />
                </label>
              </div>

              <label className="textarea-field">
                Observação do item
                <textarea
                  value={item.notes}
                  onChange={(event) =>
                    updateItem(item.id, { notes: event.target.value })
                  }
                  placeholder="Ex: sem cobertura, escrever nome, massa branca..."
                  rows={2}
                />
              </label>

              <div className="order-item-total">
                Total do item: <strong>{formatCurrencyBR(itemTotal)}</strong>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="ghost" onClick={addItem}>
          + Adicionar item
        </Button>
      </div>

      <div className="input-group">
        <label>
          Taxa de entrega
          <input
            value={deliveryFee}
            onChange={(event) => setDeliveryFee(event.target.value)}
            placeholder="Ex: 10,00"
          />
        </label>

        <label>
          Valor pago
          <input
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
            placeholder="Ex: 50,00"
          />
        </label>
      </div>

      <div className="order-summary-box">
        <span>Subtotal: {formatCurrencyBR(subtotal)}</span>
        <span>Entrega: {formatCurrencyBR(parsedDeliveryFee)}</span>
        <strong>Total: {formatCurrencyBR(total)}</strong>
        <span>Restante: {formatCurrencyBR(remaining)}</span>
      </div>

      <label className="textarea-field">
        Observações do pedido
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Detalhes gerais, combinados, horários, forma de pagamento..."
          rows={4}
        />
      </label>

      {activeProducts.length === 0 && (
        <p className="muted-text">
          Nenhum produto ativo cadastrado. Cadastre produtos antes de registrar
          pedidos.
        </p>
      )}

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button
          type="submit"
          disabled={
            saving ||
            !selectedClient ||
            !deliveryDateTime ||
            parsedItems.length === 0
          }
        >
          {saving ? "Salvando..." : "Salvar pedido"}
        </Button>
      </div>
    </form>
  );
}