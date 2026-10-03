export type PrintJobAlignment = "left" | "center" | "right";

export interface PrintJobRaster {
  widthDots: number;
  heightDots: number;
  data: Uint8Array;
}

export type PrintJobCommand =
  | { type: "text"; text: string }
  | { type: "alignment"; alignment: PrintJobAlignment }
  | { type: "bold"; enabled: boolean }
  | {
      type: "keyValue";
      label: string;
      value: string;
      labelBold?: boolean;
      valueBold?: boolean;
    }
  | { type: "rule"; character?: string }
  | { type: "feed"; lines: number }
  | { type: "raster"; raster: PrintJobRaster }
  | { type: "cut"; mode: "partial" };

export interface PrintJob {
  columns: number;
  codePage: "cp1252";
  commands: PrintJobCommand[];
}
