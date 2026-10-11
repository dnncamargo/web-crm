import { FinancialApiError } from "./errors.js";

export interface ApplyCreditCommand {
  operationId: string;
  clientId: string;
  orderId: string;
  applyCreditCents: number;
  presentedAvailableCreditCents: number;
  presentedRevision: number;
  confirmed: true;
}

const MAX_BODY_BYTES = 32 * 1024;
const COMMAND_FIELDS = new Set([
  "operationId",
  "clientId",
  "orderId",
  "applyCreditCents",
  "presentedAvailableCreditCents",
  "presentedRevision",
  "confirmed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(body: Record<string, unknown>): void {
  if (Object.keys(body).some((key) => !COMMAND_FIELDS.has(key))) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }
}

function assertIdentifier(value: unknown, fieldName: string, minimumLength = 1): asserts value is string {
  if (typeof value !== "string" || !new RegExp(`^[A-Za-z0-9_-]{${minimumLength},128}$`).test(value)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
}

function assertPositiveSafeInteger(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
}

function assertNonNegativeSafeInteger(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
}

export async function parseApplyCreditCommand(request: Request): Promise<ApplyCreditCommand> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  if (!isRecord(body)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  assertExactFields(body);
  assertIdentifier(body.operationId, "operationId", 8);
  assertIdentifier(body.clientId, "clientId");
  assertIdentifier(body.orderId, "orderId");
  assertPositiveSafeInteger(body.applyCreditCents, "applyCreditCents");
  assertNonNegativeSafeInteger(body.presentedAvailableCreditCents, "presentedAvailableCreditCents");
  assertNonNegativeSafeInteger(body.presentedRevision, "presentedRevision");

  if (body.confirmed !== true) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  return {
    operationId: body.operationId,
    clientId: body.clientId,
    orderId: body.orderId,
    applyCreditCents: body.applyCreditCents,
    presentedAvailableCreditCents: body.presentedAvailableCreditCents,
    presentedRevision: body.presentedRevision,
    confirmed: true,
  };
}

export function createCommandFingerprint(command: ApplyCreditCommand): string {
  return JSON.stringify(command);
}
