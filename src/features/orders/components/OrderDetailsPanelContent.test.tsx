import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Order } from "../orderTypes";
import { OrderDetailsPanelContent } from "./OrderDetailsPanelContent";

function renderDetails(order: Order, options: { blockReason?: string | null; testData?: boolean } = {}) {
  return renderToStaticMarkup(
    <OrderDetailsPanelContent
      order={order}
      products={[]}
      tagLabelsById={{}}
      onEdit={vi.fn()}
      onPrint={vi.fn()}
      onRegisterPayment={vi.fn()}
      canCorrectPayments={false}
      onCorrectPayment={vi.fn()}
      onDelete={vi.fn()}
      deletionBlockReason={options.blockReason ?? null}
      deletionError=""
      onDeleteTestData={vi.fn()}
      canDeleteConfirmedTestData={options.testData ?? false}
    />,
  );
}

const cancelledOrder: Order = {
  id: "order-1",
  clientId: "client-1",
  clientName: "Cliente Teste",
  deliveryDateTime: "2026-10-02T10:00:00-03:00",
  items: [],
  subtotal: 32,
  deliveryFee: 0,
  total: 32,
  amountPaid: 0,
  payments: [],
  orderStatus: "cancelled",
  tagIds: [],
  cancellationAgreement: { operationId: "operation-123", text: "Cancelamento sem movimentação." },
};

describe("OrderDetailsPanelContent deletion actions", () => {
  it("shows common deletion only for an eligible cancelled order", () => {
    expect(renderDetails(cancelledOrder)).toContain("Excluir pedido");
    expect(renderDetails(cancelledOrder, { blockReason: "Dados financeiros inconclusivos." })).toContain("Dados financeiros inconclusivos.");
    expect(renderDetails(cancelledOrder, { blockReason: "Dados financeiros inconclusivos." })).not.toContain(">Excluir pedido</button>");
  });

  it("shows a separate explicit test-data action only when the order ID is allowlisted", () => {
    expect(renderDetails(cancelledOrder, { testData: true })).toContain("Excluir dado de teste");
    expect(renderDetails(cancelledOrder, { testData: false })).not.toContain("Excluir dado de teste");
  });
});
