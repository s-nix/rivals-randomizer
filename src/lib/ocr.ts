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
  /** Raw Tesseract result for debugging */
  raw: RecognizeResult;
  /** The preprocessed image as a data URL (for debugging/preview) */
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

// ── Post-processing ──

/** Common UI text in Marvel Rivals that should be filtered out */
const UI_NOISE = [
  "team", "ready", "custom", "match", "lobby", "invite", "friends",
  "start", "cancel", "leave", "settings", "chat", "voice", "mute",
  "player", "players", "vs", "spectator", "spectators", "hero",
  "select", "ban", "pick", "map", "mode", "game", "queue",
  "back", "confirm", "accept", "decline", "close", "open",
  "marvel", "rivals", "assemble", "season", "battle",
];

/** Characters commonly found in gamertags */
const GAMERTAG_PATTERN = /^[a-zA-Z0-9_\-.\s#\[\](){}|]+$/;

/**
 * Filter and clean OCR lines to extract likely player names.
 */
function postProcess(lines: OcrLine[]): OcrLine[] {
  return lines
    .map((line) => ({
      ...line,
      // Clean up common OCR artifacts
      text: line.text
        .replace(/[|]/g, "l")         // | often misread for l
        .replace(/[{}]/g, "")         // stray braces
        .replace(/\s{2,}/g, " ")     // collapse multiple spaces
        .replace(/^[\s._\-#]+/, "")  // strip leading junk
        .replace(/[\s._\-#]+$/, "")  // strip trailing junk
        .trim(),
    }))
    .filter((line) => {
      const text = line.text;

      // Too short or too long for a gamertag
      if (text.length < 2 || text.length > 30) return false;

      // Pure numbers (likely UI elements like scores or timers)
      if (/^\d+$/.test(text)) return false;

      // Single character
      if (text.length === 1) return false;

      // Known UI noise (exact match, case-insensitive)
      if (UI_NOISE.includes(text.toLowerCase())) return false;

      // Lines that are mostly non-alphanumeric (likely UI artifacts)
      const alphaCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphaCount / text.length < 0.5) return false;

      return true;
    });
}

/**
 * Run OCR on an image with preprocessing and post-processing.
 *
 * @param image - Source image
 * @param onProgress - Progress callback
 * @param cropRect - Optional crop region (natural image coordinates)
 * @param preprocessOpts - Image preprocessing options
 */
export async function recognizeImage(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  cropRect?: { x: number; y: number; width: number; height: number },
  preprocessOpts: PreprocessOptions = DEFAULT_PREPROCESS
): Promise<OcrResult> {
  // Step 1: Preprocess image
  onProgress?.({ status: "Preprocessing image...", progress: 0.05 });
  const canvas = await preprocessImage(image, preprocessOpts, cropRect);
  const preprocessedPreview = canvas.toDataURL("image/png");

  // Step 2: Convert to blob for Tesseract
  onProgress?.({ status: "Preparing for OCR...", progress: 0.1 });
  const blob = await canvasToBlob(canvas);

  // Step 3: Run Tesseract with tuned parameters
  const w = await getWorker(onProgress);

  // Configure Tesseract for better gamertag recognition
  await w.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-. #[](){}|",
    preserve_interword_spaces: "1" as any,
  });

  onProgress?.({ status: "Running OCR...", progress: 0.2 });
  const result = await w.recognize(blob);

  // Step 4: Extract lines with confidence from block/paragraph/line hierarchy
  const rawLines: OcrLine[] = [];

  if (result.data.blocks) {
    for (const block of result.data.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          const text = line.text.trim();
          if (text.length > 0) {
            rawLines.push({ text, confidence: line.confidence });
          }
        }
      }
    }
  } else {
    // Fallback: split raw text by newlines
    const textLines = result.data.text.split("\n");
    for (const text of textLines) {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        rawLines.push({ text: trimmed, confidence: result.data.confidence });
      }
    }
  }

  // Step 5: Post-process
  const cleanedLines = postProcess(rawLines);

  return {
    lines: cleanedLines,
    raw: result,
    preprocessedPreview,
  };
}

/**
 * Run multiple OCR passes with different preprocessing settings
 * and merge the best results. Use this when single-pass results are poor.
 */
export async function recognizeWithMultiPass(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<OcrResult> {
  const presets: PreprocessOptions[] = [
    // Default: high contrast, inverted (light text on dark bg)
    { ...DEFAULT_PREPROCESS },
    // Lower threshold for lighter backgrounds
    { ...DEFAULT_PREPROCESS, threshold: 100, invert: true },
    // Higher threshold, no invert (dark text on light bg)
    { ...DEFAULT_PREPROCESS, threshold: 180, invert: false },
    // Extra contrast
    { ...DEFAULT_PREPROCESS, contrast: 2.5, threshold: 120 },
  ];

  let bestResult: OcrResult | null = null;
  let bestScore = -1;

  for (let i = 0; i < presets.length; i++) {
    onProgress?.({
      status: `OCR pass ${i + 1}/${presets.length}...`,
      progress: (i / presets.length) * 0.8,
    });

    const result = await recognizeImage(image, undefined, cropRect, presets[i]);

    // Score based on total confidence and number of valid lines
    const score =
      result.lines.reduce((sum, l) => sum + l.confidence, 0) +
      result.lines.length * 10;

    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
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
