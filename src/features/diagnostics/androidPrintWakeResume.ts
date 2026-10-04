export const WAKE_TIMEOUT_MS = 15_000;
export const POLL_INTERVAL_MS = 500;
export const WAKE_HEALTH_REQUEST_TIMEOUT_MS = 1_000;

export interface WakePollProgress {
  attempt: number;
  elapsedMs: number;
}

export interface WakePollResult {
  attempt: number;
  elapsedMs: number;
  status: "online" | "unavailable";
  errorCode?: string;
  httpStatus?: number;
  timedOut?: boolean;
}

interface WakePollErrorDetails {
  errorCode?: string;
  httpStatus?: number;
  timedOut?: boolean;
}

interface WakeResumeControllerOptions {
  hasPendingWake: () => boolean;
  clearPendingWake: () => void;
  checkHealth: () => Promise<boolean>;
  canRunPendingTest: () => boolean;
  runPendingTest: () => Promise<void>;
  onInitialHealth: (online: boolean) => void;
  onWakeTimeout: () => void;
  clearPendingOnSuccess?: boolean;
  onPollAttempt?: (progress: WakePollProgress) => void;
  onPollResult?: (result: WakePollResult) => void;
  startedAt?: number;
  getLastPollError?: () => WakePollErrorDetails | undefined;
}

export interface WakeResumeController {
  start(): void;
  beginPendingWake(): void;
  resumePendingWake(): void;
  dispose(): void;
}

export interface WaitForWakeResumeOptions {
  clearPendingWakeOnSuccess?: boolean;
  isTransientError?: (error: unknown) => boolean;
  onPollAttempt?: (progress: WakePollProgress) => void;
  onPollResult?: (result: WakePollResult) => void;
  signal?: AbortSignal;
  startedAt?: number;
}

function getWakePollErrorDetails(error: unknown): WakePollErrorDetails {
  if (error instanceof Error && error.name === "AbortError") {
    return { timedOut: true };
  }

  if (error !== null && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const errorCode = typeof candidate.companionCode === "string"
      ? candidate.companionCode
      : typeof candidate.code === "string"
        ? candidate.code
        : "unknown_error";
    return {
      errorCode,
      httpStatus: typeof candidate.status === "number" ? candidate.status : undefined,
      timedOut: candidate.companionCode === "local_timeout",
    };
  }

  return { errorCode: "unknown_error" };
}

export async function waitForWakeResume<T>(
  checkHealth: () => Promise<T>,
  isReady: (value: T) => boolean,
  options: WaitForWakeResumeOptions = {},
): Promise<T> {
  let latestValue: T | undefined;
  let pending = true;
  let resolveResult: (value: T) => void = () => undefined;
  let rejectResult: (reason: unknown) => void = () => undefined;
  let settled = false;
  let hasFatalError = false;
  let fatalError: unknown;
  let lastPollError: WakePollErrorDetails | undefined;

  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const controller = createWakeResumeController({
    hasPendingWake: () => pending,
    clearPendingWake: () => {
      pending = false;
    },
    checkHealth: async () => {
      lastPollError = undefined;
      try {
        const value = await checkHealth();
        latestValue = value;
        return isReady(value);
      } catch (error) {
        lastPollError = getWakePollErrorDetails(error);
        if (options.isTransientError && !options.isTransientError(error)) {
          hasFatalError = true;
          fatalError = error;
          return true;
        }
        return false;
      }
    },
    canRunPendingTest: () => true,
    runPendingTest: async () => {
      if (hasFatalError && !settled) {
        settled = true;
        rejectResult(fatalError);
      } else if (latestValue !== undefined && !settled) {
        settled = true;
        resolveResult(latestValue);
      }
    },
    onInitialHealth: () => undefined,
    onWakeTimeout: () => {
      if (!settled) {
        settled = true;
        rejectResult(new Error("A ativação do companion expirou."));
      }
    },
    clearPendingOnSuccess: options.clearPendingWakeOnSuccess !== false,
    onPollAttempt: options.onPollAttempt,
    onPollResult: options.onPollResult,
    startedAt: options.startedAt,
    getLastPollError: () => lastPollError,
  });

  function resume() {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      controller.resumePendingWake();
    }
  }

  const onVisibilityChange = () => resume();
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  const abort = () => {
    if (!settled) {
      settled = true;
      rejectResult(options.signal?.reason ?? new DOMException("Wake resume cancelado.", "AbortError"));
    }
    controller.dispose();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      abort();
    } else {
      options.signal.addEventListener("abort", abort, { once: true });
    }
  }

  controller.start();

  try {
    return await result;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    controller.dispose();
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  }
}

export function createWakeResumeController(
  options: WakeResumeControllerOptions,
): WakeResumeController {
  let disposed = false;
  let polling = false;
  let pendingTestStarted = false;
  let pendingHealthOnline = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let pollAttemptCount = 0;
  let pollStartedAt = 0;
  let wakeDeadlineAt = 0;

  function monotonicNow() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
  }

  function elapsedSinceWake() {
    return Math.max(0, monotonicNow() - pollStartedAt);
  }

  function wakeTimedOut() {
    return Date.now() >= wakeDeadlineAt;
  }

  function handleWakeTimeout() {
    stopPolling();
    options.clearPendingWake();
    options.onWakeTimeout();
  }

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function stopPolling() {
    polling = false;
    generation += 1;
    clearTimer();
  }

  async function poll(currentGeneration: number) {
    if (disposed || !polling || currentGeneration !== generation) {
      return;
    }

    if (wakeTimedOut() && pollAttemptCount > 0) {
      handleWakeTimeout();
      return;
    }

    const pollAttempt = ++pollAttemptCount;
    options.onPollAttempt?.({
      attempt: pollAttempt,
      elapsedMs: elapsedSinceWake(),
    });
    const online = await options.checkHealth().catch(() => false);
    options.onPollResult?.({
      attempt: pollAttempt,
      elapsedMs: elapsedSinceWake(),
      status: online ? "online" : "unavailable",
      ...options.getLastPollError?.(),
    });

    if (disposed || !polling || currentGeneration !== generation) {
      return;
    }

    if (online) {
      stopPolling();
      pendingHealthOnline = true;
      runPendingTestIfReady();
      return;
    }

    if (wakeTimedOut()) {
      handleWakeTimeout();
      return;
    }

    const remainingMs = Math.max(0, wakeDeadlineAt - Date.now());
    timer = setTimeout(() => {
      timer = undefined;
      void poll(currentGeneration);
    }, Math.min(POLL_INTERVAL_MS, remainingMs));
  }

  function startPolling() {
    if (disposed || polling || pendingTestStarted || !options.hasPendingWake()) {
      return;
    }

    polling = true;
    pendingHealthOnline = false;
    pollAttemptCount = 0;
    const startedAt = options.startedAt ?? Date.now();
    const elapsedBeforePolling = Math.max(0, Date.now() - startedAt);
    pollStartedAt = monotonicNow() - elapsedBeforePolling;
    wakeDeadlineAt = startedAt + WAKE_TIMEOUT_MS;
    const currentGeneration = ++generation;
    void poll(currentGeneration);
  }

  function beginPendingWake() {
    stopPolling();
    pendingTestStarted = false;
    startPolling();
  }

  function runPendingTestIfReady() {
    if (
      disposed ||
      !pendingHealthOnline ||
      pendingTestStarted ||
      !options.hasPendingWake() ||
      !options.canRunPendingTest()
    ) {
      return;
    }

    pendingTestStarted = true;
    void options.runPendingTest().finally(() => {
      if (options.clearPendingOnSuccess !== false) {
        options.clearPendingWake();
      }
    });
  }

  return {
    start() {
      if (options.hasPendingWake()) {
        beginPendingWake();
        return;
      }

      const currentGeneration = ++generation;
      void options.checkHealth().catch(() => false).then((online) => {
        if (!disposed && currentGeneration === generation && !options.hasPendingWake()) {
          options.onInitialHealth(online);
        }
      });
    },

    beginPendingWake,

    resumePendingWake() {
      if (pendingHealthOnline) {
        runPendingTestIfReady();
      } else {
        startPolling();
      }
    },

    dispose() {
      disposed = true;
      stopPolling();
    },
  };
}
