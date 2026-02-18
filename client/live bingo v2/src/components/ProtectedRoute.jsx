import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";


const ProtectedRoute = ({ children, requireHost = false }) => {
  const { isConnected, player, room, isRestoring } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    // Strictly do nothing until restoration is finished
    if (isRestoring) return;

    // Check if we have the necessary data
    const hasData = player && room;

    if (!isConnected || !hasData) {
      navigate("/");
      return;
    }

    if (requireHost && !player.isHost) {
      navigate("/");
      return;
    }
  }, [isConnected, player, room, requireHost, navigate, isRestoring]);

  // Show loading screen while reconnecting/restoring
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-xl font-bold animate-pulse">Restoring Session...</p>
      </div>
    );
  }

  // Prevent flicker before the useEffect redirect kicks in
  if (!isConnected || !player) return null;

  return children;
};
export default ProtectedRoute;