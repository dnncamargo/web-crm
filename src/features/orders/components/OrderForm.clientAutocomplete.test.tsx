// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Address } from "../../addresses/addressTypes";
import type { Client, NewClientData } from "../../clients/clientTypes";
import type { Product } from "../../products/productTypes";
import type { NewOrderData, Order } from "../orderTypes";
import { OrderForm } from "./OrderForm";

afterEach(cleanup);

const clients: Client[] = [
  { id: "ana", name: "Ana Souza", active: true, favorite: false, contactFrequency: "none", contacts: [], primaryAddressId: "address-ana", tagIds: [] },
  { id: "jose", name: "José Oliveira", active: true, favorite: false, contactFrequency: "none", contacts: [{ id: "jose-phone", type: "whatsapp", value: "22999990000", isPrimary: true }], primaryAddressId: "address-jose", tagIds: [] },
  { id: "inactive", name: "Bruno Lima", active: false, favorite: false, contactFrequency: "none", contacts: [], tagIds: [] },
];

const addresses: Address[] = [
  { id: "address-ana", clientId: "ana", label: "Casa Ana", street: "Rua A", city: "Niterói", active: true },
  { id: "address-jose", clientId: "jose", label: "Casa José", street: "Rua B", city: "Niterói", active: true },
];

const products: Product[] = [{ id: "cake", name: "Bolo", active: true, suggestedPrice: 50, unit: "unidade", tagIds: [] }];

const order: Order = {
  id: "order-1",
  clientId: "ana",
  clientName: "Ana Souza",
  addressId: "address-ana",
  deliveryDateTime: "2026-11-20T12:00",
  items: [{ id: "item-1", productId: "cake", productName: "Bolo", quantity: 1, unitPrice: 50, total: 50 }],
  subtotal: 50,
  deliveryFee: 0,
  total: 50,
  amountPaid: 0,
  payments: [],
  orderStatus: "active",
  tagIds: [],
};

function renderOrderForm({
  availableClients = clients,
  onCreateClient = vi.fn(async () => ({ id: "new-client" })),
  onSave = vi.fn(async () => undefined),
}: {
  availableClients?: Client[];
  onCreateClient?: (data: NewClientData) => Promise<{ id: string }>;
  onSave?: (data: NewOrderData) => Promise<void>;
} = {}) {
  render(
    <OrderForm
      order={order}
      orders={[order]}
      clients={availableClients}
      addresses={addresses}
      products={products}
      onCancel={() => undefined}
      onSave={onSave}
      onCreateClient={onCreateClient}
    />,
  );
  return { onCreateClient, onSave };
}

describe("OrderForm client autocomplete", () => {
  it("filters names without accents or case differences and preserves address selection", async () => {
    const user = userEvent.setup();
    const { onSave } = renderOrderForm();
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });
    expect((clientInput as HTMLInputElement).placeholder).toBe("Digite o nome do cliente ou o telefone");

    await user.clear(clientInput);
    await user.type(clientInput, "jose");
    const option = screen.getByRole("option", { name: /José Oliveira/ });
    await user.click(option);

    expect((clientInput as HTMLInputElement).value).toBe("José Oliveira");
    expect((screen.getByLabelText("Endereço de entrega") as HTMLSelectElement).value).toBe("address-jose");
    await user.click(screen.getByRole("button", { name: "Salvar pedido" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clientId: "jose", addressId: "address-jose" })));
  });

  it("does not submit a typed name without selecting a valid client", async () => {
    const user = userEvent.setup();
    const { onSave } = renderOrderForm();
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });

    await user.clear(clientInput);
    await user.type(clientInput, "Cliente inexistente");

    expect((screen.getByRole("button", { name: "Salvar pedido" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Cadastrar cliente/ })).toBeTruthy();
  });

  it("searches contacts and supports selecting a suggestion from the keyboard", async () => {
    const user = userEvent.setup();
    renderOrderForm();
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });

    await user.clear(clientInput);
    await user.type(clientInput, "22999990000");
    expect(screen.getByRole("option", { name: /José Oliveira/ })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");

    expect((clientInput as HTMLInputElement).value).toBe("José Oliveira");
  });

  it("blocks duplicate registration for an inactive exact-name client", async () => {
    const user = userEvent.setup();
    renderOrderForm();
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });

    await user.clear(clientInput);
    await user.type(clientInput, "bruno lima");

    expect(screen.getByText(/já existe, mas está inativo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cadastrar cliente/ })).toBeNull();
  });

  it("opens quick registration from the keyboard when there is no match", async () => {
    const user = userEvent.setup();
    renderOrderForm();
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });

    await user.clear(clientInput);
    await user.type(clientInput, "Maria Oliveira");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("dialog", { name: "Cadastrar cliente" })).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Maria Oliveira");
  });

  it("prefills, creates, and immediately selects the newly created client", async () => {
    const user = userEvent.setup();
    const onCreateClient = vi.fn(async () => ({ id: "created-now" }));
    const { onSave } = renderOrderForm({ onCreateClient });
    const clientInput = screen.getByRole("combobox", { name: "Cliente" });

    await user.clear(clientInput);
    await user.type(clientInput, "Maria Oliveira");
    await user.click(screen.getByRole("button", { name: /Cadastrar cliente/ }));

    const quickName = screen.getByLabelText("Nome");
    expect((quickName as HTMLInputElement).value).toBe("Maria Oliveira");
    await user.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(() => expect((clientInput as HTMLInputElement).value).toBe("Maria Oliveira"));
    expect(onCreateClient).toHaveBeenCalledWith(expect.objectContaining({ name: "Maria Oliveira" }));
    await user.click(screen.getByRole("button", { name: "Salvar pedido" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clientId: "created-now", clientName: "Maria Oliveira" })));
  });
});
