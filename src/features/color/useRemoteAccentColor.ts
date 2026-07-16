import { useEffect } from "react";

import {
  normalizeAccentColor,
  subscribeToRemoteColorSettings,
} from "./colorSettingsService";

function applyAccentColor(color: string) {
  document.documentElement.style.setProperty(
    "--accent",
    normalizeAccentColor(color),
  );
}

export function useRemoteAccentColor() {
  useEffect(() => {
    const unsubscribe = subscribeToRemoteColorSettings((settings) => {
      applyAccentColor(settings.accent);
    });

    return unsubscribe;
  }, []);
}