import { getOrderReceiptRoute } from "../../appRoutes";
import type { OrderPrintAttempt } from "../orders/orderPrintAttempt";
import type { PendingPrintCompanionWake } from "../printers/printCompanionStorage";

export function getPendingPrintResumeRoute(
  pendingWake: PendingPrintCompanionWake | null,
  pendingPrintAttempt: OrderPrintAttempt | null,
) {
  if (
    pendingWake?.intent !== "print" ||
    pendingPrintAttempt?.intent !== "print" ||
    pendingWake.attemptId !== pendingPrintAttempt.attemptId
  ) {
    return null;
  }

  return getOrderReceiptRoute(pendingPrintAttempt.orderId);
}
