import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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

export async function saveAddressForClient(
  clientId: string,
  addressId: string | null,
  data: NewAddressData,
) {
  const addressRef = addressId
    ? doc(db, "addresses", addressId)
    : doc(addressesCollection);
  const clientRef = doc(db, "clients", clientId);
  const shouldBePrimary = data.isPrimaryForClient === true;
  const cleanedData = removeUndefinedFields(data);

  await runTransaction(db, async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    const previousPrimaryId = clientSnapshot.data()?.primaryAddressId as string | null | undefined;
    const previousPrimaryRef = previousPrimaryId && previousPrimaryId !== addressRef.id
      ? doc(db, "addresses", previousPrimaryId)
      : null;
    const previousPrimarySnapshot = previousPrimaryRef
      ? await transaction.get(previousPrimaryRef)
      : null;

    if (addressId) {
      transaction.update(addressRef, {
        ...cleanedData,
        isPrimaryForClient: shouldBePrimary,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(addressRef, {
        ...cleanedData,
        clientId,
        isPrimaryForClient: shouldBePrimary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (shouldBePrimary) {
      if (previousPrimaryRef && previousPrimarySnapshot?.exists()) {
        transaction.update(previousPrimaryRef, {
          isPrimaryForClient: false,
          updatedAt: serverTimestamp(),
        });
      }

      transaction.update(clientRef, {
        primaryAddressId: addressRef.id,
        updatedAt: serverTimestamp(),
      });
    } else if (previousPrimaryId === addressRef.id) {
      transaction.update(clientRef, {
        primaryAddressId: null,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return addressRef;
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
