
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/BattleLobby.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const BattleLobby = () => {
  const { ws } = useRoomWSContext();
  const navigate = useNavigate();
  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const roomCode = ws.roomCode || "----";
  const playerCount = players.filter((p) => p.connected !== false).length;
  const maxPlayers = room.cap || 0;
  const canStart = playerCount >= 5;
  const [rolePickSent, setRolePickSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const copyRoomCode = async () => {
    if (!roomCode || roomCode === "----") return;
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {}
  };

  useEffect(() => {
    if (rolePickSent) return;
    if (room.state === "CONFIG") {
      setRolePickSent(true);
      navigate("/role-pick");
    }
  }, [room.state, rolePickSent, navigate]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (m?.type === "error") {
      setSendError(m.message || "Request failed");
    }
  }, [ws.lastMsg]);

  const handleBack = () => {
    navigate("/select-mode");
  };

  return (
    <div className="battle-lobby-body">
      <button onClick={handleBack} className="back-btn">
        {"\u2190"}
      </button>

      <div className="lobby-container">
        <div className="lobby-header">
          <div className="status-badge">Waiting Room</div>
          <div className="room-display">
            <div className="room-label">ROOM CODE</div>
            <input
              type="text"
              className="room-code-input"
              value={roomCode}
              readOnly
              onClick={copyRoomCode}
            />
            <button className="copy-btn" onClick={copyRoomCode} aria-label="Copy room code">
              {"\uD83D\uDCCB"}
            </button>
          </div>
          <div className="player-count">
            <span>{"\u{1F465}"}</span>
            <span>
              {playerCount} / {maxPlayers || "?"}
            </span>
          </div>
        </div>

        <div className="section-title">PLAYERS</div>
        <div className="player-list">
          {players.length === 0 ? (
            <div className="player-card" style={{ opacity: 0.6 }}>
              Waiting for players...
            </div>
          ) : (
            players.map((player) => (
              <div
                key={player.pid}
                className={`player-card ${room.gm_pid === player.pid ? "host" : ""}`}
              >
                <div className="avatar-display" style={{ background: "#f97316" }}>
                  {(player.name || "?")[0]?.toUpperCase()}
                </div>
                <div className="player-info">
                  <span className="player-name">
                    {player.name || "Unknown"}
                    {room.gm_pid === player.pid && <span className="gm-tag"> GM</span>}
                  </span>
                  <span className="player-role">
                    {room.gm_pid === player.pid ? "GM" : "Player"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="section-title">MODE</div>
        <div className="mode-badge">VS</div>

        <div className="action-area">
          <div className="waiting-alert">
            <span className="waiting-icon">{"\u23F3"}</span>
            {canStart
              ? "Ready to start. Anyone can begin role pick."
              : "Need at least 5 players to start."}
          </div>
          <button
            className="start-btn"
            onClick={() => {
              const ok = ws.send({ type: "start_role_pick" });
              if (!ok) setSendError("WebSocket not connected");
            }}
            disabled={!canStart}
          >
            Start Game
          </button>
          {sendError && (
            <div className="send-error" style={{ color: "#ef4444", marginTop: "8px" }}>
              {sendError}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BattleLobby;
