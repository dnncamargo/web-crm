import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
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

export async function loginWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth);
}
