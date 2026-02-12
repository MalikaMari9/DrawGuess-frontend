import React from "react";
import { Link } from "react-router-dom";

const BattleCreateRoom = () => {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
      <div style={{ textAlign: "center", maxWidth: 520, padding: 24 }}>
        <h2>Battle Mode Create Room</h2>
        <p>This step is disabled for now. Use the mode select screen to create a room.</p>
        <Link to="/select-mode" style={{ color: "#f97316", textDecoration: "none" }}>
          Back to Mode Select
        </Link>
      </div>
    </div>
  );
};

export default BattleCreateRoom;
