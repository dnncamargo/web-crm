import { describe, expect, it } from "vitest";

import {
  getAuthenticatedDestination,
  getLoginPath,
  getReturnToFromSearch,
  isSafeInternalPath,
} from "./authReturnTo";

describe("authentication returnTo", () => {
  it("keeps valid internal routes and rejects external destinations", () => {
    expect(isSafeInternalPath("/pedidos/order-1/via?print=1#receipt")).toBe(true);
    expect(isSafeInternalPath("https://example.com/steal")).toBe(false);
    expect(isSafeInternalPath("//example.com/steal")).toBe(false);
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalPath("/\\/example.com/steal")).toBe(false);
  });

  it("returns to a valid protected route after login", () => {
    const route = "/configuracoes/impressoras?printer=thermal-1";
    expect(getLoginPath(route)).toBe(`/login?returnTo=${encodeURIComponent(route)}`);
    expect(getReturnToFromSearch(`?returnTo=${encodeURIComponent(route)}`)).toBe(route);
    expect(getAuthenticatedDestination(route)).toBe(route);
  });

  it("falls back to the home route for malformed or recursive returnTo", () => {
    expect(getReturnToFromSearch("?returnTo=https%3A%2F%2Fexample.com")).toBeNull();
    expect(getAuthenticatedDestination("/login")).toBe("/");
    expect(getLoginPath("/login")).toBe("/login");
  });
});
