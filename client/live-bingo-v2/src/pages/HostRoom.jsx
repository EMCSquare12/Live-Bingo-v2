import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Copy,
  XCircle,
  Play,
  Settings,
  LogOut,
  Users,
  X,
  Menu,
  Hash,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import PlayerList from "../components/PlayerList";
import PatternPicker from "../components/PatternPicker";

// --- Helper functions for color coding ---
const getBingoLetter = (num) => {
  if (!num) return "";
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const getBingoColorClasses = (num) => {
  if (num <= 15) return "bg-red-900/50 text-red-200 border-red-700";
  if (num <= 30) return "bg-yellow-900/50 text-yellow-200 border-yellow-700";
  if (num <= 45) return "bg-green-900/50 text-green-200 border-green-700";
  if (num <= 60) return "bg-blue-900/50 text-blue-200 border-blue-700";
  return "bg-purple-900/50 text-purple-200 border-purple-700";
};

const getBingoHeaderColor = (letter) => {
  switch (letter) {
    case "B":
      return "text-red-400";
    case "I":
      return "text-yellow-400";
    case "N":
      return "text-green-400";
    case "G":
      return "text-blue-400";
    case "O":
      return "text-purple-400";
    default:
      return "text-gray-400";
  }
};

const getBallColorTheme = (num, isRolling) => {
  if (!num || isRolling)
    return "bg-gradient-to-br from-pink-600 to-purple-700 shadow-[0_0_20px_rgba(236,72,153,0.5)]";
  if (num <= 15)
    return "bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_20px_rgba(239,68,68,0.6)]";
  if (num <= 30)
    return "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]";
  if (num <= 45)
    return "bg-gradient-to-br from-green-500 to-green-700 shadow-[0_0_20px_rgba(34,197,94,0.6)]";
  if (num <= 60)
    return "bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.6)]";
  return "bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_0_20px_rgba(168,85,247,0.6)]";
};

const HostRoom = () => {
  const { socket, room, player, disconnectSocket, setPlayer } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const isSpectator = player?.isSpectator;

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
  const [winners, setWinners] = useState(
    location.state?.gameState?.winners || [],
  );

  const initialPattern =
    location.state?.winningPattern ||
    location.state?.gameState?.winningPattern ||
    [];
  const [winningPattern, setWinningPattern] = useState(initialPattern);

  const [hostName, setHostName] = useState(
    location.state?.gameState?.players?.find((p) => p.isHost)?.name ||
      player?.name ||
      "Host",
  );

  const [isRolling, setIsRolling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayersSidebar, setShowPlayersSidebar] = useState(false);

  // State for Mobile Header Sidebar
  const [showMenuSidebar, setShowMenuSidebar] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on("player_left", (msg) => toast(msg, { icon: "👋" }));

    socket.on("game_reset", ({ message, players: updatedPlayers }) => {
      if (isSpectator) {
        socket.emit("join_room", { roomId: room, playerName: player?.name });
        return;
      }
      setGameState("waiting");
      setHistory([]);
      setCurrentNumber(null);
      setWinners([]);
      setIsRolling(false);
      setPlayers(updatedPlayers.filter((p) => !p.isHost));
      toast.success(message || "Game reset successfully.");
    });

    socket.on("room_joined", ({ roomId, player: newPlayer }) => {
      if (isSpectator) {
        setPlayer(newPlayer);
        toast.success("Game reset! You joined as a player. 🎟️");
        navigate("/play");
      }
    });

    socket.on("update_player_list", (updatedPlayers) => {
      setPlayers(updatedPlayers.filter((p) => !p.isHost));
    });

    socket.on("game_started", ({ winners: initialWinners }) => {
      setGameState("playing");
      if (initialWinners) setWinners(initialWinners);
      toast.success("Game Started! Players' cards are locked.");
    });

    socket.on("number_rolled", ({ number, history: newHistory }) => {
      setIsRolling(true);
      let i = 0;
      const interval = setInterval(() => {
        setCurrentNumber(Math.floor(Math.random() * 75) + 1);
        i++;
        if (i > 10) {
          clearInterval(interval);
          setIsRolling(false);
          setCurrentNumber(number);
          setHistory(newHistory);
        }
      }, 100);
    });

    socket.on(
      "update_player_progress",
      ({ playerId, remaining, markedIndices }) => {
        setPlayers((prev) =>
          prev.map((p) =>
            p._id === playerId || p.socketId === playerId
              ? { ...p, remaining, ...(markedIndices ? { markedIndices } : {}) }
              : p,
          ),
        );
      },
    );

    socket.on("player_won", ({ winner, winners: updatedWinners, rank }) => {
      if (updatedWinners) setWinners(updatedWinners);
      const suffix =
        rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
      toast.success(`${winner} has BINGO! (${rank}${suffix} place)`, {
        duration: 5000,
        icon: rank === 1 ? "🎊" : "🏅",
      });
    });

    socket.on("false_bingo", ({ name }) => {
      toast.dismiss();
      toast(`${name} called a false BINGO! 🤡`, { icon: "🤡" });
    });

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
      socket.off("player_won");
      socket.off("false_bingo");
      socket.off("game_reset");
      socket.off("room_joined");
      socket.off("room_destroyed");
    };
  }, [socket, navigate, isSpectator, room, player?.name, setPlayer]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (gameState === "playing" && !isRolling && !isSpectator) handleRoll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, isRolling, room, isSpectator]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room);
    toast.dismiss();
    toast.success("Room code copied!");
  };

  const handleStartGame = () => {
    if (players.length === 0) {
      toast.dismiss();
      return toast.error("Wait for players to join!");
    }
    socket.emit("start_game", { roomId: room });
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
  };

  const handleCloseRoom = () => {
    if (confirm("Close room for everyone?")) disconnectSocket();
  };

  const handleLeaveAsSpectator = () => {
    if (confirm("Stop spectating and leave?")) {
      socket.emit("leave_room", { roomId: room });
      disconnectSocket();
    }
  };

  const groupedHistory = { B: [], I: [], N: [], G: [], O: [] };
  history.forEach((num) => groupedHistory[getBingoLetter(num)].push(num));

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-y-auto md:overflow-hidden">
      {/* Mobile Overlay for Right Players Sidebar */}
      {showPlayersSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setShowPlayersSidebar(false)}
        />
      )}

      {/* Left Column: Header, Roll Info & Call History Container */}
      <div className="flex flex-col flex-1 order-1 min-w-0 md:overflow-y-auto">
        {/* Part A: Header & Roll Info */}
        <div className="flex flex-col p-4 md:p-8 md:pb-4 shrink-0">
          {/* --- MOBILE TOP BAR --- */}
          <div className="md:hidden flex justify-between items-center bg-gray-800 p-3 rounded-xl mb-6 shadow-lg border border-gray-700/50">
            <button
              onClick={() => setShowMenuSidebar(true)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-500 truncate px-2">
              {isSpectator ? "Spectator View" : "Host Panel"}
            </h1>
            <button
              onClick={() => setShowPlayersSidebar(true)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg relative flex items-center justify-center transition-colors"
            >
              <Users size={20} />
              {players.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {players.length}
                </span>
              )}
            </button>
          </div>

          {/* --- RESPONSIVE HEADER / SIDEBAR --- */}
          {/* Mobile Overlay for Menu */}
          {showMenuSidebar && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
              onClick={() => setShowMenuSidebar(false)}
            />
          )}

          <div
            className={`
            fixed inset-y-0 left-0 z-50 w-80 bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col transform transition-transform duration-300 overflow-hidden border-r border-gray-800
            md:static md:w-auto md:bg-gray-800 md:p-4 md:rounded-xl md:flex-row md:justify-between md:items-center md:translate-x-0 md:mb-8 md:z-auto md:shadow-lg md:overflow-visible md:border-none md:backdrop-blur-none
            ${showMenuSidebar ? "translate-x-0" : "-translate-x-full"}
          `}
          >
            {/* Mobile Menu Header */}
            <div className="md:hidden flex items-center justify-between p-5 border-b border-gray-800 bg-gray-800/30">
              <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-500 truncate">
                {isSpectator ? "Spectator" : "Host Panel"}
              </h2>
              <button
                onClick={() => setShowMenuSidebar(false)}
                className="p-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-6 p-6 md:p-0 overflow-y-auto md:overflow-visible flex-1 min-w-0">
              {/* Info Card */}
              <div className="min-w-0 flex flex-col gap-2">
                <h1 className="hidden md:block text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-500 truncate">
                  {isSpectator ? "Spectator View" : "Host Panel"}
                </h1>

                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2 text-sm text-gray-300 bg-gray-800/40 p-4 md:p-0 rounded-xl md:bg-transparent md:rounded-none border border-gray-700/50 md:border-none mt-0.5">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-500 md:hidden" />
                    <span className="md:hidden text-xs uppercase tracking-wider font-bold text-gray-500 w-[70px]">
                      Host
                    </span>
                    <span className="font-mono bg-gray-900 md:bg-transparent px-2 py-1 md:p-0 rounded-md md:border border-gray-500 md:p-1 tracking-wider w-fit text-white md:text-gray-400">
                      {hostName.toUpperCase()}
                    </span>
                  </div>

                  <div className="hidden md:block w-px h-4 bg-gray-600"></div>
                  <div className="md:hidden w-full h-px bg-gray-700/50 my-1"></div>

                  <div
                    onClick={handleCopyCode}
                    className="flex items-center justify-between md:justify-start gap-2 cursor-pointer rounded-md md:border border-gray-500 md:p-1 hover:text-yellow-400 transition-colors w-full md:w-fit text-white md:text-gray-400 group"
                    title="Copy Room Code"
                  >
                    <div className="flex items-center gap-2">
                      <Hash size={16} className="text-gray-500 md:hidden" />
                      <span className="md:hidden text-xs uppercase tracking-wider font-bold text-gray-500 w-[70px]">
                        Room
                      </span>
                      <span className="font-mono tracking-wider bg-gray-900 md:bg-transparent px-2 py-1 md:p-0 rounded">
                        {room}
                      </span>
                    </div>
                    <Copy
                      size={16}
                      className="text-gray-400 md:w-4 md:h-4 group-hover:text-yellow-400"
                    />
                  </div>
                </div>
              </div>

              {/* Winning Pattern Mini-Grid */}
              <div className="flex flex-col items-start md:items-center bg-gray-800/40 md:bg-gray-900/50 p-5 md:p-1.5 rounded-xl md:rounded-lg border border-gray-700/50 md:border-none w-full md:w-fit shrink-0">
                <span className="text-xs md:text-[10px] text-gray-400 uppercase font-bold mb-3 md:mb-1 tracking-wider">
                  Pattern
                </span>
                <div
                  className={`grid grid-cols-5 gap-[1px] w-20 h-20 md:w-10 md:h-10 border border-gray-600 bg-gray-700 p-[1px] rounded-sm mx-auto md:mx-0 ${!isSpectator && gameState === "waiting" ? "cursor-pointer hover:border-pink-500 transition-colors" : ""}`}
                  onClick={() => {
                    if (!isSpectator && gameState === "waiting") {
                      setShowSettings(!showSettings);
                      setShowMenuSidebar(false);
                    }
                  }}
                  title={
                    !isSpectator && gameState === "waiting"
                      ? "Click to edit pattern"
                      : "Winning pattern"
                  }
                >
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-full h-full rounded-[1px] ${winningPattern?.includes(i) ? "bg-pink-500 shadow-[0_0_2px_#ec4899]" : "bg-gray-800/80"}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons Container */}
            <div className="flex flex-col md:flex-row gap-3 mt-auto md:mt-0 shrink-0 p-6 md:p-0 border-t border-gray-800 bg-gray-800/20 md:bg-transparent md:border-none">
              {/* Desktop Edit Pattern Button */}
              {!isSpectator && gameState === "waiting" && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="hidden md:flex px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg items-center gap-2 transition-colors"
                  title="Edit Pattern"
                >
                  <Settings size={18} />
                </button>
              )}

              {/* Mobile Edit Pattern Button */}
              {!isSpectator && gameState === "waiting" && (
                <button
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowMenuSidebar(false);
                  }}
                  className="md:hidden flex p-3.5 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-xl items-center justify-center gap-2 font-bold w-full transition-colors shadow-lg"
                >
                  <Settings size={18} /> Edit Pattern
                </button>
              )}

              {isSpectator ? (
                <button
                  onClick={handleLeaveAsSpectator}
                  className="p-3.5 md:px-4 md:py-2 bg-red-600 text-white border-none hover:bg-red-700 rounded-xl md:rounded-lg flex items-center justify-center gap-2 font-bold text-sm w-full md:w-auto transition-colors shadow-lg md:shadow-none"
                >
                  <LogOut size={16} className="md:w-5 md:h-5" />
                  <span>Leave</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRestart}
                    className="p-3.5 md:px-4 md:py-2   bg-blue-600 text-white md:border-none hover:bg-blue-700 rounded-xl md:rounded-lg flex items-center justify-center gap-2 font-bold text-sm w-full md:w-auto transition-colors shadow-lg md:shadow-none"
                    title="New Game"
                  >
                    <span>New Game</span>
                  </button>
                  <button
                    onClick={handleCloseRoom}
                    className="p-3.5 md:px-4 md:py-2   bg-red-600 text-white md:border-none hover:bg-red-700 rounded-xl md:rounded-lg flex items-center justify-center gap-2 font-bold text-sm w-full md:w-auto transition-colors shadow-lg md:shadow-none"
                    title="End Room"
                  >
                    <XCircle size={16} className="md:w-5 md:h-5" />
                    <span>End Room</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Pattern Editor Modal (Centered overlay) */}
          {showSettings && !isSpectator && (
            <>
              <div
                className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                onClick={() => setShowSettings(false)}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] bg-gray-800 p-6 border border-gray-600 rounded-xl shadow-2xl w-[90%] max-w-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl">Edit Pattern</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <PatternPicker
                  initialPattern={winningPattern}
                  onPatternChange={(p) => {
                    setWinningPattern(p);
                    socket.emit("update_pattern", { roomId: room, pattern: p });
                  }}
                />
              </div>
            </>
          )}

          {/* Current Number & Actions */}
          <div className="mb-8 md:mb-4 flex flex-col items-center justify-center gap-6">
            <div
              className={`
              w-40 h-40 md:w-48 md:h-48 rounded-full flex flex-col items-center justify-center gap-2 text-white
              border-4 border-white transition-all duration-300 transform
              ${isRolling ? "animate-bounce scale-110" : "scale-100"}
              ${getBallColorTheme(currentNumber, isRolling)}
            `}
            >
              {currentNumber && !isRolling && (
                <span className="text-5xl md:text-6xl font-black -mb-3 md:-mb-4 drop-shadow-md text-white/90">
                  {getBingoLetter(currentNumber)}
                </span>
              )}
              <span className="text-7xl md:text-8xl font-black drop-shadow-md z-10">
                {currentNumber || "--"}
              </span>
            </div>

            {!isSpectator && (
              <div className="flex gap-4">
                {gameState === "waiting" ? (
                  <button
                    onClick={handleStartGame}
                    className="px-8 py-4 bg-green-600 hover:bg-green-500 text-xl font-bold rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play fill="currentColor" /> Start Game
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

            {isSpectator && gameState === "playing" && (
              <div className="text-xl font-bold text-gray-400 animate-pulse mt-2">
                Game in progress...
              </div>
            )}
          </div>
        </div>

        {/* Part C: Call History (Scrolling with the left side) */}
        <div className="flex flex-col p-4 md:p-8 md:pt-0 shrink-0">
          <div className="md:mt-auto bg-gray-800 p-4 rounded-xl w-full">
            <h3 className="text-xs text-gray-400 font-bold mb-4 uppercase tracking-wide border-b border-gray-700 pb-2">
              Call History
            </h3>
            <div className="flex flex-col gap-3">
              {["B", "I", "N", "G", "O"].map((letter) => (
                <div key={letter} className="flex items-start gap-4">
                  <span
                    className={`w-8 h-8 flex items-center justify-center font-black text-2xl drop-shadow-sm ${getBingoHeaderColor(letter)}`}
                  >
                    {letter}
                  </span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {groupedHistory[letter].map((num) => (
                      <span
                        key={num}
                        className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold border shadow-sm ${getBingoColorClasses(num)}`}
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
      </div>

      {/* Right Column: Player List Sidebar */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-80 shadow-2xl transform transition-transform duration-300 ease-in-out bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 flex flex-col
          md:static md:translate-x-0 md:shadow-none md:z-auto md:border-gray-700 md:bg-gray-800 md:backdrop-blur-none
          shrink-0
          ${showPlayersSidebar ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Mobile Player Sidebar Header */}
        <div className="md:hidden flex justify-between items-center p-5 border-b border-gray-800 bg-gray-800/30 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"></h2>
          <button
            onClick={() => setShowPlayersSidebar(false)}
            className="p-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <PlayerList
            players={players}
            onKick={isSpectator ? null : handleKick}
            winners={winners}
            gameStarted={gameState === "playing"}
            winningPattern={winningPattern}
          />
        </div>
      </div>
    </div>
  );
};

export default HostRoom;
