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

export interface CreateOrderCommand {
  orderId: string;
  clientId: string;
  clientName: string;
  addressId?: string | null;
  addressSnapshot?: {
    label: string;
    cep?: string;
    street: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city: string;
    state?: string;
    reference?: string;
  } | null;
  deliveryDateTime: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unit?: string;
    unitPriceCents: number;
    totalCents: number;
    notes?: string;
    tagIds?: string[];
  }>;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  orderStatus: "active" | "completed" | "cancelled";
  notes?: string;
  tagIds: string[];
  initialPayment?: {
    id: string;
    amountCents: number;
    receivedAt: string;
  };
  creditApplication?: {
    applyCreditCents: number;
    presentedAvailableCreditCents: number;
    presentedRevision: number;
    confirmed: true;
  };
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

const CREATE_ORDER_FIELDS = new Set([
  "orderId", "clientId", "clientName", "addressId", "addressSnapshot", "deliveryDateTime", "items",
  "subtotalCents", "deliveryFeeCents", "totalCents", "orderStatus", "notes", "tagIds",
  "initialPayment", "creditApplication",
]);
const ADDRESS_FIELDS = new Set(["label", "cep", "street", "number", "complement", "neighborhood", "city", "state", "reference"]);
const ITEM_FIELDS = new Set(["id", "productId", "productName", "quantity", "unit", "unitPriceCents", "totalCents", "notes", "tagIds"]);

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

function assertString(value: unknown, fieldName: string, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0) || value.length > 4096) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
}

function assertDeliveryDateTime(value: unknown): asserts value is string {
  assertString(value, "deliveryDateTime");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new FinancialApiError(400, "INVALID_PAYLOAD", "deliveryDateTime inválido.");

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (daysInMonth[month - 1] ?? 0)
    || hour > 23 || minute > 59 || second > 59) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "deliveryDateTime inválido.");
  }
  if (zone && zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new FinancialApiError(400, "INVALID_PAYLOAD", "deliveryDateTime inválido.");
    }
  }
}

function assertOnlyFields(value: Record<string, unknown>, fields: ReadonlySet<string>): void {
  if (Object.keys(value).some((key) => !fields.has(key))) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length > 256)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", `${fieldName} inválido.`);
  }
  return [...value];
}

function parseAddressSnapshot(value: unknown): CreateOrderCommand["addressSnapshot"] {
  if (value === null) return null;
  if (!isRecord(value)) throw new FinancialApiError(400, "INVALID_PAYLOAD", "addressSnapshot inválido.");
  assertOnlyFields(value, ADDRESS_FIELDS);
  for (const key of ["label", "street", "city"] as const) assertString(value[key], `addressSnapshot.${key}`);
  for (const key of ["cep", "number", "complement", "neighborhood", "state", "reference"] as const) {
    if (value[key] !== undefined) assertString(value[key], `addressSnapshot.${key}`, true);
  }
  return { ...value } as CreateOrderCommand["addressSnapshot"];
}

function parseOrderItems(value: unknown): CreateOrderCommand["items"] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "items inválido.");
  }
  return value.map((entry) => {
    if (!isRecord(entry)) throw new FinancialApiError(400, "INVALID_PAYLOAD", "Item inválido.");
    assertOnlyFields(entry, ITEM_FIELDS);
    assertIdentifier(entry.id, "item.id");
    assertIdentifier(entry.productId, "item.productId");
    assertString(entry.productName, "item.productName");
    const id = entry.id as string;
    const productId = entry.productId as string;
    const productName = entry.productName as string;
    if (typeof entry.quantity !== "number" || !Number.isFinite(entry.quantity) || entry.quantity <= 0) {
      throw new FinancialApiError(400, "INVALID_PAYLOAD", "item.quantity inválido.");
    }
    if (entry.unit !== undefined) assertString(entry.unit, "item.unit", true);
    if (entry.notes !== undefined) assertString(entry.notes, "item.notes", true);
    const tagIds = entry.tagIds === undefined ? undefined : parseStringArray(entry.tagIds, "item.tagIds");
    assertNonNegativeSafeInteger(entry.unitPriceCents, "item.unitPriceCents");
    assertNonNegativeSafeInteger(entry.totalCents, "item.totalCents");
    return {
      id,
      productId,
      productName,
      quantity: entry.quantity,
      ...(entry.unit === undefined ? {} : { unit: entry.unit as string }),
      unitPriceCents: entry.unitPriceCents,
      totalCents: entry.totalCents,
      ...(entry.notes === undefined ? {} : { notes: entry.notes as string }),
      ...(tagIds === undefined ? {} : { tagIds }),
    };
  });
}

function parseInitialPayment(value: unknown): CreateOrderCommand["initialPayment"] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new FinancialApiError(400, "INVALID_PAYLOAD", "initialPayment inválido.");
  assertOnlyFields(value, new Set(["id", "amountCents", "receivedAt"]));
  assertIdentifier(value.id, "initialPayment.id", 8);
  assertPositiveSafeInteger(value.amountCents, "initialPayment.amountCents");
  assertReceivedAt(value.receivedAt, "initialPayment.receivedAt", false);
  if (typeof value.receivedAt !== "string") throw new FinancialApiError(400, "INVALID_PAYLOAD", "receivedAt inválido.");
  return { id: value.id, amountCents: value.amountCents, receivedAt: value.receivedAt };
}

function parseCreditApplication(value: unknown): CreateOrderCommand["creditApplication"] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new FinancialApiError(400, "INVALID_PAYLOAD", "creditApplication inválido.");
  assertOnlyFields(value, new Set(["applyCreditCents", "presentedAvailableCreditCents", "presentedRevision", "confirmed"]));
  assertNonNegativeSafeInteger(value.applyCreditCents, "creditApplication.applyCreditCents");
  assertNonNegativeSafeInteger(value.presentedAvailableCreditCents, "presentedAvailableCreditCents");
  assertNonNegativeSafeInteger(value.presentedRevision, "presentedRevision");
  if (value.confirmed !== true) throw new FinancialApiError(400, "INVALID_PAYLOAD", "Confirmação explícita de crédito necessária.");
  return {
    applyCreditCents: value.applyCreditCents,
    presentedAvailableCreditCents: value.presentedAvailableCreditCents,
    presentedRevision: value.presentedRevision,
    confirmed: true,
  };
}

export async function parseCreateOrderCommand(request: Request): Promise<CreateOrderCommand> {
  const body = await parseBody(request);
  assertOnlyFields(body, CREATE_ORDER_FIELDS);
  assertIdentifier(body.orderId, "orderId", 8);
  assertIdentifier(body.clientId, "clientId");
  assertString(body.clientName, "clientName");
  if (body.addressId !== undefined && body.addressId !== null) assertIdentifier(body.addressId, "addressId");
  const addressSnapshot = body.addressSnapshot === undefined ? undefined : parseAddressSnapshot(body.addressSnapshot);
  assertDeliveryDateTime(body.deliveryDateTime);
  const items = parseOrderItems(body.items);
  assertNonNegativeSafeInteger(body.subtotalCents, "subtotalCents");
  assertNonNegativeSafeInteger(body.deliveryFeeCents, "deliveryFeeCents");
  assertNonNegativeSafeInteger(body.totalCents, "totalCents");
  if (!["active", "completed", "cancelled"].includes(String(body.orderStatus))) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "orderStatus inválido.");
  }
  if (body.notes !== undefined) assertString(body.notes, "notes", true);
  const tagIds = parseStringArray(body.tagIds, "tagIds");
  const initialPayment = parseInitialPayment(body.initialPayment);
  const creditApplication = parseCreditApplication(body.creditApplication);
  return {
    orderId: body.orderId,
    clientId: body.clientId,
    clientName: body.clientName,
    ...(body.addressId === undefined ? {} : { addressId: body.addressId as string | null }),
    ...(addressSnapshot === undefined ? {} : { addressSnapshot }),
    deliveryDateTime: body.deliveryDateTime,
    items,
    subtotalCents: body.subtotalCents,
    deliveryFeeCents: body.deliveryFeeCents,
    totalCents: body.totalCents,
    orderStatus: body.orderStatus as CreateOrderCommand["orderStatus"],
    ...(body.notes === undefined ? {} : { notes: body.notes as string }),
    tagIds,
    ...(initialPayment === undefined ? {} : { initialPayment }),
    ...(creditApplication === undefined ? {} : { creditApplication }),
  };
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
