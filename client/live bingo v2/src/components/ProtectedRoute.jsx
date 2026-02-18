import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const ProtectedRoute = ({ children, requireHost = false }) => {
  const { isConnected, player, room, isRestoring } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Debug logs
    console.log("ProtectedRoute check:", { isRestoring, isConnected, player });

    // 2. Wait for restore
    if (isRestoring) return;

    // 3. Logic checks
    if (!isConnected) {
      console.log("Not connected, redirecting...");
      navigate("/");
      return;
    }

    if (!player || !room) {
      console.log("No player/room data, redirecting...");
      navigate("/");
      return;
    }

    if (requireHost && !player.isHost) {
      console.log("Not a host, redirecting...");
      navigate("/");
      return;
    }
  }, [isConnected, player, room, requireHost, navigate, isRestoring]);

  // 4. Loading UI
  if (isRestoring) {
      return <div className="text-black font-bold text-xl flex justify-center mt-10">Restoring Session...</div>;
  }

  if (!isConnected || !player) return null;

  return children;
};

export default ProtectedRoute;