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
  deleteField: mocks.deleteField,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));

vi.mock("../../services/firebase", () => ({ db: mocks.db }));

import {
  getStoreProfile,
  saveStoreProfile,
  subscribeToStoreProfile,
} from "./storeProfileService";

describe("store profile persistence", () => {
  beforeEach(() => {
    mocks.getDoc.mockReset();
    mocks.onSnapshot.mockReset();
    mocks.setDoc.mockReset();
    mocks.deleteField.mockClear();
    mocks.serverTimestamp.mockClear();
    mocks.unsubscribe.mockClear();
    mocks.onSnapshot.mockReturnValue(mocks.unsubscribe);
  });

  it("uses the canonical appSettings/storeProfile document", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    await getStoreProfile();

    expect(mocks.getDoc).toHaveBeenCalledWith("appSettings/storeProfile");
  });

  it("returns the fallback when the document does not exist", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    await expect(getStoreProfile()).resolves.toEqual({
      displayName: "Delícias do Porto",
    });
  });

  it("persists trimmed values, timestamps and deletion markers for cleared fields", async () => {
    mocks.setDoc.mockResolvedValue(undefined);

    await saveStoreProfile({
      displayName: "  Loja Central ",
      legalName: " ",
      address: { street: " Rua Principal " },
    });

    expect(mocks.setDoc).toHaveBeenCalledWith(
      "appSettings/storeProfile",
      {
        displayName: "Loja Central",
        legalName: "delete-field",
        taxId: "delete-field",
        phone: "delete-field",
        email: "delete-field",
        address: {
          postalCode: "delete-field",
          street: "Rua Principal",
          number: "delete-field",
          complement: "delete-field",
          neighborhood: "delete-field",
          city: "delete-field",
          state: "delete-field",
        },
        updatedAt: "server-timestamp",
      },
      { merge: true },
    );
  });

  it("emits the canonical fallback when the subscribed document does not exist", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToStoreProfile(onChange);
    const snapshotCallback = mocks.onSnapshot.mock.calls[0]?.[1];

    snapshotCallback?.({ exists: () => false });

    expect(onChange).toHaveBeenCalledWith({ displayName: "Delícias do Porto" });
    expect(unsubscribe).toBe(mocks.unsubscribe);
  });

  it("normalizes the profile emitted by the subscribed snapshot", () => {
    const onChange = vi.fn();
    subscribeToStoreProfile(onChange);
    const snapshotCallback = mocks.onSnapshot.mock.calls[0]?.[1];

    snapshotCallback?.({
      exists: () => true,
      data: () => ({
        displayName: "  Loja Central ",
        phone: " (22) 99999-0000 ",
      }),
    });

    expect(onChange).toHaveBeenCalledWith({
      displayName: "Loja Central",
      phone: "(22) 99999-0000",
    });
  });

  it("passes subscription errors through and returns a callable unsubscribe", () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const unsubscribe = subscribeToStoreProfile(onChange, onError);
    const errorCallback = mocks.onSnapshot.mock.calls[0]?.[2];
    const error = new Error("subscription failed");

    expect(mocks.onSnapshot).toHaveBeenCalledWith(
      "appSettings/storeProfile",
      expect.any(Function),
      onError,
    );
    errorCallback?.(error);
    unsubscribe();

    expect(onError).toHaveBeenCalledWith(error);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
