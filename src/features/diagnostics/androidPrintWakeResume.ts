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
  startedAt?: number;
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
      try {
        const value = await checkHealth();
        latestValue = value;
        return isReady(value);
      } catch (error) {
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

  controller.start();

  try {
    return await result;
  } finally {
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

    if (wakeTimedOut()) {
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
