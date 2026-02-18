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

  // 1. Check for session immediately
  const [isRestoring, setIsRestoring] = useState(() => {
    const hasSession = !!sessionStorage.getItem("bingoSession");
    console.log("SocketProvider Init: Has session to restore?", hasSession);
    return hasSession;
  });

  const navigate = useNavigate();

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);

      const savedSession = sessionStorage.getItem("bingoSession");
      if (savedSession) {
        console.log("Found session, attempting to rejoin...");
        const { roomId, player: savedPlayer } = JSON.parse(savedSession);
        newSocket.emit("join_room", {
          roomId,
          playerName: savedPlayer.name,
          playerId: savedPlayer._id
        });
      } else {
        console.log("No session found, stopping restore.");
        setIsRestoring(false);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("room_created", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
      saveSession(roomId, player);
    });

    newSocket.on("room_joined", ({ roomId, player }) => {
      console.log("Room joined successfully. Restore complete.");
      setRoom(roomId);
      setPlayer(player);
      saveSession(roomId, player);
      setIsRestoring(false); // <--- STOP LOADING

      // Only navigate if we are explicitly not on the right path
      // (Optional: You can remove this navigate if ProtectedRoute handles it)
      if (player.isHost) {
        navigate(`/host`);
      } else {
        navigate(`/play`);
      }
    });

    newSocket.on("error", (err) => {
        console.error("Socket error:", err);
        // If an error happens during restore (e.g. room closed), stop loading
        setIsRestoring(false); 
    });

    newSocket.on("room_destroyed", () => {
      clearSession();
      setIsRestoring(false);
      alert("Room closed");
      navigate("/");
    });

    return () => newSocket.close();
  }, []);

  const saveSession = (roomId, playerData) => {
    try {
        console.log("Saving session:", { roomId, playerData });
        sessionStorage.setItem("bingoSession", JSON.stringify({ roomId, player: playerData }));
        console.log("Session saved successfully!");
    } catch (error) {
        console.error("FAILED to save session:", error);
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem("bingoSession");
    setPlayer(null);
    setRoom(null);
  };

  const disconnectSocket = () => {
    if (socket && room && player) {
      socket.emit("leave_room", { roomId: room, playerId: player._id });
      clearSession();
      navigate("/");
    }
  };

  // 2. CRITICAL: Pass isRestoring in value
  const value = useMemo(
    () => ({
      socket,
      isConnected,
      player,
      setPlayer,
      room,
      setRoom,
      disconnectSocket,
      isRestoring, 
    }),
    [socket, isConnected, player, room, isRestoring],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};