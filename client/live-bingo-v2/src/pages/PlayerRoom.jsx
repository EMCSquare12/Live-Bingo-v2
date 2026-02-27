import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate, useLocation } from "react-router-dom";
import BingoCard from "../components/BingoCard";
import Confetti from "react-confetti";
import toast from "react-hot-toast";
import { LogOut, Menu, X } from "lucide-react";

// --- Helper functions for color coding ---
const getBingoLetter = (num) => {
  if (!num) return "";
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const getBallColorTheme = (num, isRolling) => {
  if (!num || isRolling)
    return "bg-gradient-to-br from-pink-600 to-purple-700 shadow-[0_0_20px_rgba(236,72,153,0.5)]";
  if (num <= 15)
    return "bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_20px_rgba(239,68,68,0.6)]"; // B
  if (num <= 30)
    return "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]"; // I
  if (num <= 45)
    return "bg-gradient-to-br from-green-500 to-green-700 shadow-[0_0_20px_rgba(34,197,94,0.6)]"; // N
  if (num <= 60)
    return "bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.6)]"; // G
  return "bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_0_20px_rgba(168,85,247,0.6)]"; // O
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
// -----------------------------------------

const PlayerRoom = () => {
  const { socket, room, player, setPlayer, disconnectSocket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [gameState, setGameState] = useState(
    location.state?.gameState?.status || "waiting",
  );
  const [currentNumber, setCurrentNumber] = useState(
    location.state?.gameState?.currentNumber || null,
  );
  const [history, setHistory] = useState(
    location.state?.gameState?.numbersDrawn || [],
  );
  const [winners, setWinners] = useState(
    location.state?.gameState?.winners || [],
  );
  const [winningPattern, setWinningPattern] = useState(
    location.state?.gameState?.winningPattern || [],
  );

  const [hostName, setHostName] = useState(
    location.state?.gameState?.players?.find((p) => p.isHost)?.name || "Host",
  );
  const [cardMatrix, setCardMatrix] = useState(player?.cardMatrix || []);
  const [markedIndices, setMarkedIndices] = useState(
    player?.markedIndices || [12],
  );

  const [showConfetti, setShowConfetti] = useState(false);
  const [hasBingo, setHasBingo] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  // NEW: State for Mobile Sidebar Header
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const checkWinCondition = useCallback(
    (indices) => {
      if (!winningPattern || winningPattern.length === 0) return false;
      return winningPattern.every((index) => indices.includes(index));
    },
    [winningPattern],
  );

  useEffect(() => {
    if (gameState === "playing" && winningPattern?.length > 0) {
      if (checkWinCondition(markedIndices)) setHasBingo(true);
    }
  }, [markedIndices, winningPattern, gameState, checkWinCondition]);

  useEffect(() => {
    if (!socket) return;

    socket.on(
      "game_started",
      ({ winners: initialWinners, winningPattern: serverPattern }) => {
        setGameState("playing");
        if (initialWinners) setWinners(initialWinners);
        if (serverPattern) setWinningPattern(serverPattern);
        toast.success("Game Started! Good luck!");
      },
    );

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
          toast(`Number drawn: ${getBingoLetter(number)} ${number}`, {
            icon: "🎉",
            duration: 3000,
          });
        }
      }, 100);
    });

    socket.on("mark_success", ({ cellIndex }) => {
      setMarkedIndices((prev) => {
        const newIndices = [...prev, cellIndex];
        if (checkWinCondition(newIndices)) {
          setHasBingo(true);
          toast.success("BINGO! Claim your win now!", { icon: "🔥" });
        }
        return newIndices;
      });
    });

    socket.on("action_error", (msg) => toast.error(msg));

    socket.on("player_won", ({ winner, winners: updatedWinners, rank }) => {
      if (updatedWinners) setWinners(updatedWinners);
      const suffix =
        rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
      if (winner === player.name) {
        setShowConfetti(true);
        toast.success(`You won ${rank}${suffix} place! 🔥`, { duration: 8000 });
        setTimeout(() => setShowConfetti(false), 8000);
      } else {
        toast(`${winner} got BINGO! (${rank}${suffix})`, { icon: "🎊" });
      }
    });

    socket.on("false_bingo", ({ name }) => {
      if (name === player.name) {
        toast.error("False ! Check your card.");
        setHasBingo(false);
      } else {
        toast(`${name} called a false BINGO! 🤡`);
      }
    });

    socket.on("game_reset", ({ message, players: updatedPlayers }) => {
      setGameState("waiting");
      setHistory([]);
      setCurrentNumber(null);
      setWinners([]);
      setMarkedIndices([12]);
      setHasBingo(false);
      setShowConfetti(false);
      setIsRolling(false);

      const currentHost = updatedPlayers.find((p) => p.isHost);
      if (currentHost) setHostName(currentHost.name);

      const me = updatedPlayers.find((p) => p.socketId === socket.id);
      if (me) {
        setPlayer(me);
        setCardMatrix(me.cardMatrix);
      }
      toast(message || "Game reset by host.");
    });

    socket.on("card_shuffled", (newMatrix) => {
      setCardMatrix(newMatrix);
      toast.success("Card shuffled!");
    });

    socket.on("room_destroyed", (message) => {
      toast.error(message);
      navigate("/");
    });

    return () => {
      socket.off("game_started");
      socket.off("number_rolled");
      socket.off("mark_success");
      socket.off("action_error");
      socket.off("player_won");
      socket.off("false_bingo");
      socket.off("game_reset");
      socket.off("card_shuffled");
      socket.off("room_destroyed");
    };
  }, [socket, navigate, player.name, setPlayer, checkWinCondition]);

  const handleCellClick = (index, num) => {
    if (gameState !== "playing" || index === 12) return;
    socket.emit("mark_number", { roomId: room, number: num, cellIndex: index });
  };

  const handleClaimBingo = () => {
    if (hasBingo) {
      socket.emit("claim_bingo", { roomId: room });
      setHasBingo(false);
    }
  };

  const handleShuffle = () => socket.emit("request_shuffle", { roomId: room });

  const handleLeaveRoom = () => {
    if (
      confirm(
        gameState === "playing"
          ? "Leave game in progress? You can't rejoin this session."
          : "Leave the room?",
      )
    ) {
      socket.emit("leave_room", { roomId: room });
      disconnectSocket();
      navigate("/");
    }
  };

  const groupedHistory = { B: [], I: [], N: [], G: [], O: [] };
  history.forEach((num) => groupedHistory[getBingoLetter(num)].push(num));

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-y-auto md:overflow-hidden pb-24 md:pb-0">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

      {/* LEFT DESKTOP COLUMN */}
      <div className="contents md:flex md:flex-col md:flex-1 md:order-1 md:overflow-y-auto md:no-scrollbar">
        {/* Part A: Header, Game Info & Actions (Order 1 on Mobile) */}
        <div className="flex flex-col p-4 md:p-8 md:pb-4 shrink-0 order-1 md:order-none">
          {/* --- MOBILE TOP BAR --- */}
          <div className="md:hidden flex justify-between items-center mb-6 bg-gray-800 p-3 rounded-xl shadow-lg">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-pink-500 truncate max-w-[150px]">
              {player.name}
            </h1>
            <button
              onClick={handleLeaveRoom}
              className="p-2 text-gray-400 hover:text-red-500 bg-gray-700 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* --- RESPONSIVE HEADER / SIDEBAR --- */}
          {/* Mobile Overlay */}
          {showMobileSidebar && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
          )}

          <div
            className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-gray-800 p-6 shadow-2xl flex flex-col gap-6 transform transition-transform duration-300 overflow-y-auto
            md:static md:w-auto md:bg-gray-800 md:p-4 md:rounded-xl md:flex-row md:justify-between md:items-center md:translate-x-0 md:mb-6 md:z-auto md:shadow-lg md:overflow-visible
            ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}
          `}
          >
            {/* Mobile Sidebar Close Button */}
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col md:flex-row md:items-center gap-6 mt-8 md:mt-0">
              <div className="min-w-0 flex flex-col gap-2">
                <h1 className="hidden md:block text-2xl font-bold text-pink-500 truncate max-w-xs">
                  {player.name}
                </h1>
                <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-gray-400">
                  <span className="font-mono rounded border border-gray-500 p-1.5 md:p-1 w-fit">
                    Room: {room}
                  </span>
                  <span className="hidden md:inline text-gray-600">•</span>
                  <span className="truncate max-w-xs p-1.5 md:p-1 rounded-md border border-gray-500 w-fit">
                    Host: {hostName.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Winning Pattern Mini-Grid */}
              {winningPattern?.length > 0 && (
                <div className="flex flex-col items-start md:items-center bg-gray-900/50 p-3 md:p-1.5 rounded-lg w-fit">
                  <span className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">
                    Pattern
                  </span>
                  <div className="grid grid-cols-5 gap-px w-10 h-10 md:w-10 md:h-10 border border-gray-700 bg-gray-800 p-px rounded-sm">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-full h-full rounded-[1px] ${winningPattern.includes(i) ? "bg-pink-500 shadow-[0_0_2px_#ec4899]" : "bg-gray-700/50"}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Leave Button */}
            <button
              onClick={handleLeaveRoom}
              className="hidden md:flex p-2 text-gray-400 hover:text-red-500 bg-gray-700 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Leave Room"
            >
              <LogOut size={20} />
            </button>

            {/* Mobile Leave Button at bottom of sidebar */}
            <button
              onClick={handleLeaveRoom}
              className="md:hidden mt-auto flex items-center justify-center gap-2 p-3 bg-red-900/50 hover:bg-red-900 text-white font-bold rounded-lg transition-colors w-full"
            >
              <LogOut size={20} /> Leave Room
            </button>
          </div>

          {/* Current Number Display */}
          <div className="mb-8 flex justify-center">
            <div
              className={`
              w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1 text-white
              border-4 border-white transition-all duration-300 transform
              ${isRolling ? "animate-bounce scale-110" : "scale-100"}
              ${getBallColorTheme(currentNumber, isRolling)}
            `}
            >
              {currentNumber && !isRolling && (
                <span className="text-4xl font-black -mb-2 drop-shadow-md text-white/90">
                  {getBingoLetter(currentNumber)}
                </span>
              )}
              <span className="text-6xl font-black drop-shadow-md">
                {currentNumber || "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Part C: Call History (Order 3 on Mobile) */}
        <div className="flex flex-col p-4 md:p-8 md:pt-0 shrink-0 order-3 md:order-none">
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

      {/* RIGHT DESKTOP COLUMN */}
      <div className="contents md:flex md:flex-col md:flex-1 md:order-2 md:overflow-y-auto md:border-l border-gray-700">
        {/* Part B: Bingo Card (Order 2 on Mobile) */}
        <div className="bg-gray-900 p-4 py-8 md:p-8 flex flex-col items-center flex-1 order-2 md:order-none md:my-auto border-y md:border-y-0 border-gray-700">
          <div className="w-full max-w-xl aspect-square flex flex-col gap-4 relative">
            <BingoCard
              matrix={cardMatrix}
              markedIndices={markedIndices}
              onCellClick={handleCellClick}
              winningPattern={winningPattern}
            />

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 z-50 md:static md:bg-transparent md:border-none md:p-0 md:mt-2 md:backdrop-blur-none shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.5)] md:shadow-none">
              <div className="w-full max-w-md mx-auto flex justify-center gap-4">
                {gameState === "waiting" && (
                  <button
                    onClick={handleShuffle}
                    className="px-6 py-4 w-full bg-blue-600 hover:bg-blue-500 font-bold rounded-md shadow-lg transition-colors"
                  >
                    Shuffle Card
                  </button>
                )}

                {gameState === "playing" && (
                  <button
                    onClick={handleClaimBingo}
                    disabled={!hasBingo || winners.includes(player.name)}
                    className={`
                    px-8 py-4 w-full text-2xl font-black rounded-md shadow-lg transition-all
                    ${
                      hasBingo && !winners.includes(player.name)
                        ? "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105 animate-pulse text-gray-900"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }
                  `}
                  >
                    BINGO! 🔥
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerRoom;
