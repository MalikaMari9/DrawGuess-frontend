import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/RolePick.css";
import "../styles/BattleLobby.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const RolePick = () => {
  const { ws } = useRoomWSContext();
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(10);

  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const isVS = (room.mode || "").toUpperCase() === "VS";

  const gmPid = room.gm_pid || null;
  const gmPlayer = players.find((p) => p.pid === gmPid) || null;

  const splitTeams = useMemo(() => {
    const basePlayers = players;
    const red = [];
    const blue = [];
    const noTeam = [];
    basePlayers.forEach((p) => {
      if (gmPid && p.pid === gmPid) return;
      if (p.team === "A") red.push(p);
      else if (p.team === "B") blue.push(p);
      else if (typeof p.role === "string") {
        if (p.role.endsWith("A")) red.push(p);
        else if (p.role.endsWith("B")) blue.push(p);
        else noTeam.push(p);
      } else {
        noTeam.push(p);
      }
    });
    return { red, blue, noTeam };
  }, [players, gmPid]);

  const rolesList = useMemo(() => {
    if (!players.length) return [];
    return players.map((p) => ({
      pid: p.pid,
      name: p.name || "Unknown",
      role: p.role || "player",
    }));
  }, [players]);

  useEffect(() => {
    const spinTimer = setTimeout(() => setSpinning(false), 3500);
    return () => clearTimeout(spinTimer);
  }, []);

  useEffect(() => {
    if (ws.status === "connected") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, ws.send]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate("/waiting-room");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, navigate]);

  return (
    <div className="role-pick">
      <div className="role-pick__header">
        <h1>Role Pick</h1>
        <p>Spinning the wheel... roles are being assigned.</p>
      </div>

      <div className="wheel-wrap">
        <div className={`wheel ${spinning ? "spinning" : ""}`}>
          {rolesList.map((p, idx) => (
            <div key={p.pid || idx} className="wheel__slice">
              <span>{p.name}</span>
            </div>
          ))}
        </div>
        <div className="wheel-pointer" />
      </div>

      {!spinning && (
        <div className="role-pick__results">
          <h2>Assigned Roles</h2>

          {isVS ? (
            <div className="role-pick__teams">
              {gmPlayer && (
                <div className="gm-standalone">
                  <div className="gm-title">GAME MASTER</div>
                  <div className="player-card">
                    <div className="avatar-display" style={{ background: "#facc15", color: "#111827" }}>
                      {(gmPlayer.name || "GM")[0]?.toUpperCase()}
                    </div>
                    <div className="player-info">
                      <span className="player-name">
                        {gmPlayer.name || "GM"}
                        <span className="gm-badge">GM</span>
                      </span>
                      <span className="player-role">HOST</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="battle-arena">
              <div className="team-side">
                <div className="team-header">
                  <span className="team-title text-red">RED TEAM</span>
                  <div className="team-count bg-red">{splitTeams.red.length}</div>
                </div>
                <div className="player-list">
                  {splitTeams.red.length === 0 ? (
                    <div className="player-card" style={{ opacity: 0.6 }}>
                      Waiting for players...
                    </div>
                  ) : (
                    splitTeams.red.map((player) => (
                      <div key={player.pid} className="player-card">
                        <div className="avatar-display" style={{ background: "#ef4444" }}>
                          {(player.name || "?")[0]?.toUpperCase()}
                        </div>
                        <div className="player-info">
                          <span className="player-name">
                            {player.name || "Unknown"}
                            {room.gm_pid === player.pid && (
                              <span className="gm-badge">GM</span>
                            )}
                          </span>
                          <span className="player-role">
                            {(player.role || "player").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="vs-badge-container">
                <div className="vs-badge">VS</div>
              </div>

              <div className="team-side">
                <div className="team-header">
                  <span className="team-title text-green">BLUE TEAM</span>
                  <div className="team-count bg-green">{splitTeams.blue.length}</div>
                </div>
                <div className="player-list">
                  {splitTeams.blue.length === 0 ? (
                    <div className="player-card" style={{ opacity: 0.6 }}>
                      Waiting for players...
                    </div>
                  ) : (
                    splitTeams.blue.map((player) => (
                      <div key={player.pid} className="player-card">
                        <div className="avatar-display" style={{ background: "#22c55e" }}>
                          {(player.name || "?")[0]?.toUpperCase()}
                        </div>
                        <div className="player-info">
                          <span className="player-name">
                            {player.name || "Unknown"}
                            {room.gm_pid === player.pid && (
                              <span className="gm-badge">GM</span>
                            )}
                          </span>
                          <span className="player-role">
                            {(player.role || "player").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {splitTeams.noTeam.length > 0 && (
                <div className="action-area">
                  <div className="waiting-alert">
                    <span className="waiting-icon">{"\u23F3"}</span>
                    {splitTeams.noTeam.length} player(s) awaiting team assignment...
                  </div>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="role-grid">
              {rolesList.map((p) => (
                <div key={p.pid} className="role-card">
                  <div className="role-name">{p.name}</div>
                  <div className="role-tag">{p.role?.toUpperCase() || "PLAYER"}</div>
                </div>
              ))}
            </div>
          )}

          <div className="role-note">
            Room {room?.mode || "SINGLE"} {"\u2192"} proceeding to configuration...
          </div>
          <div className="role-countdown">
            Moving to waiting room in {secondsLeft}s
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePick;
