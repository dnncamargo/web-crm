import { describe, expect, it, vi } from "vitest";

import {
  COMPANION_IDLE_TIMEOUT_OPTIONS,
  isCompanionIdleTimeoutControlDisabled,
  saveAndApplyCompanionIdleTimeout,
} from "./companionIdleTimeout";
import { loadPrintCompanionConfig } from "../printers/printCompanionStorage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("companion idle timeout setting", () => {
  it("exposes the canonical timeout options", () => {
    expect(COMPANION_IDLE_TIMEOUT_OPTIONS).toEqual([5, 15, 30, 60, 120]);
  });

  it("persists offline without opening pairing or applying remotely", async () => {
    const storage = new MemoryStorage();
    const configure = vi.fn(async () => ({ ok: true as const }));

    const result = await saveAndApplyCompanionIdleTimeout(60, {
      companionReady: false,
      configure,
      storage,
    });

    expect(result).toMatchObject({ applied: false, config: { idleTimeoutMinutes: 60 } });
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 60 });
    expect(configure).not.toHaveBeenCalled();
  });

  it("applies an online authenticated change exactly once", async () => {
    const configure = vi.fn(async () => ({ ok: true as const }));
    const storage = new MemoryStorage();

    const result = await saveAndApplyCompanionIdleTimeout(30, {
      companionReady: true,
      configure,
      storage,
    });

    expect(result.applied).toBe(true);
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({ idleTimeoutMinutes: 30 });
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 30 });
  });

  it("preserves the saved value when immediate configure fails", async () => {
    const configure = vi.fn(async () => {
      throw new Error("companion offline");
    });
    const storage = new MemoryStorage();

    const result = await saveAndApplyCompanionIdleTimeout(120, {
      companionReady: true,
      configure,
      storage,
    });

    expect(result.applied).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 120 });
  });

  it("disables the control during an active attempt or update", () => {
    expect(isCompanionIdleTimeoutControlDisabled(true, false)).toBe(true);
    expect(isCompanionIdleTimeoutControlDisabled(false, true)).toBe(true);
    expect(isCompanionIdleTimeoutControlDisabled(false, false)).toBe(false);
  });
});
