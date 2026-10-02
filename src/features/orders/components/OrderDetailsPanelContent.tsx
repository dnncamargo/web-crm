import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import { formatDateTimeBR, getOrderBalanceInfo, getOrderEffectivePaid, getOrderItemProductName, getOrderStatusLabel, getPaymentStatus, getPaymentStatusLabel } from "../orderUtils";

interface OrderDetailsPanelContentProps {
  order: Order;
  products: Product[];
  onEdit: () => void;
  onPrint: () => void;
}

export function OrderDetailsPanelContent({ order, products, onEdit, onPrint }: OrderDetailsPanelContentProps) {
  const paymentStatus = getPaymentStatus(order);
  const balanceInfo = getOrderBalanceInfo(order);
  const creditApplied = order.creditApplied ?? 0;
  const creditGenerated = order.creditGenerated ?? 0;
  const effectivePaid = getOrderEffectivePaid(order);

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo do pedido</span>
              <small>Dados principais, entrega e situação atual.</small>
            </div>

            <div className="compact-summary-box panel-details-summary">
              <span>
                Cliente: <strong>{order.clientName}</strong>
              </span>
              <span>
                Entrega: <strong>{formatDateTimeBR(order.deliveryDateTime)}</strong>
              </span>
              <span>
                Status: <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
              </span>
              <span>
                Pagamento: <strong>{getPaymentStatusLabel(paymentStatus)}</strong>
              </span>
            </div>
          </section>

          {order.addressSnapshot ? (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Entrega</span>
              </div>

              <div className="panel-note">
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

            <div className="compact-summary-box panel-details-summary">
              <span>
                Produtos: <strong>{formatCurrencyBR(order.subtotal)}</strong>
              </span>
              <span>
                Entrega: <strong>{formatCurrencyBR(order.deliveryFee)}</strong>
              </span>
              <span>
                Total: <strong>{formatCurrencyBR(order.total)}</strong>
              </span>
              <span>
                Pago: <strong>{formatCurrencyBR(order.amountPaid)}</strong>
              </span>
              {creditApplied > 0 && (
                <span>
                  Crédito usado: <strong>{formatCurrencyBR(creditApplied)}</strong>
                </span>
              )}
              {creditGenerated > 0 && (
                <span>
                  Crédito gerado: <strong>{formatCurrencyBR(creditGenerated)}</strong>
                </span>
              )}
              <span>Pago considerado: <strong>{formatCurrencyBR(effectivePaid)}</strong></span>
              <span className="summary-full">
                {balanceInfo.label}: <strong>{formatCurrencyBR(balanceInfo.amount)}</strong>
              </span>
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
              <span>Marcadores</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
              <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
              {creditGenerated > 0 && <Badge>{`Crédito ${formatCurrencyBR(creditGenerated)}`}</Badge>}
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
