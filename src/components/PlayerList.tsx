"use client";

import { Player } from "@/lib/randomizer";
import { v4 as uuid } from "uuid";

interface PlayerListProps {
  teamNumber: 1 | 2;
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
  maxPlayers?: number;
}

export default function PlayerList({
  teamNumber,
  players,
  onPlayersChange,
  maxPlayers = 6,
}: PlayerListProps) {
  const updateName = (id: string, name: string) => {
    onPlayersChange(players.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const removePlayer = (id: string) => {
    onPlayersChange(players.filter((p) => p.id !== id));
  };

  const addPlayer = () => {
    if (players.length >= maxPlayers) return;
    onPlayersChange([
      ...players,
      { id: uuid(), name: "", team: teamNumber },
    ]);
  };

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
        {players.map((player, idx) => (
          <div key={player.id} className="flex items-center gap-2">
            <span className="text-gray-500 text-sm w-5 text-right">
              {idx + 1}.
            </span>
            <input
              type="text"
              value={player.name}
              onChange={(e) => updateName(player.id, e.target.value)}
              placeholder={`Player ${idx + 1}`}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white placeholder:text-gray-600
                         focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500
                         transition-colors"
            />
            <button
              onClick={() => removePlayer(player.id)}
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
              title="Remove player"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {players.length < maxPlayers && (
        <button
          onClick={addPlayer}
          className="mt-3 text-sm text-gray-400 hover:text-white transition-colors
                     flex items-center gap-1"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add player
        </button>
      )}
    </div>
  );
}
