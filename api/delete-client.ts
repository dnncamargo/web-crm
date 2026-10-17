import { authorizeFinancialRequest } from "./_financial/auth.js";
import { getFinancialAdminDb } from "./_financial/admin.js";
import { assertDeletionWriteEnabled } from "./_deletion/gate.js";
import { deleteInactiveClient } from "./_deletion/eligibility.js";
import { isDeletionApiError, jsonError, readId } from "./_deletion/request.js";

export async function POST(request: Request): Promise<Response> {
  try {
    assertDeletionWriteEnabled();
    await authorizeFinancialRequest(request);
    const clientId = await readId(request, "clientId");
    await deleteInactiveClient(getFinancialAdminDb(), clientId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isDeletionApiError(error)) return jsonError(error);
    console.error("Safe client deletion failed", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
