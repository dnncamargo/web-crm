import { FinancialApiError, isFinancialApiError } from "../_financial/errors.js";

export function jsonError(error: FinancialApiError): Response {
  return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export function isDeletionApiError(error: unknown): error is FinancialApiError {
  return isFinancialApiError(error);
}

export async function readId(request: Request, key: "clientId" | "orderId"): Promise<string> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Requisição inválida.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Requisição inválida.");
  }
  const id: unknown = (body as Record<string, unknown>)[key];
  if (typeof id !== "string" || id.length === 0 || id.length > 256 || id.includes("/")) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Identificador inválido.");
  }
  return id;
}
