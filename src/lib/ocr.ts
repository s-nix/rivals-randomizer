import { createWorker, Worker, RecognizeResult } from "tesseract.js";

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  /** All extracted lines of text */
  lines: string[];
  /** Raw Tesseract result for debugging */
  raw: RecognizeResult;
}

let worker: Worker | null = null;

async function getWorker(
  onProgress?: (p: OcrProgress) => void
): Promise<Worker> {
  if (worker) return worker;
  worker = await createWorker("eng", undefined, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.({ status: m.status, progress: m.progress });
    },
  });
  return worker;
}

/**
 * Run OCR on an image file and extract player names.
 * Returns an array of non-empty text lines.
 */
export async function recognizeImage(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrResult> {
  const w = await getWorker(onProgress);

  const result = await w.recognize(image);

  // Split into lines, trim, and filter out empties
  const lines = result.data.text
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  return { lines, raw: result };
}

/**
 * Clean up the OCR worker when done.
 */
export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
