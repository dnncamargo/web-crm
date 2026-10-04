export const WAKE_TIMEOUT_MS = 15_000;
export const POLL_INTERVAL_MS = 500;

interface WakeResumeControllerOptions {
  hasPendingWake: () => boolean;
  clearPendingWake: () => void;
  checkHealth: () => Promise<boolean>;
  canRunPendingTest: () => boolean;
  runPendingTest: () => Promise<void>;
  onInitialHealth: (online: boolean) => void;
  onWakeTimeout: () => void;
}

export interface WakeResumeController {
  start(): void;
  beginPendingWake(): void;
  resumePendingWake(): void;
  dispose(): void;
}

export async function waitForWakeResume<T>(
  checkHealth: () => Promise<T>,
  isReady: (value: T) => boolean,
): Promise<T> {
  let latestValue: T | undefined;
  let pending = true;
  let resolveResult: (value: T) => void = () => undefined;
  let rejectResult: (reason: unknown) => void = () => undefined;
  let settled = false;

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
      } catch {
        return false;
      }
    },
    canRunPendingTest: () => true,
    runPendingTest: async () => {
      if (latestValue !== undefined && !settled) {
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
  let pollStartedAt = 0;
  let pendingHealthOnline = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

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

    const online = await options.checkHealth().catch(() => false);

    if (disposed || !polling || currentGeneration !== generation) {
      return;
    }

    if (online) {
      stopPolling();
      pendingHealthOnline = true;
      runPendingTestIfReady();
      return;
    }

    if (Date.now() - pollStartedAt >= WAKE_TIMEOUT_MS) {
      stopPolling();
      options.clearPendingWake();
      options.onWakeTimeout();
      return;
    }

    timer = setTimeout(() => {
      timer = undefined;
      void poll(currentGeneration);
    }, POLL_INTERVAL_MS);
  }

  function startPolling() {
    if (disposed || polling || pendingTestStarted || !options.hasPendingWake()) {
      return;
    }

    polling = true;
    pendingHealthOnline = false;
    pollStartedAt = Date.now();
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
      options.clearPendingWake();
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
