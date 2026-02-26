import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate, useLocation } from "react-router-dom";
import BingoCard from "../components/BingoCard";
import Confetti from "react-confetti";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";

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
  if (num <= 15) return "bg-red-900/50 text-red-200 border-red-700"; // B
  if (num <= 30) return "bg-yellow-900/50 text-yellow-200 border-yellow-700"; // I
  if (num <= 45) return "bg-green-900/50 text-green-200 border-green-700"; // N
  if (num <= 60) return "bg-blue-900/50 text-blue-200 border-blue-700"; // G
  return "bg-purple-900/50 text-purple-200 border-purple-700"; // O
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

  const [cardMatrix, setCardMatrix] = useState(player?.cardMatrix || []);
  const [markedIndices, setMarkedIndices] = useState(
    player?.markedIndices || [12],
  );

  const [showConfetti, setShowConfetti] = useState(false);
  const [hasBingo, setHasBingo] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  const checkWinCondition = useCallback(
    (indices) => {
      if (!winningPattern || winningPattern.length === 0) return false;
      return winningPattern.every((index) => indices.includes(index));
    },
    [winningPattern],
  );

  useEffect(() => {
    if (gameState === "playing" && winningPattern?.length > 0) {
      if (checkWinCondition(markedIndices)) {
        setHasBingo(true);
      }
    }
  }, [markedIndices, winningPattern, gameState, checkWinCondition]);

  useEffect(() => {
    if (!socket) return;

    socket.on("game_started", ({ winners: initialWinners }) => {
      setGameState("playing");
      if (initialWinners) setWinners(initialWinners);
      if (serverPattern) setWinningPattern(serverPattern);
      toast.success("Game Started! Good luck!");
    });

    socket.on("number_rolled", ({ number, history: newHistory }) => {
      setIsRolling(true);

      // Small animation for rolling number
      let i = 0;
      const interval = setInterval(() => {
        setCurrentNumber(Math.floor(Math.random() * 75) + 1);
        i++;
        if (i > 5) {
          clearInterval(interval);
          setIsRolling(false);
          setCurrentNumber(number);
          setHistory(newHistory);
          toast(`Number drawn: ${getBingoLetter(number)} ${number}`, {
            icon: "🎲",
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
          toast.success("BINGO! Claim your win now!", { icon: "🎉" });
        }
        return newIndices;
      });
    });

    socket.on("action_error", (msg) => {
      toast.error(msg);
    });

    socket.on("player_won", ({ winner, winners: updatedWinners, rank }) => {
      if (updatedWinners) setWinners(updatedWinners);
      const suffix =
        rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

      if (winner === player.name) {
        setShowConfetti(true);
        toast.success(`You won ${rank}${suffix} place! 🎉`, {
          duration: 8000,
        });
        setTimeout(() => setShowConfetti(false), 8000);
      } else {
        toast(`${winner} got BINGO! (${rank}${suffix})`, { icon: "🏆" });
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
    if (gameState !== "playing") return;
    if (index === 12) return;

    socket.emit("mark_number", { roomId: room, number: num, cellIndex: index });
  };

  const handleClaimBingo = () => {
    if (hasBingo) {
      socket.emit("claim_bingo", { roomId: room });
      setHasBingo(false); // Prevent spamming
    }
  };

  const handleShuffle = () => {
    socket.emit("request_shuffle", { roomId: room });
  };

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
  history.forEach((num) => {
    groupedHistory[getBingoLetter(num)].push(num);
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

      {/* Left Panel - Game Info & History */}
      <div className="flex-1 flex flex-col p-4 md:p-8 relative overflow-y-auto order-2 md:order-1">
        <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-pink-500">{player.name}</h1>
            <p className="font-mono text-sm text-gray-400">Room: {room}</p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="p-2 text-gray-400 hover:text-red-500 bg-gray-700 hover:bg-red-900/20 rounded-lg transition-colors"
            title="Leave Room"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Current Number Display */}
        <div className="mb-8 flex justify-center">
          <div
            className={`
            w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1
            bg-gradient-to-br from-pink-600 to-purple-700 shadow-[0_0_20px_rgba(236,72,153,0.5)]
            border-4 border-white transition-all duration-300 transform
            ${isRolling ? "animate-bounce scale-110" : "scale-100"}
          `}
          >
            {currentNumber && !isRolling && (
              <span
                className={`text-4xl font-black -mb-2 drop-shadow-md ${getBingoHeaderColor(getBingoLetter(currentNumber))}`}
              >
                {getBingoLetter(currentNumber)}
              </span>
            )}
            <span className="text-6xl font-black text-white drop-shadow-md">
              {currentNumber || "--"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mb-8">
          {gameState === "waiting" && (
            <button
              onClick={handleShuffle}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-full shadow-lg transition-colors"
            >
              Shuffle Card 🔄
            </button>
          )}

          {gameState === "playing" && (
            <button
              onClick={handleClaimBingo}
              disabled={!hasBingo || winners.includes(player.name)}
              className={`
                px-8 py-3 text-2xl font-black rounded-full shadow-lg transition-all
                ${
                  hasBingo && !winners.includes(player.name)
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105 animate-pulse text-gray-900"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }
              `}
            >
              BINGO! 🎉
            </button>
          )}
        </div>

        {/* Call History with Color Coding */}
        <div className="mt-auto bg-gray-800 p-4 rounded-xl w-full">
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

      {/* Right Panel - Bingo Card */}
      <div className="flex-1 bg-gray-900 p-4 md:p-8 flex items-center justify-center order-1 md:order-2 border-b md:border-b-0 md:border-l border-gray-700">
        <div className="w-full max-w-xl aspect-square relative">
          <BingoCard
            matrix={cardMatrix}
            markedIndices={markedIndices}
            onCellClick={handleCellClick}
            winningPattern={winningPattern}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerRoom;
