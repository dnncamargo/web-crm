import { describe, expect, it } from "vitest";

import {
  clearOpenEntityNavigationState,
  createOpenEntityNavigationState,
  getOpenEntityId,
  resolveEntityById,
  shouldProcessOpenEntityNavigation,
} from "./entityNavigation";

describe("entity navigation state", () => {
  it("creates a transient intent containing only the selected entity id", () => {
    expect(createOpenEntityNavigationState("client-1")).toEqual({ openEntityId: "client-1" });
    expect(getOpenEntityId({ openEntityId: "client-1", entity: "client" })).toBe("client-1");
  });

  it("resolves the exact entity from the raw collection, including filtered entities", () => {
    const entities = [
      { id: "active-1", active: true },
      { id: "inactive-1", active: false },
    ];

    expect(resolveEntityById(entities, "inactive-1")).toEqual(entities[1]);
    expect(resolveEntityById(entities, "missing")).toBeUndefined();
  });

  it.each([
    ["client-1", "client"],
    ["order-1", "order"],
    ["product-1", "product"],
    ["tag-1", "tag"],
  ])("supports the global-search intent for a %s", (entityId, entityType) => {
    const entities = [{ id: entityId, type: entityType }];

    expect(resolveEntityById(entities, getOpenEntityId(createOpenEntityNavigationState(entityId)))).toEqual(entities[0]);
  });

  it("consumes the transient id while preserving unrelated navigation state", () => {
    expect(clearOpenEntityNavigationState({ openEntityId: "order-1" })).toBeNull();
    expect(clearOpenEntityNavigationState({ openEntityId: "order-1", returnTo: "/pedidos" })).toEqual({ returnTo: "/pedidos" });
    expect(getOpenEntityId(clearOpenEntityNavigationState({ openEntityId: "order-1" }))).toBeNull();
    expect(getOpenEntityId(null)).toBeNull();
  });

  it("processes an open intent once per location entry", () => {
    let handledLocationKey: string | null = null;

    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "client-1", false)).toBe(true);
    handledLocationKey = "entry-1";

    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "client-1", false)).toBe(false);
    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-2", "client-1", false)).toBe(true);
  });

  it("does not mark a loading entry and allows it after loading completes", () => {
    const handledLocationKey: string | null = null;

    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "client-1", true)).toBe(false);
    expect(handledLocationKey).toBeNull();
    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "client-1", false)).toBe(true);
  });

  it("allows a stale intent to be consumed once without replay", () => {
    let handledLocationKey: string | null = null;

    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "missing", false)).toBe(true);
    handledLocationKey = "entry-1";

    expect(shouldProcessOpenEntityNavigation(handledLocationKey, "entry-1", "missing", false)).toBe(false);
  });
});
