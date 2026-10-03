import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import type {
  NewPrinterConfigurationData,
  PrinterConfiguration,
  UpdatePrinterConfigurationData,
} from "./printerTypes";

const printersCollection = collection(db, "printers");
const printingSettingsDocument = doc(db, "appSettings", "printing");

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields) as T;
  }

  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}

export function listenPrinters(
  onChange: (printers: PrinterConfiguration[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const printersQuery = query(printersCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    printersQuery,
    (snapshot) => {
      const printers = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as PrinterConfiguration[];

      onChange(printers);
    },
    onError,
  );
}

export function listenPrintingDefault(
  onChange: (defaultPrinterId: string | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    printingSettingsDocument,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      const value = snapshot.data().defaultPrinterId;
      onChange(typeof value === "string" && value ? value : null);
    },
    onError,
  );
}

export async function createPrinter(data: NewPrinterConfigurationData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(printersCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePrinter(
  printerId: string,
  data: UpdatePrinterConfigurationData,
) {
  const printerRef = doc(db, "printers", printerId);
  const cleanedData = removeUndefinedFields(data);

  if (data.active === false) {
    await runTransaction(db, async (transaction) => {
      const printerSnapshot = await transaction.get(printerRef);
      const printingSettingsSnapshot = await transaction.get(printingSettingsDocument);

      if (!printerSnapshot.exists()) {
        throw new Error("A impressora não foi encontrada.");
      }

      transaction.update(printerRef, {
        ...cleanedData,
        updatedAt: serverTimestamp(),
      });

      const defaultPrinterId = printingSettingsSnapshot.exists()
        ? printingSettingsSnapshot.data().defaultPrinterId
        : null;

      if (defaultPrinterId === printerId) {
        transaction.set(
          printingSettingsDocument,
          {
            defaultPrinterId: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    });

    return;
  }

  return updateDoc(printerRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}

export async function setDefaultPrinter(printerId: string) {
  const printerRef = doc(db, "printers", printerId);

  await runTransaction(db, async (transaction) => {
    const printerSnapshot = await transaction.get(printerRef);

    if (!printerSnapshot.exists()) {
      throw new Error("A impressora não foi encontrada.");
    }

    if (printerSnapshot.data().active !== true) {
      throw new Error("Somente uma impressora ativa pode ser definida como padrão.");
    }

    transaction.set(
      printingSettingsDocument,
      {
        defaultPrinterId: printerId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}
