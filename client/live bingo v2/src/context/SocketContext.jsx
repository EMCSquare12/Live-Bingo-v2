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
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize socket only once
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

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
      navigate("/");
      window.location.reload(); // Force hard reload to clear state
    }
  };

  const value = useMemo(
    () => ({
      socket,
      player,
      room,
      disconnectSocket,
    }),
    [socket, player, room],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
