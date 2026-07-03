import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "../../services/firebase";
import type { Client, NewClientData, UpdateClientData } from "./clientTypes";
const clientsCollection = collection(db, "clients");
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
export function listenClients(onChange: (clients: Client[]) => void, onError: (error: Error) => void): Unsubscribe {
  const clientsQuery = query(clientsCollection, orderBy("createdAt", "desc"));
  return onSnapshot(
    clientsQuery,
    (snapshot) => {
      const clients = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as Client[];
      onChange(clients);
    },
    onError,
  );
}
export async function createClient(data: NewClientData) {
  const cleanedData = removeUndefinedFields(data);
  return addDoc(clientsCollection, { ...cleanedData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function updateClient(clientId: string, data: UpdateClientData) {
  const clientRef = doc(db, "clients", clientId);
  const cleanedData = removeUndefinedFields(data);
  return updateDoc(clientRef, { ...cleanedData, updatedAt: serverTimestamp() });
}
export async function toggleClientFavorite(clientId: string, favorite: boolean) {
  const clientRef = doc(db, "clients", clientId);
  return updateDoc(clientRef, { favorite, updatedAt: serverTimestamp() });
}
export async function toggleClientActive(clientId: string, active: boolean) {
  const clientRef = doc(db, "clients", clientId);
  return updateDoc(clientRef, { active, updatedAt: serverTimestamp() });
}
