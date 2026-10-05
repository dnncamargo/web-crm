import { describe, expect, it, vi } from "vitest";

import { createPrintCompanionResumeOwner } from "./printCompanionResumeOwner";

describe("Print Companion resume owner", () => {
  it("allows one downstream consumer for repeated lifecycle events", async () => {
    const owner = createPrintCompanionResumeOwner();
    let resolveResume: (() => void) | undefined;
    const resume = new Promise<void>((resolve) => {
      resolveResume = resolve;
    });
    const startResume = vi.fn(() => resume);
    const downstream = vi.fn(async () => undefined);

    const consume = async (attemptId: string) => {
      if (!owner.claim(attemptId)) {
        return;
      }

      try {
        await startResume();
        await downstream();
      } finally {
        owner.release(attemptId);
      }
    };

    const first = consume("attempt-a");
    const focus = consume("attempt-a");
    const pageshow = consume("attempt-a");

    expect(owner.getActiveAttemptId()).toBe("attempt-a");
    resolveResume?.();
    await Promise.all([first, focus, pageshow]);

    expect(startResume).toHaveBeenCalledTimes(1);
    expect(downstream).toHaveBeenCalledTimes(1);
    expect(owner.getActiveAttemptId()).toBeNull();
  });

  it("ignores stale releases after a replacement", () => {
    const owner = createPrintCompanionResumeOwner();

    expect(owner.claim("attempt-a")).toBe(true);
    expect(owner.claim("attempt-a")).toBe(false);
    expect(owner.claim("attempt-b")).toBe(true);

    owner.release("attempt-a");
    expect(owner.getActiveAttemptId()).toBe("attempt-b");
    owner.release("attempt-b");
    expect(owner.getActiveAttemptId()).toBeNull();
  });
});
