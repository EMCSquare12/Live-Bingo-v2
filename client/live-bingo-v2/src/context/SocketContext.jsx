import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Initialize state from sessionStorage if it exists
  const [player, setPlayer] = useState(() => {
    const saved = sessionStorage.getItem("player");
    return saved ? JSON.parse(saved) : null;
  });
  const [room, setRoom] = useState(
    () => sessionStorage.getItem("room") || null,
  );

  const navigate = useNavigate();

  // 2. Automatically sync state to sessionStorage whenever it changes!
  useEffect(() => {
    if (player && room) {
      sessionStorage.setItem("player", JSON.stringify(player));
      sessionStorage.setItem("room", room);
    } else {
      sessionStorage.removeItem("player");
      sessionStorage.removeItem("room");
    }
  }, [player, room]);

  useEffect(() => {
    const URL =
      process.env.NODE_ENV === "production"
        ? import.meta.env.VITE_BACKEND_URL
        : "http://localhost:5000";

    const newSocket = io(URL);

    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);

      // 3. Ask server to rejoin if we have data (Page Reload)
      const savedRoom = sessionStorage.getItem("room");
      const savedPlayer = sessionStorage.getItem("player");

      if (savedRoom && savedPlayer) {
        socket.emit("rejoin_room", {
          roomId: savedRoom,
          player: JSON.parse(savedPlayer),
        });
      }
    });

    newSocket.on("disconnect", () => setIsConnected(false));

    // Listeners for initial room entry
    newSocket.on("room_joined", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
    });

    // 4. IMPORTANT: Listen for Host creation so the Host saves their session!
    newSocket.on("room_created", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
    });

    return () => newSocket.close();
  }, []);

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setPlayer(null);
      setRoom(null);
      setIsConnected(false);
      // Data is cleared automatically by the useEffect above
      navigate("/");
      window.location.reload();
    }
  };

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      player,
      setPlayer,
      room,
      setRoom,
      disconnectSocket,
    }),
    [socket, isConnected, player, room],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
