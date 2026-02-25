import React from "react";
import { Trash2, User, Trophy } from "lucide-react";

const PlayerList = ({ players, onKick, winners = [], gameStarted }) => {
  const getRankText = (name) => {
    const index = winners.indexOf(name);
    if (index === 0) return "1st BINGO! 🏆";
    if (index === 1) return "2nd Place 🥈";
    if (index === 2) return "3rd Place 🥉";
    return `${index + 1}th Place 🏅`;
  };

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

        {players.map((p) => {
          const isWinner = winners.includes(p.name);
          return (
            <div
              key={p.socketId || p.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isWinner
                  ? "bg-yellow-900/30 border-yellow-500"
                  : "bg-gray-700 border-gray-600"
              }`}
            >
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  {p.name}
                  {isWinner && winners.indexOf(p.name) === 0 && (
                    <Trophy size={16} className="text-yellow-400" />
                  )}
                </p>
                {/* Show "To Go" count if available, default to 24 when game starts */}
                <p className="text-xs text-gray-400 mt-1">
                  {gameStarted && !isWinner
                    ? `${p.remaining !== undefined ? p.remaining : 24} to win`
                    : gameStarted && isWinner
                      ? getRankText(p.name)
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
          );
        })}
      </div>
    </div>
  );
};

export default PlayerList;
