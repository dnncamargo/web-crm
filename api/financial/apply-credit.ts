import { getFinancialAdminDb } from "../_financial/admin";
import { authorizeFinancialRequest } from "../_financial/auth";
import { applyCreditTransaction } from "../_financial/applyCredit";
import { isFinancialApiError, FinancialApiError } from "../_financial/errors";
import { assertFinancialWriteTestGate } from "../_financial/gate";
import { parseApplyCreditCommand } from "../_financial/validation";

function jsonError(error: FinancialApiError): Response {
  return Response.json({ error: { code: error.code } }, { status: error.status });
}

export async function handleApplyCreditRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    assertFinancialWriteTestGate();
    const actor = await authorizeFinancialRequest(request);
    const command = await parseApplyCreditCommand(request);
    const result = await applyCreditTransaction(getFinancialAdminDb(), command, actor);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (isFinancialApiError(error)) {
      return jsonError(error);
    }

    console.error("Financial API unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleApplyCreditRequest(request);
}
