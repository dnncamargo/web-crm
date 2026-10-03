export interface PrinterDestination {
  host: string;
  port: number;
}

export type PrinterTransportErrorCode =
  | "bridge-unavailable"
  | "bridge-rejected"
  | "bridge-malformed-response"
  | "printer-connection-failed";

export class PrinterTransportError extends Error {
  readonly code: PrinterTransportErrorCode;
  readonly status?: number;

  constructor(
    code: PrinterTransportErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "PrinterTransportError";
    this.code = code;
    this.status = status;
  }
}

export interface PrinterTransport {
  testConnection(destination: PrinterDestination): Promise<void>;
  print(destination: PrinterDestination, bytes: Uint8Array): Promise<void>;
}
