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
import type { NewTagData, Tag, UpdateTagData } from "./tagTypes";

const tagsCollection = collection(db, "tags");

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

export function listenTags(
  onChange: (tags: Tag[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const tagsQuery = query(tagsCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    tagsQuery,
    (snapshot) => {
      const tags = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Tag[];

      onChange(tags);
    },
    onError
  );
}

export async function createTag(data: NewTagData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(tagsCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTag(tagId: string, data: UpdateTagData) {
  const tagRef = doc(db, "tags", tagId);
  const cleanedData = removeUndefinedFields(data);

  return updateDoc(tagRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleTagActive(tagId: string, active: boolean) {
  const tagRef = doc(db, "tags", tagId);

  return updateDoc(tagRef, {
    active,
    updatedAt: serverTimestamp(),
  });
}