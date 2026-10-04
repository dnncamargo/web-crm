import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { createPrintCompanionClient } from "../printers/printCompanionClient";
import {
  loadPendingPrintCompanionWake,
  loadPrintCompanionConfig,
} from "../printers/printCompanionStorage";
import {
  PRINT_COMPANION_DOWNLOAD_URL,
  PrintCompanionError,
  type PrintCompanionHealth,
} from "../printers/printCompanionTypes";
import { usePrinters } from "../printers/usePrinters";
import { resolveDefaultPrinter } from "../printers/printerUtils";

type BridgeStatus = "checking" | "online" | "offline";
type FlowStatus = "idle" | "preparing" | "configuring" | "testing" | "pass" | "fail";

const companionClient = createPrintCompanionClient();

function getErrorDetails(error: unknown) {
  if (!(error instanceof PrintCompanionError)) {
    return {
      message: "Não foi possível preparar o aplicativo de impressão.",
      showDownload: true,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "companion_incompatible") {
    return {
      message: "O aplicativo de impressão precisa ser atualizado.",
      showDownload: true,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  if (error.code === "pairing_required" || error.code === "invalid_token") {
    return {
      message: "Pareie o companion para continuar.",
      showDownload: false,
      showPair: true,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "companion_offline" || error.code === "pairing_expired") {
    return {
      message: "Companion não disponível neste dispositivo.",
      showDownload: true,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "missing_capability") {
    return {
      message: "O aplicativo instalado não oferece a capacidade necessária.",
      showDownload: true,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  if (error.code === "printer_connection_failed" || error.code === "printer_timeout") {
    return {
      message: "Não foi possível estabelecer conexão com a impressora.",
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  return {
    message: "Não foi possível concluir o diagnóstico do companion.",
    showDownload: false,
    showPair: false,
    downloadLabel: "Baixar aplicativo para Android",
  };
}

function getFlowLabel(flowStatus: FlowStatus, bridgeStatus: BridgeStatus) {
  if (flowStatus === "pass") {
    return "PASS";
  }

  if (flowStatus === "fail") {
    return "FAIL";
  }

  if (flowStatus === "configuring") {
    return "CONFIGURANDO";
  }

  if (flowStatus === "testing") {
    return "TESTANDO";
  }

  if (flowStatus === "preparing") {
    return "PREPARANDO";
  }

  return bridgeStatus === "online" ? "ONLINE" : "VERIFICANDO";
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
  const isInstallLanding = window.location.pathname === "/android-print-bridge/activate";
  const [wakeIntent] = useState(() => companionClient.prepareWakeIntent("test"));
  const hasPendingWake = Boolean(loadPendingPrintCompanionWake());
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("checking");
  const [flowStatus, setFlowStatus] = useState<FlowStatus>(() =>
    hasPendingWake ? "preparing" : "idle",
  );
  const [message, setMessage] = useState(() =>
    hasPendingWake
      ? "Retomando a ativação do aplicativo de impressão…"
      : isInstallLanding
        ? "Instale o aplicativo e toque em abrir aplicativo para iniciar o pareamento."
        : "Clique em ativar para abrir o aplicativo de impressão.",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showDownload, setShowDownload] = useState(isInstallLanding && !hasPendingWake);
  const [showPair, setShowPair] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("Baixar aplicativo para Android");
  const [health, setHealth] = useState<PrintCompanionHealth | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const runningRef = useRef(false);

  const resumeAcceptance = useCallback(async () => {
    if (loadingPrinters || runningRef.current || !loadPendingPrintCompanionWake()) {
      return;
    }

    runningRef.current = true;
    setBridgeStatus("checking");
    setFlowStatus("preparing");
    setMessage("Verificando o companion e preparando o pareamento…");
    setErrorMessage("");
    setShowDownload(false);
    setShowPair(false);

    try {
      const config = loadPrintCompanionConfig();
      const readyHealth = await companionClient.resumePendingWake({
        requiredCapabilities: ["test"],
        config,
      });
      setHealth(readyHealth);
      setAuthenticated(true);
      setBridgeStatus("online");
      setFlowStatus("configuring");
      setMessage(`Companion autenticado; configuração de ${config.idleTimeoutMinutes} min aplicada.`);

      if (!defaultPrinter) {
        setFlowStatus("fail");
        setErrorMessage("Defina uma impressora TCP ativa como padrão para executar o teste.");
        setMessage("O companion foi pareado, mas o teste não foi concluído.");
        return;
      }

      setFlowStatus("testing");
      setMessage(`Testando a conexão com “${defaultPrinter.name}”…`);
      await companionClient.testPrinter(defaultPrinter);
      setFlowStatus("pass");
      setMessage(`Conexão com “${defaultPrinter.name}” estabelecida. Nenhuma impressão física foi realizada.`);
    } catch (error) {
      const details = getErrorDetails(error);
      setBridgeStatus("offline");
      setFlowStatus("fail");
      setAuthenticated(false);
      setErrorMessage(details.message);
      setShowDownload(details.showDownload);
      setShowPair(details.showPair);
      setDownloadLabel(details.downloadLabel);
      setMessage("O diagnóstico não foi concluído.");
    } finally {
      runningRef.current = false;
    }
  }, [defaultPrinter, loadingPrinters]);

  const handleWakeClick = useCallback(() => {
    companionClient.activatePreparedWake(wakeIntent);
    window.setTimeout(() => {
      void resumeAcceptance();
    }, 0);
    setBridgeStatus("checking");
    setFlowStatus("preparing");
    setMessage("Abrindo o aplicativo de impressão…");
    setErrorMessage("");
    setShowDownload(false);
    setShowPair(false);
  }, [resumeAcceptance, wakeIntent]);

  useEffect(() => {
    if (loadingPrinters) {
      return undefined;
    }

    const resumeIfPending = () => {
      if (loadPendingPrintCompanionWake()) {
        void resumeAcceptance();
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
  }, [defaultPrinter, loadingPrinters, resumeAcceptance]);

  function retry() {
    handleWakeClick();
  }

  const statusLabel = getFlowLabel(flowStatus, bridgeStatus);
  const statusState = flowStatus === "pass" || bridgeStatus === "online"
    ? "success"
    : flowStatus === "fail"
      ? "error"
      : "pending";

  return (
    <div className="page-stack">
      <PageHeader
        title={isInstallLanding ? "Aplicativo de impressão necessário" : "Diagnóstico Android"}
        description={isInstallLanding
          ? "Instale o WebCRM Print Companion para enviar pedidos diretamente à impressora térmica."
          : "Harness de aceitação do companion Android v1."}
      />

      <Card className="android-wake-card">
        <div className="android-wake-status" data-state={statusState} role="status" aria-live="polite">
          <Badge>{statusLabel}</Badge>
          <strong>{message}</strong>
          {errorMessage && <span className="error-text">{errorMessage}</span>}
        </div>

        {!isInstallLanding && (
          <div className="android-wake-details">
            <span>Companion: {health ? "ONLINE" : "verificando"}</span>
            <span>Pairing: {authenticated ? "authenticated" : health?.paired ? "paired" : "não confirmado"}</span>
            <span>API: {health?.apiVersion ?? "—"}</span>
            <span>App: {health?.appVersion ?? "—"}</span>
            <span>Capabilities: {health?.capabilities.join(", ") ?? "—"}</span>
            <span>Impressora: {defaultPrinter?.name ?? "nenhuma padrão ativa"}</span>
          </div>
        )}

        <div className="android-wake-actions">
          {showDownload && (
            <a className="button button-primary" href={PRINT_COMPANION_DOWNLOAD_URL}>
              {downloadLabel}
            </a>
          )}
          {showPair && (flowStatus === "idle" || flowStatus === "fail") && (
            <a className="button button-primary" href={wakeIntent.intentUrl} onClick={handleWakeClick}>
              PAREAR COMPANION
            </a>
          )}
          {!showPair && flowStatus === "idle" && (
            <a className="button button-secondary" href={wakeIntent.intentUrl} onClick={handleWakeClick}>
              {isInstallLanding ? "Tentar abrir aplicativo" : "ATIVAR COMPANION E TESTAR"}
            </a>
          )}
          {flowStatus === "fail" && !showPair && (
            <a className="button button-secondary" href={wakeIntent.intentUrl} onClick={retry}>
              {isInstallLanding ? "Tentar abrir aplicativo" : "Tentar novamente"}
            </a>
          )}
          {(flowStatus === "preparing" || flowStatus === "configuring" || flowStatus === "testing" || bridgeStatus === "checking") && (
            <span className="muted-text">Aguarde o resultado do diagnóstico.</span>
          )}
        </div>

        {isInstallLanding && showDownload && (
          <p className="muted-text">
            Após instalar, volte ao sistema e toque em “Tentar abrir aplicativo”.
          </p>
        )}
        {!isInstallLanding && (
          <p className="muted-text">
            O teste abre e fecha a conexão TCP sem enviar bytes ESC/POS; a impressão física permanece fora deste fluxo.
          </p>
        )}
      </Card>

      {printersError && <p className="error-text">Não foi possível carregar a configuração das impressoras.</p>}
      {!loadingPrinters && !defaultPrinter && (
        <p className="muted-text">Defina uma impressora TCP ativa como padrão para habilitar o diagnóstico.</p>
      )}
    </div>
  );
}
