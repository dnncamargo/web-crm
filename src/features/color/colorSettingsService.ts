import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

import { db } from "../../services/firebase";

export interface ColorSettings {
  accent: string;
}

const COLOR_SETTINGS_DOC = doc(db, "appSettings", "theme");

export const DEFAULT_ACCENT_COLOR = "#b87945";

function isValidHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeAccentColor(value?: string | null) {
  if (!value || !isValidHexColor(value)) {
    return DEFAULT_ACCENT_COLOR;
  }

  return value.toLowerCase();
}

export async function getRemoteColorSettings(): Promise<ColorSettings> {
  const snapshot = await getDoc(COLOR_SETTINGS_DOC);

  if (!snapshot.exists()) {
    return {
      accent: DEFAULT_ACCENT_COLOR,
    };
  }

  const data = snapshot.data();

  return {
    accent: normalizeAccentColor(
      typeof data.accent === "string" ? data.accent : null,
    ),
  };
}

export async function saveRemoteColorSettings(settings: ColorSettings) {
  await setDoc(
    COLOR_SETTINGS_DOC,
    {
      accent: normalizeAccentColor(settings.accent),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToRemoteColorSettings(
  onChange: (settings: ColorSettings) => void,
): Unsubscribe {
  return onSnapshot(COLOR_SETTINGS_DOC, (snapshot) => {
    if (!snapshot.exists()) {
      onChange({
        accent: DEFAULT_ACCENT_COLOR,
      });

      return;
    }

    const data = snapshot.data();

    onChange({
      accent: normalizeAccentColor(
        typeof data.accent === "string" ? data.accent : null,
      ),
    });
  });
}