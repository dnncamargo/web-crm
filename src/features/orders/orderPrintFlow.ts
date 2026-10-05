import type { PrinterConfiguration } from "../printers/printerTypes";
import {
  createOrderPrintAttempt,
  createOrderPrintAttemptId,
  decodeOrderPrintAttemptBytes,
  type OrderPrintAttempt,
} from "./orderPrintAttempt";
import { PrintCompanionError } from "../printers/printCompanionTypes";
import type { PrintCompanionResumeOwner } from "../printers/printCompanionResumeOwner";

export type OrderPrintRoute = "thermal" | "browser" | "wake";

export const ORDER_RECEIPT_PRINT_LABEL = "Imprimir";
export const ORDER_RECEIPT_PRINT_BUSY_LABEL = "Imprimindo…";

interface PrintReceiptAutomaticallyOptions {
  orderId?: string;
  printer: PrinterConfiguration | null;
  createJobId: () => string;
  preflight: (printer: PrinterConfiguration) => Promise<void>;
  prepareBytes: () => Promise<Uint8Array>;
  print: (printer: PrinterConfiguration, bytes: Uint8Array, jobId: string) => Promise<void>;
  browserPrint: () => void;
  onRecoverableCompanion?: (attempt: OrderPrintAttempt) => void;
}

export interface OrderPrintResult {
  route: OrderPrintRoute;
  jobId: string;
  attempt?: OrderPrintAttempt;
}

export function isRecoverableOrderPrintCompanionError(error: unknown) {
  return (
    error instanceof PrintCompanionError &&
    (error.code === "companion_offline" ||
      error.code === "pairing_required" ||
      error.code === "service_stopping")
  );
}

export interface ResumeFrozenOrderPrintOptions {
  attempt: OrderPrintAttempt;
  owner: PrintCompanionResumeOwner;
  isCurrentAttempt: () => boolean;
  resumeCompanion: () => Promise<void>;
  preflight: (printer: PrinterConfiguration) => Promise<void>;
  print: (printer: PrinterConfiguration, bytes: Uint8Array, jobId: string) => Promise<void>;
  onSuccess: () => void;
}

export type ResumeFrozenOrderPrintResult = "ignored" | "printed";

export async function resumeFrozenOrderPrint({
  attempt,
  owner,
  isCurrentAttempt,
  resumeCompanion,
  preflight,
  print,
  onSuccess,
}: ResumeFrozenOrderPrintOptions): Promise<ResumeFrozenOrderPrintResult> {
  if (!isCurrentAttempt() || !owner.claim(attempt.attemptId)) {
    return "ignored";
  }

  try {
    await resumeCompanion();
    if (!isCurrentAttempt()) {
      return "ignored";
    }

    const bytes = decodeOrderPrintAttemptBytes(attempt);
    await preflight(attempt.printer);
    if (!isCurrentAttempt()) {
      return "ignored";
    }

    await print(attempt.printer, bytes, attempt.jobId);
    if (isCurrentAttempt()) {
      onSuccess();
    }
    return "printed";
  } finally {
    owner.release(attempt.attemptId);
  }
}

export async function printReceiptAutomatically({
  orderId,
  printer,
  createJobId,
  preflight,
  prepareBytes,
  print,
  browserPrint,
  onRecoverableCompanion,
}: PrintReceiptAutomaticallyOptions): Promise<OrderPrintResult> {
  const jobId = createJobId();

  if (!printer) {
    browserPrint();
    return { route: "browser", jobId };
  }

  let bytes: Uint8Array;
  try {
    bytes = await prepareBytes();
  } catch {
    browserPrint();
    return { route: "browser", jobId };
  }

  const attempt = createOrderPrintAttempt({
    attemptId: createOrderPrintAttemptId(),
    orderId: orderId ?? "unknown-order",
    jobId,
    printer,
    bytes,
  });

  try {
    await preflight(printer);
  } catch (error) {
    if (isRecoverableOrderPrintCompanionError(error)) {
      onRecoverableCompanion?.(attempt);
      return { route: "wake", jobId, attempt };
    }

    browserPrint();
    return { route: "browser", jobId };
  }

  let printStarted = false;
  try {
    printStarted = true;
    await print(printer, bytes, jobId);
    return { route: "thermal", jobId };
  } catch (error) {
    if (printStarted) {
      throw error;
    }

    browserPrint();
    return { route: "browser", jobId };
  }
}
