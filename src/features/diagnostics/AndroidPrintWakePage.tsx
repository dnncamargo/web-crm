import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { createPrintCompanionClient } from "../printers/printCompanionClient";
import {
  loadPendingPrintCompanionWake,
  loadPrintCompanionConfig,
} from "../printers/printCompanionStorage";
import {
  PRINT_COMPANION_DOWNLOAD_URL,
  type PrintCompanionHealth,
} from "../printers/printCompanionTypes";
import {
  ANDROID_PRINT_DIAGNOSTIC_VERSION,
  EXPECTED_COMPANION_APP_VERSION,
  EXPECTED_COMPANION_VERSION_CODE,
  getProductionDiagnosticUrl,
  isAndroidPrintDiagnosticProduction,
} from "./androidPrintDiagnostic";
import {
  POLL_INTERVAL_MS,
  WAKE_HEALTH_REQUEST_TIMEOUT_MS,
  WAKE_TIMEOUT_MS,
  type WakePollProgress,
  type WakePollResult,
} from "./androidPrintWakeResume";
import { getAndroidPrintWakeErrorDetails } from "./androidPrintWakeErrors";
import {
  appendAndroidDiagnosticLog,
  createInitialAndroidDiagnosticLog,
  formatAndroidDiagnosticLog,
  formatAndroidDiagnosticLogEntry,
  type AndroidDiagnosticLogEntry,
  type AndroidDiagnosticLogStage,
} from "./androidPrintWakeLog";
import { usePrinters } from "../printers/usePrinters";
import { resolveDefaultPrinter } from "../printers/printerUtils";

type BridgeStatus = "unknown" | "checking" | "online" | "offline";
type FlowStatus = "idle" | "preparing" | "configuring" | "testing" | "pass" | "fail";
type DiagnosticStage = "idle" | "wake" | "health" | "pair" | "config" | "test";

const companionClient = createPrintCompanionClient();

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

function monotonicNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
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
  const [attemptActive, setAttemptActive] = useState(false);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentStage, setCurrentStage] = useState<DiagnosticStage>(hasPendingWake ? "health" : "idle");
  const [lastPublicErrorCode, setLastPublicErrorCode] = useState<string | null>(null);
  const [diagnosticLog, setDiagnosticLog] = useState<AndroidDiagnosticLogEntry[]>(() =>
    createInitialAndroidDiagnosticLog(isProduction),
  );
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const attemptStartedAtRef = useRef<number | null>(null);
  const attemptStartedPerformanceAtRef = useRef<number | null>(null);
  const attemptNumberRef = useRef(0);
  const pollAttemptCountRef = useRef(0);
  const runningRef = useRef(false);

  const appendDiagnosticLog = useCallback((
    stage: AndroidDiagnosticLogStage,
    event: string,
    details?: string,
  ) => {
    const startedAt = attemptStartedPerformanceAtRef.current;
    setDiagnosticLog((current) => appendAndroidDiagnosticLog(current, {
      at: Date.now(),
      elapsedMs: startedAt === null ? undefined : Math.max(0, monotonicNow() - startedAt),
      stage,
      event,
      details,
    }));
  }, []);

  const resetAttemptMetrics = useCallback((startedAt: number, stage: DiagnosticStage) => {
    const elapsedBeforeResume = Math.max(0, Date.now() - startedAt);
    const nextAttemptNumber = attemptNumberRef.current + 1;
    attemptStartedAtRef.current = startedAt;
    attemptStartedPerformanceAtRef.current = monotonicNow() - elapsedBeforeResume;
    attemptNumberRef.current = nextAttemptNumber;
    setAttemptStartedAt(startedAt);
    setAttemptNumber(nextAttemptNumber);
    setAttemptActive(true);
    pollAttemptCountRef.current = 0;
    setPollAttemptCount(0);
    setElapsedMs(elapsedBeforeResume);
    setCurrentStage(stage);
    setLastPublicErrorCode(null);
    if (nextAttemptNumber > 1) {
      setDiagnosticLog((current) => appendAndroidDiagnosticLog(current, {
        at: Date.now(),
        elapsedMs: 0,
        stage: "idle",
        event: `--- Nova tentativa #${nextAttemptNumber} ---`,
      }));
    }
  }, []);

  const updateElapsed = useCallback(() => {
    const startedAt = attemptStartedPerformanceAtRef.current;
    if (startedAt !== null) {
      setElapsedMs(Math.max(0, monotonicNow() - startedAt));
    }
  }, []);

  const finishAttempt = useCallback(() => {
    updateElapsed();
    setAttemptActive(false);
  }, [updateElapsed]);

  useEffect(() => {
    if (!attemptActive) {
      return undefined;
    }

    updateElapsed();
    const heartbeat = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(heartbeat);
  }, [attemptActive, updateElapsed]);

  const handlePollAttempt = useCallback(({ attempt, elapsedMs: nextElapsedMs }: WakePollProgress) => {
    setCurrentStage("health");
    pollAttemptCountRef.current = attempt;
    setPollAttemptCount(attempt);
    setElapsedMs(nextElapsedMs);
    appendDiagnosticLog("health", `probe #${attempt} iniciado`);
  }, [appendDiagnosticLog]);

  const handlePollResult = useCallback(({ attempt, status, errorCode, httpStatus, timedOut }: WakePollResult) => {
    if (timedOut) {
      appendDiagnosticLog("health", `probe #${attempt} timeout local`);
    } else if (httpStatus !== undefined) {
      appendDiagnosticLog("health", `probe #${attempt} HTTP ${httpStatus}`, errorCode);
    } else if (status === "online" && errorCode === undefined) {
      appendDiagnosticLog("health", `probe #${attempt} respondeu`);
    } else if (errorCode !== undefined) {
      appendDiagnosticLog("health", `probe #${attempt} falhou`, errorCode);
    } else {
      appendDiagnosticLog("health", `probe #${attempt} sem resposta`, errorCode);
    }
  }, [appendDiagnosticLog]);

  const handleHealthReady = useCallback((nextHealth: PrintCompanionHealth) => {
    setHealth(nextHealth);
    setBridgeStatus("online");
    setCurrentStage("pair");
    setMessage("Companion respondeu. Verificando pareamento…");
    appendDiagnosticLog(
      "health",
      "companion detectado",
      `app=${nextHealth.appVersion} code=${nextHealth.appVersionCode} api=${nextHealth.apiVersion} paired=${nextHealth.paired}`,
    );
    appendDiagnosticLog("health", "capabilities", nextHealth.capabilities.join(", "));
  }, [appendDiagnosticLog]);

  const handleStageResult = useCallback((
    stage: "pair" | "config",
    result: "success" | "failure",
    publicCode?: string,
  ) => {
    appendDiagnosticLog(stage, result === "success" ? "sucesso" : "falha", publicCode);
  }, [appendDiagnosticLog]);

  const getCurrentElapsedMs = useCallback(() => {
    const startedAt = attemptStartedPerformanceAtRef.current;
    return startedAt === null ? 0 : Math.max(0, monotonicNow() - startedAt);
  }, []);

  const handleStageChange = useCallback((stage: "health" | "pair" | "config") => {
    setCurrentStage(stage);
    if (stage === "pair") {
      setFlowStatus("preparing");
      setMessage("Companion respondeu. Pareando…");
      appendDiagnosticLog("pair", "início");
    } else if (stage === "config") {
      setFlowStatus("configuring");
      setMessage("Companion respondeu. Aplicando configuração…");
      appendDiagnosticLog("config", "início");
    } else {
      setMessage("Aguardando o companion responder…");
    }
  }, [appendDiagnosticLog]);

  const resumeAcceptance = useCallback(async () => {
    const pendingWake = loadPendingPrintCompanionWake();
    if (!isProduction || loadingPrinters || runningRef.current || !pendingWake) {
      return;
    }

    if (attemptStartedAtRef.current === null) {
      resetAttemptMetrics(pendingWake.createdAt, "health");
      appendDiagnosticLog("wake", "tentativa retomada");
    }

    runningRef.current = true;
    setCurrentStage("health");
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
        onPollResult: handlePollResult,
        onStageChange: handleStageChange,
        onStageResult: handleStageResult,
        onHealthReady: handleHealthReady,
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
      appendDiagnosticLog("test", "início");
      try {
        await companionClient.testPrinter(defaultPrinter);
        appendDiagnosticLog("test", "sucesso");
      } catch (error) {
        const publicCode = getAndroidPrintWakeErrorDetails(error).publicCode;
        appendDiagnosticLog("test", "falha", publicCode);
        throw error;
      }
      setFlowStatus("pass");
      setMessage(`Conexão com “${defaultPrinter.name}” estabelecida. Nenhuma impressão física foi realizada.`);
    } catch (error) {
      const details = getAndroidPrintWakeErrorDetails(error);
      setBridgeStatus("offline");
      setFlowStatus("fail");
      setAuthenticated(false);
      setErrorMessage(details.message);
      setLastPublicErrorCode(details.publicCode);
      setShowDownload(details.showDownload);
      setShowPair(details.showPair);
      setDownloadLabel(details.downloadLabel);
      setMessage("O diagnóstico não foi concluído.");
      if (details.publicCode === "wake_timeout") {
        appendDiagnosticLog(
          "health",
          "wake_timeout",
          `probes=${pollAttemptCountRef.current} elapsed=${Math.round(getCurrentElapsedMs())} ms`,
        );
      }
    } finally {
      finishAttempt();
      runningRef.current = false;
    }
  }, [appendDiagnosticLog, defaultPrinter, finishAttempt, getCurrentElapsedMs, handleHealthReady, handlePollAttempt, handlePollResult, handleStageChange, handleStageResult, isProduction, loadingPrinters, resetAttemptMetrics]);

  const handleWakeClick = useCallback(() => {
    if (!isProduction) {
      return;
    }

    const clickTimestamp = Date.now();
    companionClient.activatePreparedWake(wakeIntent);
    resetAttemptMetrics(clickTimestamp, "wake");
    appendDiagnosticLog("wake", "nova tentativa iniciada");
    appendDiagnosticLog("wake", "pending salvo");
    appendDiagnosticLog("intent", "solicitação enviada ao Android");
    window.setTimeout(() => {
      setWakeIntent(companionClient.prepareWakeIntent("test"));
      void resumeAcceptance();
    }, 0);
    setBridgeStatus("checking");
    setFlowStatus("preparing");
    setMessage("Solicitação de abertura enviada ao Android.");
    setErrorMessage("");
    setShowDownload(false);
    setShowPair(false);
  }, [appendDiagnosticLog, isProduction, resetAttemptMetrics, resumeAcceptance, wakeIntent]);

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

  const logText = formatAndroidDiagnosticLog({
    diagnosticVersion: ANDROID_PRINT_DIAGNOSTIC_VERSION,
    companionVersion: EXPECTED_COMPANION_APP_VERSION,
    companionVersionCode: EXPECTED_COMPANION_VERSION_CODE,
    environment: isProduction ? "PRODUÇÃO" : "NÃO SUPORTADO",
    origin: window.location.origin,
    wakeDeadlineMs: WAKE_TIMEOUT_MS,
    healthProbeTimeoutMs: WAKE_HEALTH_REQUEST_TIMEOUT_MS,
    pollIntervalMs: POLL_INTERVAL_MS,
    attemptNumber,
  }, diagnosticLog);

  const copyLog = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logText);
      setCopyMessage("Log copiado.");
    } catch {
      setCopyMessage("Não foi possível copiar o log.");
    }
  }, [logText]);

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
          {isProduction && attemptStartedAt !== null && (
            <>
              <span>Health probes: {pollAttemptCount}</span>
              <span>Tempo total: {formatElapsed(elapsedMs)}</span>
            </>
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

      <Card className="android-wake-log">
        <div className="panel-section-title">Log do diagnóstico</div>
        <div className="android-wake-details">
          <span>Diagnóstico: v{ANDROID_PRINT_DIAGNOSTIC_VERSION}</span>
          <span>Companion esperado: v{EXPECTED_COMPANION_APP_VERSION} (code {EXPECTED_COMPANION_VERSION_CODE})</span>
          <span>Ambiente: {isProduction ? "PRODUÇÃO" : "NÃO SUPORTADO"}</span>
          <span>Origin: {window.location.origin}</span>
          <span>Wake deadline: {WAKE_TIMEOUT_MS / 1000} s</span>
          <span>Health probe timeout: {WAKE_HEALTH_REQUEST_TIMEOUT_MS / 1000} s</span>
          <span>Poll interval: {POLL_INTERVAL_MS} ms</span>
        </div>
        <pre>{diagnosticLog.map(formatAndroidDiagnosticLogEntry).join("\n")}</pre>
        <div className="android-wake-actions">
          <Button type="button" variant="secondary" onClick={() => setDiagnosticLog([])}>
            LIMPAR LOG
          </Button>
          <Button type="button" variant="secondary" onClick={() => void copyLog()}>
            COPIAR LOG
          </Button>
          {copyMessage && <span className="muted-text">{copyMessage}</span>}
        </div>
      </Card>

      {printersError && <p className="error-text">Não foi possível carregar a configuração das impressoras.</p>}
      {!loadingPrinters && !defaultPrinter && (
        <p className="muted-text">Defina uma impressora TCP ativa como padrão para habilitar o diagnóstico.</p>
      )}
    </div>
  );
}
