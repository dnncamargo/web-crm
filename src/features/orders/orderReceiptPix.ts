import { createStaticPixPayloadFromSettings } from "../pix/pixBrCode";
import type { PixSettings } from "../pix/pixTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import { getOrderBalanceInfo } from "./orderUtils";
import type { Order } from "./orderTypes";

export function getOrderReceiptPixAmount(
  order: Pick<Order, "total" | "amountPaid" | "orderStatus"> & { creditApplied?: number | null },
): number | null {
  if (order.orderStatus === "cancelled") {
    return null;
  }

  const balanceInfo = getOrderBalanceInfo(order);
  return balanceInfo.type === "remaining" ? balanceInfo.amount : null;
}

export function createOrderReceiptPixPayload(
  order: Pick<Order, "total" | "amountPaid" | "orderStatus"> & { creditApplied?: number | null },
  settings: PixSettings,
  profile: StoreProfile,
): string | null {
  const amount = getOrderReceiptPixAmount(order);

  if (amount === null) {
    return null;
  }

  return createStaticPixPayloadFromSettings({
    settings,
    profile,
    amount,
  });
}
