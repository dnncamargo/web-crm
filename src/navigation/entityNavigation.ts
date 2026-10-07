export interface OpenEntityNavigationState {
  openEntityId: string;
}

function isNavigationState(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createOpenEntityNavigationState(openEntityId: string): OpenEntityNavigationState {
  return { openEntityId };
}

export function getOpenEntityId(state: unknown): string | null {
  if (!isNavigationState(state) || typeof state.openEntityId !== "string" || !state.openEntityId) {
    return null;
  }

  return state.openEntityId;
}

export function clearOpenEntityNavigationState(state: unknown): Record<string, unknown> | null {
  if (!isNavigationState(state)) {
    return null;
  }

  const remainingState = { ...state };
  delete remainingState.openEntityId;

  return Object.keys(remainingState).length > 0 ? remainingState : null;
}

export function resolveEntityById<T extends { id: string }>(entities: T[], entityId: string | null) {
  if (!entityId) {
    return undefined;
  }

  return entities.find((entity) => entity.id === entityId);
}

export function shouldProcessOpenEntityNavigation(
  handledLocationKey: string | null,
  locationKey: string,
  openEntityId: string | null,
  loading: boolean,
) {
  return Boolean(openEntityId) && !loading && handledLocationKey !== locationKey;
}
