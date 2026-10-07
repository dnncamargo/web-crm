import { describe, expect, it } from "vitest";

import { filterVisibleClients } from "./clientFormatters";
import { filterClientsBySearch } from "./useClients";
import type { Client } from "./clientTypes";

const clients: Client[] = [
  {
    id: "client-ana",
    name: "Ana Souza",
    active: true,
    favorite: true,
    contactFrequency: "weekly",
    contacts: [{ id: "contact-ana", type: "whatsapp", value: "11999990000", isPrimary: true }],
    tagIds: ["vip"],
    birthDate: "1990-01-01",
  },
  {
    id: "client-bruno",
    name: "Bruno Lima",
    active: false,
    favorite: false,
    contactFrequency: "none",
    contacts: [],
    tagIds: [],
  },
  {
    id: "client-carla",
    name: "Carla Mendes",
    active: true,
    favorite: false,
    contactFrequency: "monthly",
    contacts: [],
    tagIds: [],
  },
];

describe("client search composition", () => {
  it("filters results by the search state across client fields", () => {
    expect(filterClientsBySearch(clients, "ana").map((client) => client.id)).toEqual(["client-ana"]);
    expect(filterClientsBySearch(clients, "11999990000").map((client) => client.id)).toEqual(["client-ana"]);
    expect(filterClientsBySearch(clients, "vip", { vip: "VIP" }).map((client) => client.id)).toEqual(["client-ana"]);
  });

  it("composes page filters on top of searched results", () => {
    const searchedClients = filterClientsBySearch(clients, "a");

    expect(
      filterVisibleClients(searchedClients, {
        showOnlyFavorites: false,
        showOnlyActive: true,
        showOnlyWithContactFrequency: true,
        showOnlyWithBirthDate: true,
      }).map((client) => client.id),
    ).toEqual(["client-ana"]);
  });

  it("restores the non-search result set when search is cleared", () => {
    expect(filterClientsBySearch(clients, "bruno").map((client) => client.id)).toEqual(["client-bruno"]);
    expect(filterClientsBySearch(clients, "")).toBe(clients);
  });
});
