import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import BingoCard from "../components/BingoCard";

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
      setGameState("playing");
      
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

    // Attach listeners
    socket.on("game_started", onGameStarted);
    socket.on("number_rolled", onNumberRolled);
    socket.on("mark_success", onMarkSuccess);
    socket.on("game_over", onGameOver);
    socket.on("card_shuffled", onCardShuffled);
    socket.on("action_error", onActionError);

    // Cleanup
    return () => {
      socket.off("game_started", onGameStarted);
      socket.off("number_rolled", onNumberRolled);
      socket.off("mark_success", onMarkSuccess);
      socket.off("game_over", onGameOver);
      socket.off("card_shuffled", onCardShuffled);
      socket.off("action_error", onActionError);
    };
  }, [socket, player]);

  // --- HANDLERS ---
  const handleLeave = () => {
    if (confirm("Are you sure you want to leave?")) {
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      {/* TOP BAR */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 bg-gray-800 p-3 rounded-xl border border-gray-700">
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
      <div className="mb-6 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="text-gray-400 text-sm uppercase tracking-widest font-bold mb-1">
          {gameState === "waiting" ? "Waiting for Host..." : "Current Number"}
        </div>
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center border-4 border-white shadow-[0_0_20px_rgba(236,72,153,0.5)] text-4xl font-black bg-gradient-to-br from-pink-500 to-purple-600 ${lastCalledNumber ? "animate-bounce" : "opacity-50"}`}
        >
          {lastCalledNumber || "--"}
        </div>
      </div>

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
  );
};

export default PlayerRoom;
