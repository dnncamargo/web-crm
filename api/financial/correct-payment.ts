import { getFinancialAdminDb } from "../_financial/admin.js";
import { authorizeFinancialRequest } from "../_financial/auth.js";
import { FinancialApiError, isFinancialApiError } from "../_financial/errors.js";
import { assertPaymentCorrectionWriteGate } from "../_financial/gate.js";
import {
  correctPaymentProductionTransaction,
  correctPaymentTransaction,
} from "../_financial/paymentTransactions.js";
import {
  parseCorrectPaymentCommand,
  parseProductionCorrectPaymentCommand,
} from "../_financial/validation.js";

function jsonError(error: FinancialApiError): Response {
  return Response.json({ error: { code: error.code } }, { status: error.status });
}

async function assertProductionCorrectionReady(): Promise<void> {
  const admission = await getFinancialAdminDb().doc("config/authAdmission").get();
  const allowedEmails: unknown = admission.data()?.allowedGoogleEmails;
  if (!admission.exists
    || !Array.isArray(allowedEmails)
    || !allowedEmails.some((email) => typeof email === "string" && email.trim().length > 0)) {
    throw new FinancialApiError(503, "FINANCIAL_OPERATION_DISABLED", "Operação financeira indisponível.");
  }
}

export async function handleCorrectPaymentRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    try {
      const mode = assertPaymentCorrectionWriteGate();
      if (mode === "production") await assertProductionCorrectionReady();
      return new Response(null, { status: 204 });
    } catch (error) {
      if (isFinancialApiError(error)) return jsonError(error);
      return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
  }

  if (request.method !== "POST") {
    return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    const mode = assertPaymentCorrectionWriteGate();
    await authorizeFinancialRequest(request);
    const db = getFinancialAdminDb();
    if (mode === "production") {
      const command = await parseProductionCorrectPaymentCommand(request);
      return Response.json(await correctPaymentProductionTransaction(db, command), { status: 200 });
    }
    const command = await parseCorrectPaymentCommand(request);
    return Response.json(await correctPaymentTransaction(db, command), { status: 200 });
  } catch (error) {
    if (isFinancialApiError(error)) return jsonError(error);
    console.error("Financial API unexpected error", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleCorrectPaymentRequest(request);
}

export async function GET(): Promise<Response> {
  return handleCorrectPaymentRequest(new Request("http://localhost/api/financial/correct-payment"));
}
