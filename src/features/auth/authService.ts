import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";

import { auth } from "../../services/firebase";

export function configureAuthPersistence() {
  return setPersistence(auth, browserLocalPersistence);
}
export function subscribeToAuthState(
  onChange: (user: User | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, onChange, onError);
}

export async function loginWithEmailAndPassword(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}
