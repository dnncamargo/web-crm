import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import type { Address, NewAddressData, UpdateAddressData } from "./addressTypes";

const addressesCollection = collection(db, "addresses");

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields) as T;
  }

  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}

export function listenAddresses(
  onChange: (addresses: Address[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const addressesQuery = query(
    addressesCollection,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    addressesQuery,
    (snapshot) => {
      const addresses = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Address[];

      onChange(addresses);
    },
    onError
  );
}

export async function createAddress(data: NewAddressData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(addressesCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAddress(
  addressId: string,
  data: UpdateAddressData
) {
  const addressRef = doc(db, "addresses", addressId);
  const cleanedData = removeUndefinedFields(data);

  return updateDoc(addressRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}