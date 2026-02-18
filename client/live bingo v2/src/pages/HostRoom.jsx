import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { Copy, XCircle, RotateCcw, Play, Settings } from "lucide-react";
import toast from "react-hot-toast";
import PlayerList from "../components/PlayerList";
import PatternPicker from "../components/PatternPicker";

const HostRoom = () => {
  const { socket, room, player, disconnectSocket } = useSocket();

  // Game State
  const [gameState, setGameState] = useState("waiting");
  const [currentNumber, setCurrentNumber] = useState(null);
  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState(null);
  console.log("Players list: ",players)

  // UI State
  const [isRolling, setIsRolling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    socket.on("update_player_list", (updatedPlayers) => {
      setPlayers(updatedPlayers.filter((p) => !p.isHost));
    });

    socket.on("game_started", () => {
      setGameState("playing");
      toast.success("Game Started! Players' cards are locked.");
    });

    socket.on("number_rolled", ({ number, history: newHistory }) => {
      // Stop animation and show number
      setIsRolling(false);
      setCurrentNumber(number);
      setHistory(newHistory);
    });

    socket.on("update_player_progress", ({ playerId, remaining }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p._id === playerId || p.socketId === playerId
            ? { ...p, remaining }
            : p,
        ),
      );
    });

    socket.on("game_over", ({ winner }) => {
      setGameState("ended");
      setWinner(winner);
      toast.success(`${winner} has BINGO!`, { duration: 5000, icon: "🏆" });
    });

    return () => {
      socket.off("update_player_list");
      socket.off("game_started");
      socket.off("number_rolled");
      socket.off("update_player_progress");
      socket.off("game_over");
    };
  }, [socket]);

  // --- ACTIONS ---

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room);
    toast.success("Room code copied!");
  };

  const handleStartGame = () => {
    if (players.length === 0) return toast.error("Wait for players to join!");
    socket.emit("start_game", { roomId: room });
  };

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);

    // Fake animation before sending request
    let i = 0;
    const interval = setInterval(() => {
      setCurrentNumber(Math.floor(Math.random() * 75) + 1);
      i++;
      if (i > 10) {
        clearInterval(interval);
        // Ask server for the REAL number
        socket.emit("roll_number", { roomId: room });
      }
    }, 100);
  };

  const handleKick = (playerSocketId) => {
    if (confirm("Kick this player?")) {
      socket.emit("kick_player", {
        roomId: room,
        targetSocketId: playerSocketId,
      });
      // Optimistic update
      setPlayers((prev) => prev.filter((p) => p.socketId !== playerSocketId));
    }
  };

  const handleRestart = () => {
    if (confirm("Restart Game? All progress will be lost.")) {
      socket.emit("restart_game", { roomId: room });
      setGameState("waiting");
      setHistory([]);
      setCurrentNumber(null);
      setWinner(null);
    }
  };

 const handleCloseRoom = () => {
    if (confirm("Close room for everyone?")) {
      disconnectSocket();
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
      {/* MAIN CONTENT (Left) */}
      <div className="flex-1 flex flex-col p-4 md:p-8 relative">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 bg-gray-800 p-4 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-500">
              Host Panel
            </h1>
            <div
              onClick={handleCopyCode}
              className="flex items-center gap-2 cursor-pointer hover:text-yellow-400 transition-colors"
            >
              <span className="font-mono text-xl tracking-widest text-gray-300">
                CODE: {room}
              </span>
              <Copy size={16} />
            </div>
          </div>

          <div className="flex gap-2">
            {gameState === "waiting" && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                title="Edit Pattern"
              >
                <Settings size={20} />
              </button>
            )}
            <button
              onClick={handleCloseRoom}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 font-bold"
            >
              <XCircle size={18} /> End
            </button>
          </div>
        </div>

        {/* SETTINGS MODAL (Conditional) */}
        {showSettings && (
          <div className="absolute top-24 right-8 z-50 bg-gray-800 p-4 border border-gray-600 rounded-xl shadow-2xl">
            <h3 className="font-bold mb-2">Edit Pattern</h3>
            <PatternPicker
              onPatternChange={(p) => {
                // Emit update immediately if game hasn't started
                socket.emit("update_pattern", { roomId: room, pattern: p });
              }}
            />
          </div>
        )}

        {/* GAME AREA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          {/* THE BIG BALL (Current Number) */}
          <div
            className={`
            w-48 h-48 rounded-full flex items-center justify-center 
            bg-gradient-to-br from-blue-600 to-purple-700 shadow-[0_0_30px_rgba(59,130,246,0.5)]
            border-4 border-white transition-all duration-300 transform
            ${isRolling ? "animate-bounce scale-110" : "scale-100"}
          `}
          >
            <span className="text-8xl font-black text-white drop-shadow-md">
              {currentNumber || "--"}
            </span>
          </div>

          {/* CONTROLS */}
          <div className="flex gap-4">
            {gameState === "waiting" ? (
              <button
                onClick={handleStartGame}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 text-xl font-bold rounded-full shadow-lg flex items-center gap-2"
              >
                <Play fill="currentColor" /> Start Game
              </button>
            ) : gameState === "ended" ? (
              <button
                onClick={handleRestart}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-xl font-bold rounded-full shadow-lg flex items-center gap-2"
              >
                <RotateCcw /> New Game
              </button>
            ) : (
              <button
                onClick={handleRoll}
                disabled={isRolling}
                className={`
                  px-12 py-4 text-2xl font-bold rounded-full shadow-lg transition-all
                  ${
                    isRolling
                      ? "bg-gray-600 cursor-not-allowed opacity-50"
                      : "bg-pink-600 hover:bg-pink-500 hover:scale-105 active:scale-95"
                  }
                `}
              >
                {isRolling ? "Rolling..." : "ROLL NUMBER"}
              </button>
            )}
          </div>
        </div>

        {/* HISTORY (Bottom) */}
        <div className="mt-8 bg-gray-800 p-4 rounded-xl h-32 overflow-y-auto">
          <h3 className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wide">
            Call History
          </h3>
          <div className="flex flex-wrap gap-2">
            {history.map((num, i) => (
              <span
                key={i}
                className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-sm font-bold border border-gray-600"
              >
                {num}
              </span>
            ))}
            {history.length === 0 && (
              <span className="text-gray-500 text-sm italic">
                No numbers called yet.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SIDEBAR (Right) */}
      <PlayerList players={players} onKick={handleKick} winnerName={winner} />
    </div>
  );
};

export default HostRoom;
