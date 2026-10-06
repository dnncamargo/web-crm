import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

import { db } from "../../services/firebase";
import {
  isPixKeySource,
  normalizePixSettings,
} from "./pixTypes";
import type { PixSettings } from "./pixTypes";

const PIX_SETTINGS_DOCUMENT = doc(db, "appSettings", "pix");

export async function getPixSettings(): Promise<PixSettings | null> {
  const snapshot = await getDoc(PIX_SETTINGS_DOCUMENT);

  return normalizePixSettings(snapshot.exists() ? snapshot.data() : undefined);
}

export function subscribeToPixSettings(
  onChange: (settings: PixSettings | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    PIX_SETTINGS_DOCUMENT,
    (snapshot) => {
      onChange(normalizePixSettings(snapshot.exists() ? snapshot.data() : undefined));
    },
    onError,
  );
}

export async function savePixSettings(settings: PixSettings): Promise<PixSettings> {
  if (!isPixKeySource(settings.keySource)) {
    throw new Error("Selecione uma fonte para a chave Pix.");
  }

  const normalizedSettings = { keySource: settings.keySource };

  await setDoc(
    PIX_SETTINGS_DOCUMENT,
    {
      ...normalizedSettings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalizedSettings;
}
