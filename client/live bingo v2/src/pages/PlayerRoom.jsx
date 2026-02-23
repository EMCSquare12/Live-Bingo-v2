import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import BingoCard from "../components/BingoCard";

// Helper to determine the BINGO letter
const getBingoLetter = (num) => {
  if (!num) return "";
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const PlayerRoom = () => {
  const { socket, room, player, disconnectSocket } = useSocket();
  const navigate = useNavigate();

  // Local Game State
  const [gameState, setGameState] = useState("waiting");
  const [cardMatrix, setCardMatrix] = useState(player?.cardMatrix || []);
  const [markedIndices, setMarkedIndices] = useState(
    player?.markedIndices || [12],
  );
  const [lastCalledNumber, setLastCalledNumber] = useState(null);
  const [calledHistory, setCalledHistory] = useState([]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const onGameStarted = () => {
      setGameState("playing");
      toast("Game Started! Good Luck!", { icon: "🍀" });
    };

    const onNumberRolled = ({ number, history }) => {
      setLastCalledNumber(number);
      setCalledHistory(history);
    };

    const onMarkSuccess = ({ cellIndex }) => {
      setMarkedIndices((prev) => [...new Set([...prev, cellIndex])]);
    };

    const onGameOver = ({ winner }) => {
      setGameState("ended");
      if (winner === player?.name) {
        toast.success("YOU WON! BINGO!!! 🏆");
      } else {
        toast.error(`${winner} won the game.`);
      }
    };

    const onCardShuffled = (newMatrix) => {
      setCardMatrix(newMatrix);
      toast.success("Card Shuffled!");
    };

    const onActionError = (msg) => toast.error(msg);

    const onRoomDestroyed = (message) => {
      toast.success(message);
      navigate('/');
    }

    // Attach listeners
    socket.on("game_started", onGameStarted);
    socket.on("number_rolled", onNumberRolled);
    socket.on("mark_success", onMarkSuccess);
    socket.on("game_over", onGameOver);
    socket.on("card_shuffled", onCardShuffled);
    socket.on("action_error", onActionError);
    socket.on("room_destroyed", onRoomDestroyed);


    // Cleanup
    return () => {
      socket.off("game_started", onGameStarted);
      socket.off("number_rolled", onNumberRolled);
      socket.off("mark_success", onMarkSuccess);
      socket.off("game_over", onGameOver);
      socket.off("card_shuffled", onCardShuffled);
      socket.off("action_error", onActionError);
      socket.off("room_destroyed", onRoomDestroyed);

    };
  }, [socket, player]);

  // --- HANDLERS ---
  const handleLeave = () => {
    if (confirm("Are you sure you want to leave?")) {
      socket.emit("leave_room", { roomId: room });
      disconnectSocket();
    }
  };

  const handleCellClick = (index, number) => {
    if (gameState !== "playing") {
      if (gameState === "waiting") return toast("Game hasn't started yet.");
      return;
    }
    if (markedIndices.includes(index)) return;

    if (!calledHistory.includes(number)) {
      toast.error(`${number} hasn't been called!`);
      return;
    }
    socket.emit("mark_number", { roomId: room, number, cellIndex: index });
  };

  const handleClaimBingo = () => {
    socket.emit("claim_bingo", { roomId: room });
  };

  const handleShuffle = () => {
    socket.emit("request_shuffle", { roomId: room });
  };

  // Group history by BINGO letter
  const groupedHistory = { B: [], I: [], N: [], G: [], O: [] };
  calledHistory.forEach((num) => {
    groupedHistory[getBingoLetter(num)].push(num);
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 pb-12">
      {/* TOP BAR - Increased max-width to match the new 2-column layout */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-6 bg-gray-800 p-3 rounded-xl border border-gray-700">
        <div>
          <h2 className="font-bold text-lg">{player?.name || "Player"}</h2>
          <p className="text-xs text-gray-400 font-mono">ROOM: {room}</p>
        </div>
        <button
          onClick={handleLeave}
          className="p-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* HERO SECTION */}
      <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="text-gray-400 text-sm uppercase tracking-widest font-bold mb-1">
          {gameState === "waiting" ? "Waiting for Host..." : "Current Number"}
        </div>
        <div
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-[0_0_20px_rgba(236,72,153,0.5)] bg-gradient-to-br from-pink-500 to-purple-600 ${lastCalledNumber ? "animate-bounce" : "opacity-50"}`}
        >
          {lastCalledNumber && (
            <span className="text-xl font-black text-white/50 -mb-2">
              {getBingoLetter(lastCalledNumber)}
            </span>
          )}
          <span className="text-5xl font-black z-10">
            {lastCalledNumber || "--"}
          </span>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT WRAPPER */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-start justify-center gap-8">
        
        {/* LEFT COLUMN: BINGO CARD & ACTION BUTTONS */}
        <div className="flex flex-col items-center w-full lg:w-1/2">
          {/* BINGO CARD */}
          <BingoCard
            matrix={cardMatrix}
            markedIndices={markedIndices}
            onCellClick={handleCellClick}
            isSpectator={player?.isSpectator}
          />

          {/* ACTION BUTTONS */}
          <div className="mt-8 w-full max-w-md flex gap-4">
            {gameState === "waiting" && !player?.isSpectator && (
              <button
                onClick={handleShuffle}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Shuffle Card
              </button>
            )}

            {gameState === "playing" && !player?.isSpectator && (
              <button
                onClick={handleClaimBingo}
                className="flex-1 py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-black text-2xl shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 animate-pulse"
              >
                <Trophy size={28} /> BINGO!
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CALL HISTORY */}
        <div className="w-full  lg:w-1/2 max-w-md mx-auto lg:max-w-none bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
          <h3 className="text-sm text-gray-400 font-bold mb-6 uppercase tracking-wider border-b border-gray-700 pb-3">
            Call History
          </h3>
          <div className="flex flex-col gap-4">
            {["B", "I", "N", "G", "O"].map((letter) => (
              <div key={letter} className="flex items-start gap-4">
                <span className="w-10 h-10 flex items-center justify-center font-black text-2xl text-pink-500 drop-shadow-sm bg-gray-900 rounded-lg border border-gray-700">
                  {letter}
                </span>
                <div className="flex flex-wrap gap-2 flex-1 pt-1">
                  {groupedHistory[letter].map((num) => (
                    <span
                      key={num}
                      className="w-9 h-9 flex items-center justify-center bg-gray-700 rounded-full text-sm font-bold border border-gray-600 shadow-sm"
                    >
                      {num}
                    </span>
                  ))}
                  {groupedHistory[letter].length === 0 && (
                    <span className="text-gray-500 text-sm italic py-1 mt-1">--</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerRoom;