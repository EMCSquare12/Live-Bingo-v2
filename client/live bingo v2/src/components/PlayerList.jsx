import React, { useState } from "react";
import {
  Trash2,
  User,
  Trophy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
// Helper to get colors based on BINGO number affiliation
const getNumberColorClasses = (num) => {
  if (num <= 15) return "bg-red-900/50 text-red-200 border-red-700"; // B
  if (num <= 30) return "bg-yellow-900/50 text-yellow-200 border-yellow-700"; // I
  if (num <= 45) return "bg-green-900/50 text-green-200 border-green-700"; // N
  if (num <= 60) return "bg-blue-900/50 text-blue-200 border-blue-700"; // G
  return "bg-purple-900/50 text-purple-200 border-purple-700"; // O
};

const PlayerList = ({
  players,
  onKick,
  winners = [],
  gameStarted,
  winningPattern = [],
}) => {
  // Store the IDs of players whose remaining numbers are currently visible
  const [viewedPlayers, setViewedPlayers] = useState(new Set());
  const [showSpectators, setShowSpectators] = useState(false);

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  // Sort players to put winners at the top
  const sortedActivePlayers = [...activePlayers].sort((a, b) => {
    const aIndex = winners.indexOf(a.name);
    const bIndex = winners.indexOf(b.name);

    const aIsWinner = aIndex !== -1;
    const bIsWinner = bIndex !== -1;

    if (aIsWinner && bIsWinner) return aIndex - bIndex;
    if (aIsWinner) return -1;
    if (bIsWinner) return 1;
    return 0;
  });

  const toggleView = (id) => {
    setViewedPlayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getRankText = (name) => {
    const index = winners.indexOf(name);
    if (index === 0) return "1st BINGO! 🏆";
    if (index === 1) return "2nd Place 🥈";
    if (index === 2) return "3rd Place 🥉";
    return `${index + 1}th Place 🏅`;
  };

  const getRemainingNumbers = (player) => {
    if (
      !player.cardMatrix ||
      !player.cardMatrix.length ||
      !player.markedIndices ||
      !winningPattern.length
    )
      return [];

    const remainingIndices = winningPattern.filter(
      (index) => !player.markedIndices.includes(index),
    );

    return remainingIndices
      .map((index) => {
        const row = Math.floor(index / 5);
        const col = index % 5;
        return player.cardMatrix[row][col];
      })
      .filter((num) => num !== 0 && num !== null)
      .sort((a, b) => a - b);
  };

  return (
    // FIX: Added `overflow-hidden w-full` to prevent the container from blowing out screen height
    <div className="bg-gray-800 flex flex-col h-full w-full overflow-hidden">
      {/* Spectator Section */}
      {spectators.length > 0 && (
        <div className="p-4 border-b border-gray-700 bg-gray-900 shrink-0">
          <button
            onClick={() => setShowSpectators(!showSpectators)}
            className="w-full flex items-center justify-between text-sm font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
            title={showSpectators ? "Hide Spectators" : "Show Spectators"}
          >
            <div className="flex items-center gap-2">
              <Eye
                size={16}
                className={showSpectators ? "text-pink-500" : ""}
              />
              Spectators ({spectators.length})
            </div>
            {showSpectators ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {/* Toggleable List */}
          {showSpectators && (
            <div className="flex flex-col gap-2 mt-3 max-h-32 md:max-h-40 overflow-y-auto pr-1">
              {spectators.map((s) => (
                <div
                  key={s.socketId || s.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-800 border border-gray-700"
                >
                  <span className="text-sm text-gray-300 truncate">
                    {s.name}
                  </span>
                  {onKick && (
                    <button
                      onClick={() => onKick(s.socketId)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                      title="Kick Spectator"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Players Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-900 shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="text-pink-500" />
          Players ({activePlayers.length})
        </h2>
      </div>

      {/* Active Players List - flex-1 allows this to take remaining space and independently scroll! */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-24 md:pb-4">
        {sortedActivePlayers.length === 0 && (
          <p className="text-gray-500 text-center mt-10">
            Waiting for players to join...
          </p>
        )}

        {sortedActivePlayers.map((p) => {
          const isWinner = winners.includes(p.name);
          const isViewed = viewedPlayers.has(p.socketId || p.id);
          const remainingNums = isViewed ? getRemainingNumbers(p) : [];

          return (
            <div
              key={p.socketId || p.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-500 ${
                isWinner
                  ? "bg-yellow-900/30 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                  : "bg-gray-700 border-gray-600"
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white truncate">{p.name}</p>

                  {isWinner && winners.indexOf(p.name) === 0 && (
                    <Trophy size={16} className="text-yellow-400 shrink-0" />
                  )}

                  {/* Eye Toggle */}
                  {!isWinner && gameStarted && (
                    <button
                      onClick={() => toggleView(p.socketId || p.id)}
                      className="text-gray-400 hover:text-white transition-colors shrink-0 p-1"
                      title={
                        isViewed ? "Hide numbers" : "Show remaining numbers"
                      }
                    >
                      {isViewed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>

                {isViewed && gameStarted && !isWinner ? (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Needs:</p>
                    <div className="flex flex-wrap gap-1">
                      {remainingNums.length > 0 ? (
                        remainingNums.map((num) => (
                          <span
                            key={num}
                            className={`text-xs font-bold px-1.5 py-0.5 rounded border ${getNumberColorClasses(num)}`}
                          >
                            {num}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">None</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p
                    className={`text-xs mt-1 ${isWinner ? "text-yellow-400 font-bold animate-pulse" : "text-gray-400"}`}
                  >
                    {gameStarted && !isWinner
                      ? `${p.remaining !== undefined ? p.remaining : 24} to win`
                      : gameStarted && isWinner
                        ? getRankText(p.name)
                        : "Ready"}
                  </p>
                )}
              </div>

              {onKick && (
                <button
                  onClick={() => onKick(p.socketId)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-full transition-colors shrink-0"
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
