import { describe, expect, it } from "vitest";

import {
  DEFAULT_STORE_PROFILE,
  normalizeStoreProfile,
  normalizeStoreProfileForSave,
} from "./storeProfileTypes";

describe("store profile normalization", () => {
  it("requires a non-empty display name when saving", () => {
    expect(() => normalizeStoreProfileForSave({ displayName: "   " })).toThrow(
      "Informe o nome da loja.",
    );
  });

  it("trims optional fields and keeps a populated address", () => {
    expect(
      normalizeStoreProfileForSave({
        displayName: "  Loja Central  ",
        legalName: "  Loja Central LTDA ",
        taxId: "  12.345.678/0001-90 ",
        phone: "  (22) 99999-0000 ",
        email: "  contato@example.test ",
        address: {
          postalCode: " 28000-000 ",
          street: " Rua Principal ",
          number: " 100 ",
          complement: " ",
          neighborhood: " Centro ",
          city: " Campos ",
          state: " RJ ",
        },
      }),
    ).toEqual({
      displayName: "Loja Central",
      legalName: "Loja Central LTDA",
      taxId: "12.345.678/0001-90",
      phone: "(22) 99999-0000",
      email: "contato@example.test",
      address: {
        postalCode: "28000-000",
        street: "Rua Principal",
        number: "100",
        neighborhood: "Centro",
        city: "Campos",
        state: "RJ",
      },
    });
  });

  it("uses the existing store-facing fallback and removes empty optional values", () => {
    expect(
      normalizeStoreProfile({
        displayName: " ",
        legalName: " ",
        address: { street: " ", city: "" },
      }),
    ).toEqual(DEFAULT_STORE_PROFILE);
  });
});
