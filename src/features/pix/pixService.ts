import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

import { db } from "../../services/firebase";
import {
  isPixRecipientType,
  isPixKeySource,
  normalizePixSettings,
} from "./pixTypes";
import type { PixPersonRecipient, PixSettings } from "./pixTypes";

const PIX_SETTINGS_DOCUMENT = doc(db, "appSettings", "pix");

function createPersonRecipientPayload(personRecipient?: PixPersonRecipient) {
  if (!personRecipient) {
    return undefined;
  }

  return {
    name: personRecipient.name.trim() || deleteField(),
    city: personRecipient.city.trim() || deleteField(),
    taxId: personRecipient.taxId?.trim() || deleteField(),
    phone: personRecipient.phone?.trim() || deleteField(),
    email: personRecipient.email?.trim() || deleteField(),
  };
}

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

  if (!isPixRecipientType(settings.recipientType)) {
    throw new Error("Selecione o tipo de recebedor Pix.");
  }

  const normalizedSettings = normalizePixSettings(settings);

  if (!normalizedSettings) {
    throw new Error("Configure uma fonte válida para a chave Pix.");
  }

  const personRecipientPayload = createPersonRecipientPayload(
    normalizedSettings.personRecipient,
  );

  await setDoc(
    PIX_SETTINGS_DOCUMENT,
    {
      recipientType: normalizedSettings.recipientType,
      keySource: normalizedSettings.keySource,
      ...(personRecipientPayload ? { personRecipient: personRecipientPayload } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalizedSettings;
}
