import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWakeResumeController,
  POLL_INTERVAL_MS,
  WAKE_TIMEOUT_MS,
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
