import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import { formatDateTimeBR, getOrderBalanceInfo, getOrderEffectivePaid, getOrderItemProductName, getOrderStatusLabel, getPaymentStatus, getPaymentStatusLabel } from "../orderUtils";

interface OrderDetailsPanelContentProps {
  order: Order;
  products: Product[];
  tagLabelsById: Record<string, string>;
  onEdit: () => void;
  onPrint: () => void;
}

export function OrderDetailsPanelContent({ order, products, tagLabelsById, onEdit, onPrint }: OrderDetailsPanelContentProps) {
  const paymentStatus = getPaymentStatus(order);
  const balanceInfo = getOrderBalanceInfo(order);
  const creditApplied = order.creditApplied ?? 0;
  const creditGenerated = order.creditGenerated ?? 0;
  const effectivePaid = getOrderEffectivePaid(order);
  const orderTagLabels = order.tagIds.map((tagId) => ({
    id: tagId,
    label: (tagLabelsById[tagId] ?? tagId).replace(/^#+/, ""),
  }));

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Cliente e agenda</span>
              <small>Dados principais, entrega e situação atual.</small>
            </div>

            <div className="panel-block-grid">
              <div className="panel-block">
                <span>Cliente</span>
                <strong>{order.clientName}</strong>
              </div>

              <div className="panel-block">
                <span>Entrega</span>
                <strong>{formatDateTimeBR(order.deliveryDateTime)}</strong>
              </div>

              <div className="panel-block">
                <span>Status do pedido</span>
                <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
              </div>

              <div className="panel-block">
                <span>Status do pagamento</span>
                <strong>{getPaymentStatusLabel(paymentStatus)}</strong>
              </div>
            </div>
          </section>

          {order.addressSnapshot ? (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Entrega</span>
              </div>

              <div className="panel-note">
                <span>{order.addressSnapshot.label}</span>
                <p>
                  {order.addressSnapshot.street}
                  {order.addressSnapshot.number ? `, ${order.addressSnapshot.number}` : ""}
                  {order.addressSnapshot.complement ? ` · ${order.addressSnapshot.complement}` : ""}
                  {order.addressSnapshot.neighborhood ? ` · ${order.addressSnapshot.neighborhood}` : ""}
                  {order.addressSnapshot.city ? ` · ${order.addressSnapshot.city}` : ""}
                  {order.addressSnapshot.state ? `/${order.addressSnapshot.state}` : ""}
                </p>
                {order.addressSnapshot.reference && <p>{order.addressSnapshot.reference}</p>}
              </div>
            </section>
          ) : (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Entrega</span>
              </div>
              <div className="panel-note">
                <span>Retirada pelo cliente</span>
                <p>Nenhum endereço de entrega foi selecionado.</p>
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Itens do pedido</span>
            </div>

            <div className="panel-list compact-list">
              {order.items.map((item) => (
                <div className="panel-list-row compact-row panel-list-row-with-value" key={item.id}>
                  <div>
                    <strong>{getOrderItemProductName(item, products)}</strong>
                    <span>
                      {item.quantity} × {formatCurrencyBR(item.unitPrice)} cada
                    </span>
                  </div>
                  <small>{formatCurrencyBR(item.total)}</small>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo financeiro</span>
              <small>Valores consolidados em um único bloco.</small>
            </div>

            <div className="panel-block-grid">
              <div className="panel-block">
                <span>Produtos</span>
                <strong>{formatCurrencyBR(order.subtotal)}</strong>
              </div>

              <div className="panel-block">
                <span>Taxa de entrega</span>
                <strong>{formatCurrencyBR(order.deliveryFee)}</strong>
              </div>

              <div className="panel-block panel-block-total">
                <span>Total</span>
                <strong>{formatCurrencyBR(order.total)}</strong>
              </div>

              <div className="panel-block">
                <span>Pago</span>
                <strong>{formatCurrencyBR(order.amountPaid)}</strong>
              </div>

              {creditApplied > 0 && (
                <div className="panel-block">
                  <span>Crédito usado</span>
                  <strong>{formatCurrencyBR(creditApplied)}</strong>
                </div>
              )}

              {creditGenerated > 0 && (
                <div className="panel-block">
                  <span>Crédito gerado</span>
                  <strong>{formatCurrencyBR(creditGenerated)}</strong>
                </div>
              )}

              <div className="panel-block">
                <span>Pago considerado</span>
                <strong>{formatCurrencyBR(effectivePaid)}</strong>
              </div>

              <div className="panel-block panel-block-total">
                <span>{balanceInfo.label}</span>
                <strong>{formatCurrencyBR(balanceInfo.amount)}</strong>
              </div>
            </div>
          </section>

          {order.notes && (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Anotações</span>
              </div>
              <div className="panel-note">
                <p>{order.notes}</p>
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Status e etiquetas</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
              <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
              {creditGenerated > 0 && <Badge>{`Crédito ${formatCurrencyBR(creditGenerated)}`}</Badge>}
              {orderTagLabels.map((tag) => <Badge key={tag.id}>{tag.label}</Badge>)}
            </div>
          </section>
        </section>
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          <Button type="button" variant="secondary" onClick={onPrint}>
            Imprimir via
          </Button>
          <Button type="button" variant="primary" onClick={onEdit}>
            Editar pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
