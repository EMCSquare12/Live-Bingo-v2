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

  // Initialize Socket
  useEffect(() => {
    //IP IF TESTING ON MOBILE (e.g. "http://192.168.1.5:5000")
    const newSocket = io("http://localhost:5000"); 
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      // Attempt Reconnect if session exists
      const savedSession = sessionStorage.getItem("bingoSession");
      if (savedSession) {
        const { roomId, player: savedPlayer } = JSON.parse(savedSession);
        // Ask server to restore this specific player ID
        newSocket.emit("join_room", { 
            roomId, 
            playerName: savedPlayer.name,
            playerId: savedPlayer._id 
        });
      }
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Global listeners for setting state
    newSocket.on("room_created", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
      saveSession(roomId, player);
    });

    newSocket.on("room_joined", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
      saveSession(roomId, player);
      
      // Navigate to correct page based on role
      if (player.isHost) {
        navigate(`/host/${roomId}`);
      } else {
        navigate(`/room/${roomId}`);
      }
    });

    newSocket.on("room_destroyed", () => {
        clearSession();
        alert("Room closed");
        navigate("/");
    });

    return () => newSocket.close();
  }, []);

  // Helper to save to Session Storage
  const saveSession = (roomId, playerData) => {
    sessionStorage.setItem("bingoSession", JSON.stringify({ roomId, player: playerData }));
  };

  const clearSession = () => {
    sessionStorage.removeItem("bingoSession");
    setPlayer(null);
    setRoom(null);
  };

  // Explicit Disconnect (Used by Leave/End buttons)
  const disconnectSocket = () => {
    if (socket && room && player) {
      // Notify server we are leaving explicitly
      socket.emit("leave_room", { roomId: room, playerId: player._id });
      clearSession();
      navigate("/");
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