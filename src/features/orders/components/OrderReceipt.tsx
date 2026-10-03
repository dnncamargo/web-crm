import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import { createOrderReceiptDocument } from "../orderReceiptDocument";

interface OrderReceiptProps {
  order: Order;
  products: Product[];
}

export function OrderReceipt({ order, products }: OrderReceiptProps) {
  const document = createOrderReceiptDocument(order, products);

  return (
    <article className="receipt-paper" aria-label="Prévia do recibo do pedido">
      <header className="receipt-header">
        <img className="receipt-logo" src="/brand/brand-mark-print.bmp" alt="Delícias do Porto" />
        <h1>{document.title}</h1>
        <p>Entrega: {document.deliveryDateTime}</p>
      </header>

      <section className="receipt-section receipt-customer">
        <p>
          Cliente: <strong>{document.customerName}</strong>
        </p>
        <div className="receipt-address">
          <strong>Entrega</strong>
          {document.fulfillment.type === "delivery" ? (
            document.fulfillment.lines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>{document.fulfillment.label}</p>
          )}
        </div>
      </section>

      <section className="receipt-section">
        <h2>Itens</h2>
        <div className="receipt-items">
          {document.items.map((item) => (
            <article className="receipt-item" key={item.id}>
              <div className="receipt-item-header">
                <h3>{item.name}</h3>
                <strong>{item.total}</strong>
              </div>
              <p className="receipt-item-meta">{item.details}</p>
              {item.notes && <p className="receipt-item-notes">{item.notes}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="receipt-section receipt-summary">
        <h2>Resumo</h2>
        {document.summary.rows.map((row) => (
          <div className="receipt-summary-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
        {document.summary.settled && <p className="receipt-settled">Quitado</p>}
        {document.summary.creditGenerated && (
          <div className="receipt-summary-row">
            <span>{document.summary.creditGenerated.label}</span>
            <strong>{document.summary.creditGenerated.value}</strong>
          </div>
        )}
        <div className="receipt-total">
          <span>TOTAL</span>
          <strong>{document.summary.total}</strong>
        </div>
      </section>
    </article>
  );
}
