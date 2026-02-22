"use client";

import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";
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

type Stage = "edit" | "results";

function createEmptyTeam(team: 1 | 2, count: number = 6): Player[] {
  return Array.from({ length: count }, () => ({
    id: uuid(),
    name: "",
    team,
  }));
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("edit");
  const [team1, setTeam1] = useState<Player[]>(createEmptyTeam(1));
  const [team2, setTeam2] = useState<Player[]>(createEmptyTeam(2));
  const [options, setOptions] = useState<RandomizerOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<RandomizerResult | null>(null);

  // Fill in default names for empty slots
  const withDefaults = useCallback(
    (players: Player[]): Player[] =>
      players.map((p, i) => ({
        ...p,
        name: p.name.trim() || `Player ${i + 1}`,
      })),
    []
  );

  // ── Randomize ──
  const handleRandomize = useCallback(() => {
    const allPlayers = [
      ...withDefaults(team1),
      ...withDefaults(team2),
    ];

    if (allPlayers.length === 0) return;

    const randomResult = randomizeHeroes(allPlayers, options);
    setResult(randomResult);
    setStage("results");
  }, [team1, team2, options, withDefaults]);

  // ── Re-roll ──
  const handleReroll = useCallback(() => {
    const allPlayers = [
      ...withDefaults(team1),
      ...withDefaults(team2),
    ];
    const randomResult = randomizeHeroes(allPlayers, options);
    setResult(randomResult);
  }, [team1, team2, options, withDefaults]);

  // ── Start over ──
  const handleStartOver = useCallback(() => {
    setStage("edit");
    setTeam1(createEmptyTeam(1));
    setTeam2(createEmptyTeam(2));
    setOptions(DEFAULT_OPTIONS);
    setResult(null);
  }, []);

  const filledPlayerCount = team1.length + team2.length;

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
          {stage === "results" && (
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
        {/* ── Stage: Edit Players ── */}
        {stage === "edit" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Enter Players</h2>
              <p className="text-gray-400">
                Enter player names for each team. Add or remove players as
                needed.
              </p>
            </div>

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
