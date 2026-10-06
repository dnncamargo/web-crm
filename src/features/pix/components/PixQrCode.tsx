import { QRCodeSVG } from "qrcode.react";

interface PixQrCodeProps {
  payload: string;
}

export function PixQrCode({ payload }: PixQrCodeProps) {
  return (
    <div className="pix-qr-code">
      <QRCodeSVG
        value={payload}
        size={256}
        marginSize={4}
        title="QR Code Pix"
      />
    </div>
  );
}
