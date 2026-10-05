import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { createPrintJobId } from "../printers/printCompanionClient";
import { useProducts } from "../products/useProducts";
import { encodePrintJob } from "../printers/escposEncoder";
import { getPrintColumnsForPaperWidth } from "../printers/printJobLayout";
import type { PrintJobRaster } from "../printers/printJobTypes";
import { loadPrintRaster } from "../printers/printRaster";
import { resolveDefaultPrinter } from "../printers/printerUtils";
import { usePrinters } from "../printers/usePrinters";
import { OrderReceipt } from "./components/OrderReceipt";
import { ORDER_RECEIPT_BRAND_NAME, ORDER_RECEIPT_LOGO_SRC } from "./orderReceiptBrand";
import { createOrderReceiptDocument } from "./orderReceiptDocument";
import { createOrderReceiptPrintJob } from "./orderReceiptPrintJob";
import {
  ORDER_RECEIPT_PRINT_BUSY_LABEL,
  ORDER_RECEIPT_PRINT_LABEL,
  printReceiptAutomatically,
} from "./orderPrintFlow";
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
    testPrinterConnection,
    printToPrinter,
  } = usePrinters();
  const [thermalPrintBusy, setThermalPrintBusy] = useState(false);
  const [thermalPrintError, setThermalPrintError] = useState("");
  const [thermalPrintSuccess, setThermalPrintSuccess] = useState("");

  const order = orders.find((candidate) => candidate.id === orderId);
  const loading = loadingOrders || loadingProducts;
  const defaultPrinter = resolveDefaultPrinter(printers, defaultPrinterId);

  async function handlePrint() {
    if (!order || thermalPrintBusy) {
      return;
    }

    setThermalPrintError("");
    setThermalPrintSuccess("");
    setThermalPrintBusy(true);

    try {
      const printer = loadingPrinters || printersError ? null : defaultPrinter;
      const result = await printReceiptAutomatically({
        printer,
        createJobId: createPrintJobId,
        preflight: testPrinterConnection,
        prepareBytes: async () => {
          const document = createOrderReceiptDocument(order, products);
          let logo: PrintJobRaster | undefined;

          try {
            logo = await loadPrintRaster(ORDER_RECEIPT_LOGO_SRC);
          } catch {
            logo = undefined;
          }

          const job = createOrderReceiptPrintJob(document, {
            columns: getPrintColumnsForPaperWidth(printer?.paperWidthMm ?? 80),
            brandName: ORDER_RECEIPT_BRAND_NAME,
            logo,
          });
          return encodePrintJob(job);
        },
        print: printToPrinter,
        browserPrint: () => window.print(),
      });

      if (result.route === "thermal") {
        setThermalPrintSuccess(`Recibo enviado para “${printer?.name ?? "impressora"}”.`);
      }
    } catch (error) {
      setThermalPrintError(getErrorMessage(error));
    } finally {
      setThermalPrintBusy(false);
    }
  }

  const thermalPrintStatus = thermalPrintError
    ? { message: thermalPrintError, error: true }
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
          <Button type="button" onClick={handlePrint} disabled={thermalPrintBusy}>
            {thermalPrintBusy ? ORDER_RECEIPT_PRINT_BUSY_LABEL : ORDER_RECEIPT_PRINT_LABEL}
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
