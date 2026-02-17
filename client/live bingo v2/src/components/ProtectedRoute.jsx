import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const ProtectedRoute = ({ children, requireHost = false }) => {
  const { isConnected, player, room } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    // Not connected? Go Home.
    if (!isConnected) {
      navigate("/");
      return;
    }

    // No player data? Go Home.
    if (!player || !room) {
      // Optional: Attempt restore from sessionStorage here if needed
      navigate("/");
      return;
    }

    // Page requires Host but user is not Host? Go Home.
    if (requireHost && !player.isHost) {
      navigate("/");
      return;
    }
  }, [isConnected, player, room, requireHost, navigate]);
  if (!isConnected || !player) return null;

  return children;
};

export default ProtectedRoute;
