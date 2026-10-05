import type { PrintCompanionConfig, PrintCompanionOperationResult } from "../printers/printCompanionTypes";
import { savePrintCompanionConfig } from "../printers/printCompanionStorage";

export const COMPANION_IDLE_TIMEOUT_OPTIONS = [5, 15, 30, 60, 120] as const;

export interface CompanionIdleTimeoutUpdateResult {
  config: PrintCompanionConfig;
  applied: boolean;
  error?: unknown;
}

interface CompanionIdleTimeoutUpdateOptions {
  companionReady: boolean;
  configure: (config: PrintCompanionConfig) => Promise<PrintCompanionOperationResult>;
  storage?: Storage;
}

export function isCompanionIdleTimeoutControlDisabled(
  attemptActive: boolean,
  updateActive: boolean,
) {
  return attemptActive || updateActive;
}

export async function saveAndApplyCompanionIdleTimeout(
  idleTimeoutMinutes: number,
  { companionReady, configure, storage }: CompanionIdleTimeoutUpdateOptions,
): Promise<CompanionIdleTimeoutUpdateResult> {
  const config = { idleTimeoutMinutes };
  savePrintCompanionConfig(config, storage);

  if (!companionReady) {
    return { config, applied: false };
  }

  try {
    await configure(config);
    return { config, applied: true };
  } catch (error) {
    return { config, applied: false, error };
  }
}
