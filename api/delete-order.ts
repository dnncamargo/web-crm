import { authorizeFinancialRequest } from "./_financial/auth.js";
import { getFinancialAdminDb } from "./_financial/admin.js";
import { assertDeletionWriteEnabled } from "./_deletion/gate.js";
import { deleteCancelledOrder, deleteConfirmedTestOrder } from "./_deletion/eligibility.js";
import { isDeletionApiError, jsonError, readId } from "./_deletion/request.js";

export async function POST(request: Request): Promise<Response> {
  try {
    assertDeletionWriteEnabled();
    await authorizeFinancialRequest(request);
    const orderId = await readId(request, "orderId");
    const confirmation = request.headers.get("x-test-data-confirmation");
    if (confirmation !== null) {
      await deleteConfirmedTestOrder(getFinancialAdminDb(), orderId, confirmation);
    } else {
      await deleteCancelledOrder(getFinancialAdminDb(), orderId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isDeletionApiError(error)) return jsonError(error);
    console.error("Safe order deletion failed", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
