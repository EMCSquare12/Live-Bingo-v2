import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import PatternPicker from "../components/PatternPicker";
import toast from "react-hot-toast";

const LandingPage = () => {
  const navigate = useNavigate();
  const { socket, setPlayer, setRoom } = useSocket();

  // State
  const [view, setView] = useState("menu");
  const [formData, setFormData] = useState({
    username: "",
    roomCode: "",
    winningPattern: [],
  });

  // --- SOCKET EVENT LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    socket.on("room_created", ({ roomId, player, room }) => {
      setRoom(roomId);
      setPlayer(player);
      toast.success(`Room ${roomId} Created!`);
      // Pass the selected pattern downward
      navigate("/host", { state: { winningPattern: room.winningPattern } });
    });

    socket.on("room_joined", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
      toast.success(`Joined Room ${roomId}!`);
      navigate("/play");
    });

    socket.on("spectator_joined", ({ gameState, message }) => {
      setRoom(gameState.roomId);
      setPlayer({ name: formData.username, isSpectator: true, isHost: false });
      toast(message, { icon: "👀" });
      navigate("/spectate", { state: { gameState } });
    });

    socket.on("error", (msg) => {
      toast.dismiss();
      toast.error(msg);
    });

    return () => {
      socket.off("room_created");
      socket.off("room_joined");
      socket.off("spectator_joined");
      socket.off("error");
    };
  }, [socket, navigate, setPlayer, setRoom, formData.username]);

  // --- HANDLERS ---
  const handlePatternChange = useCallback((pattern) => {
    setFormData((prev) => ({ ...prev, winningPattern: pattern }));
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!socket) return toast.error("Server not connected...");
    if (!formData.username) {
      toast.dismiss();
      return toast.error("Name is required");
    }
    if (formData.winningPattern.length === 0) {
      toast.dismiss();
      return toast.error("Select at least 1 winning cell");
    }

    if (!socket.connected) socket.connect();
    socket.emit("create_room", {
      hostName: formData.username,
      winningPattern: formData.winningPattern,
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!socket) return toast.error("Server not connected...");
    if (!formData.username || !formData.roomCode) {
      toast.dismiss();
      return toast.error("Fill all fields");
    }

    if (!socket.connected) socket.connect();
    socket.emit("join_room", {
      roomId: formData.roomCode.toUpperCase(),
      playerName: formData.username,
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center mb-2 text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-yellow-500">
          Live Bingo
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Real-time multiplayer bingo
        </p>

        {/* MENU VIEW */}
        {view === "menu" && (
          <div className="space-y-4">
            <button
              onClick={() => setView("create")}
              className="w-full py-4 bg-pink-600 hover:bg-pink-700 rounded-xl font-bold text-lg transition-all transform hover:scale-105"
            >
              Create Room
            </button>
            <button
              onClick={() => setView("join")}
              className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-lg transition-all"
            >
              Join Room
            </button>
          </div>
        )}

        {/* CREATE ROOM VIEW */}
        {view === "create" && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 animate-in fade-in zoom-in duration-300"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Host Name
              </label>
              <input
                type="text"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                placeholder="Enter your name"
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
            </div>

            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700">
              <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                Winning Pattern
              </label>
              <PatternPicker onPatternChange={handlePatternChange} />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold"
            >
              Start Game
            </button>
            <button
              type="button"
              onClick={() => setView("menu")}
              className="w-full text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}

        {/* JOIN ROOM VIEW */}
        {view === "join" && (
          <form
            onSubmit={handleJoin}
            className="space-y-4 animate-in fade-in zoom-in duration-300"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Room Code
              </label>
              <input
                type="text"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none uppercase tracking-widest text-center text-xl font-mono"
                placeholder="ABCD12"
                maxLength={6}
                onChange={(e) =>
                  setFormData({ ...formData, roomCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Player Name
              </label>
              <input
                type="text"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                placeholder="Enter your name"
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold"
            >
              Join Game
            </button>
            <button
              type="button"
              onClick={() => setView("menu")}
              className="w-full text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
