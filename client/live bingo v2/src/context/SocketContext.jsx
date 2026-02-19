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
  const [initialGameState, setInitialGameState] = useState(null);
  const [player, setPlayer] = useState(() => {
    const saved = sessionStorage.getItem("bingoSession");
    return saved ? JSON.parse(saved).player : null;
  });
 const [room, setRoom] = useState(() => {
    const saved = sessionStorage.getItem("bingoSession");
    return saved ? JSON.parse(saved).roomId : null;
  });

  // Check for session immediately
  const [isRestoring, setIsRestoring] = useState(() => {
    return !!sessionStorage.getItem("bingoSession");
  });

  const navigate = useNavigate();

useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      const savedSession = sessionStorage.getItem("bingoSession");
      if (savedSession) {
        const { roomId, player: savedPlayer } = JSON.parse(savedSession);
        newSocket.emit("join_room", {
          roomId,
          playerName: savedPlayer.name,
          playerId: savedPlayer._id
        });
      } else {
        setIsRestoring(false);
      }
    });

    newSocket.on("room_joined", (data) => {
      setRoom(data.roomId);
      setPlayer(data.player);
      
      // Store the synced game state provided by the server!
      setInitialGameState({
        status: data.status || "waiting",
        numbersDrawn: data.numbersDrawn || [],
        currentNumber: data.currentNumber || null
      });

      saveSession(data.roomId, data.player);
      setIsRestoring(false);
    });

    // Handle re-joining as a spectator if the game started
    newSocket.on("spectator_joined", ({ gameState }) => {
      setRoom(gameState.roomId);
      setPlayer((prev) => ({ name: prev?.name || "Spectator", isSpectator: true, isHost: false }));
      
      // Spectators need to know current progress too
      setInitialGameState({
        status: gameState.status || "waiting",
        numbersDrawn: gameState.numbersDrawn || [],
        currentNumber: gameState.currentNumber || null
      });
      setIsRestoring(false);
    });

    newSocket.on("error", (err) => {
      console.error("Socket error:", err);
      // If restore fails (e.g. room closed), clear and stop loading
      if (isRestoring) {
        clearSession();
        setIsRestoring(false);
      }
    });

    newSocket.on("room_destroyed", () => {
      clearSession();
      setIsRestoring(false);
      navigate("/");
    });

    newSocket.on("room_created", ({ roomId, player }) => {
      setRoom(roomId);
      setPlayer(player);
      setInitialGameState({
        status: "waiting",
        numbersDrawn: [],
        currentNumber: null
      });
      saveSession(roomId, player);
      setIsRestoring(false);
    });

    return () => newSocket.close();
  }, [navigate]);

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

  // CRITICAL: Pass isRestoring in value
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
      initialGameState
    }),
    [socket, isConnected, player, room, isRestoring],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};