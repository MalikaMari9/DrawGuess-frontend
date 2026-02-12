import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/landingpage";
import SelectMode from "./pages/SelectMode";

// Single Mode Imports
import SingleCreateRoom from "./pages/SingleCreateRoom";
import SingleLobby from "./pages/SingleLobby";
import SingleGame from "./pages/SingleGame";
import SingleWin from "./pages/SingleWin";

// Battle Mode Imports
import BattleCreateRoom from "./pages/BattleCreateRoom";
import BattleLobby from "./pages/BattleLobby";
import BattleRoundWin from "./pages/BattleRoundWin";
import BattleGame from "./pages/BattleGame";
import BattleWinFinal from "./pages/BattlwWinFinal";
import RolePick from "./pages/RolePick";
import WaitingRoom from "./pages/WaitingRoom";
import AdminPanel from "./pages/AdminPanel";

import "./App.css";
import { RoomWSProvider } from "./ws/RoomWSContext";

function App() {
  return (
    <RoomWSProvider>
      <Router>
        <div className="App">
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/select-mode" element={<SelectMode />} />

          <Route path="/single-mode/create" element={<SingleCreateRoom />} />
          <Route path="/single-lobby" element={<SingleLobby />} />
          <Route path="/single-lobby/:roomCode" element={<SingleLobby />} />
          <Route path="/single-game" element={<SingleGame />} />
          <Route path="/single-game/:roomId" element={<SingleGame />} />
          <Route path="/single-win" element={<SingleWin />} />

          <Route path="/battle-mode/create" element={<BattleCreateRoom />} />
          <Route path="/battle-lobby" element={<BattleLobby />} />
          <Route path="/battle-round-win" element={<BattleRoundWin />} />
          <Route path="/battle-game" element={<BattleGame />} />
          <Route path="/battle-win" element={<BattleWinFinal />} />
          <Route path="/role-pick" element={<RolePick />} />
          <Route path="/waiting-room" element={<WaitingRoom />} />
          <Route path="/admin" element={<AdminPanel />} />

          <Route
            path="*"
            element={
              <div
                style={{
                  color: "white",
                  padding: "20px",
                  textAlign: "center",
                  minHeight: "100vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)",
                }}
              >
                <div>
                  <h1 style={{ fontSize: "4rem", marginBottom: "1rem", color: "#ef4444" }}>404</h1>
                  <p style={{ fontSize: "1.3rem", marginBottom: "2rem", color: "#94a3b8" }}>
                    Page Not Found
                  </p>
                  <a
                    href="/"
                    style={{
                      color: "#f97316",
                      textDecoration: "none",
                      padding: "12px 24px",
                      border: "2px solid #f97316",
                      borderRadius: "999px",
                      fontSize: "1.1rem",
                      fontWeight: "bold",
                      transition: "all 0.2s",
                      display: "inline-block",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f97316";
                      e.target.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                      e.target.style.color = "#f97316";
                    }}
                  >
                    Go back home
                  </a>
                </div>
              </div>
            }
          />
          </Routes>
        </div>
      </Router>
    </RoomWSProvider>
  );
}

export default App;
