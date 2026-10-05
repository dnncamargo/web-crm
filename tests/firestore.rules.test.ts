import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getFirestore } from "firebase/firestore";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const projectId = "web-crm-firestore-rules-test";
const testEnvironment: RulesTestEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
  },
});
describe("Firestore authenticated boundary", () => {
  beforeEach(async () => {
    await testEnvironment.clearFirestore();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("denies anonymous reads and writes", async () => {
    const authenticatedContext = testEnvironment.authenticatedContext("seed-user");
    const authenticatedDb = getFirestore(authenticatedContext.app);
    await authenticatedDb.doc("appSettings/theme").set({ accent: "#b87945" });
    await authenticatedDb.doc("appSettings/printing").set({ defaultPrinterId: null });
    await authenticatedDb.doc("clients/client-1").set({ name: "Cliente de teste" });

    const anonymousDb = getFirestore(testEnvironment.unauthenticatedContext().app);
    await assertFails(anonymousDb.doc("appSettings/theme").get());
    await assertFails(anonymousDb.doc("appSettings/printing").get());
    await assertFails(anonymousDb.doc("clients/client-1").get());
    await assertFails(anonymousDb.doc("clients/client-2").set({ name: "Sem acesso" }));
  });

  it("allows authenticated global settings and CRM reads/writes", async () => {
    const authenticatedDb = getFirestore(testEnvironment.authenticatedContext("crm-user").app);

    await assertSucceeds(authenticatedDb.doc("appSettings/theme").set({ accent: "#123456" }));
    await assertSucceeds(authenticatedDb.doc("clients/client-1").set({ name: "Cliente" }));
    await assertSucceeds(authenticatedDb.doc("clients/client-1").get());
    await assertSucceeds(authenticatedDb.doc("clients/client-1").update({ active: true }));

    const snapshot = await authenticatedDb.doc("clients/client-1").get();
    expect(snapshot.data()).toMatchObject({ name: "Cliente", active: true });
  });
});
