import { useEffect, useState } from "react";

import {
  createPrinter,
  listenPrintingDefault,
  listenPrinters,
  setDefaultPrinter,
  updatePrinter,
} from "./printersService";
import type {
  NewPrinterConfigurationData,
  PrinterConfiguration,
  UpdatePrinterConfigurationData,
} from "./printerTypes";
import { createLoopbackPrinterTransport } from "./loopbackPrinterTransport";
import { encodePrintJob } from "./escposEncoder";
import { createPrinterIntegrityTestJob } from "./printerIntegrityPrintJob";

const printerTransport = createLoopbackPrinterTransport();

export async function printToPrinter(
  printer: PrinterConfiguration,
  bytes: Uint8Array,
) {
  await printerTransport.print(
    {
      host: printer.host,
      port: printer.port,
    },
    bytes,
  );
}

export function usePrinters() {
  const [printers, setPrinters] = useState<PrinterConfiguration[]>([]);
  const [defaultPrinterId, setDefaultPrinterId] = useState<string | null>(null);
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [loadingPrintingSettings, setLoadingPrintingSettings] = useState(true);
  const [printersError, setPrintersError] = useState("");

  useEffect(() => {
    const unsubscribePrinters = listenPrinters(
      (loadedPrinters) => {
        setPrinters(loadedPrinters);
        setLoadingPrinters(false);
      },
      (firebaseError) => {
        setPrintersError(firebaseError.message);
        setLoadingPrinters(false);
      },
    );

    const unsubscribePrintingSettings = listenPrintingDefault(
      (loadedDefaultPrinterId) => {
        setDefaultPrinterId(loadedDefaultPrinterId);
        setLoadingPrintingSettings(false);
      },
      (firebaseError) => {
        setPrintersError(firebaseError.message);
        setLoadingPrintingSettings(false);
      },
    );

    return () => {
      unsubscribePrinters();
      unsubscribePrintingSettings();
    };
  }, []);

  async function addPrinter(data: NewPrinterConfigurationData) {
    await createPrinter(data);
  }

  async function editPrinter(
    printerId: string,
    data: UpdatePrinterConfigurationData,
  ) {
    await updatePrinter(printerId, data);
  }

  async function setPrinterActive(printer: PrinterConfiguration, active: boolean) {
    await updatePrinter(printer.id, { active });
  }

  async function chooseDefaultPrinter(printerId: string) {
    await setDefaultPrinter(printerId);
  }

  async function testPrinterConnection(printer: PrinterConfiguration) {
    await printerTransport.testConnection({
      host: printer.host,
      port: printer.port,
    });
  }

  async function printPrinterIntegrityTest(printer: PrinterConfiguration) {
    const job = createPrinterIntegrityTestJob(printer);
    const bytes = encodePrintJob(job);

    await printToPrinter(printer, bytes);
  }

  return {
    printers,
    defaultPrinterId,
    loading: loadingPrinters || loadingPrintingSettings,
    printersError,
    addPrinter,
    editPrinter,
    setPrinterActive,
    chooseDefaultPrinter,
    testPrinterConnection,
    printPrinterIntegrityTest,
    printToPrinter,
  };
}
