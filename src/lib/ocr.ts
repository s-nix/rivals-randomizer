import { createWorker, Worker, RecognizeResult, PSM } from "tesseract.js";
import {
  preprocessImage,
  canvasToBlob,
  PreprocessOptions,
  DEFAULT_PREPROCESS,
} from "./preprocess";

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
}

export interface OcrResult {
  /** Cleaned, filtered lines with confidence */
  lines: OcrLine[];
  /** Raw unfiltered lines (for debugging) */
  rawLines: OcrLine[];
  /** Raw Tesseract result for debugging */
  raw: RecognizeResult;
  /** The input image Tesseract saw (for debugging/preview) — may be null for raw mode */
  preprocessedPreview: string;
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

// ── Post-processing tuned for Marvel Rivals lobby screenshots ──

/**
 * Known UI text and rank names that appear in the lobby but are NOT player names.
 */
const RANK_NAMES = [
  "bronze", "silver", "gold", "platinum", "diamond",
  "grandmaster", "celestial", "eternity", "one above all",
  "unranked",
];

const UI_WORDS = [
  "team", "ready", "custom", "match", "lobby", "invite", "friends",
  "start", "cancel", "leave", "settings", "chat", "voice", "mute",
  "player", "players", "vs", "spectator", "spectators", "hero",
  "select", "ban", "pick", "map", "mode", "game", "queue",
  "back", "confirm", "accept", "decline", "close", "open",
  "marvel", "rivals", "assemble", "season", "battle", "competitive",
  "quickplay", "practice", "overview", "social", "store",
];

/**
 * Rank pattern: rank name optionally followed by roman numerals or numbers.
 * Handles OCR misreads: I↔l↔1, II↔Il↔ll↔11, etc.
 */
const RANK_PATTERN = new RegExp(
  `^(${RANK_NAMES.join("|")})\\s*([iIl1]{1,4}|iv|v|vi{0,3}|\\d{1,2})?$`,
  "i"
);

/**
 * Filter and clean OCR lines to extract likely player names.
 */
function postProcess(lines: OcrLine[]): OcrLine[] {
  return lines
    .map((line) => ({
      ...line,
      text: cleanText(line.text),
    }))
    .filter((line) => {
      const text = line.text;

      // Too short or too long for a gamertag
      if (text.length < 2 || text.length > 30) return false;

      // Pure numbers / single chars (UI elements like "84", "100", stats)
      if (/^\d[\s\d.,]*$/.test(text)) return false;

      // Known rank lines (GRANDMASTER III, SILVER I, etc.)
      if (RANK_PATTERN.test(text)) return false;

      // UI noise words (exact match, case-insensitive)
      if (UI_WORDS.includes(text.toLowerCase())) return false;

      // Very short text that's a common OCR artifact (single letters, punctuation)
      if (text.length <= 2 && !/[a-zA-Z]{2}/.test(text)) return false;

      // Mostly non-alphanumeric (UI artifacts, icons misread as punctuation)
      const alphaCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphaCount / text.length < 0.4) return false;

      // Very low confidence lines are likely garbage
      if (line.confidence < 25) return false;

      return true;
    });
}

/**
 * Clean common OCR misreads from a text line.
 */
function cleanText(text: string): string {
  return text
    .replace(/[©®™]+/g, "")       // misread icons (© from avatar icons)
    .replace(/^[@#]+\s*/, "")      // leading @ or # from icon misreads
    .replace(/\s*[@#]+$/, "")      // trailing @ or #
    .replace(/[{}[\]]/g, "")       // stray braces/brackets
    .replace(/\s{2,}/g, " ")      // collapse multiple spaces
    .replace(/^[\s._\-:;]+/, "")  // strip leading junk (keep # for gamertags)
    .replace(/[\s._\-:;]+$/, "")  // strip trailing junk
    .trim();
}

/**
 * Extract OcrLine array from a Tesseract RecognizeResult,
 * walking the blocks→paragraphs→lines hierarchy.
 */
function extractLines(result: RecognizeResult): OcrLine[] {
  const lines: OcrLine[] = [];

  if (result.data.blocks) {
    for (const block of result.data.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          const text = line.text.trim();
          if (text.length > 0) {
            lines.push({ text, confidence: line.confidence });
          }
        }
      }
    }
  }

  // Fallback: split raw text by newlines
  if (lines.length === 0 && result.data.text) {
    for (const text of result.data.text.split("\n")) {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        lines.push({ text: trimmed, confidence: result.data.confidence });
      }
    }
  }

  return lines;
}

// ── Main OCR functions ──

/**
 * Run OCR directly on the raw image with Tesseract's built-in rectangle
 * cropping. No canvas preprocessing — avoids degrading the image.
 *
 * This is the preferred first-pass approach since Tesseract handles the
 * original screenshot quality better than our canvas preprocessing.
 */
export async function recognizeRaw(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<OcrResult> {
  onProgress?.({ status: "Preparing OCR...", progress: 0.05 });
  const w = await getWorker(onProgress);

  await w.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1" as any,
  });

  onProgress?.({ status: "Reading text...", progress: 0.2 });

  // Use Tesseract's built-in rectangle cropping (no canvas needed)
  const recognizeOpts = cropRect
    ? {
        rectangle: {
          top: Math.round(cropRect.y),
          left: Math.round(cropRect.x),
          width: Math.round(cropRect.width),
          height: Math.round(cropRect.height),
        },
      }
    : undefined;

  const result = await w.recognize(image, recognizeOpts);
  const rawLines = extractLines(result);
  const cleanedLines = postProcess(rawLines);

  // Generate a preview of what was processed (the crop region, if any)
  let preprocessedPreview = "";
  try {
    preprocessedPreview = await generateCropPreview(image, cropRect);
  } catch {
    // Preview is optional — don't fail OCR over it
  }

  return {
    lines: cleanedLines,
    rawLines,
    raw: result,
    preprocessedPreview,
  };
}

/**
 * Generate a small preview image of the crop region (for debugging UI).
 */
async function generateCropPreview(
  source: File | Blob | string,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<string> {
  const img = await loadImageElement(source);
  const sx = cropRect?.x ?? 0;
  const sy = cropRect?.y ?? 0;
  const sw = cropRect?.width ?? img.naturalWidth;
  const sh = cropRect?.height ?? img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}

function loadImageElement(src: File | Blob | string): Promise<HTMLImageElement> {
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
 * Run OCR with canvas preprocessing (scale, grayscale, contrast, etc.).
 * Use this as a fallback when raw OCR doesn't produce good results.
 */
export async function recognizeImage(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  cropRect?: { x: number; y: number; width: number; height: number },
  preprocessOpts: PreprocessOptions = DEFAULT_PREPROCESS
): Promise<OcrResult> {
  onProgress?.({ status: "Preprocessing image...", progress: 0.05 });
  const canvas = await preprocessImage(image, preprocessOpts, cropRect);
  const preprocessedPreview = canvas.toDataURL("image/png");

  onProgress?.({ status: "Preparing for OCR...", progress: 0.1 });
  const blob = await canvasToBlob(canvas);

  const w = await getWorker(onProgress);
  await w.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1" as any,
  });

  onProgress?.({ status: "Running OCR...", progress: 0.2 });
  const result = await w.recognize(blob);

  const rawLines = extractLines(result);
  const cleanedLines = postProcess(rawLines);

  return {
    lines: cleanedLines,
    rawLines,
    raw: result,
    preprocessedPreview,
  };
}

/**
 * Run multiple OCR passes and pick the best result.
 * Starts with raw (no preprocessing), then tries increasing preprocessing.
 */
export async function recognizeWithMultiPass(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<OcrResult> {
  const passes: Array<{
    label: string;
    fn: () => Promise<OcrResult>;
  }> = [
    {
      label: "Raw (no preprocessing)",
      fn: () => recognizeRaw(image, undefined, cropRect),
    },
    {
      label: "Scale 2x + grayscale",
      fn: () =>
        recognizeImage(image, undefined, cropRect, {
          ...DEFAULT_PREPROCESS,
          scale: 2,
        }),
    },
    {
      label: "Scale 2x + normalize",
      fn: () =>
        recognizeImage(image, undefined, cropRect, {
          ...DEFAULT_PREPROCESS,
          scale: 2,
          normalize: true,
        }),
    },
    {
      label: "Scale 2x + contrast 1.3",
      fn: () =>
        recognizeImage(image, undefined, cropRect, {
          ...DEFAULT_PREPROCESS,
          scale: 2,
          contrast: 1.3,
          normalize: true,
        }),
    },
  ];

  let bestResult: OcrResult | null = null;
  let bestScore = -1;

  for (let i = 0; i < passes.length; i++) {
    onProgress?.({
      status: `Pass ${i + 1}/${passes.length}: ${passes[i].label}...`,
      progress: (i / passes.length) * 0.9,
    });

    try {
      const result = await passes[i].fn();

      // Score: prefer more high-confidence lines
      const score =
        result.lines.reduce((sum, l) => sum + l.confidence, 0) +
        result.lines.length * 20;

      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    } catch {
      // Skip failed passes
    }
  }

  onProgress?.({ status: "Done", progress: 1 });
  return bestResult!;
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
