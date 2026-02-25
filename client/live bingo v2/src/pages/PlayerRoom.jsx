import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import BingoCard from "../components/BingoCard";

const getBingoLetter = (num) => {
  if (!num) return "";
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const PlayerRoom = () => {
  const { socket, room, player, disconnectSocket, setPlayer, setRoom } =
    useSocket();
  const navigate = useNavigate();

  // Local Game State
  const [isRolling, setIsRolling] = useState(false);
  const [gameState, setGameState] = useState("waiting");
  const [cardMatrix, setCardMatrix] = useState(player?.cardMatrix || []);
  const [markedIndices, setMarkedIndices] = useState(
    player?.markedIndices || [12],
  );
  const [lastCalledNumber, setLastCalledNumber] = useState(null);
  const [calledHistory, setCalledHistory] = useState([]);

  // Track Winners Data
  const [winners, setWinners] = useState([]);
  const [hasWon, setHasWon] = useState(false);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const onSessionExpired = (message) => {
      toast.error(message);
      setRoom(null);
      setPlayer(null);
      sessionStorage.removeItem("room");
      sessionStorage.removeItem("player");
      navigate("/");
    };

    const onGameStarted = ({ winners: currentWinners }) => {
      setGameState("playing");
      if (currentWinners) setWinners(currentWinners);
      if (currentWinners && currentWinners.includes(player?.name))
        setHasWon(true);
      toast("Game Started! Good Luck!", { icon: "🍀" });
    };

    const onNumberRolled = ({ number, history }) => {
      setIsRolling(true);

      let i = 0;
      const interval = setInterval(() => {
        setLastCalledNumber(Math.floor(Math.random() * 75) + 1);
        i++;
        if (i > 10) {
          clearInterval(interval);
          setIsRolling(false);
          setLastCalledNumber(number);
          setCalledHistory(history);
        }
      }, 100);
    };

    const onMarkSuccess = ({ cellIndex }) => {
      setMarkedIndices((prev) => [...new Set([...prev, cellIndex])]);
    };

    const onPlayerWon = ({ winner, winners: updatedWinners, rank }) => {
      if (updatedWinners) setWinners(updatedWinners);

      const suffix =
        rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

      if (winner === player?.name) {
        if (rank === 1) {
          toast.success("YOU WON 1ST PLACE! BINGO!!! 🏆", { duration: 5000 });
        } else {
          toast.success(
            `YOU GOT BINGO! You are in ${rank}${suffix} place! 🎉`,
            { duration: 5000 },
          );
        }
        setHasWon(true);
      } else {
        toast.success(
          `${winner} got BINGO (${rank}${suffix} place)! Game continues.`,
          { icon: "🎉" },
        );
      }
    };

    const onFalseBingo = ({ name }) => {
      if (name === player?.name) {
        toast.error("You don't have BINGO yet! Keep playing.");
      } else {
        toast(`${name} called a false BINGO! 🤡`, { icon: "🤡" });
      }
    };

    const onCardShuffled = (newMatrix) => {
      setCardMatrix(newMatrix);
      toast.success("Card Shuffled!");
    };

    const onActionError = (msg) => toast.error(msg);

    const onRoomDestroyed = (message) => {
      toast.success(message);
      setRoom(null);
      setPlayer(null);
      sessionStorage.removeItem("room");
      sessionStorage.removeItem("player");
      navigate("/");
    };

    const onGameReset = ({ message, players }) => {
      setGameState("waiting");
      setLastCalledNumber(null);
      setCalledHistory([]);
      setMarkedIndices([12]);
      setWinners([]);
      setHasWon(false);

      const me = players.find(
        (p) => p.socketId === socket.id || p.name === player?.name,
      );
      if (me && me.cardMatrix) {
        setCardMatrix(me.cardMatrix);
      }

      toast.success(message || "New Game! Your card has been shuffled.", {
        icon: "🔄",
      });
    };

    const onRoomJoined = ({ player: updatedPlayer }) => {
      if (updatedPlayer) {
        if (updatedPlayer.cardMatrix) setCardMatrix(updatedPlayer.cardMatrix);
        if (updatedPlayer.markedIndices)
          setMarkedIndices(updatedPlayer.markedIndices);
      }
    };

    socket.on("session_expired", onSessionExpired);
    socket.on("game_started", onGameStarted);
    socket.on("number_rolled", onNumberRolled);
    socket.on("mark_success", onMarkSuccess);
    socket.on("player_won", onPlayerWon);
    socket.on("false_bingo", onFalseBingo);
    socket.on("card_shuffled", onCardShuffled);
    socket.on("action_error", onActionError);
    socket.on("room_destroyed", onRoomDestroyed);
    socket.on("game_reset", onGameReset);
    socket.on("room_joined", onRoomJoined);

    return () => {
      socket.off("session_expired", onSessionExpired);
      socket.off("game_started", onGameStarted);
      socket.off("number_rolled", onNumberRolled);
      socket.off("mark_success", onMarkSuccess);
      socket.off("player_won", onPlayerWon);
      socket.off("false_bingo", onFalseBingo);
      socket.off("card_shuffled", onCardShuffled);
      socket.off("action_error", onActionError);
      socket.off("room_destroyed", onRoomDestroyed);
      socket.off("game_reset", onGameReset);
      socket.off("room_joined", onRoomJoined);
    };
  }, [socket, player]);

  const handleLeave = () => {
    if (confirm("Are you sure you want to leave?")) {
      socket.emit("leave_room", { roomId: room });
      setRoom(null);
      setPlayer(null);
      sessionStorage.removeItem("room");
      sessionStorage.removeItem("player");
      disconnectSocket();
      navigate("/");
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

  const groupedHistory = { B: [], I: [], N: [], G: [], O: [] };
  calledHistory.forEach((num) => {
    groupedHistory[getBingoLetter(num)].push(num);
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 pb-12">
      <div className="w-full max-w-6xl flex justify-between items-center mb-6 bg-gray-800 p-3 rounded-xl border border-gray-700">
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

      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center mt-10 lg:items-start justify-center gap-8">
        <div className="flex  flex-col items-center w-full  lg:flex-1 order-1 lg:order-1 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="text-gray-400 text-sm uppercase tracking-widest font-bold mb-1">
            {gameState === "waiting" ? "Waiting for Host..." : "Current Number"}
          </div>
          <div
            className={`
              w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 mx-auto
              bg-linear-to-br from-blue-600 to-purple-700 shadow-[0_0_30px_rgba(59,130,246,0.5)]
              border-4 border-white transition-all duration-300 transform
              ${isRolling ? "animate-bounce scale-110" : "scale-100"}
            `}
          >
            {lastCalledNumber && !isRolling && (
              <span className="text-6xl font-black text-white/50 -mb-4 drop-shadow-md">
                {getBingoLetter(lastCalledNumber)}
              </span>
            )}
            <span className="text-8xl font-black text-white drop-shadow-md z-10">
              {lastCalledNumber || "--"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center w-full lg:flex-1 order-2 lg:order-2">
          <BingoCard
            matrix={cardMatrix}
            markedIndices={markedIndices}
            onCellClick={handleCellClick}
            isSpectator={player?.isSpectator}
          />

          <div className="mt-8 w-full max-w-md flex gap-4">
            {gameState === "waiting" && !player?.isSpectator && (
              <button
                onClick={handleShuffle}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Shuffle Card
              </button>
            )}

            {gameState === "playing" && !player?.isSpectator && !hasWon && (
              <button
                onClick={handleClaimBingo}
                className="flex-1 py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-black text-2xl shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 animate-pulse"
              >
                <Trophy size={28} /> BINGO!
              </button>
            )}
          </div>
        </div>

        <div className="w-full max-w-md mx-auto lg:flex-1 lg:max-w-none bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl order-3">
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
                    <span className="text-gray-500 text-sm italic py-1 mt-1">
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
  );
};

export default PlayerRoom;
