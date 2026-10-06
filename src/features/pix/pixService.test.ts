import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {},
  doc: vi.fn((_database: unknown, ...path: string[]) => path.join("/")),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));

vi.mock("../../services/firebase", () => ({ db: mocks.db }));

import {
  getPixSettings,
  savePixSettings,
  subscribeToPixSettings,
} from "./pixService";

describe("Pix settings persistence", () => {
  beforeEach(() => {
    mocks.getDoc.mockReset();
    mocks.onSnapshot.mockReset();
    mocks.setDoc.mockReset();
    mocks.serverTimestamp.mockClear();
    mocks.onSnapshot.mockReturnValue(mocks.unsubscribe);
  });

  it("uses the canonical appSettings/pix document", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    await getPixSettings();

    expect(mocks.getDoc).toHaveBeenCalledWith("appSettings/pix");
  });

  it("normalizes malformed persisted settings as unconfigured", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ keySource: "document" }),
    });

    await expect(getPixSettings()).resolves.toBeNull();
  });

  it("persists only the selected source and technical timestamp", async () => {
    mocks.setDoc.mockResolvedValue(undefined);

    await expect(savePixSettings({ keySource: "phone" })).resolves.toEqual({
      keySource: "phone",
    });

    expect(mocks.setDoc).toHaveBeenCalledWith(
      "appSettings/pix",
      {
        keySource: "phone",
        updatedAt: "server-timestamp",
      },
      { merge: true },
    );
  });

  it("normalizes subscribed snapshots and returns unsubscribe", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToPixSettings(onChange);
    const snapshotCallback = mocks.onSnapshot.mock.calls[0]?.[1];

    snapshotCallback?.({
      exists: () => true,
      data: () => ({ keySource: "email", resolvedKey: "contato@exemplo.com" }),
    });

    expect(onChange).toHaveBeenCalledWith({ keySource: "email" });
    expect(unsubscribe).toBe(mocks.unsubscribe);
  });
});
