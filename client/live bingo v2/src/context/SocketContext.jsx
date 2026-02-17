import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const SocketContext = createContext();

// Initialize socket outside component to prevent multiple connections
const socket = io("http://localhost:5000", {
  autoConnect: false,
  reconnection: true,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Connection Event Listeners
    const onConnect = () => {
      setIsConnected(true);
      console.log("Socket Connected:", socket.id);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log("Socket Disconnected");
    };

    const onRoomDestroyed = (reason) => {
      toast.error(reason || "Room closed by host.");
      setPlayer(null);
      setRoom(null);
      navigate("/");
    };

    // Attach listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_destroyed", onRoomDestroyed);

    // RECONNECT LOGIC (The "Reload" Fix)
    const savedSession = sessionStorage.getItem("bingo_session");
    if (savedSession && !socket.connected) {
      const { roomId, playerName } = JSON.parse(savedSession);
      socket.auth = { roomId, playerName }; // Send auth data if using middleware
      socket.connect();

      // Emit a specific reconnect event to server (needs server handler)
      socket.emit("rejoin_room", { roomId, playerName });
    }

    // Cleanup listeners on unmount
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_destroyed", onRoomDestroyed);
    };
  }, [navigate]);

  // --- Helper Functions ---

  const connectSocket = (playerName, roomId) => {
    socket.auth = { playerName };
    socket.connect();

    // Save session for reload
    sessionStorage.setItem(
      "bingo_session",
      JSON.stringify({
        playerName,
        roomId,
      }),
    );
  };

  const disconnectSocket = () => {
    socket.disconnect();
    sessionStorage.removeItem("bingo_session");
    setPlayer(null);
    setRoom(null);
    navigate("/");
  };

  // Wrapper to clean up emitted events
  const emit = (eventName, data) => {
    socket.emit(eventName, data);
  };

  const value = {
    socket,
    isConnected,
    player,
    setPlayer,
    room,
    setRoom,
    connectSocket,
    disconnectSocket,
    emit,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
