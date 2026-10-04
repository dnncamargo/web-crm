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
import {
  ANDROID_PRINT_DIAGNOSTIC_VERSION,
  EXPECTED_COMPANION_APP_VERSION,
  EXPECTED_COMPANION_VERSION_CODE,
  getProductionDiagnosticUrl,
  isAndroidPrintDiagnosticProduction,
} from "./androidPrintDiagnostic";
import type { WakePollProgress } from "./androidPrintWakeResume";
import { usePrinters } from "../printers/usePrinters";
import { resolveDefaultPrinter } from "../printers/printerUtils";

type BridgeStatus = "unknown" | "checking" | "online" | "offline";
type FlowStatus = "idle" | "preparing" | "configuring" | "testing" | "pass" | "fail";
type DiagnosticStage = "idle" | "wake" | "health" | "pair" | "config" | "test";

const companionClient = createPrintCompanionClient();

function getErrorDetails(error: unknown) {
  if (!(error instanceof PrintCompanionError)) {
    return {
      message: "Não foi possível preparar o aplicativo de impressão.",
      publicCode: "unknown_error",
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "pairing_expired" && error.companionCode === "wake_timeout") {
    return {
      message: "O companion não respondeu em 15 segundos.",
      publicCode: error.code,
      showDownload: true,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "companion_incompatible") {
    return {
      message: "A API do companion é incompatível com este diagnóstico.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  if (error.code === "pairing_required" || error.code === "invalid_token") {
    return {
      message: "Pareie o companion para continuar.",
      publicCode: error.code,
      showDownload: false,
      showPair: true,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "pairing_expired") {
    return {
      message: "O pareamento do companion expirou.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "protocol_error") {
    return {
      message: "O companion retornou uma resposta inválida.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "missing_capability") {
    return {
      message: "O aplicativo instalado não oferece a capacidade necessária.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  return {
    message: error.code === "companion_offline"
      ? "O companion está offline."
      : error.message,
    publicCode: error.code,
    showDownload: false,
    showPair: false,
    downloadLabel: "Baixar aplicativo para Android",
  };
}

function getFlowLabel(flowStatus: FlowStatus, bridgeStatus: BridgeStatus, currentStage: DiagnosticStage) {
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

  if (flowStatus === "preparing" && currentStage !== "health") {
    return "PREPARANDO";
  }

  if (bridgeStatus === "online") {
    return "ONLINE";
  }

  if (bridgeStatus === "checking") {
    return "VERIFICANDO";
  }

  if (bridgeStatus === "offline") {
    return "OFFLINE";
  }

  return "AGUARDANDO AÇÃO";
}

function formatElapsed(elapsedMs: number) {
  return `${(elapsedMs / 1000).toFixed(1).replace(".", ",")} s`;
}

function getStageLabel(stage: DiagnosticStage) {
  switch (stage) {
    case "wake":
      return "wake";
    case "health":
      return "health";
    case "pair":
      return "pair";
    case "config":
      return "config";
    case "test":
      return "test";
    default:
      return "aguardando";
  }
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
  const isProduction = isAndroidPrintDiagnosticProduction(window.location.origin);
  const [wakeIntent, setWakeIntent] = useState(() => companionClient.prepareWakeIntent("test"));
  const hasPendingWake = isProduction && Boolean(loadPendingPrintCompanionWake());
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("unknown");
  const [flowStatus, setFlowStatus] = useState<FlowStatus>(() =>
    hasPendingWake ? "preparing" : "idle",
  );
  const [message, setMessage] = useState(() =>
    hasPendingWake
      ? "Retomando a ativação do aplicativo de impressão…"
      : !isProduction
        ? "Este diagnóstico físico só pode ser executado em produção."
      : isInstallLanding
        ? "Instale o aplicativo e toque em abrir aplicativo para iniciar o pareamento."
        : "Clique em ativar para iniciar o diagnóstico.",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showDownload, setShowDownload] = useState(isInstallLanding && isProduction);
  const [showPair, setShowPair] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("Baixar aplicativo para Android");
  const [health, setHealth] = useState<PrintCompanionHealth | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentStage, setCurrentStage] = useState<DiagnosticStage>(hasPendingWake ? "health" : "idle");
  const [lastPublicErrorCode, setLastPublicErrorCode] = useState<string | null>(null);
  const runningRef = useRef(false);

  const handlePollAttempt = useCallback(({ attempt, elapsedMs: nextElapsedMs }: WakePollProgress) => {
    setCurrentStage("health");
    setPollAttemptCount(attempt);
    setElapsedMs(nextElapsedMs);
  }, []);

  const handleStageChange = useCallback((stage: "health" | "pair" | "config") => {
    setCurrentStage(stage);
    if (stage === "pair") {
      setFlowStatus("preparing");
      setMessage("Companion respondeu. Pareando…");
    } else if (stage === "config") {
      setFlowStatus("configuring");
      setMessage("Companion respondeu. Aplicando configuração…");
    } else {
      setMessage("Aguardando o companion responder…");
    }
  }, []);

  const resumeAcceptance = useCallback(async () => {
    if (!isProduction || loadingPrinters || runningRef.current || !loadPendingPrintCompanionWake()) {
      return;
    }

    runningRef.current = true;
    setAttemptStartedAt(Date.now());
    setPollAttemptCount(0);
    setElapsedMs(0);
    setCurrentStage("health");
    setLastPublicErrorCode(null);
    setBridgeStatus("checking");
    setFlowStatus("preparing");
    setMessage("Aguardando o companion responder…");
    setErrorMessage("");
    setShowDownload(false);
    setShowPair(false);

    try {
      const config = loadPrintCompanionConfig();
      const readyHealth = await companionClient.resumePendingWake({
        requiredCapabilities: ["test"],
        config,
        onPollAttempt: handlePollAttempt,
        onStageChange: handleStageChange,
      });
      setHealth(readyHealth);
      setAuthenticated(true);
      setBridgeStatus("online");
      setMessage(`Companion respondeu; configuração de ${config.idleTimeoutMinutes} min aplicada.`);

      if (!defaultPrinter) {
        setCurrentStage("test");
        setFlowStatus("fail");
        setErrorMessage("Defina uma impressora TCP ativa como padrão para executar o teste.");
        setMessage("O companion foi pareado, mas o teste não foi concluído.");
        return;
      }

      setCurrentStage("test");
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
      setLastPublicErrorCode(details.publicCode);
      setShowDownload(details.showDownload);
      setShowPair(details.showPair);
      setDownloadLabel(details.downloadLabel);
      setMessage("O diagnóstico não foi concluído.");
    } finally {
      runningRef.current = false;
    }
  }, [defaultPrinter, handlePollAttempt, handleStageChange, isProduction, loadingPrinters]);

  const handleWakeClick = useCallback(() => {
    if (!isProduction) {
      return;
    }

    companionClient.activatePreparedWake(wakeIntent);
    window.setTimeout(() => {
      setWakeIntent(companionClient.prepareWakeIntent("test"));
      void resumeAcceptance();
    }, 0);
    setAttemptStartedAt(Date.now());
    setPollAttemptCount(0);
    setElapsedMs(0);
    setCurrentStage("wake");
    setLastPublicErrorCode(null);
    setBridgeStatus("checking");
    setFlowStatus("preparing");
    setMessage("Solicitação de abertura enviada ao Android.");
    setErrorMessage("");
    setShowDownload(false);
    setShowPair(false);
  }, [isProduction, resumeAcceptance, wakeIntent]);

  useEffect(() => {
    if (!isProduction || loadingPrinters) {
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
  }, [defaultPrinter, isProduction, loadingPrinters, resumeAcceptance]);

  function retry() {
    handleWakeClick();
  }

  const statusLabel = !isProduction
    ? "AMBIENTE NÃO SUPORTADO"
    : getFlowLabel(flowStatus, bridgeStatus, currentStage);
  const statusState = !isProduction || flowStatus === "fail"
    ? "error"
    : flowStatus === "pass" || bridgeStatus === "online"
      ? "success"
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

        <div className="android-wake-details">
          <span>Ambiente: {isProduction ? "PRODUÇÃO" : "NÃO SUPORTADO"}</span>
          <span>Diagnóstico: v{ANDROID_PRINT_DIAGNOSTIC_VERSION}</span>
          <span>Companion esperado: v{EXPECTED_COMPANION_APP_VERSION} (code {EXPECTED_COMPANION_VERSION_CODE})</span>
          <span>Companion detectado: {health ? `v${health.appVersion} (code ${health.appVersionCode})` : "não verificado"}</span>
          <span>API esperada: v1</span>
          <span>API detectada: {health?.apiVersion ?? "—"}</span>
          <span>Pairing: {authenticated ? "authenticated" : health?.paired ? "paired" : "não confirmado"}</span>
          <span>Capabilities: {health?.capabilities.join(", ") ?? "—"}</span>
          <span>Impressora: {defaultPrinter?.name ?? "nenhuma padrão ativa"}</span>
          <span>Etapa: {getStageLabel(currentStage)}</span>
          <span>Tentativa iniciada: {attemptStartedAt ? new Date(attemptStartedAt).toLocaleTimeString("pt-BR") : "—"}</span>
          {isProduction && bridgeStatus === "checking" && currentStage === "health" && pollAttemptCount > 0 && (
            <span>Tentativa {pollAttemptCount} · {formatElapsed(elapsedMs)}</span>
          )}
          {lastPublicErrorCode && <span>Código: {lastPublicErrorCode}</span>}
        </div>

        <div className="android-wake-actions">
          {!isProduction && (
            <>
              <span className="muted-text">Este diagnóstico físico só pode ser executado em produção.</span>
              <a className="button button-secondary" href={getProductionDiagnosticUrl()}>
                Abrir diagnóstico em produção
              </a>
            </>
          )}
          {isProduction && showDownload && (
            <a className="button button-primary" href={PRINT_COMPANION_DOWNLOAD_URL}>
              {downloadLabel}
            </a>
          )}
          {isProduction && showPair && (flowStatus === "idle" || flowStatus === "fail") && (
            <a className="button button-primary" href={wakeIntent.intentUrl} onClick={handleWakeClick}>
              PAREAR COMPANION
            </a>
          )}
          {isProduction && !showPair && flowStatus === "idle" && (
            <a className="button button-secondary" href={wakeIntent.intentUrl} onClick={handleWakeClick}>
              {isInstallLanding ? "Tentar abrir aplicativo" : "ATIVAR COMPANION E TESTAR"}
            </a>
          )}
          {isProduction && flowStatus === "fail" && !showPair && (
            <a className="button button-secondary" href={wakeIntent.intentUrl} onClick={retry}>
              {isInstallLanding ? "Tentar abrir aplicativo" : "Tentar novamente"}
            </a>
          )}
          {isProduction && (flowStatus === "preparing" || flowStatus === "configuring" || flowStatus === "testing" || bridgeStatus === "checking") && (
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
