import { describe, expect, it } from "vitest";

import { packRgbaPixelsToPrintRaster } from "./printRaster";

function rgba(...pixels: Array<[number, number, number, number]>) {
  return new Uint8ClampedArray(pixels.flat());
}

describe("packRgbaPixelsToPrintRaster", () => {
  it("packs black and white pixels MSB first", () => {
    const raster = packRgbaPixelsToPrintRaster(
      8,
      1,
      rgba(
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [255, 255, 255, 255],
      ),
    );

    expect(raster.data).toEqual(new Uint8Array([0xaa]));
  });

  it("keeps non-byte-aligned rows independent with clear trailing bits", () => {
    const raster = packRgbaPixelsToPrintRaster(
      9,
      2,
      rgba(
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [255, 255, 255, 255],
      ),
    );

    expect(raster.widthDots).toBe(9);
    expect(raster.heightDots).toBe(2);
    expect(raster.data).toEqual(new Uint8Array([0x80, 0x80, 0x01, 0x00]));
  });

  it("treats transparent pixels as white", () => {
    const raster = packRgbaPixelsToPrintRaster(
      2,
      1,
      rgba(
        [0, 0, 0, 0],
        [0, 0, 0, 255],
      ),
    );

    expect(raster.data).toEqual(new Uint8Array([0x40]));
  });
});
