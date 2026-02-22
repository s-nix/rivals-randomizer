"use client";

import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";
import ImageUploader from "@/components/ImageUploader";
import ImageCropper, { CropRect } from "@/components/ImageCropper";
import PlayerList from "@/components/PlayerList";
import ConstraintPanel from "@/components/ConstraintPanel";
import ResultsDisplay from "@/components/ResultsDisplay";
import {
  Player,
  RandomizerOptions,
  RandomizerResult,
  DEFAULT_OPTIONS,
  randomizeHeroes,
} from "@/lib/randomizer";
import {
  recognizeRaw,
  recognizeWithMultiPass,
  OcrProgress,
  OcrLine,
} from "@/lib/ocr";

type Stage = "upload" | "crop" | "edit" | "results";

function createEmptyTeam(team: 1 | 2, count: number = 6): Player[] {
  return Array.from({ length: count }, () => ({
    id: uuid(),
    name: "",
    team,
  }));
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [team1, setTeam1] = useState<Player[]>(createEmptyTeam(1));
  const [team2, setTeam2] = useState<Player[]>(createEmptyTeam(2));
  const [options, setOptions] = useState<RandomizerOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<RandomizerResult | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useMultiPass, setUseMultiPass] = useState(false);
  const [preprocessedPreview, setPreprocessedPreview] = useState<string>("");
  const [rawOcrLines, setRawOcrLines] = useState<OcrLine[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // ── Step 1: Image selected → go to crop stage ──
  const handleImageSelected = useCallback((file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setStage("crop");
  }, []);

  // ── Step 2: Crop confirmed → run OCR ──
  const handleCropConfirm = useCallback(
    async (cropRect: CropRect | null) => {
      if (!imageFile) return;

      setIsProcessing(true);
      setOcrStatus("Preprocessing image...");
      setOcrProgress(0);

      try {
        const ocrFn = useMultiPass ? recognizeWithMultiPass : recognizeRaw;
        const ocrResult = await ocrFn(
          imageFile,
          (p: OcrProgress) => {
            setOcrStatus(p.status);
            setOcrProgress(Math.round(p.progress * 100));
          },
          cropRect ?? undefined
        );

        setPreprocessedPreview(ocrResult.preprocessedPreview);
        setRawOcrLines(ocrResult.rawLines);

        // Split lines into two teams
        const names: OcrLine[] = ocrResult.lines.filter(
          (l) => l.text.length > 1
        );
        const mid = Math.ceil(names.length / 2);

        const t1: Player[] = names.slice(0, mid).map((line) => ({
          id: uuid(),
          name: line.text,
          team: 1 as const,
        }));

        const t2: Player[] = names.slice(mid).map((line) => ({
          id: uuid(),
          name: line.text,
          team: 2 as const,
        }));

        // Pad to at least 1 entry each
        if (t1.length === 0) t1.push({ id: uuid(), name: "", team: 1 });
        if (t2.length === 0) t2.push({ id: uuid(), name: "", team: 2 });

        setTeam1(t1);
        setTeam2(t2);
        setStage("edit");
      } catch (err) {
        console.error("OCR failed:", err);
        setOcrStatus("OCR failed. Try manual entry instead.");
      } finally {
        setIsProcessing(false);
      }
    },
    [imageFile, useMultiPass]
  );

  // ── Manual entry ──
  const handleManualEntry = useCallback(() => {
    setTeam1(createEmptyTeam(1));
    setTeam2(createEmptyTeam(2));
    setStage("edit");
  }, []);

  // ── Randomize ──
  const handleRandomize = useCallback(() => {
    const allPlayers = [
      ...team1.filter((p) => p.name.trim()),
      ...team2.filter((p) => p.name.trim()),
    ];

    if (allPlayers.length === 0) return;

    const randomResult = randomizeHeroes(allPlayers, options);
    setResult(randomResult);
    setStage("results");
  }, [team1, team2, options]);

  // ── Re-roll ──
  const handleReroll = useCallback(() => {
    const allPlayers = [
      ...team1.filter((p) => p.name.trim()),
      ...team2.filter((p) => p.name.trim()),
    ];
    const randomResult = randomizeHeroes(allPlayers, options);
    setResult(randomResult);
  }, [team1, team2, options]);

  // ── Start over ──
  const handleStartOver = useCallback(() => {
    setStage("upload");
    setImageFile(null);
    setImagePreview("");
    setTeam1(createEmptyTeam(1));
    setTeam2(createEmptyTeam(2));
    setOptions(DEFAULT_OPTIONS);
    setResult(null);
    setOcrStatus("");
    setOcrProgress(0);
    setPreprocessedPreview("");
    setRawOcrLines([]);
  }, []);

  const filledPlayerCount =
    team1.filter((p) => p.name.trim()).length +
    team2.filter((p) => p.name.trim()).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-sm font-bold">
              R
            </div>
            <h1 className="text-xl font-bold">
              Rivals <span className="text-purple-400">Randomizer</span>
            </h1>
          </div>
          {stage !== "upload" && (
            <button
              onClick={handleStartOver}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* ── Stage: Upload ── */}
        {stage === "upload" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">
                Upload a lobby screenshot
              </h2>
              <p className="text-gray-400">
                Upload a screenshot of your Marvel Rivals custom match lobby to
                extract player names, or enter them manually.
              </p>
            </div>

            <ImageUploader
              onImageSelected={handleImageSelected}
              disabled={false}
            />

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <span className="relative bg-gray-950 px-4 text-sm text-gray-500">
                or
              </span>
            </div>

            <button
              onClick={handleManualEntry}
              className="w-full py-3 border border-gray-700 rounded-xl text-gray-300
                         hover:border-gray-500 hover:text-white transition-colors"
            >
              Enter players manually
            </button>
          </div>
        )}

        {/* ── Stage: Crop ── */}
        {stage === "crop" && imagePreview && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Select Player Names</h2>
              <p className="text-gray-400">
                Draw a box around <strong>one team&apos;s player names</strong> to
                improve OCR accuracy. Crop just the names — avoid avatars,
                ranks, and other UI.
              </p>
            </div>

            {!isProcessing ? (
              <>
                <ImageCropper
                  imageSrc={imagePreview}
                  onCropConfirm={handleCropConfirm}
                />

                {/* Multi-pass toggle */}
                <div className="flex items-center justify-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={useMultiPass}
                      onChange={(e) => setUseMultiPass(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-purple-500
                                 focus:ring-purple-500 focus:ring-offset-gray-950"
                    />
                    Multi-pass OCR (slower but more accurate)
                  </label>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">{ocrStatus}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stage: Edit Players ── */}
        {stage === "edit" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Edit Players</h2>
              <p className="text-gray-400">
                Review and edit player names for each team. Add or remove
                players as needed.
              </p>
            </div>

            {/* Debug: raw OCR lines + preprocessed image preview */}
            {(rawOcrLines.length > 0 || preprocessedPreview) && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors
                             flex items-center gap-1 mx-auto"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${showDebug ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showDebug ? "Hide" : "Show"} OCR debug info
                </button>
                {showDebug && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
                    {rawOcrLines.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Raw OCR lines (before filtering):</p>
                        <div className="text-xs font-mono space-y-0.5 max-h-[150px] overflow-y-auto">
                          {rawOcrLines.map((line, i) => (
                            <div key={i} className={`${line.confidence < 50 ? "text-red-400" : "text-gray-400"}`}>
                              [{Math.round(line.confidence)}%] {line.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {preprocessedPreview && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Cropped region sent to OCR:</p>
                        <img
                          src={preprocessedPreview}
                          alt="OCR input"
                          className="max-h-[200px] mx-auto rounded border border-gray-700"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Re-scan button */}
            {imageFile && (
              <div className="flex justify-center">
                <button
                  onClick={() => setStage("crop")}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors
                             flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.015 4.356v4.993" />
                  </svg>
                  Re-scan with different selection
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-6">
              <PlayerList
                teamNumber={1}
                players={team1}
                onPlayersChange={setTeam1}
              />
              <PlayerList
                teamNumber={2}
                players={team2}
                onPlayersChange={setTeam2}
              />
            </div>

            <ConstraintPanel options={options} onOptionsChange={setOptions} />

            <button
              onClick={handleRandomize}
              disabled={filledPlayerCount === 0}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-red-600
                         hover:from-purple-500 hover:to-red-500
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-bold rounded-xl transition-all text-lg
                         shadow-lg shadow-purple-500/20"
            >
              🎲 Randomize Heroes ({filledPlayerCount} player
              {filledPlayerCount !== 1 ? "s" : ""})
            </button>
          </div>
        )}

        {/* ── Stage: Results ── */}
        {stage === "results" && result && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Hero Assignments</h2>
              <p className="text-gray-400">
                Here are the randomized hero assignments for your custom match.
              </p>
            </div>

            <ResultsDisplay
              result={result}
              onReroll={handleReroll}
              onStartOver={handleStartOver}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          Marvel Rivals Randomizer — {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
