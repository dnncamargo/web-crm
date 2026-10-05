import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {},
  doc: vi.fn(() => "crm-access-probe"),
  getDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
}));

vi.mock("../../services/firebase", () => ({ db: mocks.db }));

import {
  isFirestorePermissionDenied,
  verifyCrmAccess,
} from "./crmAccessService";

describe("CRM access probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the protected canonical CRM document", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    await verifyCrmAccess();

    expect(mocks.getDoc).toHaveBeenCalledWith("crm-access-probe");
  });

  it("recognizes Firestore permission denial without embedding the allowlist", () => {
    expect(isFirestorePermissionDenied({ code: "permission-denied" })).toBe(true);
    expect(isFirestorePermissionDenied({ code: "unavailable" })).toBe(false);
    expect(isFirestorePermissionDenied(null)).toBe(false);
  });
});
