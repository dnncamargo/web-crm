import { getFinancialAdminDb } from "../_financial/admin.js";
import { authorizeFinancialRequest } from "../_financial/auth.js";
import { FinancialApiError, isFinancialApiError } from "../_financial/errors.js";
import { assertFinancialWriteTestGate } from "../_financial/gate.js";
import { recordPaymentTransaction } from "../_financial/paymentTransactions.js";
import { parseRecordPaymentCommand } from "../_financial/validation.js";

function jsonError(error: FinancialApiError): Response {
  return Response.json({ error: { code: error.code } }, { status: error.status });
}

export async function handleRecordPaymentRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    assertFinancialWriteTestGate();
    await authorizeFinancialRequest(request);
    const command = await parseRecordPaymentCommand(request);
    return Response.json(await recordPaymentTransaction(getFinancialAdminDb(), command), { status: 200 });
  } catch (error) {
    if (isFinancialApiError(error)) return jsonError(error);
    console.error("Financial API unexpected error", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleRecordPaymentRequest(request);
}
