import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const ProtectedRoute = ({ children, requireHost = false }) => {
  const { isConnected, player } = useSocket();
  const navigate = useNavigate();

  // Read directly from storage to survive the initial render
  const savedPlayer = sessionStorage.getItem("player");
  const savedRoom = sessionStorage.getItem("room");

  useEffect(() => {
    // If no player in React state AND no player in storage, go Home.
    if (!player && !savedPlayer) {
      navigate("/");
      return;
    }

    const currentPlayer = player || JSON.parse(savedPlayer);

    // If page requires Host but user is not Host, go Home.
    if (requireHost && !currentPlayer?.isHost) {
      navigate("/");
      return;
    }
  }, [player, savedPlayer, requireHost, navigate]);

  // VITAL: Do NOT redirect purely based on `!isConnected`.
  // Sockets take a few milliseconds to connect. Show a loading screen instead.
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg animate-pulse font-bold text-gray-300">
          Reconnecting...
        </p>
      </div>
    );
  }

  // Fallback check
  if (!player && !savedPlayer) return null;

  return children;
};

export default ProtectedRoute;
