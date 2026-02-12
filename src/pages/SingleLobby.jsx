import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/SingleLobby.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const SingleLobby = () => {
  const { ws } = useRoomWSContext();
  const navigate = useNavigate();
  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const roomCode = ws.roomCode || "----";
  const playerCount = players.filter((p) => p.connected !== false).length;
  const maxPlayers = room.cap || 0;
  const canStart = playerCount >= 3;
  const [lastSendOk, setLastSendOk] = useState(null);
  const [rolePickSent, setRolePickSent] = useState(false);

  const copyCode = () => {
    if (!roomCode || roomCode === "----") return;
    navigator.clipboard.writeText(roomCode);
  };

  useEffect(() => {
    if (rolePickSent) return;
    if (room.state === "ROLE_PICK") {
      setRolePickSent(true);
      navigate("/role-pick");
    }
  }, [room.state, rolePickSent, navigate]);

  return (
    <div className="lobby-body">
      <Link to="/select-mode" className="back-btn">
        ←
      </Link>

      <div className="lobby-frame">
        <div className="page-label">WAITING ROOM</div>

        <div className="lobby-header">
          <div className="room-code-box" onClick={copyCode}>
            <span className="code-label">CODE</span>
            <span className="code-value">{roomCode}</span>
          </div>
          <button className="copy-btn" onClick={copyCode} aria-label="Copy room code">
            {"\uD83D\uDCCB"}
          </button>

          <div className="player-count">
            <span>👥</span>
            <span>
              {playerCount} / {maxPlayers || "?"}
            </span>
          </div>
        </div>

        <div>
          <div className="section-title">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                fill="white"
              />
            </svg>
            PLAYERS
          </div>

          <div className="player-list">
            {players.length === 0 ? (
              <div className="player-card">Waiting for players...</div>
            ) : (
              players.map((player) => (
                <div
                  key={player.pid}
                  className={`player-card ${room.gm_pid === player.pid ? "host" : ""}`}
                >
                  <div className="avatar">
                    {room.gm_pid === player.pid && <span className="crown">👑</span>}
                    {(player.name || "?")[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{player.name || "Unknown"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="section-title">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
                fill="white"
              />
            </svg>
            MODE
          </div>
          <div className="mode-badge">
            <span>SINGLE</span>
          </div>
        </div>

        <div className="status-bar">
          <div className="pulse-dot"></div>
          <span>
            {canStart
              ? "Ready to start. Anyone can begin role pick."
              : "Need at least 3 players to start."}
          </span>
        </div>

        <button
          className="start-btn"
          onClick={() => {
            const ok = ws.send({ type: "start_role_pick" });
            setLastSendOk(ok);
          }}
          disabled={!canStart}
        >
          Start Game
        </button>

      </div>
    </div>
  );
};

export default SingleLobby;
