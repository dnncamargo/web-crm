import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getDiagnosticRoute } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import {
  clearPendingPrintCompanionWakeIfMatches,
  loadFreshPendingPrintCompanionWake,
  loadPrintCompanionConfig,
  loadPendingPrintCompanionWake,
} from "../printers/printCompanionStorage";
import {
  createPrintJobId,
  type PrintCompanionWakeIntent,
} from "../printers/printCompanionClient";
import { createPrintCompanionResumeOwner } from "../printers/printCompanionResumeOwner";
import { useProducts } from "../products/useProducts";
import { encodePrintJob } from "../printers/escposEncoder";
import { getPrintColumnsForPaperWidth } from "../printers/printJobLayout";
import type { PrintJobRaster } from "../printers/printJobTypes";
import { loadPrintRaster } from "../printers/printRaster";
import { resolveDefaultPrinter } from "../printers/printerUtils";
import { usePrinters } from "../printers/usePrinters";
import { OrderReceipt } from "./components/OrderReceipt";
import { ORDER_RECEIPT_LOGO_SRC } from "./orderReceiptBrand";
import { createOrderReceiptDocument } from "./orderReceiptDocument";
import { createOrderReceiptPrintJob } from "./orderReceiptPrintJob";
import { getStoreProfile } from "../store-profile/storeProfileService";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import {
  ORDER_RECEIPT_PRINT_BUSY_LABEL,
  ORDER_RECEIPT_PRINT_LABEL,
  printReceiptAutomatically,
  resumeFrozenOrderPrint,
} from "./orderPrintFlow";
import {
  clearOrderPrintAttemptIfMatches,
  createOrderPrintAttempt,
  loadFreshOrderPrintAttempt,
  saveOrderPrintAttempt,
  type OrderPrintAttempt,
} from "./orderPrintAttempt";
import type { Order } from "./orderTypes";
import {
  getOrderPrintActionMode,
  getShortOrderPrintError,
  type CompanionReadiness,
} from "./orderPrintStatus";
import type { Product } from "../products/productTypes";
import type { PrinterConfiguration } from "../printers/printerTypes";
import { printCompanionClient } from "../printers/usePrinters";
import { useOrders } from "./useOrders";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível enviar o recibo para a impressora térmica.";
}

interface PreparedReceipt {
  order: Order;
  products: Product[];
  printer: PrinterConfiguration;
  bytes: Uint8Array;
}

export function OrderReceiptPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { products, loadingProducts, productsError } = useProducts();
  const { orders, loadingOrders, ordersError } = useOrders(products);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [loadingStoreProfile, setLoadingStoreProfile] = useState(true);
  const [storeProfileError, setStoreProfileError] = useState("");
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
  const [initialPendingPrintAttempt] = useState(() => {
    const attempt = loadFreshOrderPrintAttempt();
    return attempt?.orderId === orderId ? attempt : null;
  });
  const [companionReadiness, setCompanionReadiness] = useState<CompanionReadiness>(
    initialPendingPrintAttempt ? "wake-required" : "unknown",
  );
  const [printStatus, setPrintStatus] = useState(
    initialPendingPrintAttempt ? "Aguardando serviço de impressão…" : "Verificando serviço de impressão…",
  );
  const [preparedReceipt, setPreparedReceipt] = useState<PreparedReceipt | null>(null);
  const [lastAttemptPrinter, setLastAttemptPrinter] = useState<PrinterConfiguration | null>(null);
  const [pendingPrintAttempt, setPendingPrintAttempt] = useState<OrderPrintAttempt | null>(initialPendingPrintAttempt);
  const [wakeIntent, setWakeIntent] = useState<PrintCompanionWakeIntent | null>(() =>
    printCompanionClient.prepareWakeIntent("print", initialPendingPrintAttempt?.attemptId),
  );
  const currentAttemptIdRef = useRef<string | null>(initialPendingPrintAttempt?.attemptId ?? null);
  const resumeOwnerRef = useRef(createPrintCompanionResumeOwner());
  const printStatusOwnerRef = useRef(initialPendingPrintAttempt ? 1 : 0);

  const order = orders.find((candidate) => candidate.id === orderId);
  const loading = loadingOrders || loadingProducts || loadingStoreProfile;
  const defaultPrinter = resolveDefaultPrinter(printers, defaultPrinterId);

  const prepareReceiptBytes = useCallback(async (
    receiptOrder: Order,
    receiptProducts: Product[],
    printer: PrinterConfiguration,
    receiptStoreProfile: StoreProfile,
  ) => {
    const document = createOrderReceiptDocument(receiptOrder, receiptProducts);
    let logo: PrintJobRaster | undefined;

    try {
      logo = await loadPrintRaster(ORDER_RECEIPT_LOGO_SRC);
    } catch {
      logo = undefined;
    }

    const job = createOrderReceiptPrintJob(document, {
      columns: getPrintColumnsForPaperWidth(printer.paperWidthMm),
      brandName: receiptStoreProfile.displayName,
      logo,
    });
    return encodePrintJob(job);
  }, []);

  useEffect(() => {
    let active = true;

    getStoreProfile()
      .then((profile) => {
        if (active) {
          setStoreProfile(profile);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStoreProfileError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingStoreProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!order || loading || loadingPrinters || printersError || !defaultPrinter || !storeProfile) {
      return undefined;
    }

    void prepareReceiptBytes(order, products, defaultPrinter, storeProfile).then((bytes) => {
      if (cancelled) {
        return;
      }

      setPreparedReceipt({ order, products, printer: defaultPrinter, bytes });
      if (printStatusOwnerRef.current === 0) {
        setPrintStatus("Pronto para imprimir.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [defaultPrinter, loading, loadingPrinters, order, prepareReceiptBytes, printersError, products, storeProfile]);

  const refreshCompanionReadiness = useCallback(async () => {
    try {
      await printCompanionClient.ensureCompanionReady({ requiredCapabilities: ["config", "print"] });
      if (printStatusOwnerRef.current !== 0) {
        return;
      }
      setCompanionReadiness("ready");
      if (printStatusOwnerRef.current === 0) {
        setPrintStatus("Pronto para imprimir.");
      }
    } catch {
      if (printStatusOwnerRef.current !== 0) {
        return;
      }
      setCompanionReadiness("wake-required");
      if (printStatusOwnerRef.current === 0) {
        setPrintStatus("Pronto para imprimir.");
      }
    }
  }, []);

  useEffect(() => {
    const initialReadinessTimer = window.setTimeout(() => {
      void refreshCompanionReadiness();
    }, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && printStatusOwnerRef.current === 0) {
        void refreshCompanionReadiness();
      }
    };
    const readinessHeartbeat = window.setInterval(() => {
      if (printStatusOwnerRef.current === 0) {
        void refreshCompanionReadiness();
      }
    }, 5_000);

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialReadinessTimer);
      window.clearInterval(readinessHeartbeat);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshWhenVisible);
    };
  }, [refreshCompanionReadiness]);

  const resumePendingPrint = useCallback(async () => {
    const attempt = loadFreshOrderPrintAttempt();
    const pendingWake = loadFreshPendingPrintCompanionWake();

    if (!attempt || !pendingWake || pendingWake.intent !== "print") {
      if (!attempt && pendingWake?.intent === "print") {
        clearPendingPrintCompanionWakeIfMatches(pendingWake.attemptId);
      }
      return;
    }

    if (attempt.orderId !== orderId) {
      return;
    }

    if (attempt.attemptId !== pendingWake.attemptId) {
      clearPendingPrintCompanionWakeIfMatches(pendingWake.attemptId);
      return;
    }

    if (resumeOwnerRef.current.getActiveAttemptId() === attempt.attemptId) {
      return;
    }

    currentAttemptIdRef.current = attempt.attemptId;
    setPendingPrintAttempt(attempt);
    setCompanionReadiness("wake-required");
    setPrintStatus("Aguardando serviço de impressão…");
    setThermalPrintError("");
    setThermalPrintBusy(true);

    try {
      const result = await resumeFrozenOrderPrint({
        attempt,
        owner: resumeOwnerRef.current,
        isCurrentAttempt: () => currentAttemptIdRef.current === attempt.attemptId,
        resumeCompanion: async () => {
          await printCompanionClient.resumePendingWake({
            requiredCapabilities: ["config", "print"],
            config: loadPrintCompanionConfig(),
            onStageChange: (stage) => {
              if (currentAttemptIdRef.current !== attempt.attemptId) {
                return;
              }
              setPrintStatus(
                stage === "health"
                  ? "Aguardando serviço de impressão…"
                  : stage === "pair"
                    ? "Ativando serviço de impressão…"
                    : "Configurando serviço de impressão…",
              );
            },
          });
        },
        preflight: async (printer) => {
          if (currentAttemptIdRef.current === attempt.attemptId) {
            setPrintStatus("Conectando à impressora…");
          }
          await testPrinterConnection(printer);
        },
        print: async (printer, bytes, jobId) => {
          if (currentAttemptIdRef.current === attempt.attemptId) {
            setPrintStatus("Enviando cupom…");
          }
          await printToPrinter(printer, bytes, jobId);
        },
        onSuccess: () => {
          clearOrderPrintAttemptIfMatches(attempt.attemptId);
          clearPendingPrintCompanionWakeIfMatches(attempt.attemptId);
          setPendingPrintAttempt(null);
          setWakeIntent(printCompanionClient.prepareWakeIntent("print"));
          printStatusOwnerRef.current = 0;
          setCompanionReadiness("ready");
          setPrintStatus("Cupom enviado.");
        },
      });

      if (result === "ignored" || currentAttemptIdRef.current !== attempt.attemptId) {
        return;
      }
    } catch (error) {
      if (currentAttemptIdRef.current !== attempt.attemptId) {
        return;
      }

      setThermalPrintError(getErrorMessage(error));
      setPrintStatus(`Não foi possível imprimir: ${getShortOrderPrintError(error)}`);
      setCompanionReadiness("wake-required");
      setWakeIntent(printCompanionClient.prepareWakeIntent("print", attempt.attemptId));
    } finally {
      if (currentAttemptIdRef.current === attempt.attemptId) {
        setThermalPrintBusy(false);
      }
    }
  }, [orderId, printToPrinter, testPrinterConnection]);

  useEffect(() => {
    const resumeIfPending = () => {
      const pendingWake = loadFreshPendingPrintCompanionWake();
      const pendingAttempt = loadFreshOrderPrintAttempt();
      if (pendingWake?.intent === "print" && pendingAttempt && pendingAttempt.orderId === orderId && pendingWake.attemptId === pendingAttempt.attemptId) {
        void resumePendingPrint();
      }
    };
    const resumeWhenVisible = () => {
      if (document.visibilityState === "visible") {
        resumeIfPending();
      }
    };

    resumeIfPending();
    window.addEventListener("pageshow", resumeIfPending);
    window.addEventListener("focus", resumeIfPending);
    document.addEventListener("visibilitychange", resumeWhenVisible);

    return () => {
      window.removeEventListener("pageshow", resumeIfPending);
      window.removeEventListener("focus", resumeIfPending);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
    };
  }, [orderId, resumePendingPrint]);

  const invalidatePendingPrint = useCallback(() => {
    printCompanionClient.invalidatePendingWakeResume();
    const previousAttempt = loadFreshOrderPrintAttempt();
    if (previousAttempt) {
      clearOrderPrintAttemptIfMatches(previousAttempt.attemptId);
    }
    const previousWake = loadPendingPrintCompanionWake();
    if (previousWake) {
      clearPendingPrintCompanionWakeIfMatches(previousWake.attemptId);
    }
    currentAttemptIdRef.current = null;
    setPendingPrintAttempt(null);
    setWakeIntent(null);
  }, []);

  async function handlePrint() {
    if (!order || thermalPrintBusy) {
      return;
    }

    const statusOwner = printStatusOwnerRef.current + 1;
    printStatusOwnerRef.current = statusOwner;
    invalidatePendingPrint();
    setThermalPrintError("");
    setPrintStatus("Preparando impressão…");
    setThermalPrintBusy(true);

    try {
      const printer = loadingPrinters || printersError ? null : defaultPrinter;
      setLastAttemptPrinter(printer);
      const result = await printReceiptAutomatically({
        orderId: orderId ?? "",
        printer,
        createJobId: createPrintJobId,
        preflight: async (attemptPrinter) => {
          if (printStatusOwnerRef.current === statusOwner) {
            setPrintStatus("Conectando à impressora…");
          }
          await testPrinterConnection(attemptPrinter);
        },
        prepareBytes: async () => {
          if (!printer || !storeProfile) {
            throw new Error("Nenhuma impressora térmica ativa foi selecionada.");
          }
          return prepareReceiptBytes(order, products, printer, storeProfile);
        },
        print: async (attemptPrinter, bytes, jobId) => {
          if (printStatusOwnerRef.current === statusOwner) {
            setPrintStatus("Enviando cupom…");
          }
          await printToPrinter(attemptPrinter, bytes, jobId);
        },
        browserPrint: () => window.print(),
        onRecoverableCompanion: (attempt) => {
          saveOrderPrintAttempt(attempt);
          currentAttemptIdRef.current = attempt.attemptId;
          setPendingPrintAttempt(attempt);
          setWakeIntent(printCompanionClient.prepareWakeIntent("print", attempt.attemptId));
          setCompanionReadiness("wake-required");
          if (printStatusOwnerRef.current === statusOwner) {
            setPrintStatus("Aguardando serviço de impressão…");
          }
        },
      });

      if (result.route === "thermal") {
        setLastAttemptPrinter(null);
        printStatusOwnerRef.current = 0;
        setWakeIntent(printCompanionClient.prepareWakeIntent("print"));
        setPrintStatus("Cupom enviado.");
      } else if (result.route === "wake") {
        setPrintStatus("Aguardando serviço de impressão…");
      } else {
        printStatusOwnerRef.current = 0;
        setWakeIntent(printCompanionClient.prepareWakeIntent("print"));
        setPrintStatus("Impressão do navegador aberta.");
      }
    } catch (error) {
      setThermalPrintError(getErrorMessage(error));
      setPrintStatus(`Não foi possível imprimir: ${getShortOrderPrintError(error)}`);
    } finally {
      setThermalPrintBusy(false);
    }
  }

  function handleWakePrint(event: MouseEvent<HTMLAnchorElement>) {
    if (thermalPrintBusy || !wakeIntent || !order || !orderId) {
      event.preventDefault();
      return;
    }

    const currentPreparedReceipt = preparedReceipt && preparedReceipt.order === order && preparedReceipt.products === products && preparedReceipt.printer.id === defaultPrinter?.id
      ? preparedReceipt
      : null;
    const attempt = pendingPrintAttempt?.attemptId === wakeIntent.attemptId
      ? pendingPrintAttempt
      : currentPreparedReceipt
        ? createOrderPrintAttempt({
          attemptId: wakeIntent.attemptId,
          orderId,
          jobId: createPrintJobId(),
          printer: currentPreparedReceipt.printer,
          bytes: currentPreparedReceipt.bytes,
        })
        : null;

    if (!attempt) {
      event.preventDefault();
      setPrintStatus("Preparando impressão…");
      return;
    }

    saveOrderPrintAttempt(attempt);
    currentAttemptIdRef.current = attempt.attemptId;
    setPendingPrintAttempt(attempt);
    setLastAttemptPrinter(attempt.printer);
    setCompanionReadiness("wake-required");
    setThermalPrintError("");
    setPrintStatus("Ativando serviço de impressão…");
    setThermalPrintBusy(true);
    printCompanionClient.activatePreparedWake(wakeIntent);
  }

  const thermalPrintStatus = thermalPrintError
    ? { message: thermalPrintError, error: true }
    : null;

  const currentPreparedReceipt = preparedReceipt && preparedReceipt.order === order && preparedReceipt.products === products && preparedReceipt.printer.id === defaultPrinter?.id
    ? preparedReceipt
    : null;
  const printActionMode = storeProfile && !storeProfileError && !loadingStoreProfile
    ? getOrderPrintActionMode({
      readiness: companionReadiness,
      busy: thermalPrintBusy,
      canWake: Boolean(wakeIntent && (pendingPrintAttempt || currentPreparedReceipt)),
      canUseDirectFallback: !loadingPrinters && Boolean(printersError || !defaultPrinter),
    })
    : "disabled";

  return (
    <main className="receipt-page">
      {order && (
        <div className="receipt-toolbar" aria-label="Ações do recibo">
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar
          </Button>
          {printActionMode === "wake" && wakeIntent ? (
            <a className="button button-primary" href={wakeIntent.intentUrl} onClick={handleWakePrint}>
              {thermalPrintBusy ? ORDER_RECEIPT_PRINT_BUSY_LABEL : ORDER_RECEIPT_PRINT_LABEL}
            </a>
          ) : (
            <Button
              type="button"
              onClick={() => void handlePrint()}
              disabled={printActionMode === "disabled"}
            >
              {thermalPrintBusy ? ORDER_RECEIPT_PRINT_BUSY_LABEL : ORDER_RECEIPT_PRINT_LABEL}
            </Button>
          )}
          <span
            className="receipt-print-log"
            role="status"
            aria-live="polite"
            title={printStatus}
          >
            {printStatus}
          </span>
          {thermalPrintError && lastAttemptPrinter && (
            <a className="text-link compact-link" href={getDiagnosticRoute(lastAttemptPrinter.id)}>
              Diagnóstico
            </a>
          )}
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
      {!loading && storeProfileError && <p className="receipt-state receipt-state-error">{storeProfileError}</p>}
      {!loading && !ordersError && !productsError && !storeProfileError && !order && (
        <section className="receipt-state">
          <h1>Pedido não encontrado</h1>
          <p>Não foi possível localizar este pedido.</p>
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar para pedidos
          </Button>
        </section>
      )}

      {order && storeProfile && !storeProfileError && <OrderReceipt order={order} products={products} storeDisplayName={storeProfile.displayName} />}
    </main>
  );
}
