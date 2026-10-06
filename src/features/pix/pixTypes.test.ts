import { describe, expect, it } from "vitest";

import {
  normalizePixSettings,
  resolvePixKeyValue,
} from "./pixTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";

const profile: StoreProfile = {
  displayName: "Loja Central",
  taxId: "12.345.678/0001-90",
  phone: "(22) 99999-9999",
  email: "contato@exemplo.com",
};

describe("Pix domain contract", () => {
  it("accepts only the canonical key sources", () => {
    expect(normalizePixSettings({ keySource: "taxId" })).toEqual({ keySource: "taxId" });
    expect(normalizePixSettings({ keySource: "phone" })).toEqual({ keySource: "phone" });
    expect(normalizePixSettings({ keySource: "email" })).toEqual({ keySource: "email" });
  });

  it("treats malformed persisted sources as unconfigured", () => {
    expect(normalizePixSettings(undefined)).toBeNull();
    expect(normalizePixSettings({})).toBeNull();
    expect(normalizePixSettings({ keySource: "document" })).toBeNull();
    expect(normalizePixSettings({ keySource: "taxId", pixKey: "12.345.678/0001-90" })).toEqual({
      keySource: "taxId",
    });
  });

  it("resolves each selected value from the live Store Profile", () => {
    expect(resolvePixKeyValue({ keySource: "taxId" }, profile)).toBe("12.345.678/0001-90");
    expect(resolvePixKeyValue({ keySource: "phone" }, profile)).toBe("(22) 99999-9999");
    expect(resolvePixKeyValue({ keySource: "email" }, profile)).toBe("contato@exemplo.com");
  });

  it("returns null for absent selection or source value", () => {
    expect(resolvePixKeyValue(null, profile)).toBeNull();
    expect(resolvePixKeyValue({ keySource: "phone" }, { displayName: "Loja" })).toBeNull();
    expect(resolvePixKeyValue({ keySource: "email" }, { displayName: "Loja", email: "   " })).toBeNull();
  });
});
