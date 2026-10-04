export type AndroidDiagnosticLogStage =
  | "idle"
  | "wake"
  | "intent"
  | "health"
  | "pair"
  | "config"
  | "test";

export interface AndroidDiagnosticLogEntry {
  at: number;
  elapsedMs?: number;
  stage: AndroidDiagnosticLogStage;
  event: string;
  details?: string;
}

export const ANDROID_DIAGNOSTIC_LOG_MAX_ENTRIES = 50;

export function createInitialAndroidDiagnosticLog(
  isProduction: boolean,
  at = Date.now(),
): AndroidDiagnosticLogEntry[] {
  return [{
    at,
    stage: "idle",
    event: isProduction ? "diagnóstico carregado" : "ambiente não suportado",
  }];
}

function sanitizeAndroidDiagnosticLogDetails(details?: string) {
  if (!details) {
    return undefined;
  }

  return details
    .replace(/(bearer\s+|token\s*[=:]\s*|nonce\s*[=:]\s*|authorization\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]");
}

export function appendAndroidDiagnosticLog(
  current: AndroidDiagnosticLogEntry[],
  entry: AndroidDiagnosticLogEntry,
) {
  return [...current, { ...entry, details: sanitizeAndroidDiagnosticLogDetails(entry.details) }]
    .slice(-ANDROID_DIAGNOSTIC_LOG_MAX_ENTRIES);
}

export interface AndroidDiagnosticLogHeader {
  diagnosticVersion: string;
  companionVersion: string;
  companionVersionCode: number;
  environment: string;
  origin: string;
  wakeDeadlineMs: number;
  healthProbeTimeoutMs: number;
  pollIntervalMs: number;
  attemptNumber: number;
}

export function formatAndroidDiagnosticLog(
  header: AndroidDiagnosticLogHeader,
  entries: AndroidDiagnosticLogEntry[],
) {
  return [
    `Diagnóstico Android v${header.diagnosticVersion}`,
    `Companion esperado v${header.companionVersion} code ${header.companionVersionCode}`,
    `Ambiente ${header.environment}`,
    `Origin: ${header.origin}`,
    `Wake deadline: ${header.wakeDeadlineMs / 1000} s`,
    `Health probe timeout: ${header.healthProbeTimeoutMs / 1000} s`,
    `Poll interval: ${header.pollIntervalMs} ms`,
    `Tentativa #${header.attemptNumber}`,
    "",
    ...entries.map(formatAndroidDiagnosticLogEntry),
  ].join("\n");
}

export function formatAndroidDiagnosticLogEntry(entry: AndroidDiagnosticLogEntry) {
  const date = new Date(entry.at);
  const time = date.toLocaleTimeString("pt-BR", { hour12: false });
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  const elapsed = entry.elapsedMs === undefined
    ? ""
    : ` +${(entry.elapsedMs / 1000).toFixed(3).replace(".", ",")}s`;
  const details = entry.details ? ` ${entry.details}` : "";
  return `${time}.${milliseconds}${elapsed} [${entry.stage}] ${entry.event}${details}`;
}
