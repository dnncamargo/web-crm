import { describe, expect, it, vi } from "vitest";

import { createAndroidPrintDiagnosticResumeOwner } from "./androidPrintDiagnosticResumeOwner";

describe("Android diagnostic resume owner", () => {
  it("allows one downstream consumer while repeated lifecycle events reuse the owner", async () => {
    const owner = createAndroidPrintDiagnosticResumeOwner();
    let resolveResume: (() => void) | undefined;
    const resume = new Promise<void>((resolve) => {
      resolveResume = resolve;
    });
    const startResume = vi.fn(() => resume);
    const downstreamTest = vi.fn(async () => undefined);

    const consume = async (attemptId: string) => {
      if (!owner.claim(attemptId)) {
        return;
      }

      try {
        await startResume();
        await downstreamTest();
      } finally {
        owner.release(attemptId);
      }
    };

    const first = consume("attempt-a");
    const focus = consume("attempt-a");
    const pageshow = consume("attempt-a");

    expect(owner.getActiveAttemptId()).toBe("attempt-a");
    expect(downstreamTest).not.toHaveBeenCalled();

    resolveResume?.();
    await Promise.all([first, focus, pageshow]);

    expect(startResume).toHaveBeenCalledTimes(1);
    expect(downstreamTest).toHaveBeenCalledTimes(1);
    expect(owner.getActiveAttemptId()).toBeNull();
  });

  it("isolates a retry and ignores a stale release from the previous attempt", () => {
    const owner = createAndroidPrintDiagnosticResumeOwner();

    expect(owner.claim("attempt-a")).toBe(true);
    expect(owner.claim("attempt-a")).toBe(false);
    expect(owner.claim("attempt-b")).toBe(true);
    expect(owner.getActiveAttemptId()).toBe("attempt-b");

    owner.release("attempt-a");
    expect(owner.getActiveAttemptId()).toBe("attempt-b");
    expect(owner.claim("attempt-b")).toBe(false);

    owner.release("attempt-b");
    expect(owner.getActiveAttemptId()).toBeNull();
  });
});
