import { useState } from "react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { PrinterCard } from "./components/PrinterCard";
import { PrinterForm } from "./components/PrinterForm";
import type {
  NewPrinterConfigurationData,
  PrinterConfiguration,
} from "./printerTypes";
import { resolveDefaultPrinter } from "./printerUtils";
import { usePrinters } from "./usePrinters";

type PrinterPanelState =
  | { type: "create" }
  | { type: "edit"; printer: PrinterConfiguration }
  | null;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}

export function PrintersPage() {
  const {
    printers,
    defaultPrinterId,
    loading,
    printersError,
    addPrinter,
    editPrinter,
    setPrinterActive,
    chooseDefaultPrinter,
    testPrinterConnection,
    printPrinterIntegrityTest,
  } = usePrinters();
  const [panel, setPanel] = useState<PrinterPanelState>(null);
  const [busyPrinterId, setBusyPrinterId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const effectiveDefaultPrinter = resolveDefaultPrinter(printers, defaultPrinterId);

  function closePanel() {
    setPanel(null);
  }

  async function handleSave(data: NewPrinterConfigurationData) {
    if (panel?.type === "edit") {
      await editPrinter(panel.printer.id, data);
    } else {
      await addPrinter(data);
    }

    closePanel();
  }

  async function handleActiveChange(printer: PrinterConfiguration, active: boolean) {
    setActionError("");
    setActionSuccess("");
    setBusyPrinterId(printer.id);

    try {
      await setPrinterActive(printer, active);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyPrinterId(null);
    }
  }

  async function handleSetDefault(printer: PrinterConfiguration) {
    setActionError("");
    setActionSuccess("");
    setBusyPrinterId(printer.id);

    try {
      await chooseDefaultPrinter(printer.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyPrinterId(null);
    }
  }

  async function handleTestConnection(printer: PrinterConfiguration) {
    setActionError("");
    setActionSuccess("");
    setBusyPrinterId(printer.id);

    try {
      await testPrinterConnection(printer);
      setActionSuccess(`Conexão com “${printer.name}” testada com sucesso.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyPrinterId(null);
    }
  }

  async function handlePrintIntegrityTest(printer: PrinterConfiguration) {
    setActionError("");
    setActionSuccess("");
    setBusyPrinterId(printer.id);

    try {
      await printPrinterIntegrityTest(printer);
      setActionSuccess(`Página de teste enviada para “${printer.name}”.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyPrinterId(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Impressoras"
        description="Configure destinos, teste a conexão e envie uma página de teste pela ponte local."
        action={
          <div className="header-actions">
            <Link className="button button-secondary" to={APP_ROUTES.diagnostic}>
              Diagnóstico
            </Link>
            <Button type="button" onClick={() => setPanel({ type: "create" })}>
              + Impressora
            </Button>
          </div>
        }
      />

      {printersError && <p className="error-text">{printersError}</p>}
      {actionError && <p className="error-text">{actionError}</p>}
      {actionSuccess && <p className="printer-feedback" aria-live="polite">{actionSuccess}</p>}

      {loading && <p className="muted-text">Carregando impressoras...</p>}

      {!loading && printers.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhuma impressora cadastrada.</strong>
            <span>Adicione uma impressora para configurar seu destino de impressão.</span>
          </div>
        </Card>
      )}

      {!loading && printers.length > 0 && (
        <div className="printer-list">
          {printers.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              isDefault={printer.id === effectiveDefaultPrinter?.id}
              busy={busyPrinterId === printer.id}
              onEdit={(selectedPrinter) => setPanel({ type: "edit", printer: selectedPrinter })}
              onActiveChange={handleActiveChange}
              onSetDefault={handleSetDefault}
              onTestConnection={handleTestConnection}
              onPrintIntegrityTest={handlePrintIntegrityTest}
            />
          ))}
        </div>
      )}

      <SlidePanel
        open={panel !== null}
        size="normal"
        title={panel?.type === "edit" ? "Editar impressora" : "Adicionar impressora"}
        description={panel?.type === "edit" ? "Atualize os dados desta configuração." : "Cadastre um destino de impressão."}
        onClose={closePanel}
      >
        <PrinterForm
          printer={panel?.type === "edit" ? panel.printer : undefined}
          onCancel={closePanel}
          onSave={handleSave}
        />
      </SlidePanel>
    </div>
  );
}
