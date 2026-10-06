import { Button } from "../../../components/ui/Button";
import { PixQrCode } from "./PixQrCode";

interface PixPaymentPreviewProps {
  payload: string;
  copyMessage: string;
  onCopy: () => void;
}

export function PixPaymentPreview({ payload, copyMessage, onCopy }: PixPaymentPreviewProps) {
  return (
    <div className="pix-preview">
      <PixQrCode payload={payload} />

      <div className="pix-copy-preview">
        <label className="panel-textarea">
          Pix Copia e Cola
          <textarea
            readOnly
            rows={6}
            value={payload}
            aria-label="Pix Copia e Cola"
          />
        </label>

        <div className="pix-copy-actions">
          <Button type="button" variant="secondary" onClick={onCopy}>
            Copiar código Pix
          </Button>
          <span className="panel-muted" aria-live="polite">{copyMessage}</span>
        </div>
      </div>
    </div>
  );
}
