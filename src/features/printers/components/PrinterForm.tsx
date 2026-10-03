import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type {
  NewPrinterConfigurationData,
  PrinterConfiguration,
} from "../printerTypes";

const DEFAULT_TRANSPORT = "tcp" as const;
const DEFAULT_PROTOCOL = "escpos" as const;
const DEFAULT_CODE_PAGE = "cp1252" as const;

interface PrinterFormProps {
  printer?: PrinterConfiguration;
  onCancel: () => void;
  onSave: (data: NewPrinterConfigurationData) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar a impressora.";
}

export function PrinterForm({ printer, onCancel, onSave }: PrinterFormProps) {
  const [name, setName] = useState(printer?.name ?? "");
  const [model, setModel] = useState(printer?.model ?? "");
  const [host, setHost] = useState(printer?.host ?? "");
  const [port, setPort] = useState(String(printer?.port ?? 9100));
  const [paperWidthMm, setPaperWidthMm] = useState(String(printer?.paperWidthMm ?? 80));
  const [printableWidthDots, setPrintableWidthDots] = useState(
    printer?.printableWidthDots === undefined ? "576" : String(printer.printableWidthDots),
  );
  const [active, setActive] = useState(printer?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const trimmedName = name.trim();
    const trimmedHost = host.trim();
    const parsedPort = Number(port);
    const parsedPaperWidthMm = Number(paperWidthMm);
    const parsedPrintableWidthDots = printableWidthDots.trim()
      ? Number(printableWidthDots)
      : undefined;

    if (!trimmedName || !trimmedHost) {
      setFormError("Informe o nome e o host da impressora.");
      return;
    }

    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setFormError("A porta deve ser um número inteiro entre 1 e 65535.");
      return;
    }

    if (!Number.isFinite(parsedPaperWidthMm) || parsedPaperWidthMm <= 0) {
      setFormError("Informe uma largura de papel válida.");
      return;
    }

    if (
      parsedPrintableWidthDots !== undefined &&
      (!Number.isInteger(parsedPrintableWidthDots) || parsedPrintableWidthDots <= 0)
    ) {
      setFormError("Informe uma largura imprimível válida ou deixe o campo vazio.");
      return;
    }

    setSaving(true);

    try {
      await onSave({
        name: trimmedName,
        model: model.trim() || undefined,
        host: trimmedHost,
        port: parsedPort,
        paperWidthMm: parsedPaperWidthMm,
        printableWidthDots: parsedPrintableWidthDots,
        transport: DEFAULT_TRANSPORT,
        protocol: DEFAULT_PROTOCOL,
        codePage: DEFAULT_CODE_PAGE,
        active,
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-1">
        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Identificação</span>
              <small>Cadastre o destino lógico usado futuramente pela impressão.</small>
            </div>

            <div className="panel-field-group">
              <label>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Balcão" autoFocus />
              </label>

              <label>
                Modelo opcional
                <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ex: TA-TP510W" />
              </label>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Destino de rede</span>
              <small>Esses dados configuram o destino usado pela ponte local de impressão.</small>
            </div>

            <div className="panel-field-group">
              <label>
                Host
                <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="Ex: impressora.local" autoComplete="off" />
              </label>

              <div className="panel-field-row">
                <label className="panel-field-card">
                  Porta
                  <input type="number" min="1" max="65535" step="1" value={port} onChange={(event) => setPort(event.target.value)} />
                </label>

                <label className="panel-field-card">
                  Transporte
                  <select value={DEFAULT_TRANSPORT} disabled aria-label="Transporte">
                    <option value={DEFAULT_TRANSPORT}>TCP</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Formato</span>
              <small>Valores canônicos para a primeira versão do destino ESC/POS.</small>
            </div>

            <div className="panel-field-group">
              <div className="panel-field-row">
                <label className="panel-field-card">
                  Protocolo
                  <select value={DEFAULT_PROTOCOL} disabled aria-label="Protocolo">
                    <option value={DEFAULT_PROTOCOL}>ESC/POS</option>
                  </select>
                </label>

                <label className="panel-field-card">
                  Code page
                  <select value={DEFAULT_CODE_PAGE} disabled aria-label="Code page">
                    <option value={DEFAULT_CODE_PAGE}>CP1252</option>
                  </select>
                </label>
              </div>

              <div className="panel-field-row">
                <label className="panel-field-card">
                  Papel (mm)
                  <input type="number" min="1" step="1" value={paperWidthMm} onChange={(event) => setPaperWidthMm(event.target.value)} />
                </label>

                <label className="panel-field-card">
                  Largura imprimível (dots)
                  <input type="number" min="1" step="1" value={printableWidthDots} onChange={(event) => setPrintableWidthDots(event.target.value)} />
                </label>
              </div>
            </div>
          </section>
        </section>
      </div>

      {formError && <p className="error-text">{formError}</p>}

      <div className="panel-mobile-switch">
        <Switch label="Impressora ativa" checked={active} onChange={setActive} disabled={saving} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Impressora ativa" checked={active} onChange={setActive} disabled={saving} />
        </div>

        <div className="panel-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || !host.trim()}>
            {saving ? "Salvando..." : printer ? "Salvar alterações" : "Salvar impressora"}
          </Button>
        </div>
      </div>
    </form>
  );
}
