import { describe, expect, it } from "vitest";

import {
  clearPrintCompanionToken,
  loadPrintCompanionConfig,
  loadPrintCompanionToken,
  savePrintCompanionConfig,
  savePrintCompanionToken,
} from "./printCompanionStorage";

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

describe("Print Companion local storage", () => {
  it("loads, saves and clears the browser-only token", () => {
    const storage = new MemoryStorage();
    const token = { token: "secret-token", apiVersion: "1" as const };

    expect(loadPrintCompanionToken(storage)).toBeNull();
    savePrintCompanionToken(token, storage);
    expect(loadPrintCompanionToken(storage)).toEqual(token);
    clearPrintCompanionToken(storage);
    expect(loadPrintCompanionToken(storage)).toBeNull();
  });

  it("uses a validated 15-minute config default and rejects invalid values", () => {
    const storage = new MemoryStorage();

    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 15 });
    savePrintCompanionConfig({ idleTimeoutMinutes: 30 }, storage);
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 30 });
    expect(() => savePrintCompanionConfig({ idleTimeoutMinutes: 0 }, storage)).toThrow();
  });
});
