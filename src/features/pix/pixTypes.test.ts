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
    expect(normalizePixSettings({ keySource: "taxId" })).toEqual({
      recipientType: "business",
      keySource: "taxId",
    });
    expect(normalizePixSettings({ keySource: "phone" })).toEqual({
      recipientType: "business",
      keySource: "phone",
    });
    expect(normalizePixSettings({ keySource: "email" })).toEqual({
      recipientType: "business",
      keySource: "email",
    });
  });

  it("treats malformed persisted sources as unconfigured", () => {
    expect(normalizePixSettings(undefined)).toBeNull();
    expect(normalizePixSettings({})).toBeNull();
    expect(normalizePixSettings({ keySource: "document" })).toBeNull();
    expect(normalizePixSettings({ recipientType: "unknown", keySource: "phone" })).toBeNull();
    expect(normalizePixSettings({ keySource: "taxId", pixKey: "12.345.678/0001-90" })).toEqual({
      recipientType: "business",
      keySource: "taxId",
    });
  });

  it("normalizes a Person recipient without changing the conceptual taxId field", () => {
    expect(normalizePixSettings({
      recipientType: "person",
      keySource: "phone",
      personRecipient: {
        name: "  Ana Silva ",
        taxId: "",
        phone: " (22) 99999-9999 ",
        email: "   ",
        city: "  Saquarema ",
      },
    })).toEqual({
      recipientType: "person",
      keySource: "phone",
      personRecipient: {
        name: "Ana Silva",
        phone: "(22) 99999-9999",
        city: "Saquarema",
      },
    });
  });

  it("resolves each selected value from the live Store Profile", () => {
    expect(resolvePixKeyValue({ recipientType: "business", keySource: "taxId" }, profile))
      .toBe("12.345.678/0001-90");
    expect(resolvePixKeyValue({ recipientType: "business", keySource: "phone" }, profile))
      .toBe("(22) 99999-9999");
    expect(resolvePixKeyValue({ recipientType: "business", keySource: "email" }, profile))
      .toBe("contato@exemplo.com");
    expect(resolvePixKeyValue({
      recipientType: "person",
      keySource: "email",
      personRecipient: { name: "Ana", email: "ana@exemplo.com", city: "Campos" },
    }, profile)).toBe("ana@exemplo.com");
  });

  it("returns null for absent selection or source value", () => {
    expect(resolvePixKeyValue(null, profile)).toBeNull();
    expect(resolvePixKeyValue({ recipientType: "business", keySource: "phone" }, { displayName: "Loja" }))
      .toBeNull();
    expect(resolvePixKeyValue({
      recipientType: "person",
      keySource: "email",
      personRecipient: { name: "Ana", city: "Campos", email: "   " },
    }, { displayName: "Loja" })).toBeNull();
  });
});
