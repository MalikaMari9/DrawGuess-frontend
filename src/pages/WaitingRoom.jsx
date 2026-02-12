
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
  const isDrawer = myRole.includes("drawer");

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
  const countdownInitialized = useRef(false);

  useEffect(() => {
    if (room.state === "IN_ROUND") {
      navigate(mode === "VS" ? "/battle-game" : "/single-game");
    }
  }, [room.state, navigate, mode]);

  useEffect(() => {
    if (!configSent || countdownInitialized.current) return;
    countdownInitialized.current = true;
    setSecretReveal(true);
    const t = setTimeout(() => setCountdown(10), 5000);
    return () => clearTimeout(t);
  }, [configSent]);

  useEffect(() => {
    if (!configSent && secretWord) {
      setConfigSent(true);
    }
  }, [secretWord, configSent]);

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
      // VS: delay start_round until countdown ends (no set_round_config in backend)
    }
  };

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        <h1>Waiting Room</h1>
        <p className="subtitle">Roles assigned. Waiting for configuration.</p>

        <div className="role-section">
          <div className="role-chip">You are: {myRole || "PLAYER"}</div>
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
            <h2>GM Config</h2>
            <input
              type="text"
              placeholder="Secret word"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            {mode === "SINGLE" ? (
              <>
                <input
                  type="number"
                  min="10"
                  max="20"
                  value={strokeLimit}
                  onChange={(e) => setStrokeLimit(Number(e.target.value))}
                  placeholder="Stroke limit"
                />
                <input
                  type="number"
                  min="180"
                  max="420"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  placeholder="Time limit sec"
                />
              </>
            ) : (
              <>
                <input
                  type="number"
                  min="3"
                  max="5"
                  value={strokesPerPhase}
                  onChange={(e) => setStrokesPerPhase(Number(e.target.value))}
                  placeholder="Strokes per phase"
                />
                <input
                  type="number"
                  min="60"
                  max="900"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  placeholder="Time limit sec"
                />
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={guessWindowSec}
                  onChange={(e) => setGuessWindowSec(Number(e.target.value))}
                  placeholder="Guess window sec"
                />
              </>
            )}
            <button className="primary-btn" onClick={handleConfigSubmit}>
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

      </div>
    </div>
  );
};

export default WaitingRoom;
