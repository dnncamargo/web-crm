import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import {
  normalizeStoreProfile,
  normalizeStoreProfileForSave,
} from "./storeProfileTypes";
import type { StoreProfile, StoreProfileAddress } from "./storeProfileTypes";

const STORE_PROFILE_DOCUMENT = doc(db, "appSettings", "storeProfile");

const optionalProfileFields = ["legalName", "taxId", "phone", "email"] as const;
const addressFields = [
  "postalCode",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
] as const;

function createOptionalFieldPayload(
  profile: StoreProfile,
): Record<string, unknown> {
  return Object.fromEntries(
    optionalProfileFields.map((field) => [field, profile[field] ?? deleteField()]),
  );
}

function createAddressPayload(address?: StoreProfileAddress) {
  return Object.fromEntries(
    addressFields.map((field) => [field, address?.[field] ?? deleteField()]),
  );
}

function createPersistencePayload(profile: StoreProfile) {
  return {
    displayName: profile.displayName,
    ...createOptionalFieldPayload(profile),
    address: profile.address ? createAddressPayload(profile.address) : deleteField(),
    updatedAt: serverTimestamp(),
  };
}

export async function getStoreProfile(): Promise<StoreProfile> {
  const snapshot = await getDoc(STORE_PROFILE_DOCUMENT);

  return normalizeStoreProfile(snapshot.exists() ? snapshot.data() : undefined);
}

export async function saveStoreProfile(profile: StoreProfile): Promise<StoreProfile> {
  const normalizedProfile = normalizeStoreProfileForSave(profile);

  await setDoc(
    STORE_PROFILE_DOCUMENT,
    createPersistencePayload(normalizedProfile),
    { merge: true },
  );

  return normalizedProfile;
}
