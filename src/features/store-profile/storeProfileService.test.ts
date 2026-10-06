import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {},
  deleteField: vi.fn(() => "delete-field"),
  doc: vi.fn((_database: unknown, ...path: string[]) => path.join("/")),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  deleteField: mocks.deleteField,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));

vi.mock("../../services/firebase", () => ({ db: mocks.db }));

import { getStoreProfile, saveStoreProfile } from "./storeProfileService";

describe("store profile persistence", () => {
  beforeEach(() => {
    mocks.getDoc.mockReset();
    mocks.setDoc.mockReset();
    mocks.deleteField.mockClear();
    mocks.serverTimestamp.mockClear();
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
});
