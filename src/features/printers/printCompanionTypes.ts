export const PRINT_COMPANION_API_VERSION = "1" as const;
export const PRINT_COMPANION_ORIGIN = "https://deliciasdoporto.vercel.app";
export const PRINT_COMPANION_APP_LINK =
  "https://deliciasdoporto.vercel.app/android-print-bridge/activate";

export type PrintCompanionCapability = string;

export interface PrintCompanionHealth {
  ok: true;
  state: "RUNNING" | string;
  appVersion: string;
  appVersionCode: number;
  apiVersion: string;
  capabilities: PrintCompanionCapability[];
  paired: boolean;
}

export interface PrintCompanionToken {
  token: string;
  apiVersion: typeof PRINT_COMPANION_API_VERSION;
}

export interface PrintCompanionConfig {
  idleTimeoutMinutes: number;
}

export interface PrintCompanionOperationResult {
  ok: true;
  replayed?: boolean;
  jobId?: string;
}

export type PrintCompanionErrorCode =
  | "companion_offline"
  | "companion_incompatible"
  | "missing_capability"
  | "pairing_required"
  | "pairing_expired"
  | "invalid_token"
  | "invalid_origin"
  | "queue_full"
  | "job_in_progress"
  | "job_id_conflict"
  | "printer_connection_failed"
  | "printer_timeout"
  | "payload_too_large"
  | "service_stopping"
  | "protocol_error";

export type PrintCompanionErrorCategory =
  | "COMPANION"
  | "PRINTER"
  | "AUTH"
  | "PROTOCOL";

export class PrintCompanionError extends Error {
  readonly code: PrintCompanionErrorCode;
  readonly category: PrintCompanionErrorCategory;
  readonly companionCode?: string;
  readonly status?: number;

  constructor(
    code: PrintCompanionErrorCode,
    message: string,
    options: {
      category?: PrintCompanionErrorCategory;
      companionCode?: string;
      status?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "PrintCompanionError";
    this.code = code;
    this.category = options.category ?? getPrintCompanionErrorCategory(code);
    this.companionCode = options.companionCode;
    this.status = options.status;
  }
}

export function getPrintCompanionErrorCategory(
  code: PrintCompanionErrorCode,
): PrintCompanionErrorCategory {
  if (
    code === "invalid_token" ||
    code === "pairing_required" ||
    code === "pairing_expired" ||
    code === "invalid_origin"
  ) {
    return "AUTH";
  }

  if (
    code === "printer_connection_failed" ||
    code === "printer_timeout"
  ) {
    return "PRINTER";
  }

  if (code === "protocol_error" || code === "companion_incompatible") {
    return "PROTOCOL";
  }

  return "COMPANION";
}
