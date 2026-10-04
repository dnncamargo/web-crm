import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { createLoopbackPrinterTransport } from "../printers/loopbackPrinterTransport";
import { usePrinters } from "../printers/usePrinters";
import { resolveDefaultPrinter } from "../printers/printerUtils";
import {
  createWakeResumeController,
  WAKE_TIMEOUT_MS,
  type WakeResumeController,
} from "./androidPrintWakeResume";

const APP_LINK_URL = "https://deliciasdoporto.vercel.app/android-print-bridge/activate";
const PENDING_TEST_KEY = "web-crm.android-print-wake.pending";

type BridgeStatus = "checking" | "online" | "offline";
type FlowStatus = "idle" | "waking" | "testing" | "pass" | "fail";

const bridgeTransport = createLoopbackPrinterTransport();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "A ponte local recusou o teste.";
}

function hasPendingTest() {
  const value = window.localStorage.getItem(PENDING_TEST_KEY);
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as { createdAt?: unknown };
    return typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt <= WAKE_TIMEOUT_MS;
  } catch {
    return false;
  }
}

function markPendingTest() {
  window.localStorage.setItem(PENDING_TEST_KEY, JSON.stringify({ createdAt: Date.now() }));
}

function clearPendingTest() {
  window.localStorage.removeItem(PENDING_TEST_KEY);
}

export function AndroidPrintWakePage() {
  const {
    printers,
    defaultPrinterId,
    loading: loadingPrinters,
    printersError,
  } = usePrinters();
  const defaultPrinter = useMemo(
    () => resolveDefaultPrinter(printers, defaultPrinterId),
    [defaultPrinterId, printers],
  );
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("checking");
  const [flowStatus, setFlowStatus] = useState<FlowStatus>(() =>
    hasPendingTest() ? "waking" : "idle",
  );
  const [message, setMessage] = useState(() =>
    hasPendingTest()
      ? "Aguardando o companion iniciar a ponte…"
      : "Consultando a ponte local…",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const runTestRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const wakeResumeControllerRef = useRef<WakeResumeController | null>(null);
  const loadingPrintersRef = useRef(loadingPrinters);

  const checkHealth = useCallback(async () => {
    try {
      await bridgeTransport.checkHealth();
      setBridgeStatus("online");
      return true;
    } catch {
      setBridgeStatus("offline");
      return false;
    }
  }, []);

  const runTest = useCallback(async () => {
    if (!defaultPrinter) {
      clearPendingTest();
      setFlowStatus("fail");
      setErrorMessage("Nenhuma impressora ativa está definida como padrão.");
      setMessage("Não foi possível executar /v1/test.");
      return;
    }

    setFlowStatus("testing");
    setMessage(`Testando ${defaultPrinter.name} em /v1/test…`);
    setErrorMessage("");

    try {
      await bridgeTransport.testConnection({
        host: defaultPrinter.host,
        port: defaultPrinter.port,
      });
      clearPendingTest();
      setFlowStatus("pass");
      setMessage("/v1/test respondeu OK; nenhum byte foi enviado à impressora.");
    } catch (error) {
      clearPendingTest();
      setFlowStatus("fail");
      setErrorMessage(getErrorMessage(error));
      setMessage("A ponte respondeu, mas /v1/test falhou.");
    }
  }, [defaultPrinter]);

  useEffect(() => {
    runTestRef.current = runTest;
  }, [runTest]);

  useEffect(() => {
    loadingPrintersRef.current = loadingPrinters;
  }, [loadingPrinters]);

  useEffect(() => {
    const controller = createWakeResumeController({
      hasPendingWake: hasPendingTest,
      clearPendingWake: clearPendingTest,
      checkHealth,
      canRunPendingTest: () => !loadingPrintersRef.current,
      runPendingTest: () => runTestRef.current(),
      onInitialHealth: (online) => {
        setFlowStatus("idle");
        setMessage(
          online
            ? "A ponte está pronta para o próximo passo."
            : "A ponte está offline; ative o companion para continuar.",
        );
      },
      onWakeTimeout: () => {
        setFlowStatus("fail");
        setMessage("A ponte não ficou online dentro do tempo limite.");
        setErrorMessage("Ativação expirada após 15 segundos.");
      },
    });
    wakeResumeControllerRef.current = controller;

    controller.start();
    return () => {
      controller.dispose();
      wakeResumeControllerRef.current = null;
    };
  }, [checkHealth]);

  useEffect(() => {
    if (!loadingPrinters) {
      wakeResumeControllerRef.current?.resumePendingWake();
    }
  }, [loadingPrinters]);

  const resumePendingWake = useCallback(() => {
    if (document.visibilityState !== "visible" || !hasPendingTest()) {
      return;
    }

    setBridgeStatus("checking");
    setFlowStatus("waking");
    setMessage("Retomando o teste após a ativação do companion…");
    wakeResumeControllerRef.current?.resumePendingWake();
  }, []);

  useEffect(() => {
    function resumeFromVisibility() {
      if (document.visibilityState === "visible") {
        resumePendingWake();
      }
    }

    window.addEventListener("pageshow", resumePendingWake);
    window.addEventListener("focus", resumePendingWake);
    document.addEventListener("visibilitychange", resumeFromVisibility);
    return () => {
      window.removeEventListener("pageshow", resumePendingWake);
      window.removeEventListener("focus", resumePendingWake);
      document.removeEventListener("visibilitychange", resumeFromVisibility);
    };
  }, [resumePendingWake]);

  function activateCompanion() {
    markPendingTest();
    setErrorMessage("");
    setBridgeStatus("checking");
    setFlowStatus("waking");
    setMessage("Abrindo o App Link HTTPS do companion…");
    wakeResumeControllerRef.current?.beginPendingWake();
    window.location.assign(APP_LINK_URL);
  }

  function testDirectly() {
    void runTest();
  }

  const statusLabel = flowStatus === "pass"
    ? "PASS"
    : flowStatus === "fail"
      ? "FAIL"
      : bridgeStatus === "online"
        ? "ONLINE"
        : bridgeStatus === "checking"
          ? "VERIFICANDO"
          : "OFFLINE";

  const canActivate = bridgeStatus === "offline" && flowStatus !== "waking" && flowStatus !== "testing";
  const canTestDirectly = bridgeStatus === "online" && flowStatus !== "testing" && !loadingPrinters;

  return (
    <div className="page-stack">
      <PageHeader
        title="Diagnóstico Android"
        description="Spike isolado para acordar a ponte local a partir de uma página HTTPS."
      />

      <Card className="android-wake-card">
        <div className="android-wake-status" data-state={flowStatus === "pass" || bridgeStatus === "online" ? "success" : flowStatus === "fail" ? "error" : "pending"} role="status" aria-live="polite">
          <Badge>{statusLabel}</Badge>
          <strong>{message}</strong>
          {errorMessage && <span className="error-text">{errorMessage}</span>}
        </div>

        <div className="android-wake-details">
          <span>Ponte: http://127.0.0.1:17890</span>
          <span>Impressora: {defaultPrinter?.name ?? "nenhuma padrão ativa"}</span>
        </div>

        <div className="android-wake-actions">
          {canActivate && (
            <Button type="button" onClick={activateCompanion}>
              Ativar companion e testar
            </Button>
          )}
          {canTestDirectly && (
            <Button type="button" variant="secondary" onClick={testDirectly}>
              Executar /v1/test diretamente
            </Button>
          )}
          {(flowStatus === "waking" || flowStatus === "testing" || bridgeStatus === "checking") && (
            <span className="muted-text">Aguarde o resultado do teste.</span>
          )}
        </div>

        <p className="muted-text">
          O spike não chama <code>window.print()</code> e /v1/test apenas abre e fecha a conexão TCP; a impressão física permanece fora deste fluxo.
        </p>
      </Card>

      {printersError && <p className="error-text">{printersError}</p>}
      {!loadingPrinters && !defaultPrinter && (
        <p className="muted-text">Defina uma impressora TCP ativa como padrão para habilitar /v1/test.</p>
      )}
    </div>
  );
}
