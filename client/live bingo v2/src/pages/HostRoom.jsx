import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Copy, XCircle, RotateCcw, Play, Settings, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import PlayerList from "../components/PlayerList";
import PatternPicker from "../components/PatternPicker";

const getBingoLetter = (num) => {
  if (!num) return "";
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const HostRoom = () => {
  const { socket, room, player, disconnectSocket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const isSpectator = player?.isSpectator;

  // Initialize Game State from location.state if passed (for spectators)
  const [gameState, setGameState] = useState(
    location.state?.gameState?.status || "waiting",
  );
  const [currentNumber, setCurrentNumber] = useState(
    location.state?.gameState?.currentNumber || null,
  );
  const [history, setHistory] = useState(
    location.state?.gameState?.numbersDrawn || [],
  );
  const [players, setPlayers] = useState(
    location.state?.gameState?.players?.filter((p) => !p.isHost) || [],
  );
  const [winner, setWinner] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  // UI State
  const [isRolling, setIsRolling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // SOCKET LISTENERS
  useEffect(() => {
    if (!socket) return;

    socket.on("player_left", (msg) => {
      toast(msg, { icon: "👋" });
    });

    socket.on("game_reset", ({ message, players: updatedPlayers }) => {
      setGameState("waiting");
      setHistory([]);
      setCurrentNumber(null);
      setWinner(null);
      setIsRolling(false);
      setPlayers(updatedPlayers.filter((p) => !p.isHost));
      toast.success(message || "Game reset successfully.");
    });

    socket.on("update_player_list", (updatedPlayers) => {
      setPlayers(updatedPlayers.filter((p) => !p.isHost));
    });

    socket.on("game_started", () => {
      setGameState("playing");
      toast.success("Game Started! Players' cards are locked.");
    });

    socket.on("number_rolled", ({ number, history: newHistory }) => {
      setIsRolling(true); // Start the animation

      let i = 0;
      const interval = setInterval(() => {
        // Shuffle random numbers temporarily
        setCurrentNumber(Math.floor(Math.random() * 75) + 1);
        i++;
        if (i > 10) {
          // After ~1 second, stop shuffling and reveal the actual number
          clearInterval(interval);
          setIsRolling(false);
          setCurrentNumber(number);
          setHistory(newHistory);
        }
      }, 100);
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

    // If the host closes the room while spectating
    socket.on("room_destroyed", (message) => {
      toast.success(message);
      navigate("/");
    });

    return () => {
      socket.off("player_left");
      socket.off("update_player_list");
      socket.off("game_started");
      socket.off("number_rolled");
      socket.off("update_player_progress");
      socket.off("game_over");
      socket.off("game_reset");
      socket.off("room_destroyed");
    };
  }, [socket, navigate]);

  // --- KEYBOARD LISTENERS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Prevent spectators from rolling with the keyboard
        if (gameState === "playing" && !isRolling && !isSpectator) {
          handleRoll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, isRolling, room, isSpectator]);

  // --- ACTIONS ---
  const handleCopyCode = () => {
    navigator.clipboard.writeText(room);
    toast.success("Room code copied!");
  };

  const handleStartGame = () => {
    if (players.length === 0) return toast.error("Wait for players to join!");
    socket.emit("start_game", { roomId: room });
    setGameStarted(true);
  };

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    socket.emit("roll_number", { roomId: room });
  };

  const handleKick = (playerSocketId) => {
    if (confirm("Kick this player?")) {
      socket.emit("kick_player", {
        roomId: room,
        targetSocketId: playerSocketId,
      });
      setPlayers((prev) => prev.filter((p) => p.socketId !== playerSocketId));
    }
  };

  const handleRestart = () => {
    if (confirm("Restart Game? All progress will be lost.")) {
      socket.emit("restart_game", { roomId: room });
    }
    setGameStarted(false);
  };

  const handleCloseRoom = () => {
    if (confirm("Close room for everyone?")) {
      disconnectSocket();
    }
  };

  const handleLeaveAsSpectator = () => {
    if (confirm("Stop spectating and leave?")) {
      socket.emit("leave_room", { roomId: room });
      disconnectSocket();
    }
  };

  // Group history by BINGO letter
  const groupedHistory = { B: [], I: [], N: [], G: [], O: [] };
  history.forEach((num) => {
    groupedHistory[getBingoLetter(num)].push(num);
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
      <div className="flex-1 flex flex-col p-4 md:p-8 relative overflow-y-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 bg-gray-800 p-4 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-500">
              {isSpectator ? "Spectator View" : "Host Panel"}
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
            {!isSpectator && gameState === "waiting" && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                title="Edit Pattern"
              >
                <Settings size={20} />
              </button>
            )}

            {isSpectator ? (
              <button
                onClick={handleLeaveAsSpectator}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-900 rounded-lg flex items-center gap-2 font-bold"
              >
                <LogOut size={18} /> Leave
              </button>
            ) : (
              <>
                <button
                  onClick={handleRestart}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 font-bold"
                >
                  New Game
                </button>
                <button
                  onClick={handleCloseRoom}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 font-bold"
                >
                  <XCircle size={18} /> End
                </button>
              </>
            )}
          </div>
        </div>

        {/* SETTINGS MODAL */}
        {showSettings && !isSpectator && (
          <>
            {/* Invisible clickable overlay to detect outside clicks */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowSettings(false)}
            />

            {/* Actual Modal Container */}
            <div className="absolute top-24 right-8 z-50 bg-gray-800 p-4 border border-gray-600 rounded-xl shadow-2xl">
              <h3 className="font-bold mb-2">Edit Pattern</h3>
              <PatternPicker
                onPatternChange={(p) => {
                  socket.emit("update_pattern", { roomId: room, pattern: p });
                }}
              />
            </div>
          </>
        )}

        {/* GAME AREA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-[400px]">
          {/* THE BIG BALL (Current Number) */}
          <div
            className={`
            w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2
            bg-gradient-to-br from-blue-600 to-purple-700 shadow-[0_0_30px_rgba(59,130,246,0.5)]
            border-4 border-white transition-all duration-300 transform
            ${isRolling ? "animate-bounce scale-110" : "scale-100"}
          `}
          >
            {currentNumber && !isRolling && (
              <span className="text-6xl font-black text-white/50 -mb-4 drop-shadow-md">
                {getBingoLetter(currentNumber)}
              </span>
            )}
            <span className="text-8xl font-black text-white drop-shadow-md z-10">
              {currentNumber || "--"}
            </span>
          </div>

          {/* CONTROLS (Hidden if Spectator) */}
          {!isSpectator && (
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
          )}

          {/* Spectator Status Text */}
          {isSpectator && gameState === "playing" && (
            <div className="text-xl font-bold text-gray-400 animate-pulse mt-4">
              Game in progress...
            </div>
          )}
        </div>

        {/* SEGREGATED HISTORY */}
        <div className="mt-8 bg-gray-800 p-4 rounded-xl w-full">
          <h3 className="text-xs text-gray-400 font-bold mb-4 uppercase tracking-wide border-b border-gray-700 pb-2">
            Call History
          </h3>
          <div className="flex flex-col gap-3">
            {["B", "I", "N", "G", "O"].map((letter) => (
              <div key={letter} className="flex items-start gap-4">
                <span className="w-8 h-8 flex items-center justify-center font-black text-2xl text-pink-500 drop-shadow-sm">
                  {letter}
                </span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {groupedHistory[letter].map((num) => (
                    <span
                      key={num}
                      className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-sm font-bold border border-gray-600 shadow-sm"
                    >
                      {num}
                    </span>
                  ))}
                  {groupedHistory[letter].length === 0 && (
                    <span className="text-gray-500 text-sm italic py-1">
                      --
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SIDEBAR (Right) */}
      <PlayerList
        players={players}
        onKick={isSpectator ? null : handleKick}
        winnerName={winner}
        gameStarted={gameStarted}
      />
    </div>
  );
};

export default HostRoom;
