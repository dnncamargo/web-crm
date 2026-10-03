import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import type { PrinterConfiguration } from "../printerTypes";

interface PrinterCardProps {
  printer: PrinterConfiguration;
  isDefault: boolean;
  busy: boolean;
  onEdit: (printer: PrinterConfiguration) => void;
  onActiveChange: (printer: PrinterConfiguration, active: boolean) => Promise<void>;
  onSetDefault: (printer: PrinterConfiguration) => Promise<void>;
  onTestConnection: (printer: PrinterConfiguration) => Promise<void>;
}

export function PrinterCard({
  printer,
  isDefault,
  busy,
  onEdit,
  onActiveChange,
  onSetDefault,
  onTestConnection,
}: PrinterCardProps) {
  return (
    <Card className={printer.active ? "printer-card" : "printer-card muted-card"}>
      <div className="printer-card-header">
        <div>
          <h2>{printer.name}</h2>
          <p>{printer.model || "Modelo não informado"}</p>
        </div>

        <div className="entity-badges">
          {!printer.active && <Badge>Inativa</Badge>}
          {isDefault && <Badge>Padrão</Badge>}
        </div>
      </div>

      <div className="printer-card-details">
        <span>
          TCP/IP · {printer.host}:{printer.port}
        </span>
        <span>
          {printer.paperWidthMm} mm · ESC/POS · CP1252
        </span>
      </div>

      <div className="printer-card-footer">
        <Switch
          label={printer.active ? "Impressora ativa" : "Impressora inativa"}
          checked={printer.active}
          disabled={busy}
          onChange={(active) => onActiveChange(printer, active)}
        />

        <div className="printer-card-actions">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onTestConnection(printer)}>
            Testar conexão
          </Button>

          <Button type="button" variant="secondary" disabled={busy} onClick={() => onEdit(printer)}>
            Editar
          </Button>

          {printer.active && !isDefault && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onSetDefault(printer)}>
              Definir como padrão
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
