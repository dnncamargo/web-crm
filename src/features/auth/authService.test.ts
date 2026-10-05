import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {},
  configurePersistence: vi.fn(),
  onAuthStateChanged: vi.fn(),
  setCustomParameters: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "local",
  GoogleAuthProvider: class GoogleAuthProvider {
    customParameters?: Record<string, string>;

    setCustomParameters(parameters: Record<string, string>) {
      mocks.setCustomParameters(parameters);
      this.customParameters = parameters;
    }
  },
  onAuthStateChanged: mocks.onAuthStateChanged,
  setPersistence: mocks.configurePersistence,
  signInWithPopup: mocks.signInWithPopup,
  signOut: mocks.signOut,
}));

vi.mock("../../services/firebase", () => ({ auth: mocks.auth }));

import {
  configureAuthPersistence,
  loginWithGoogle,
  logout,
  subscribeToAuthState,
} from "./authService";

describe("authentication service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures browser-local persistence before observing auth state", async () => {
    mocks.configurePersistence.mockResolvedValue(undefined);

    await configureAuthPersistence();

    expect(mocks.configurePersistence).toHaveBeenCalledWith(mocks.auth, "local");
  });

  it("starts Google authentication with explicit account selection", async () => {
    mocks.signInWithPopup.mockResolvedValue(undefined);

    await loginWithGoogle();

    expect(mocks.setCustomParameters).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(mocks.signInWithPopup).toHaveBeenCalledWith(mocks.auth, expect.any(Object));

    const provider = mocks.signInWithPopup.mock.calls[0]?.[1] as {
      customParameters?: Record<string, string>;
    } | undefined;
    expect(provider?.customParameters).toEqual({ prompt: "select_account" });
  });

  it("subscribes to Firebase state and exposes explicit logout", async () => {
    const unsubscribe = vi.fn();
    const onChange = vi.fn();
    mocks.onAuthStateChanged.mockReturnValue(unsubscribe);
    mocks.signOut.mockResolvedValue(undefined);

    expect(subscribeToAuthState(onChange)).toBe(unsubscribe);
    await logout();

    expect(mocks.onAuthStateChanged).toHaveBeenCalledWith(mocks.auth, onChange, undefined);
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth);
  });
});
