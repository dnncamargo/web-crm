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

export interface RecordPaymentCommand {
  orderId: string;
  clientId: string;
  paymentId: string;
  amountCents: number;
  receivedAt: string;
  presentedAvailableCreditCents: number;
  presentedRevision: number;
}

export interface CorrectPaymentCommand {
  orderId: string;
  clientId: string;
  paymentId: string;
  expectedAmountCents: number;
  expectedReceivedAt: string | null;
  amountCents: number;
  receivedAt: string | null;
  presentedAvailableCreditCents: number;
  presentedRevision: number;
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

const RECORD_PAYMENT_FIELDS = new Set([
  "orderId",
  "clientId",
  "paymentId",
  "amountCents",
  "receivedAt",
  "presentedAvailableCreditCents",
  "presentedRevision",
]);

const CORRECT_PAYMENT_FIELDS = new Set([
  "orderId",
  "clientId",
  "paymentId",
  "expectedAmountCents",
  "expectedReceivedAt",
  "amountCents",
  "receivedAt",
  "presentedAvailableCreditCents",
  "presentedRevision",
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

function assertReceivedAt(value: unknown, fieldName: string, allowNull: boolean): asserts value is string | null {
  if (allowNull && value === null) {
    return;
  }

  const match = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!match) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number((millisecondText ?? "").padEnd(3, "0"));
  const calendarDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
    || calendarDate.getUTCHours() !== hour
    || calendarDate.getUTCMinutes() !== minute
    || calendarDate.getUTCSeconds() !== second
    || calendarDate.getUTCMilliseconds() !== millisecond
    || Number.isNaN(new Date(match[0]).getTime())) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
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

  return body;
}

export async function parseApplyCreditCommand(request: Request): Promise<ApplyCreditCommand> {
  const body = await parseBody(request);

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

export async function parseRecordPaymentCommand(request: Request): Promise<RecordPaymentCommand> {
  const body = await parseBody(request);
  if (Object.keys(body).some((key) => !RECORD_PAYMENT_FIELDS.has(key))) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }
  assertIdentifier(body.orderId, "orderId");
  assertIdentifier(body.clientId, "clientId");
  assertIdentifier(body.paymentId, "paymentId", 8);
  assertPositiveSafeInteger(body.amountCents, "amountCents");
  assertReceivedAt(body.receivedAt, "receivedAt", false);
  if (typeof body.receivedAt !== "string") {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "receivedAt inválido.");
  }
  assertNonNegativeSafeInteger(body.presentedAvailableCreditCents, "presentedAvailableCreditCents");
  assertNonNegativeSafeInteger(body.presentedRevision, "presentedRevision");

  return {
    orderId: body.orderId,
    clientId: body.clientId,
    paymentId: body.paymentId,
    amountCents: body.amountCents,
    receivedAt: body.receivedAt,
    presentedAvailableCreditCents: body.presentedAvailableCreditCents,
    presentedRevision: body.presentedRevision,
  };
}

export async function parseCorrectPaymentCommand(request: Request): Promise<CorrectPaymentCommand> {
  const body = await parseBody(request);
  if (Object.keys(body).some((key) => !CORRECT_PAYMENT_FIELDS.has(key))) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }
  assertIdentifier(body.orderId, "orderId");
  assertIdentifier(body.clientId, "clientId");
  assertIdentifier(body.paymentId, "paymentId", 8);
  assertPositiveSafeInteger(body.expectedAmountCents, "expectedAmountCents");
  assertReceivedAt(body.expectedReceivedAt, "expectedReceivedAt", true);
  assertPositiveSafeInteger(body.amountCents, "amountCents");
  assertReceivedAt(body.receivedAt, "receivedAt", true);
  assertNonNegativeSafeInteger(body.presentedAvailableCreditCents, "presentedAvailableCreditCents");
  assertNonNegativeSafeInteger(body.presentedRevision, "presentedRevision");

  return {
    orderId: body.orderId,
    clientId: body.clientId,
    paymentId: body.paymentId,
    expectedAmountCents: body.expectedAmountCents,
    expectedReceivedAt: body.expectedReceivedAt,
    amountCents: body.amountCents,
    receivedAt: body.receivedAt,
    presentedAvailableCreditCents: body.presentedAvailableCreditCents,
    presentedRevision: body.presentedRevision,
  };
}

export function createCommandFingerprint(command: ApplyCreditCommand): string {
  return JSON.stringify(command);
}
