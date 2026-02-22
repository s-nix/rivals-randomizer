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

// ── Post-processing tuned for Marvel Rivals lobby screenshots ──

/**
 * Known UI text and rank names that appear in the lobby but are NOT player names.
 * Matched case-insensitively. Includes partial matches via regex.
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

/** Rank pattern: rank name optionally followed by I/II/III/IV/V or a number */
const RANK_PATTERN = new RegExp(
  `^(${RANK_NAMES.join("|")})\\s*(i{1,3}|iv|v|vi{0,3}|\\d+)?$`,
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

      // Pure numbers (UI elements like "84", "100", stats)
      if (/^\d+[\s\d]*$/.test(text)) return false;

      // Known rank lines (GRANDMASTER III, SILVER I, etc.)
      if (RANK_PATTERN.test(text)) return false;

      // UI noise words (exact match)
      if (UI_WORDS.includes(text.toLowerCase())) return false;

      // Mostly non-alphanumeric (UI artifacts, icons misread as punctuation)
      const alphaCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphaCount / text.length < 0.5) return false;

      // Very low confidence lines are likely garbage
      if (line.confidence < 30) return false;

      return true;
    });
}

/**
 * Clean common OCR misreads from a text line.
 */
function cleanText(text: string): string {
  return text
    .replace(/[©®™@]+$/g, "")     // trailing misread icons (© from avatar icons)
    .replace(/^[©®™@]+/g, "")     // leading misread icons
    .replace(/[|]/g, "l")          // | often misread for l
    .replace(/[{}[\]]/g, "")       // stray braces/brackets
    .replace(/\s{2,}/g, " ")      // collapse multiple spaces
    .replace(/^[\s._\-#:;]+/, "") // strip leading junk
    .replace(/[\s._\-#:;]+$/, "") // strip trailing junk
    .trim();
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

  // Configure Tesseract for Marvel Rivals lobby text
  // Don't use char whitelist — gamertags can contain apostrophes, unicode, etc.
  // Use SINGLE_BLOCK mode since the cropped region is a block of text lines
  await w.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
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

  // Step 5: Post-process to extract player names
  const cleanedLines = postProcess(rawLines);

  return {
    lines: cleanedLines,
    rawLines,
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
    // Default: dark text on light background (Marvel Rivals lobby)
    { ...DEFAULT_PREPROCESS },
    // With binarization — threshold to isolate dark text
    { ...DEFAULT_PREPROCESS, threshold: 140 },
    // Higher contrast, no binarization
    { ...DEFAULT_PREPROCESS, contrast: 2.0, normalize: true },
    // Binarization with higher threshold for lighter text
    { ...DEFAULT_PREPROCESS, threshold: 180, contrast: 1.2 },
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
