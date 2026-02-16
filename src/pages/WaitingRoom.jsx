
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

  const [secret, setSecret] = useState("");
  const [strokeLimit, setStrokeLimit] = useState(12);
  const [timeLimit, setTimeLimit] = useState(240);
  const [strokesPerPhase, setStrokesPerPhase] = useState(4);
  const [guessWindowSec, setGuessWindowSec] = useState(10);
  const [configSent, setConfigSent] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [secretReveal, setSecretReveal] = useState(false);
  const [startTriggered, setStartTriggered] = useState(false);

  const secretWord = roundConfig.secret_word || "";
  const configReady = Boolean(roundConfig.config_ready);
  const countdownInitialized = useRef(false);

  useEffect(() => {
    if (room.state === "IN_ROUND") {
      navigate(mode === "VS" ? "/battle-game" : "/single-game");
    }
  }, [room.state, navigate, mode]);

  useEffect(() => {
    if (ws.status === "CONNECTED") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, room.state, configReady, ws.send]);

  useEffect(() => {
    if (!configSent || countdownInitialized.current) return;
    countdownInitialized.current = true;
    setSecretReveal(true);
    const t = setTimeout(() => setCountdown(10), 5000);
    return () => clearTimeout(t);
  }, [configSent]);

  useEffect(() => {
    if (!configSent && (configReady || secretWord)) {
      setConfigSent(true);
    }
  }, [secretWord, configReady, configSent]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (!startTriggered) {
        if (mode === "SINGLE") {
          ws.send({ type: "start_game" });
        } else {
          ws.send({
            type: "start_round",
            secret_word: secret.trim(),
            time_limit_sec: Number(timeLimit),
            strokes_per_phase: Number(strokesPerPhase),
            guess_window_sec: Number(guessWindowSec),
          });
        }
        setStartTriggered(true);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, ws, mode, secret, timeLimit, strokesPerPhase, guessWindowSec, startTriggered]);

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
        time_limit_sec: Number(timeLimit),
        strokes_per_phase: Number(strokesPerPhase),
        guess_window_sec: Number(guessWindowSec),
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
                {teamMembers.map((p) => (
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
                  <label htmlFor="timeLimitVs">Time Limit</label>
                  <input
                    id="timeLimitVs"
                    type="number"
                    min="60"
                    max="900"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
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
              </>
            )}
            <button className="start-btn" onClick={handleConfigSubmit}>
              Confirm & Start Countdown
            </button>
          </div>
        ) : (
          <div className="waiting-panel">
            <p>Waiting for GM to configure the round...</p>
          </div>
        )}

        {countdown !== null && (
          <div className="countdown">
            Game starts in <span>{countdown}</span>
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
