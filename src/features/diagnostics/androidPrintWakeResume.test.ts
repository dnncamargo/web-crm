import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWakeResumeController,
  POLL_INTERVAL_MS,
  WAKE_TIMEOUT_MS,
  waitForWakeResume,
  type WakePollResult,
  type WakePollProgress,
} from "./androidPrintWakeResume";

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHarness(options: {
  pending?: boolean;
  health: () => Promise<boolean>;
  runTest?: () => Promise<void>;
  onPollAttempt?: (progress: WakePollProgress) => void;
  onPollResult?: (result: WakePollResult) => void;
  startedAt?: number;
}) {
  let pending = options.pending ?? true;
  const clearPendingWake = vi.fn(() => {
    pending = false;
  });
  const runPendingTest = options.runTest ?? vi.fn(async () => undefined);
  const onInitialHealth = vi.fn();
  const onWakeTimeout = vi.fn();
  const controller = createWakeResumeController({
    hasPendingWake: () => pending,
    clearPendingWake,
    checkHealth: options.health,
    canRunPendingTest: () => true,
    runPendingTest,
    onInitialHealth,
    onWakeTimeout,
    onPollAttempt: options.onPollAttempt,
    onPollResult: options.onPollResult,
    startedAt: options.startedAt,
  });

  return {
    controller,
    clearPendingWake,
    onInitialHealth,
    onWakeTimeout,
    runPendingTest,
  };
}

describe("Android wake resume controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes polling after a wake and runs /v1/test once on the first health OK", async () => {
    vi.useFakeTimers();
    const health = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const harness = createHarness({ health });

    harness.controller.beginPendingWake();
    await vi.advanceTimersByTimeAsync(0);
    harness.controller.resumePendingWake();
    expect(harness.clearPendingWake).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await settle();

    expect(health).toHaveBeenCalledTimes(2);
    expect(harness.runPendingTest).toHaveBeenCalledTimes(1);
    expect(harness.clearPendingWake).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated focus and visibility resumes without duplicating the test", async () => {
    vi.useFakeTimers();
    const health = vi.fn().mockResolvedValue(true);
    const harness = createHarness({ health });

    harness.controller.beginPendingWake();
    harness.controller.resumePendingWake();
    harness.controller.resumePendingWake();
    harness.controller.resumePendingWake();
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    harness.controller.resumePendingWake();
    harness.controller.resumePendingWake();
    await settle();

    expect(health).toHaveBeenCalledTimes(1);
    expect(harness.runPendingTest).toHaveBeenCalledTimes(1);
  });

  it("reports each real health poll with attempt and elapsed time", async () => {
    vi.useFakeTimers();
    const progress: WakePollProgress[] = [];
    const harness = createHarness({
      health: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
      onPollAttempt: (value) => progress.push(value),
    });

    harness.controller.beginPendingWake();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await settle();

    expect(progress).toEqual([
      { attempt: 1, elapsedMs: 0 },
      { attempt: 2, elapsedMs: POLL_INTERVAL_MS },
    ]);
  });

  it("reports local timeout, HTTP failure, and valid health responses distinctly", async () => {
    vi.useFakeTimers();
    const results: WakePollResult[] = [];
    const health = vi.fn<() => Promise<{ ready: boolean }>>()
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { companionCode: "local_timeout" }))
      .mockRejectedValueOnce(Object.assign(new Error("unavailable"), { companionCode: "http_503", status: 503 }))
      .mockResolvedValueOnce({ ready: true });
    const resumePromise = waitForWakeResume(
      health,
      (value) => value.ready,
      { onPollResult: (result) => results.push(result) },
    );

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await expect(resumePromise).resolves.toEqual({ ready: true });
    expect(results).toMatchObject([
      { status: "unavailable", timedOut: true, errorCode: "local_timeout" },
      { status: "unavailable", httpStatus: 503, errorCode: "http_503" },
      { status: "online" },
    ]);
  });

  it("does not overlap health probes while the current probe is pending", async () => {
    vi.useFakeTimers();
    let resolveHealth: ((value: boolean) => void) | undefined;
    let inFlight = 0;
    let maxInFlight = 0;
    const health = vi.fn(() => new Promise<boolean>((resolve) => {
      resolveHealth = resolve;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    }).finally(() => {
      inFlight -= 1;
    }));
    const harness = createHarness({ health });

    harness.controller.beginPendingWake();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(health).toHaveBeenCalledTimes(1);
    expect(maxInFlight).toBe(1);

    resolveHealth?.(true);
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    expect(harness.runPendingTest).toHaveBeenCalledTimes(1);
  });

  it("keeps the fifteen-second deadline anchored to the wake start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const health = vi.fn().mockResolvedValue(false);
    const harness = createHarness({
      health,
      startedAt: 0,
    });

    vi.advanceTimersByTime(14_900);
    harness.controller.beginPendingWake();
    await vi.advanceTimersByTimeAsync(100);
    await settle();

    expect(harness.onWakeTimeout).toHaveBeenCalledTimes(1);
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("fails and clears the pending wake when the finite timeout expires", async () => {
    vi.useFakeTimers();
    const harness = createHarness({ health: vi.fn().mockResolvedValue(false) });

    harness.controller.beginPendingWake();
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS);
    await settle();

    expect(harness.onWakeTimeout).toHaveBeenCalledTimes(1);
    expect(harness.clearPendingWake).toHaveBeenCalledTimes(1);
    expect(harness.runPendingTest).not.toHaveBeenCalled();
  });

  it("checks an already-online page without running /v1/test when no wake is pending", async () => {
    const harness = createHarness({
      pending: false,
      health: vi.fn().mockResolvedValue(true),
    });

    harness.controller.start();
    await settle();

    expect(harness.onInitialHealth).toHaveBeenCalledWith(true);
    expect(harness.runPendingTest).not.toHaveBeenCalled();
    expect(harness.clearPendingWake).not.toHaveBeenCalled();
  });
});
