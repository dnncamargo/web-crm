import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { createPrintCompanionClient } from "../printers/printCompanionClient";
import {
  inspectFreshPendingPrintCompanionWake,
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
import { createAndroidPrintDiagnosticResumeOwner } from "./androidPrintDiagnosticResumeOwner";
import {
  getFlowLabel,
  type BridgeStatus,
  type DiagnosticStage,
  type FlowStatus,
} from "./androidPrintDiagnosticUi";
import {
  appendAndroidDiagnosticLog,
  createInitialAndroidDiagnosticLog,
  formatAndroidDiagnosticLog,
  formatAndroidDiagnosticLogEntry,
  shortenAndroidDiagnosticAttemptId,
  type AndroidDiagnosticLogEntry,
  type AndroidDiagnosticLogStage,
} from "./androidPrintWakeLog";
import { usePrinters } from "../printers/usePrinters";
import { resolveDiagnosticPrinter } from "../printers/printerUtils";

const companionClient = createPrintCompanionClient();

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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPrinterId = searchParams.get("printer");
  const selectedPrinter = useMemo(
    () => resolveDiagnosticPrinter(printers, defaultPrinterId, requestedPrinterId),
    [defaultPrinterId, printers, requestedPrinterId],
  );
  const isInstallLanding = window.location.pathname === APP_ROUTES.companionActivation;
  const isProduction = isAndroidPrintDiagnosticProduction(window.location.origin);
  const [initialPendingState] = useState(() => isProduction
    ? inspectFreshPendingPrintCompanionWake()
    : { pending: null });
  const initialPendingWake = initialPendingState.pending;
  const [wakeIntent, setWakeIntent] = useState(() => companionClient.prepareWakeIntent("test"));
  const hasPendingWake = isProduction && Boolean(initialPendingWake);
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
  const [diagnosticLog, setDiagnosticLog] = useState<AndroidDiagnosticLogEntry[]>(() => {
    const initialLog = createInitialAndroidDiagnosticLog(isProduction);
    return initialPendingState.staleAgeMs === undefined
      ? initialLog
      : appendAndroidDiagnosticLog(initialLog, {
        at: Date.now(),
        stage: "pending",
        event: "stale descartado",
        details: `age=${initialPendingState.staleAgeMs} ms`,
      });
  });
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const attemptStartedAtRef = useRef<number | null>(null);
  const attemptStartedPerformanceAtRef = useRef<number | null>(null);
  const attemptNumberRef = useRef(0);
  const pollAttemptCountRef = useRef(0);
  const currentAttemptIdRef = useRef<string | null>(initialPendingWake?.attemptId ?? null);
  const resumeOwnerRef = useRef(createAndroidPrintDiagnosticResumeOwner());
  const staleAttemptLogRef = useRef(new Set<string>());

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

  const appendAttemptDiagnosticLog = useCallback((
    attemptId: string,
    stage: AndroidDiagnosticLogStage,
    event: string,
    details?: string,
  ) => {
    if (currentAttemptIdRef.current !== attemptId) {
      if (!staleAttemptLogRef.current.has(attemptId)) {
        staleAttemptLogRef.current.add(attemptId);
        appendDiagnosticLog(
          "diagnostic",
          "resultado stale ignorado",
          `id=${shortenAndroidDiagnosticAttemptId(attemptId)}`,
        );
      }
      return false;
    }

    appendDiagnosticLog(stage, event, details);
    return true;
  }, [appendDiagnosticLog]);

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

  const handlePollAttempt = useCallback((attemptId: string, { attempt, elapsedMs: nextElapsedMs }: WakePollProgress) => {
    if (!appendAttemptDiagnosticLog(attemptId, "health", `probe #${attempt} iniciado`)) {
      return;
    }
    setCurrentStage("health");
    pollAttemptCountRef.current = attempt;
    setPollAttemptCount(attempt);
    setElapsedMs(nextElapsedMs);
  }, [appendAttemptDiagnosticLog]);

  const handlePollResult = useCallback((attemptId: string, { attempt, status, errorCode, httpStatus, timedOut }: WakePollResult) => {
    let event = "probe sem resposta";
    const details = errorCode;
    if (timedOut) {
      event = `probe #${attempt} timeout local`;
    } else if (httpStatus !== undefined) {
      event = `probe #${attempt} HTTP ${httpStatus}`;
    } else if (status === "online" && errorCode === undefined) {
      event = `probe #${attempt} respondeu`;
    } else if (errorCode !== undefined) {
      event = `probe #${attempt} falhou`;
    }
    appendAttemptDiagnosticLog(attemptId, "health", event, details);
  }, [appendAttemptDiagnosticLog]);

  const handleHealthReady = useCallback((attemptId: string, nextHealth: PrintCompanionHealth) => {
    if (!appendAttemptDiagnosticLog(attemptId, "health", "companion detectado", `app=${nextHealth.appVersion} code=${nextHealth.appVersionCode} api=${nextHealth.apiVersion} paired=${nextHealth.paired}`)) {
      return;
    }
    setHealth(nextHealth);
    setBridgeStatus("online");
    setCurrentStage("pair");
    setMessage("Companion respondeu. Verificando pareamento…");
    appendAttemptDiagnosticLog(attemptId, "health", "capabilities", nextHealth.capabilities.join(", "));
  }, [appendAttemptDiagnosticLog]);

  const handleStageResult = useCallback((
    attemptId: string,
    stage: "pair" | "config",
    result: "success" | "failure",
    publicCode?: string,
  ) => {
    appendAttemptDiagnosticLog(attemptId, stage, result === "success" ? "sucesso" : "falha", publicCode);
  }, [appendAttemptDiagnosticLog]);

  const getCurrentElapsedMs = useCallback(() => {
    const startedAt = attemptStartedPerformanceAtRef.current;
    return startedAt === null ? 0 : Math.max(0, monotonicNow() - startedAt);
  }, []);

  const handleStageChange = useCallback((attemptId: string, stage: "health" | "pair" | "config") => {
    if (currentAttemptIdRef.current !== attemptId) {
      appendAttemptDiagnosticLog(attemptId, "resume", "resultado stale ignorado");
      return;
    }
    setCurrentStage(stage);
    if (stage === "pair") {
      setFlowStatus("preparing");
      setMessage("Companion respondeu. Pareando…");
      appendAttemptDiagnosticLog(attemptId, "pair", "início");
    } else if (stage === "config") {
      setFlowStatus("configuring");
      setMessage("Companion respondeu. Aplicando configuração…");
      appendAttemptDiagnosticLog(attemptId, "config", "início");
    } else {
      setMessage("Aguardando o companion responder…");
    }
  }, [appendAttemptDiagnosticLog]);

  const resumeAcceptance = useCallback(async () => {
    const freshPending = inspectFreshPendingPrintCompanionWake();
    if (!isProduction || loadingPrinters || !freshPending.pending) {
      return;
    }
    const pendingWake = freshPending.pending;
    const attemptPrinter = selectedPrinter;
    const attemptId = pendingWake.attemptId;
    const isResumeOwner = resumeOwnerRef.current.claim(attemptId);

    if (!isResumeOwner) {
      appendDiagnosticLog("resume", "reutilizado", `id=${shortenAndroidDiagnosticAttemptId(attemptId)}`);
      return;
    }

    if (currentAttemptIdRef.current !== attemptId) {
      currentAttemptIdRef.current = attemptId;
      resetAttemptMetrics(pendingWake.createdAt, "health");
      appendDiagnosticLog("resume", "início", `id=${shortenAndroidDiagnosticAttemptId(attemptId)}`);
    } else if (attemptStartedAtRef.current === null) {
      resetAttemptMetrics(pendingWake.createdAt, "health");
      appendDiagnosticLog("resume", "início", `id=${shortenAndroidDiagnosticAttemptId(attemptId)}`);
    }

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
        onPollAttempt: (progress) => handlePollAttempt(attemptId, progress),
        onPollResult: (result) => handlePollResult(attemptId, result),
        onStageChange: (stage) => handleStageChange(attemptId, stage),
        onStageResult: (stage, result, publicCode) => handleStageResult(attemptId, stage, result, publicCode),
        onHealthReady: (nextHealth) => handleHealthReady(attemptId, nextHealth),
      });
      if (currentAttemptIdRef.current !== attemptId) {
        appendAttemptDiagnosticLog(attemptId, "resume", "resultado stale ignorado");
        return;
      }
      setHealth(readyHealth);
      setAuthenticated(true);
      setBridgeStatus("online");
      setMessage(`Companion respondeu; configuração de ${config.idleTimeoutMinutes} min aplicada.`);

      if (!attemptPrinter) {
        setCurrentStage("test");
        setFlowStatus("fail");
        setErrorMessage("Selecione uma impressora para executar o teste.");
        setMessage("O companion foi pareado, mas o teste não foi concluído.");
        return;
      }

      setCurrentStage("test");
      setFlowStatus("testing");
      setMessage(`Testando a conexão com “${attemptPrinter.name}”…`);
      appendAttemptDiagnosticLog(attemptId, "test", "início", `printer=${attemptPrinter.name}`);
      try {
        await companionClient.testPrinter(attemptPrinter);
        appendAttemptDiagnosticLog(attemptId, "test", "sucesso", `printer=${attemptPrinter.name}`);
      } catch (error) {
        const publicCode = getAndroidPrintWakeErrorDetails(error).publicCode;
        appendAttemptDiagnosticLog(attemptId, "test", "falha", `printer=${attemptPrinter.name} code=${publicCode}`);
        throw error;
      }
      if (currentAttemptIdRef.current !== attemptId) {
        appendAttemptDiagnosticLog(attemptId, "resume", "resultado stale ignorado");
        return;
      }
      setFlowStatus("pass");
      setMessage(`Conexão com “${attemptPrinter.name}” estabelecida. Nenhuma impressão física foi realizada.`);
    } catch (error) {
      if (currentAttemptIdRef.current !== attemptId) {
        appendAttemptDiagnosticLog(attemptId, "resume", "resultado stale ignorado");
        return;
      }
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
        const elapsed = Math.round(getCurrentElapsedMs());
        if (pollAttemptCountRef.current === 0 && elapsed < WAKE_TIMEOUT_MS) {
          setErrorMessage("O diagnóstico encontrou um estado inválido antes do primeiro health probe.");
          setLastPublicErrorCode("diagnostic_state_error");
          setShowDownload(false);
          appendAttemptDiagnosticLog(
            attemptId,
            "diagnostic",
            "timeout inválido antes do primeiro probe",
            `probes=0 elapsed=${elapsed} ms`,
          );
        } else {
          appendAttemptDiagnosticLog(
            attemptId,
            "health",
            "wake_timeout",
            `probes=${pollAttemptCountRef.current} elapsed=${elapsed} ms`,
          );
        }
      }
    } finally {
      if (currentAttemptIdRef.current === attemptId) {
        finishAttempt();
      }
      resumeOwnerRef.current.release(attemptId);
    }
  }, [appendAttemptDiagnosticLog, appendDiagnosticLog, finishAttempt, getCurrentElapsedMs, handleHealthReady, handlePollAttempt, handlePollResult, handleStageChange, handleStageResult, isProduction, loadingPrinters, resetAttemptMetrics, selectedPrinter]);

  const handleWakeClick = useCallback(() => {
    if (!isProduction) {
      return;
    }

    const previousAttemptId = currentAttemptIdRef.current;
    const activeResumeAttemptId = resumeOwnerRef.current.getActiveAttemptId();
    if (previousAttemptId !== null && activeResumeAttemptId !== null && previousAttemptId !== wakeIntent.attemptId) {
      appendDiagnosticLog(
        "resume",
        "tentativa anterior invalidada",
        `id=${shortenAndroidDiagnosticAttemptId(previousAttemptId)}`,
      );
    }
    const clickTimestamp = Date.now();
    companionClient.activatePreparedWake(wakeIntent);
    currentAttemptIdRef.current = wakeIntent.attemptId;
    resetAttemptMetrics(clickTimestamp, "wake");
    appendDiagnosticLog("wake", "nova tentativa iniciada");
    appendDiagnosticLog("wake", "pending salvo");
    appendDiagnosticLog("intent", "solicitação enviada ao Android");
    appendDiagnosticLog("pending", "tentativa criada", `id=${shortenAndroidDiagnosticAttemptId(wakeIntent.attemptId)}`);
    window.setTimeout(() => {
      if (currentAttemptIdRef.current !== wakeIntent.attemptId) {
        appendDiagnosticLog("resume", "resultado stale ignorado", `id=${shortenAndroidDiagnosticAttemptId(wakeIntent.attemptId)}`);
        return;
      }
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
      const freshPending = inspectFreshPendingPrintCompanionWake();
      if (freshPending.pending) {
        void resumeAcceptance();
      } else if (freshPending.staleAgeMs !== undefined) {
        appendDiagnosticLog("pending", "stale descartado", `age=${freshPending.staleAgeMs} ms`);
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
  }, [appendDiagnosticLog, isProduction, loadingPrinters, resumeAcceptance]);

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
    ? "Falha"
    : getFlowLabel(flowStatus, bridgeStatus, currentStage);
  const statusState = !isProduction || flowStatus === "fail"
    ? "error"
    : flowStatus === "pass" || bridgeStatus === "online"
      ? "success"
      : "pending";

  return (
    <div className="page-stack">
      <PageHeader
        title={isInstallLanding ? "Aplicativo de impressão necessário" : "Diagnóstico de impressão"}
        description={isInstallLanding
          ? "Instale o WebCRM Print Companion para enviar pedidos diretamente à impressora térmica."
          : "Verifique a conexão entre o sistema, o companion Android e a impressora selecionada."}
      />

      <Card className="android-wake-card">
        <div className="android-wake-status" data-state={statusState} role="status" aria-live="polite">
          <span className="android-wake-status-label">{statusLabel}</span>
          <strong>{message}</strong>
          {errorMessage && <span className="error-text">{errorMessage}</span>}
        </div>

        <div className="android-wake-printer-field">
          <label htmlFor="diagnostic-printer">Impressora</label>
          <select
            id="diagnostic-printer"
            value={selectedPrinter?.id ?? ""}
            disabled={attemptActive}
            onChange={(event) => {
              const nextParams = new URLSearchParams(searchParams);
              if (event.target.value) {
                nextParams.set("printer", event.target.value);
              } else {
                nextParams.delete("printer");
              }
              setSearchParams(nextParams, { replace: true });
            }}
          >
            {!selectedPrinter && <option value="">Nenhuma impressora disponível</option>}
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name}{printer.active ? "" : " (inativa)"}
              </option>
            ))}
          </select>
          {!loadingPrinters && !selectedPrinter && (
            <span className="muted-text">Cadastre uma impressora para executar o teste.</span>
          )}
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
          <span>Impressora: {selectedPrinter?.name ?? "nenhuma selecionada"}</span>
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
              Parear companion
            </a>
          )}
          {isProduction && !showPair && flowStatus === "idle" && (
            <a className="button button-secondary" href={wakeIntent.intentUrl} onClick={handleWakeClick}>
              {isInstallLanding ? "Tentar abrir aplicativo" : "Ativar companion e testar"}
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
        <div className="android-wake-log-header">
          <strong>Log do diagnóstico</strong>
          <div className="android-wake-actions">
            <Button type="button" variant="ghost" onClick={() => setDiagnosticLog([])}>
              Limpar log
            </Button>
            <Button type="button" variant="secondary" onClick={() => void copyLog()}>
              Copiar log
            </Button>
            {copyMessage && <span className="muted-text">{copyMessage}</span>}
          </div>
        </div>
        <div className="android-wake-details">
          <span>Diagnóstico: v{ANDROID_PRINT_DIAGNOSTIC_VERSION}</span>
          <span>Companion esperado: v{EXPECTED_COMPANION_APP_VERSION} (code {EXPECTED_COMPANION_VERSION_CODE})</span>
          <span>Ambiente: {isProduction ? "PRODUÇÃO" : "NÃO SUPORTADO"}</span>
          <span>Origin: {window.location.origin}</span>
          <span>Wake deadline: {WAKE_TIMEOUT_MS / 1000} s</span>
          <span>Health probe timeout: {WAKE_HEALTH_REQUEST_TIMEOUT_MS / 1000} s</span>
          <span>Poll interval: {POLL_INTERVAL_MS} ms</span>
        </div>
        <pre className="android-wake-log-output">{diagnosticLog.map(formatAndroidDiagnosticLogEntry).join("\n")}</pre>
      </Card>

      {printersError && <p className="error-text">Não foi possível carregar a configuração das impressoras.</p>}
    </div>
  );
}
