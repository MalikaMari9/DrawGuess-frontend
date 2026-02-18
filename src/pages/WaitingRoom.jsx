
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/WaitingRoom.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const WaitingRoom = () => {
  const { ws } = useRoomWSContext();
  const navigate = useNavigate();
  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const roles = snapshot.roles || {};
  const roundConfig = snapshot.round_config || {};
  const mode = room.mode || "SINGLE";
  const myPid = ws.pid || localStorage.getItem("dg_pid");
  const me = players.find((p) => p.pid === myPid) || {};
  const myRole = me.role || "";
  const isGM = room.gm_pid && myPid && room.gm_pid === myPid;
  const isDrawer =
    myRole.includes("drawer") ||
    (myPid && (myPid === roles?.drawerA || myPid === roles?.drawerB || myPid === roles?.drawer));
  const myTeam =
    me.team ||
    (typeof myRole === "string" && myRole.endsWith("A")
      ? "A"
      : typeof myRole === "string" && myRole.endsWith("B")
      ? "B"
      : null);
  const teamName =
    myTeam === "A" ? "Red Team" : myTeam === "B" ? "Blue Team" : "No Team";
  const displayRole =
    isGM ? "GM" : isDrawer ? "Drawer" : "Guesser";
  const teamMembers = myTeam
    ? players.filter((p) => p.team === myTeam)
    : [];
  const teamConnected = teamMembers.filter((p) => p.connected !== false);
  const teamDisconnected = teamMembers.filter((p) => p.connected === false);

  const [secret, setSecret] = useState("");
  const [strokeLimit, setStrokeLimit] = useState(12);
  const [timeLimit, setTimeLimit] = useState(240);
  const [drawWindowSec, setDrawWindowSec] = useState(60);
  const [strokesPerPhase, setStrokesPerPhase] = useState(4);
  const [guessWindowSec, setGuessWindowSec] = useState(10);
  const [maxRounds, setMaxRounds] = useState(5);
  const [configSent, setConfigSent] = useState(false);
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [serverSync, setServerSync] = useState({ serverTs: 0, clientTs: 0 });
  const [secretReveal, setSecretReveal] = useState(false);

  const secretWord = roundConfig.secret_word || "";
  const configReady = Boolean(roundConfig.config_ready);
  const secretRequestedRef = useRef(false);

  const effectiveServerNow = serverSync.serverTs
    ? serverSync.serverTs + (nowSec - serverSync.clientTs)
    : nowSec;
  const countdownEndAt = Number(room.countdown_end_at || 0);
  const countdownLeft = countdownEndAt ? Math.max(0, countdownEndAt - effectiveServerNow) : null;

  useEffect(() => {
    if (room.state === "IN_GAME") {
      navigate(mode === "VS" ? "/battle-game" : "/single-game");
    }
  }, [room.state, navigate, mode]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "room_state_changed" && m.state === "IN_GAME") {
      navigate(mode === "VS" ? "/battle-game" : "/single-game");
    }
  }, [ws.lastMsg, navigate, mode]);

  useEffect(() => {
    if (ws.status === "CONNECTED") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, room.state, configReady, ws.send]);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const st = Number(snapshot.server_ts || 0);
    if (!st) return;
    setServerSync({ serverTs: st, clientTs: Math.floor(Date.now() / 1000) });
  }, [snapshot.server_ts]);

  useEffect(() => {
    if (room.state !== "CONFIG") return;
    if (ws.status !== "CONNECTED") return;
    const id = setInterval(() => ws.send({ type: "snapshot" }), 2000);
    return () => clearInterval(id);
  }, [room.state, ws.status, ws.send]);

  useEffect(() => {
    if (!isGM) return;
    if (!configReady) return;
    setSecretReveal(true);
  }, [configReady, isGM]);

  useEffect(() => {
    if (isGM) return;
    if (configReady || secretWord) {
      setSecretReveal(true);
    }
  }, [isGM, configReady, secretWord]);

  useEffect(() => {
    if (!configSent && (configReady || secretWord)) {
      setConfigSent(true);
    }
  }, [secretWord, configReady, configSent]);

  useEffect(() => {
    if (!isGM) return;
    if (!configReady) return;
    if (typeof roundConfig.secret_word === "string") setSecret(roundConfig.secret_word);
    if (mode === "SINGLE") {
      if (roundConfig.time_limit_sec != null) setTimeLimit(Number(roundConfig.time_limit_sec));
      if (roundConfig.stroke_limit != null) setStrokeLimit(Number(roundConfig.stroke_limit));
    } else {
      if (roundConfig.draw_window_sec != null) setDrawWindowSec(Number(roundConfig.draw_window_sec));
      if (roundConfig.strokes_per_phase != null) setStrokesPerPhase(Number(roundConfig.strokes_per_phase));
      if (roundConfig.guess_window_sec != null) setGuessWindowSec(Number(roundConfig.guess_window_sec));
      if (roundConfig.max_rounds != null) setMaxRounds(Number(roundConfig.max_rounds));
    }
  }, [isGM, configReady, mode, roundConfig]);

  useEffect(() => {
    if (!isDrawer) return;
    if (!configReady) return;
    if (secretWord) {
      secretRequestedRef.current = false;
      return;
    }
    if (secretRequestedRef.current) return;
    secretRequestedRef.current = true;
    ws.send({ type: "snapshot" });
  }, [isDrawer, configReady, secretWord, ws]);

  const handleConfigSubmit = async () => {
    if (!secret.trim()) return;
    setConfigSent(true);

    if (mode === "SINGLE") {
      ws.send({
        type: "set_round_config",
        secret_word: secret.trim(),
        stroke_limit: Number(strokeLimit),
        time_limit_sec: Number(timeLimit),
      });
    } else {
      ws.send({
        type: "set_vs_config",
        secret_word: secret.trim(),
        draw_window_sec: Number(drawWindowSec),
        strokes_per_phase: Number(strokesPerPhase),
        guess_window_sec: Number(guessWindowSec),
        max_rounds: Number(maxRounds),
      });
    }
  };

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        <div className="card-header">
          <h2>WAITING ROOM</h2>
          <p className="subtitle">Roles assigned. Waiting for configuration.</p>
        </div>

        <div className="role-section">
          <div className="role-chip">
            You are: {displayRole}
            {mode === "VS" && myTeam && ` · ${teamName}`}
          </div>
          {mode === "VS" && myTeam && teamMembers.length > 0 && (
            <div className="team-panel">
              <div className="team-title">{teamName}</div>
              <div className="team-list">
                {teamConnected.map((p) => (
                  <div key={p.pid} className="team-member">
                    <span className="team-avatar">
                      {(p.name || "?")[0]?.toUpperCase()}
                    </span>
                    <span className="team-name">{p.name || "Unknown"}</span>
                    {p.role?.includes("drawer") ? (
                      <span className="team-role">Drawer</span>
                    ) : (
                      <span className="team-role">Guesser</span>
                    )}
                  </div>
                ))}
              </div>
              {teamDisconnected.length > 0 && (
                <details className="team-disconnected">
                  <summary>Disconnected ({teamDisconnected.length})</summary>
                  <div className="team-list" style={{ marginTop: 10, opacity: 0.6 }}>
                    {teamDisconnected.map((p) => (
                      <div key={p.pid} className="team-member" style={{ filter: "grayscale(0.6)" }}>
                        <span className="team-avatar" style={{ background: "#64748b" }}>
                          {(p.name || "?")[0]?.toUpperCase()}
                        </span>
                        <span className="team-name">{p.name || "Unknown"}</span>
                        <span className="team-role">Offline</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          {isDrawer && secretReveal && secretWord && (
            <div className="secret-word">
              Secret word: <span>{secretWord}</span>
            </div>
          )}
          {!isDrawer && secretReveal && (
            <div className="secret-word">
              Secret word is hidden. Get ready to guess.
            </div>
          )}
        </div>

        {isGM ? (
          <div className="config-panel">
            <div className="form-row">
              <label htmlFor="secretWord">Keyword</label>
              <input
                id="secretWord"
                type="text"
                placeholder="e.g. Apple, Tiger"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
            {mode === "SINGLE" ? (
              <>
                <div className="form-row">
                  <label htmlFor="strokeLimit">Stroke Limit</label>
                  <input
                    id="strokeLimit"
                    type="number"
                    min="10"
                    max="20"
                    value={strokeLimit}
                    onChange={(e) => setStrokeLimit(Number(e.target.value))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="timeLimit">Time Limit</label>
                  <input
                    id="timeLimit"
                    type="number"
                    min="180"
                    max="420"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="strokesPerPhase">Strokes/Phase</label>
                  <input
                    id="strokesPerPhase"
                    type="number"
                    min="3"
                    max="5"
                    value={strokesPerPhase}
                    onChange={(e) => setStrokesPerPhase(Number(e.target.value))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="drawWindowVs">Draw Window</label>
                  <input
                    id="drawWindowVs"
                    type="number"
                    min="10"
                    max="600"
                    value={drawWindowSec}
                    onChange={(e) => setDrawWindowSec(Number(e.target.value))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="guessWindowSec">Guess Window</label>
                  <input
                    id="guessWindowSec"
                    type="number"
                    min="5"
                    max="60"
                    value={guessWindowSec}
                    onChange={(e) => setGuessWindowSec(Number(e.target.value))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="maxRounds">Max Rounds</label>
                  <input
                    id="maxRounds"
                    type="number"
                    min="1"
                    max="20"
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value))}
                  />
                </div>
              </>
            )}
            {!configReady ? (
              <button className="start-btn" onClick={handleConfigSubmit} disabled={!secret.trim()}>
                Confirm & Start Countdown
              </button>
            ) : (
              <div className="waiting-panel">
                <p>Config sent. Waiting for countdown...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="waiting-panel">
            <p>Waiting for GM to configure the round...</p>
          </div>
        )}

        {countdownLeft !== null && countdownLeft > 0 && (
          <div className="countdown">
            Game starts in <span>{countdownLeft}</span>
          </div>
        )}

        <div className="debug-panel">
          <div>Mode: {mode}</div>
          <div>Room state: {room.state || "?"}</div>
          <div>gm_pid: {room.gm_pid || "?"}</div>
          <div>myPid: {myPid || "?"}</div>
          <div>me found: {String(Boolean(me && me.pid))}</div>
          <div>Config ready: {String(configReady)}</div>
          <div>Secret in snapshot: {String(Boolean(secretWord))}</div>
          <div>My role: {myRole || "?"}</div>
          <div>My team: {myTeam || "none"}</div>
        </div>

      </div>
    </div>
  );
};

export default WaitingRoom;
