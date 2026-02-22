/**
 * Canvas-based image preprocessing to improve OCR accuracy on game screenshots.
 * Converts busy, colorful game UI into clean black-on-white text.
 */

export interface PreprocessOptions {
  /** Upscale factor (2 = double resolution). Higher DPI helps Tesseract. */
  scale: number;
  /** Contrast multiplier (1.0 = no change, 2.0 = double contrast) */
  contrast: number;
  /** Binarization threshold (0-255). Pixels above become white, below become black. */
  threshold: number;
  /** Invert colors (useful when text is light on dark background, which is common in games) */
  invert: boolean;
  /** Apply sharpening kernel */
  sharpen: boolean;
}

export const DEFAULT_PREPROCESS: PreprocessOptions = {
  scale: 2,
  contrast: 1.8,
  threshold: 140,
  invert: true,
  sharpen: true,
};

/**
 * Load an image File/Blob into an HTMLImageElement.
 */
function loadImage(src: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof src === "string") {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Crop and preprocess an image for OCR.
 * If cropRect is provided, only that region is processed.
 */
export async function preprocessImage(
  source: File | Blob | string,
  opts: PreprocessOptions = DEFAULT_PREPROCESS,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<HTMLCanvasElement> {
  const img = await loadImage(source);

  // Determine source region
  const sx = cropRect?.x ?? 0;
  const sy = cropRect?.y ?? 0;
  const sw = cropRect?.width ?? img.naturalWidth;
  const sh = cropRect?.height ?? img.naturalHeight;

  // Create canvas at scaled size
  const canvas = document.createElement("canvas");
  const w = Math.round(sw * opts.scale);
  const h = Math.round(sh * opts.scale);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Draw the (cropped) source image scaled up
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Step 1: Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  // Step 2: Apply contrast
  const factor = (259 * (opts.contrast * 128 + 255)) / (255 * (259 - opts.contrast * 128));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
  }

  // Step 3: Binarize (threshold)
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > opts.threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  // Step 4: Invert if needed (Tesseract prefers dark text on light background)
  if (opts.invert) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Step 5: Sharpen (optional, applied via convolution)
  if (opts.sharpen) {
    applyConvolution(ctx, w, h, [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ]);
  }

  return canvas;
}

/**
 * Convert processed canvas to a Blob for Tesseract.
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png"
    );
  });
}

function clamp(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

/**
 * Apply a 3x3 convolution kernel to the canvas.
 */
function applyConvolution(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kernel: number[]
) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const sd = src.data;
  const dd = dst.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            val += sd[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dd[(y * w + x) * 4 + c] = clamp(val);
      }
      dd[(y * w + x) * 4 + 3] = 255; // alpha
    }
  }

  ctx.putImageData(dst, 0, 0);
}
