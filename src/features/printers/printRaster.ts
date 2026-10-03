import type { PrintJobRaster } from "./printJobTypes";

const RGBA_BYTES_PER_PIXEL = 4;
const BLACK_LUMINANCE_THRESHOLD = 128;

function assertRasterDimensions(widthDots: number, heightDots: number) {
  if (!Number.isInteger(widthDots) || widthDots <= 0) {
    throw new Error("Raster width must be a positive integer");
  }

  if (!Number.isInteger(heightDots) || heightDots <= 0) {
    throw new Error("Raster height must be a positive integer");
  }
}

export function packRgbaPixelsToPrintRaster(
  widthDots: number,
  heightDots: number,
  pixels: Uint8ClampedArray,
): PrintJobRaster {
  assertRasterDimensions(widthDots, heightDots);

  const expectedPixelBytes = widthDots * heightDots * RGBA_BYTES_PER_PIXEL;

  if (pixels.length !== expectedPixelBytes) {
    throw new Error(`RGBA pixel data must contain exactly ${expectedPixelBytes} bytes`);
  }

  const rowBytes = Math.ceil(widthDots / 8);
  const data = new Uint8Array(rowBytes * heightDots);

  for (let y = 0; y < heightDots; y += 1) {
    for (let x = 0; x < widthDots; x += 1) {
      const pixelOffset = (y * widthDots + x) * RGBA_BYTES_PER_PIXEL;
      const red = pixels[pixelOffset] ?? 0;
      const green = pixels[pixelOffset + 1] ?? 0;
      const blue = pixels[pixelOffset + 2] ?? 0;
      const alpha = pixels[pixelOffset + 3] ?? 0;
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

      if (alpha >= 128 && luminance < BLACK_LUMINANCE_THRESHOLD) {
        const byteOffset = y * rowBytes + Math.floor(x / 8);
        data[byteOffset] |= 0x80 >> (x % 8);
      }
    }
  }

  return { widthDots, heightDots, data };
}

export async function loadPrintRaster(source: string): Promise<PrintJobRaster> {
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("Não foi possível carregar o logo para impressão térmica.")),
      { once: true },
    );
    image.src = source;
  });

  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("O logo para impressão térmica não possui dimensões válidas.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar o logo para impressão térmica.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  return packRgbaPixelsToPrintRaster(
    image.naturalWidth,
    image.naturalHeight,
    context.getImageData(0, 0, canvas.width, canvas.height).data,
  );
}
