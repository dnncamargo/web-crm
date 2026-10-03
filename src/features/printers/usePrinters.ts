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

  return {
    printers,
    defaultPrinterId,
    loading: loadingPrinters || loadingPrintingSettings,
    printersError,
    addPrinter,
    editPrinter,
    setPrinterActive,
    chooseDefaultPrinter,
  };
}
