import React from "react";
import { Trash2, User, Trophy } from "lucide-react";

const PlayerList = ({winningPattern, players, onKick, winners = [], gameStarted }) => {
  return (
    <div className="bg-gray-800 w-full md:w-80 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 bg-gray-900">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="text-pink-500" />
          Players ({players.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {players.length === 0 && (
          <p className="text-gray-500 text-center mt-10">
            Waiting for players to join...
          </p>
        )}

        {players.map((p) => (
          <div
            key={p.socketId || p.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              winners.includes(p.name)
                ? "bg-yellow-900/30 border-yellow-500"
                : "bg-gray-700 border-gray-600"
            }`}
          >
            <div>
              <p className="font-bold text-white flex items-center gap-2">
                {p.name}
                {winners.includes(p.name) && (
                  <Trophy size={16} className="text-yellow-400" />
                )}
              </p>
              {/* Show "To Go" count if available, default to 24 when game starts */}
              <p className="text-xs text-gray-400">
                {gameStarted && !winners.includes(p.name)
                  ? `${p.remaining !== undefined ? p.remaining : winningPattern} to win`
                  : gameStarted && winners.includes(p.name)
                    ? "BINGO!"
                    : "Ready"}
              </p>
            </div>

            {onKick && (
              <button
                onClick={() => onKick(p.socketId)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-full transition-colors"
                title="Kick Player"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;
