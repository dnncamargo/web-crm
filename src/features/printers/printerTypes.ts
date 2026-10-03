export type PrinterTransport = "tcp";
export type PrinterProtocol = "escpos";
export type PrinterCodePage = "cp1252";

export interface PrinterConfiguration {
  id: string;
  name: string;
  model?: string;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  host: string;
  port: number;
  paperWidthMm: number;
  printableWidthDots?: number;
  codePage: PrinterCodePage;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewPrinterConfigurationData {
  name: string;
  model?: string;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  host: string;
  port: number;
  paperWidthMm: number;
  printableWidthDots?: number;
  codePage: PrinterCodePage;
  active: boolean;
}

export type UpdatePrinterConfigurationData = Partial<NewPrinterConfigurationData>;
