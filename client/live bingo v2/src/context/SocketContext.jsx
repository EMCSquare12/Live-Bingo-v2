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

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize socket only once
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    // Listen for connection events
    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Global listeners
    newSocket.on("room_joined", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
    });

    // Cleanup on unmount
    return () => newSocket.close();
  }, []);

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setPlayer(null);
      setRoom(null);
      setIsConnected(false);
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
