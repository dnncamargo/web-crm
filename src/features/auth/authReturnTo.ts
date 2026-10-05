import type { Location } from "react-router-dom";

const INTERNAL_ORIGIN = "https://web-crm.internal";

export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return false;
  }

  try {
    decodeURIComponent(value);
    const parsed = new URL(value, INTERNAL_ORIGIN);
    return parsed.origin === INTERNAL_ORIGIN && parsed.protocol === "https:";
  } catch {
    return false;
  }
}
export function getInternalPath(location: Pick<Location, "pathname" | "search" | "hash">) {
  const value = `${location.pathname}${location.search}${location.hash}`;
  return isSafeInternalPath(value) ? value : "/";
}

export function getLoginPath(returnTo?: string | null) {
  if (!isSafeInternalPath(returnTo) || new URL(returnTo, INTERNAL_ORIGIN).pathname === "/login") {
    return "/login";
  }

  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getReturnToFromSearch(search: string) {
  try {
    const returnTo = new URLSearchParams(search).get("returnTo");
    return isSafeInternalPath(returnTo) && new URL(returnTo, INTERNAL_ORIGIN).pathname !== "/login"
      ? returnTo
      : null;
  } catch {
    return null;
  }
}

export function getAuthenticatedDestination(returnTo?: string | null) {
  return isSafeInternalPath(returnTo) && new URL(returnTo, INTERNAL_ORIGIN).pathname !== "/login"
    ? returnTo
    : "/";
}
