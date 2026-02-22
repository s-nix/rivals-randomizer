"use client";

import { Assignment, RandomizerResult, formatResults } from "@/lib/randomizer";
import { Role, ROLE_COLORS } from "@/data/heroes";
import { useState } from "react";

interface ResultsDisplayProps {
  result: RandomizerResult;
  onReroll: () => void;
  onStartOver: () => void;
}

export default function ResultsDisplay({
  result,
  onReroll,
  onStartOver,
}: ResultsDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const text = formatResults(result);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-6">
        <TeamResults teamNumber={1} assignments={result.team1} />
        <TeamResults teamNumber={2} assignments={result.team2} />
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onReroll}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold
                     rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.015 4.356v4.993"
            />
          </svg>
          Re-roll
        </button>
        <button
          onClick={copyToClipboard}
          className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold
                     rounded-lg transition-colors flex items-center gap-2"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
              Copy Results
            </>
          )}
        </button>
        <button
          onClick={onStartOver}
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold
                     rounded-lg transition-colors border border-gray-700"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

function TeamResults({
  teamNumber,
  assignments,
}: {
  teamNumber: 1 | 2;
  assignments: Assignment[];
}) {
  return (
    <div className="flex-1 min-w-[280px]">
      <h3
        className={`text-lg font-bold mb-3 ${
          teamNumber === 1 ? "text-blue-400" : "text-red-400"
        }`}
      >
        Team {teamNumber}
      </h3>
      <div className="space-y-2">
        {assignments.map((a) => (
          <div
            key={a.player.id}
            className="flex items-center gap-3 bg-gray-800/80 border border-gray-700
                       rounded-lg px-4 py-3 transition-all hover:border-gray-600"
          >
            <span className="text-gray-400 text-sm flex-shrink-0 w-24 truncate">
              {a.player.name || "Player"}
            </span>
            <span className="text-gray-600 text-sm">→</span>
            <span className="text-white font-semibold flex-1">
              {a.hero.name}
            </span>
            <HeroBadge role={a.assignedRole} />
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="text-gray-600 text-sm italic">No players</p>
        )}
      </div>
    </div>
  );
}

function HeroBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    Vanguard: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Duelist: "bg-red-500/20 text-red-400 border-red-500/30",
    Strategist: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles[role]}`}
    >
      {role}
    </span>
  );
}
