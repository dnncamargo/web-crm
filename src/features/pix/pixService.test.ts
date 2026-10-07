import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {},
  deleteField: vi.fn(() => "delete-field"),
  doc: vi.fn((_database: unknown, ...path: string[]) => path.join("/")),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  deleteField: mocks.deleteField,
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
    mocks.deleteField.mockClear();
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

    await expect(savePixSettings({ recipientType: "business", keySource: "phone" })).resolves.toEqual({
      recipientType: "business",
      keySource: "phone",
    });

    expect(mocks.setDoc).toHaveBeenCalledWith(
      "appSettings/pix",
      {
        recipientType: "business",
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

    expect(onChange).toHaveBeenCalledWith({ recipientType: "business", keySource: "email" });
    expect(unsubscribe).toBe(mocks.unsubscribe);
  });

  it("normalizes and persists the Pix-specific Person recipient", async () => {
    mocks.setDoc.mockResolvedValue(undefined);

    await expect(savePixSettings({
      recipientType: "person",
      keySource: "phone",
      personRecipient: {
        name: " Ana Silva ",
        taxId: "",
        phone: " (22) 99999-9999 ",
        email: "",
        city: " Saquarema ",
      },
    })).resolves.toEqual({
      recipientType: "person",
      keySource: "phone",
      personRecipient: {
        name: "Ana Silva",
        phone: "(22) 99999-9999",
        city: "Saquarema",
      },
    });

    expect(mocks.setDoc).toHaveBeenCalledWith(
      "appSettings/pix",
      {
        recipientType: "person",
        keySource: "phone",
        personRecipient: {
          name: "Ana Silva",
          city: "Saquarema",
          taxId: "delete-field",
          phone: "(22) 99999-9999",
          email: "delete-field",
        },
        updatedAt: "server-timestamp",
      },
      { merge: true },
    );
  });

  it("preserves Person data when Business is selected", async () => {
    mocks.setDoc.mockResolvedValue(undefined);

    await savePixSettings({
      recipientType: "business",
      keySource: "email",
      personRecipient: { name: "Ana", city: "Campos", email: "ana@exemplo.com" },
    });

    expect(mocks.setDoc).toHaveBeenCalledWith(
      "appSettings/pix",
      expect.objectContaining({
        recipientType: "business",
        personRecipient: expect.objectContaining({
          name: "Ana",
          city: "Campos",
          email: "ana@exemplo.com",
        }),
      }),
      { merge: true },
    );
  });
});
