import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import HostRoom from "./pages/HostRoom";
import PlayerRoom from "./pages/PlayerRoom";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Protected Host Route */}
        <Route
          path="/host"
          element={
            <ProtectedRoute requireHost={true}>
              <HostRoom />
            </ProtectedRoute>
          }
        />

        {/* Protected Spectator Route (Uses HostRoom UI) */}
        <Route
          path="/spectate"
          element={
            <ProtectedRoute>
              <HostRoom />
            </ProtectedRoute>
          }
        />

        {/* Protected Player Route */}
        <Route
          path="/play"
          element={
            <ProtectedRoute>
              <PlayerRoom />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
