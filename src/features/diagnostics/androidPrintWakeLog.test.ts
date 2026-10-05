import { describe, expect, it } from "vitest";

import {
  ANDROID_DIAGNOSTIC_LOG_MAX_ENTRIES,
  appendAndroidDiagnosticLog,
  createInitialAndroidDiagnosticLog,
  formatAndroidDiagnosticLog,
} from "./androidPrintWakeLog";

describe("Android diagnostic visible log", () => {
  it("starts without a health probe", () => {
    const entries = createInitialAndroidDiagnosticLog(true, 1_000);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ stage: "idle", event: "diagnóstico carregado" });
    expect(entries.some((entry) => entry.stage === "health")).toBe(false);
  });

  it("keeps only the newest fifty entries and redacts secrets", () => {
    let entries = createInitialAndroidDiagnosticLog(true, 1_000);
    for (let index = 1; index <= ANDROID_DIAGNOSTIC_LOG_MAX_ENTRIES + 5; index += 1) {
      entries = appendAndroidDiagnosticLog(entries, {
        at: index,
        stage: "health",
        event: `probe #${index}`,
        details: `nonce=secret-${index} token=secret-token-${index}`,
      });
    }

    expect(entries).toHaveLength(ANDROID_DIAGNOSTIC_LOG_MAX_ENTRIES);
    expect(entries[0]?.event).toBe("probe #6");
    expect(JSON.stringify(entries)).not.toContain("secret-55");
    expect(JSON.stringify(entries)).not.toContain("secret-token-55");
  });

  it("formats a safe copy payload with the diagnostic header", () => {
    const text = formatAndroidDiagnosticLog({
      diagnosticVersion: "1.0.9",
      companionVersion: "1.0.0",
      companionVersionCode: 1,
      environment: "PRODUÇÃO",
      origin: "https://deliciasdoporto.vercel.app",
      wakeDeadlineMs: 15_000,
      healthProbeTimeoutMs: 1_000,
      pollIntervalMs: 500,
      attemptNumber: 2,
    }, [{
      at: new Date("2026-10-04T20:00:00.123Z").getTime(),
      elapsedMs: 1_234,
      stage: "health",
      event: "probe #1 respondeu",
      details: "app=1.0.0 code=1 api=1 paired=false",
    }]);

    expect(text).toContain("Diagnóstico Android v1.0.9");
    expect(text).toContain("Ambiente PRODUÇÃO");
    expect(text).toContain("Tentativa #2");
    expect(text).toContain("[health] probe #1 respondeu");
    expect(text).not.toContain("nonce");
    expect(text).not.toContain("token");
  });

  it("records an idle timeout update without secrets", () => {
    const text = formatAndroidDiagnosticLog({
      diagnosticVersion: "1.0.9",
      companionVersion: "1.0.0",
      companionVersionCode: 1,
      environment: "PRODUÇÃO",
      origin: "https://deliciasdoporto.vercel.app",
      wakeDeadlineMs: 15_000,
      healthProbeTimeoutMs: 1_000,
      pollIntervalMs: 500,
      attemptNumber: 1,
    }, [{
      at: Date.now(),
      stage: "config",
      event: "timeout atualizado",
      details: "idle=30min",
    }]);

    expect(text).toContain("idle=30min");
    expect(text).not.toContain("nonce");
    expect(text).not.toContain("token");
    expect(text).not.toContain("Authorization");
  });

  it("keeps the selected printer name without adding connection secrets", () => {
    const text = formatAndroidDiagnosticLog({
      diagnosticVersion: "1.0.9",
      companionVersion: "1.0.0",
      companionVersionCode: 1,
      environment: "PRODUÇÃO",
      origin: "https://deliciasdoporto.vercel.app",
      wakeDeadlineMs: 15_000,
      healthProbeTimeoutMs: 1_000,
      pollIntervalMs: 500,
      attemptNumber: 1,
    }, [{
      at: Date.now(),
      stage: "test",
      event: "início",
      details: "printer=Balcão",
    }]);

    expect(text).toContain("printer=Balcão");
    expect(text).not.toContain("127.0.0.1");
    expect(text).not.toContain("17890");
    expect(text).not.toContain("nonce=");
    expect(text).not.toContain("token=");
  });
});
