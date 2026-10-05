import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {},
  configurePersistence: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "local",
  GoogleAuthProvider: class GoogleAuthProvider {},
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

  it("starts Google authentication without Email/Password credentials", async () => {
    mocks.signInWithPopup.mockResolvedValue(undefined);

    await loginWithGoogle();

    expect(mocks.signInWithPopup).toHaveBeenCalledWith(mocks.auth, expect.any(Object));
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
