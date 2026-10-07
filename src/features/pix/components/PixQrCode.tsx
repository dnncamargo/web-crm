import { useCallback, useEffect, useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

export const PIX_QR_CODE_SIZE = 256;
export const PIX_QR_CODE_MARGIN_SIZE = 4;

interface PixQrCodeProps {
  payload: string;
}

export function PixQrCode({ payload }: PixQrCodeProps) {
  return (
    <div className="pix-qr-code">
      <QRCodeSVG
        value={payload}
        size={PIX_QR_CODE_SIZE}
        marginSize={PIX_QR_CODE_MARGIN_SIZE}
        title="QR Code Pix"
      />
    </div>
  );
}

interface PixQrCodeCanvasProps {
  payload: string;
  onReady: (canvas: HTMLCanvasElement) => void;
}

export function PixQrCodeCanvas({ payload, onReady }: PixQrCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    let cancelled = false;
    const notifyReady = () => {
      if (!cancelled) {
        onReady(canvas);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      const frameId = window.requestAnimationFrame(notifyReady);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frameId);
      };
    }

    const timeoutId = window.setTimeout(notifyReady, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [onReady, payload]);

  return (
    <div className="pix-qr-raster-source" aria-hidden="true">
      <QRCodeCanvas
        ref={setCanvasRef}
        value={payload}
        size={PIX_QR_CODE_SIZE}
        marginSize={PIX_QR_CODE_MARGIN_SIZE}
        title="QR Code Pix"
      />
    </div>
  );
}
