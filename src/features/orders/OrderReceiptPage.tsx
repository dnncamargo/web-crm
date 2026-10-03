import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { useProducts } from "../products/useProducts";
import { encodePrintJob } from "../printers/escposEncoder";
import { getPrintColumnsForPaperWidth } from "../printers/printJobLayout";
import { resolveDefaultPrinter } from "../printers/printerUtils";
import { usePrinters } from "../printers/usePrinters";
import { OrderReceipt } from "./components/OrderReceipt";
import { createOrderReceiptDocument } from "./orderReceiptDocument";
import { createOrderReceiptPrintJob } from "./orderReceiptPrintJob";
import { useOrders } from "./useOrders";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível enviar o recibo para a impressora térmica.";
}

export function OrderReceiptPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { products, loadingProducts, productsError } = useProducts();
  const { orders, loadingOrders, ordersError } = useOrders(products);
  const {
    printers,
    defaultPrinterId,
    loading: loadingPrinters,
    printersError,
    printToPrinter,
  } = usePrinters();
  const [thermalPrintBusy, setThermalPrintBusy] = useState(false);
  const [thermalPrintError, setThermalPrintError] = useState("");
  const [thermalPrintSuccess, setThermalPrintSuccess] = useState("");

  const order = orders.find((candidate) => candidate.id === orderId);
  const loading = loadingOrders || loadingProducts;
  const defaultPrinter = resolveDefaultPrinter(printers, defaultPrinterId);

  async function handleThermalPrint() {
    if (!order || !defaultPrinter || loadingPrinters || printersError || thermalPrintBusy) {
      return;
    }

    setThermalPrintError("");
    setThermalPrintSuccess("");
    setThermalPrintBusy(true);

    try {
      const document = createOrderReceiptDocument(order, products);
      const job = createOrderReceiptPrintJob(document, {
        columns: getPrintColumnsForPaperWidth(defaultPrinter.paperWidthMm),
      });
      const bytes = encodePrintJob(job);

      await printToPrinter(defaultPrinter, bytes);
      setThermalPrintSuccess(`Recibo enviado para “${defaultPrinter.name}”.`);
    } catch (error) {
      setThermalPrintError(getErrorMessage(error));
    } finally {
      setThermalPrintBusy(false);
    }
  }

  const thermalPrintStatus = thermalPrintError
    ? { message: thermalPrintError, error: true }
    : printersError
      ? {
          message: "A configuração da impressora não pôde ser carregada. A impressão térmica está indisponível; use a impressão pelo navegador.",
          error: true,
        }
      : loadingPrinters
        ? { message: "Carregando a configuração da impressora térmica...", error: false }
        : !defaultPrinter
          ? {
              message: "A impressão térmica exige uma impressora padrão ativa configurada.",
              error: true,
            }
          : thermalPrintSuccess
            ? { message: thermalPrintSuccess, error: false }
            : null;

  return (
    <main className="receipt-page">
      {order && (
        <div className="receipt-toolbar" aria-label="Ações do recibo">
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar
          </Button>
          <Button type="button" onClick={handleThermalPrint} disabled={loadingPrinters || Boolean(printersError) || !defaultPrinter || thermalPrintBusy}>
            Imprimir na térmica
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            Imprimir pelo navegador
          </Button>
        </div>
      )}

      {order && thermalPrintStatus && (
        <p className={`receipt-state${thermalPrintStatus.error ? " receipt-state-error" : ""}`} aria-live="polite">
          {thermalPrintStatus.message}
        </p>
      )}

      {loading && <p className="receipt-state">Carregando pedido...</p>}
      {!loading && ordersError && <p className="receipt-state receipt-state-error">{ordersError}</p>}
      {!loading && productsError && <p className="receipt-state receipt-state-error">{productsError}</p>}
      {!loading && !ordersError && !productsError && !order && (
        <section className="receipt-state">
          <h1>Pedido não encontrado</h1>
          <p>Não foi possível localizar este pedido.</p>
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar para pedidos
          </Button>
        </section>
      )}

      {order && <OrderReceipt order={order} products={products} />}
    </main>
  );
}
