import { createStaticPixPayloadFromSettings } from "./pixBrCode";
import {
  PIX_KEY_SOURCE_LABELS,
  PIX_RECIPIENT_TYPE_LABELS,
  resolvePixKeyValue,
} from "./pixTypes";
import type { PixSettings, PixKeySource, PixRecipientType } from "./pixTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";

export interface PixPreviewResult {
  payload: string | null;
  error: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getMissingSourceMessage(source: PixKeySource, recipientType: PixRecipientType) {
  const recipientLabel = PIX_RECIPIENT_TYPE_LABELS[recipientType];
  const location = recipientType === "person"
    ? `no recebedor ${recipientLabel}`
    : "no Perfil da loja";

  return `${PIX_KEY_SOURCE_LABELS[source]} não informado ${location}.`;
}

export function derivePixPreview(
  previewSettings: PixSettings | null,
  storeProfile: StoreProfile | null,
): PixPreviewResult {
  if (!previewSettings || !storeProfile) {
    return { payload: null, error: "" };
  }

  if (!resolvePixKeyValue(previewSettings, storeProfile)) {
    return {
      payload: null,
      error: getMissingSourceMessage(
        previewSettings.keySource,
        previewSettings.recipientType,
      ),
    };
  }

  try {
    return {
      payload: createStaticPixPayloadFromSettings({
        settings: previewSettings,
        profile: storeProfile,
      }),
      error: "",
    };
  } catch (error: unknown) {
    return {
      payload: null,
      error: getErrorMessage(error, "Não foi possível gerar o código Pix."),
    };
  }
}
