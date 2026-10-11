export class FinancialApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "FinancialApiError";
    this.status = status;
    this.code = code;
  }
}

export function isFinancialApiError(error: unknown): error is FinancialApiError {
  return error instanceof FinancialApiError;
}
