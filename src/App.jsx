// src/App.jsx
import { useEffect, useState } from "react";
import { useRoomWS } from "./ws/useRoomWS";

function Home({ busy, onCreate, onJoin, wsBase }) {
  const [name, setName] = useState("Malika");
  const [mode, setMode] = useState("SINGLE");
  const [cap, setCap] = useState(8);
  const [roomCode, setRoomCode] = useState("");

  return (
    <div style={{ padding: 18, maxWidth: 700, margin: "0 auto" }}>
      <h2>DrawGuess</h2>

      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 6 }}>Name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #ccc", padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Create</h3>

          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Mode</div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="SINGLE">SINGLE</option>
              <option value="VS">VS</option>
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Capacity</div>
            <input
              type="number"
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <button
            onClick={() => onCreate({ name, mode, cap: Number(cap) })}
            disabled={busy}
            style={{ width: "100%", padding: 10 }}
          >
            {busy ? "Working..." : "Create Room"}
          </button>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Join</h3>

          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Room Code</div>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              style={{ width: "100%", padding: 10, textTransform: "uppercase" }}
            />
          </div>

          <button
            onClick={() => onJoin({ name, roomCode: roomCode.trim() })}
            disabled={busy || !roomCode.trim()}
            style={{ width: "100%", padding: 10 }}
          >
            {busy ? "Working..." : "Join Room"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Backend WS: <span style={{ fontFamily: "monospace" }}>{wsBase}</span>
      </div>
    </div>
  );
}

function Lobby({ ws, name, myPid, onBack }) {
  const players = ws.snapshot?.players ?? [];
  const room = ws.snapshot?.room ?? null;
  const roles = ws.snapshot?.roles ?? {};
  const game = ws.snapshot?.game ?? {};
  const modlog = ws.snapshot?.modlog ?? [];
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [lastRoundEnd, setLastRoundEnd] = useState(null);
  const [lastGuessResult, setLastGuessResult] = useState(null);

  // Get budget from game state (included in snapshot for VS mode)
  const budget = game.budget || {};

  const mode = room?.mode ?? "SINGLE";
  const state = room?.state ?? "WAITING";
  const phase = game?.phase ?? "";
  const guessWindowSeconds = Number(game?.guess_window_sec || 0);
  const score = game?.score || { A: 0, B: 0 };
  const roundEndAt = Number(game?.round_end_at || 0);
  const guessEndAt = Number(game?.guess_end_at || 0);

  // Find current player by PID
  const currentPlayer = myPid ? players.find((p) => p.pid === myPid) : null;
  const currentPid = currentPlayer?.pid;
  const currentTeam = currentPlayer?.team;
  const currentRole = currentPlayer?.role;
  const mutedUntil = Number(currentPlayer?.muted_until || 0);
  const isMuted = mutedUntil > nowSec;
  const mutedRemainingSec = isMuted ? mutedUntil - nowSec : 0;

  const isGM = room?.gm_pid === myPid;
  const isDrawer = (currentRole || "").toLowerCase().includes("drawer");
  const isGuesser = (currentRole || "").toLowerCase().includes("guesser");
  const lastError = ws.lastMsg?.type === "error" ? ws.lastMsg : null;
  const gmName = room?.gm_pid ? players.find((p) => p.pid === room.gm_pid)?.name : null;

  // Build teams
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const [word, setWord] = useState("");

  // VS mode GM-configurable settings
  const [strokeLimit, setStrokeLimit] = useState(3); // strokes_per_phase (3–5)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(4); // drawing phase minutes (e.g. 4 -> 240s)
  const [guessWindowSec, setGuessWindowSec] = useState(10);

  const [guess, setGuess] = useState("");

  const [drawerA, setDrawerA] = useState(roles.drawerA || "");
  const [drawerB, setDrawerB] = useState(roles.drawerB || "");

  const [modAction, setModAction] = useState("warn");
  const [modTarget, setModTarget] = useState("");
  const [modReason, setModReason] = useState("");
  const [modDurationSec, setModDurationSec] = useState(60);
  const [devOpen, setDevOpen] = useState(false);
  const [singleSecret, setSingleSecret] = useState("apple");
  const [singleStrokeLimit, setSingleStrokeLimit] = useState(12);
  const [singleTimeLimit, setSingleTimeLimit] = useState(240);

  const [vsSecret, setVsSecret] = useState("elephant");
  const [vsTimeLimit, setVsTimeLimit] = useState(240);
  const [vsStrokes, setVsStrokes] = useState(4);
  const [vsGuessWindow, setVsGuessWindow] = useState(10);
  // ✅ keep only ONE effect (you had it twice)
  useEffect(() => {
    if (roles.drawerA) setDrawerA(roles.drawerA);
    if (roles.drawerB) setDrawerB(roles.drawerB);
  }, [roles.drawerA, roles.drawerB]);

  // Track last round results + guesses for simple scoring display
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "round_end") setLastRoundEnd(m);
    if (m.type === "guess_result") setLastGuessResult(m);
  }, [ws.lastMsg]);

  // Local timer tick for countdown display
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const drawRemainingSec =
    phase === "DRAW" && roundEndAt ? Math.max(0, roundEndAt - nowSec) : null;
  const guessRemainingSec =
    phase === "GUESS" && guessEndAt ? Math.max(0, guessEndAt - nowSec) : null;

  const canPhaseTick =
    state === "IN_ROUND" &&
    (phase === "DRAW" || phase === "GUESS") &&
    ((phase === "DRAW" && (!roundEndAt || nowSec < roundEndAt)) ||
      (phase === "GUESS" && (!guessEndAt || nowSec < guessEndAt)));

  const formatCountdown = (sec) => {
    if (sec === null) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Auto-advance GUESS phase after GM-configured timer (GM only)
  useEffect(() => {
    if (state !== "IN_ROUND") return;
    if (phase !== "GUESS") return;
    if (!isGM) return;
    if (!canPhaseTick) return;

    const delayMs = guessEndAt
      ? Math.max(0, guessEndAt - nowSec) * 1000
      : guessWindowSeconds * 1000;

    if (!delayMs) return;

    const t = setTimeout(() => {
      if (canPhaseTick) ws.send({ type: "phase_tick" });
    }, delayMs);

    return () => clearTimeout(t);
  }, [state, phase, isGM, guessWindowSeconds, guessEndAt, nowSec, canPhaseTick, ws]);

  // Handle VS mode specific actions
  const handleSetTeam = (team) => {
    if (state === "WAITING") {
      if (isMuted) return;
      ws.send({ type: "set_team", team });
    }
  };

  // ✅ IMPORTANT FIX:
  // Button must work BEFORE GM exists, so DON'T require isGM here.
  // Also backend message is likely "vs_start" (your Postman tests).
  const handleStartRolePick = () => {
    if (state === "WAITING" || state === "ROLE_PICK") {
      if (isMuted) return;
      ws.send({ type: "start_role_pick" });
    }
  };

  const handleStartRound = () => {
    if (state === "CONFIG" && isGM && word.trim()) {
      if (isMuted) return;
      ws.send({
        type: "start_round",
        secret_word: word.trim(),
        time_limit_sec: timeLimitMinutes * 60,
        strokes_per_phase: strokeLimit,
        guess_window_sec: guessWindowSec,
      });
      setWord("");
    }
  };

  const handleGuess = () => {
    if (state === "IN_ROUND" && phase === "GUESS" && isGuesser && guess.trim()) {
      if (isMuted) return;
      ws.send({ type: "guess", text: guess.trim() });
      setGuess("");
    }
  };

  const handlePhaseTick = () => {
    if (isGM && canPhaseTick) {
      if (isMuted) return;
      ws.send({ type: "phase_tick" });
    }
  };

  const handleSabotage = () => {
    if (state === "IN_ROUND" && isDrawer && currentTeam) {
      if (isMuted) return;
      const targetTeam = currentTeam === "A" ? "B" : "A";
      const ok = ws.send({
        type: "sabotage",
        target: targetTeam,
        op: {
          t: "line",
          pid: "client",
          tool: "line",
          c: "#ff0000",
          w: 3,
          pts: [
            [50, 50],
            [150, 150],
          ],
          sab: 1,
        },
      });
      if (ok) ws.send({ type: "snapshot" });
    }
  };

  // Handle drawing (simplified - just send test draw op)
  const handleDraw = () => {
    if (state === "IN_ROUND" && phase === "DRAW" && isDrawer) {
      if (isMuted) return;
      const ok = ws.send({
        type: "draw_op",
        canvas: currentTeam,
        op: {
          t: "line",
          pid: "client",
          tool: "line",
          c: "#000000",
          w: 2,
          pts: [
            [10, 10],
            [100, 100],
          ],
          sab: 0,
        },
      });
      if (ok) ws.send({ type: "snapshot" });
    }
  };

  const handleModeration = () => {
    if (!isGM || !modTarget) return;
    if (modAction === "mute" && (!modDurationSec || modDurationSec <= 0)) return;
    ws.send({
      type: "moderation",
      action: modAction,
      target: modTarget,
      reason: modReason.trim(),
      duration_sec: modAction === "mute" ? Number(modDurationSec) : undefined,
    });
    setModReason("");
  };

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Lobby {mode === "VS" ? "(VS Mode)" : ""}</h2>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Room: <b>{ws.roomCode}</b> • You: <b>{name}</b> • WS: <b>{ws.status}</b>
            {currentTeam && ` • Team: ${currentTeam}`}
            {currentRole && ` • Role: ${currentRole}`}
            {isGM && " • [GM]"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            State: <b>{state}</b> {phase && `• Phase: ${phase}`} {room?.round_no ? `• Round: ${room.round_no}` : ""}
          </div>
          {phase === "DRAW" && drawRemainingSec !== null && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Draw Countdown: <b>{formatCountdown(drawRemainingSec)}</b>
            </div>
          )}
          {phase === "GUESS" && guessRemainingSec !== null && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Guess Countdown: <b>{formatCountdown(guessRemainingSec)}</b>
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Score: <b>A</b> {score.A ?? 0} - <b>B</b> {score.B ?? 0}
          </div>
          {state === "ROUND_END" && lastRoundEnd && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Round End: {lastRoundEnd.winner ? `Winner Team ${lastRoundEnd.winner}` : "No winner"} •
              Word: {lastRoundEnd.word}
            </div>
          )}
          {lastGuessResult && (
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
              Last Guess: {lastGuessResult.text} • {lastGuessResult.correct ? "Correct" : "Wrong"}
            </div>
          )}
          {lastError && (
            <div style={{ marginTop: 6, color: "#b00020", fontSize: 12 }}>
              Error: {lastError.code} — {lastError.message}
            </div>
          )}
          {isMuted && (
            <div style={{ marginTop: 6, color: "#8a4b0f", fontSize: 12 }}>
              You are muted for {mutedRemainingSec}s.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => ws.send({ type: "snapshot" })} disabled={ws.status !== "CONNECTED"}>
            Snapshot
          </button>
          <button onClick={onBack}>Back</button>
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      {isGM && (
        <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Moderation</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ marginBottom: 6 }}>Action</div>
              <select
                value={modAction}
                onChange={(e) => setModAction(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="warn">Warn</option>
                <option value="mute">Mute</option>
                <option value="kick">Kick</option>
              </select>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>Target</div>
              <select
                value={modTarget}
                onChange={(e) => setModTarget(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">Select player</option>
                {players.map((p) => (
                  <option key={p.pid} value={p.pid}>
                    {p.name} ({p.pid})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>Duration (sec)</div>
              <input
                type="number"
                min="1"
                value={modDurationSec}
                onChange={(e) => setModDurationSec(Number(e.target.value))}
                disabled={modAction !== "mute"}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 6 }}>Reason</div>
            <input
              type="text"
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="Optional reason"
              style={{ width: "100%", padding: 8 }}
            />
          </div>
          <button
            onClick={handleModeration}
            style={{ marginTop: 8 }}
            disabled={isMuted || !modTarget || (modAction === "mute" && (!modDurationSec || modDurationSec <= 0))}
          >
            Apply
          </button>
        </div>
      )}

      <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Mod Log</h3>
        {modlog.length === 0 ? (
          <div style={{ opacity: 0.7 }}>(no entries)</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {modlog
              .slice(-50)
              .reverse()
              .map((m, idx) => (
                <li key={`${m.ts}-${idx}`} style={{ marginBottom: 4 }}>
                  [{new Date(m.ts * 1000).toLocaleTimeString()}] {m.action || m.t} by{" "}
                  {players.find((p) => p.pid === m.by)?.name || m.by} →{" "}
                  {players.find((p) => p.pid === m.target)?.name || m.target}
                  {m.reason ? ` — ${m.reason}` : ""}
                </li>
              ))}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 12, border: "1px solid #ccc", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>Dev Panel</h3>
          <button onClick={() => setDevOpen((v) => !v)}>
            {devOpen ? "Hide" : "Show"}
          </button>
        </div>

        {devOpen ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #ddd", padding: 10 }}>
              <h4 style={{ marginTop: 0 }}>SINGLE</h4>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={singleSecret}
                  onChange={(e) => setSingleSecret(e.target.value)}
                  placeholder="secret_word"
                />
                <input
                  type="number"
                  value={singleStrokeLimit}
                  onChange={(e) => setSingleStrokeLimit(Number(e.target.value))}
                  placeholder="stroke_limit"
                />
                <input
                  type="number"
                  value={singleTimeLimit}
                  onChange={(e) => setSingleTimeLimit(Number(e.target.value))}
                  placeholder="time_limit_sec"
                />
                <button
                  onClick={() =>
                    ws.send({
                      type: "set_round_config",
                      secret_word: singleSecret,
                      stroke_limit: Number(singleStrokeLimit),
                      time_limit_sec: Number(singleTimeLimit),
                    })
                  }
                  disabled={ws.status !== "CONNECTED"}
                >
                  set_round_config
                </button>
                <button
                  onClick={() => ws.send({ type: "start_game" })}
                  disabled={ws.status !== "CONNECTED"}
                >
                  start_game
                </button>
                <button
                  onClick={() => ws.send({ type: "phase_tick" })}
                  disabled={ws.status !== "CONNECTED"}
                >
                  phase_tick
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => ws.send({ type: "vote_next", vote: "yes" })}
                    disabled={ws.status !== "CONNECTED"}
                  >
                    vote_yes
                  </button>
                  <button
                    onClick={() => ws.send({ type: "vote_next", vote: "no" })}
                    disabled={ws.status !== "CONNECTED"}
                  >
                    vote_no
                  </button>
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid #ddd", padding: 10 }}>
              <h4 style={{ marginTop: 0 }}>VS</h4>
              <div style={{ display: "grid", gap: 8 }}>
                <button
                  onClick={() => ws.send({ type: "start_role_pick" })}
                  disabled={ws.status !== "CONNECTED"}
                >
                  start_role_pick
                </button>
                <input
                  value={vsSecret}
                  onChange={(e) => setVsSecret(e.target.value)}
                  placeholder="secret_word"
                />
                <input
                  type="number"
                  value={vsTimeLimit}
                  onChange={(e) => setVsTimeLimit(Number(e.target.value))}
                  placeholder="time_limit_sec"
                />
                <input
                  type="number"
                  value={vsStrokes}
                  onChange={(e) => setVsStrokes(Number(e.target.value))}
                  placeholder="strokes_per_phase"
                />
                <input
                  type="number"
                  value={vsGuessWindow}
                  onChange={(e) => setVsGuessWindow(Number(e.target.value))}
                  placeholder="guess_window_sec"
                />
                <button
                  onClick={() =>
                    ws.send({
                      type: "start_round",
                      secret_word: vsSecret,
                      time_limit_sec: Number(vsTimeLimit),
                      strokes_per_phase: Number(vsStrokes),
                      guess_window_sec: Number(vsGuessWindow),
                    })
                  }
                  disabled={ws.status !== "CONNECTED"}
                >
                  start_round
                </button>
                <button
                  onClick={() => ws.send({ type: "phase_tick" })}
                  disabled={ws.status !== "CONNECTED"}
                >
                  phase_tick
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => ws.send({ type: "vote_next", vote: "yes" })}
                    disabled={ws.status !== "CONNECTED"}
                  >
                    vote_yes
                  </button>
                  <button
                    onClick={() => ws.send({ type: "vote_next", vote: "no" })}
                    disabled={ws.status !== "CONNECTED"}
                  >
                    vote_no
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Toggle to access dev controls for SINGLE and VS.
          </div>
        )}
      </div>
      {mode === "VS" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* VS Mode: Team Selection (WAITING state) */}
          {state === "WAITING" && (
            <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Team Selection</h3>

              {!currentTeam ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleSetTeam("A")} disabled={isMuted}>
                    Join Team A
                  </button>
                  <button onClick={() => handleSetTeam("B")} disabled={isMuted}>
                    Join Team B
                  </button>
                </div>
              ) : (
                <div style={{ color: "green" }}>You are on Team {currentTeam}</div>
              )}

              {/* ✅ FIX: allow at 4 players (2v2). Anyone can start role pick. */}
              {players.length >= 4 && (
                <button onClick={handleStartRolePick} style={{ marginTop: 8 }} disabled={isMuted}>
                  Start VS Game (Auto-Assign Roles)
                </button>
              )}

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                Need at least 4 players (2 per team) to start.
              </div>
            </div>
          )}

          {state === "ROLE_PICK" && (
            <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Role Pick</h3>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                New GM: <b>{gmName || "?"}</b>
              </div>
              <button onClick={handleStartRolePick} disabled={isMuted}>
                Start VS Game (Auto-Assign Roles)
              </button>
            </div>
          )}

          {/* VS Mode: Round Configuration (CONFIG state) */}
          {state === "CONFIG" && isGM && (
            <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Start Round - Configure Settings</h3>

              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 6, fontSize: 14, fontWeight: "bold" }}>
                  Secret Word (Drawing Name):
                </div>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="Enter word to draw"
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ marginBottom: 6, fontSize: 14, fontWeight: "bold" }}>
                    Strokes per Phase (VS):
                  </div>
                  <input
                    type="number"
                    min="3"
                    max="5"
                    value={strokeLimit}
                    onChange={(e) =>
                      setStrokeLimit(Math.max(3, Math.min(5, parseInt(e.target.value) || 3)))
                    }
                    style={{ width: "100%", padding: 8 }}
                  />
                  <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                    Range: 3–5 strokes per DRAW phase (per team)
                  </div>
                </div>

                <div>
                  <div style={{ marginBottom: 6, fontSize: 14, fontWeight: "bold" }}>
                    Time Limit (Minutes):
                  </div>
                  <input
                    type="number"
                    min="3"
                    max="7"
                    value={timeLimitMinutes}
                    onChange={(e) =>
                      setTimeLimitMinutes(Math.max(3, Math.min(7, parseInt(e.target.value) || 4)))
                    }
                    style={{ width: "100%", padding: 8 }}
                  />
                  <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                    Range: 3–7 minutes for DRAW phase
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 6, fontSize: 14, fontWeight: "bold" }}>
                  Guess Window (Seconds):
                </div>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={guessWindowSec}
                  onChange={(e) =>
                    setGuessWindowSec(Math.max(5, Math.min(60, parseInt(e.target.value) || 10)))
                  }
                  style={{ width: "100%", padding: 8 }}
                />
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Recommended: 10 seconds</div>
              </div>

              <button
                onClick={handleStartRound}
                disabled={
                  !word.trim() ||
                  strokeLimit < 3 ||
                  strokeLimit > 5 ||
                  timeLimitMinutes < 3 ||
                  timeLimitMinutes > 7 ||
                  guessWindowSec < 5 ||
                  guessWindowSec > 60 ||
                  isMuted
                }
                style={{ width: "100%", padding: 10, fontSize: 16, fontWeight: "bold" }}
              >
                Start Round
              </button>
            </div>
          )}

          {/* VS Mode: In Round (IN_ROUND state) */}
          {state === "IN_ROUND" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Team A Panel */}
              <div style={{ border: "2px solid #4a90e2", padding: 12, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0, color: "#4a90e2" }}>Team A</h3>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  Drawer: {roles.drawerA ? players.find((p) => p.pid === roles.drawerA)?.name : "?"}
                  <br />
                  Budget: {budget.A ?? 0} strokes
                </div>
                <div
                  style={{
                    border: "1px solid #ddd",
                    height: 200,
                    background: "#f9f9f9",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Canvas A (Drawing area)
                </div>
                {isDrawer && currentTeam === "A" && phase === "DRAW" && (
                  <button onClick={handleDraw} style={{ marginTop: 8, width: "100%" }} disabled={isMuted}>
                    Test Draw (Line)
                  </button>
                )}
              </div>

              {/* Team B Panel */}
              <div style={{ border: "2px solid #e24a4a", padding: 12, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0, color: "#e24a4a" }}>Team B</h3>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  Drawer: {roles.drawerB ? players.find((p) => p.pid === roles.drawerB)?.name : "?"}
                  <br />
                  Budget: {budget.B ?? 0} strokes
                </div>
                <div
                  style={{
                    border: "1px solid #ddd",
                    height: 200,
                    background: "#f9f9f9",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Canvas B (Drawing area)
                </div>
                {isDrawer && currentTeam === "B" && phase === "DRAW" && (
                  <button onClick={handleDraw} style={{ marginTop: 8, width: "100%" }} disabled={isMuted}>
                    Test Draw (Line)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VS Mode: Game Controls */}
          {state === "IN_ROUND" && (
            <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Game Controls</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {phase === "DRAW" && isDrawer && (
                  <div>
                    <div style={{ marginBottom: 6 }}>Drawing Phase - You are the drawer</div>
                    <button onClick={handleDraw} disabled={isMuted}>
                      Send Test Draw Operation
                    </button>
                    {currentTeam && (
                      <button
                        onClick={handleSabotage}
                        style={{ marginLeft: 8, background: "#ff6b6b" }}
                        disabled={isMuted}
                      >
                        Sabotage Opponent (Costs 1 stroke)
                      </button>
                    )}
                  </div>
                )}

                {phase === "GUESS" && isGuesser && (
                  <div>
                    <div style={{ marginBottom: 6 }}>Guess Phase - Enter your guess</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Your guess..."
                        style={{ flex: 1, padding: 8 }}
                        disabled={isMuted}
                        onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                      />
                      <button onClick={handleGuess} disabled={!guess.trim() || isMuted}>
                        Submit Guess
                      </button>
                    </div>
                  </div>
                )}

                {phase === "VOTING" && !isGM && (
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      Voting Phase — Score: A {score.A ?? 0} / B {score.B ?? 0}
                    </div>
                    <div style={{ marginBottom: 6 }}>Vote to start next round?</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => ws.send({ type: "vote_next", vote: "yes" })} disabled={isMuted}>
                        Vote Yes (Next Round)
                      </button>
                      <button onClick={() => ws.send({ type: "vote_next", vote: "no" })} disabled={isMuted}>
                        Vote No
                      </button>
                    </div>
                  </div>
                )}

                {isGM && (phase === "DRAW" || phase === "GUESS") && (
                  <button onClick={handlePhaseTick} disabled={isMuted}>
                    Advance Phase (DRAW → GUESS → VOTING)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Teams Display */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #4a90e2", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, color: "#4a90e2" }}>Team A ({teamA.length})</h3>
              {teamA.length === 0 ? (
                <div style={{ opacity: 0.7 }}>(none)</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {teamA.map((p) => (
                    <li key={p.pid} style={{ marginBottom: 4 }}>
                      <b>{p.name}</b> {p.role && `(${p.role})`}
                      {p.warnings ? ` • warnings: ${p.warnings}` : ""}
                      {p.muted_until && p.muted_until > nowSec ? " • muted" : ""}
                      {p.kicked ? " • kicked" : ""}
                      {p.pid === currentPid && " ← You"}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ border: "1px solid #e24a4a", padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, color: "#e24a4a" }}>Team B ({teamB.length})</h3>
              {teamB.length === 0 ? (
                <div style={{ opacity: 0.7 }}>(none)</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {teamB.map((p) => (
                    <li key={p.pid} style={{ marginBottom: 4 }}>
                      <b>{p.name}</b> {p.role && `(${p.role})`}
                      {p.warnings ? ` • warnings: ${p.warnings}` : ""}
                      {p.muted_until && p.muted_until > nowSec ? " • muted" : ""}
                      {p.kicked ? " • kicked" : ""}
                      {p.pid === currentPid && " ← You"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE Mode: Original UI */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #ccc", padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Room Info</h3>
            <pre style={{ margin: 0, fontSize: 12 }}>{room ? JSON.stringify(room, null, 2) : "(no snapshot yet)"}</pre>
          </div>

          <div style={{ border: "1px solid #ccc", padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Players ({players.length})</h3>
            {players.length === 0 ? (
              <div style={{ opacity: 0.7 }}>(none)</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {players.map((p) => (
                  <li key={p.pid} style={{ marginBottom: 6 }}>
                    <b>{p.name}</b> — {p.connected ? "online" : "offline"}{" "}
                    {p.warnings ? ` • warnings: ${p.warnings}` : ""}
                    {p.muted_until && p.muted_until > nowSec ? " • muted" : ""}
                    {p.kicked ? " • kicked" : ""}
                    <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
                      ({p.pid})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Debug: Show full snapshot */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", padding: 8, background: "#f0f0f0", borderRadius: 4 }}>
          Debug: Full Snapshot
        </summary>
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            padding: 8,
            background: "#f9f9f9",
            overflow: "auto",
            maxHeight: 400,
          }}
        >
          {ws.snapshot ? JSON.stringify(ws.snapshot, null, 2) : "(none)"}
        </pre>
      </details>
    </div>
  );
}

export default function App() {
  // ✅ Use env if provided, otherwise auto-use the host you loaded the page from
  const WS_BASE = import.meta.env.VITE_WS_BASE_URL?.trim() || `ws://${window.location.hostname}:8000`;

  const ws = useRoomWS(WS_BASE);

  const [screen, setScreen] = useState("HOME"); // HOME | LOBBY
  const [name, setName] = useState("Malika");
  const [myPid, setMyPid] = useState(null); // Track our PID
  const [busy, setBusy] = useState(false);
  const [reconnectAttempted, setReconnectAttempted] = useState(false);
  const [kickedInfo, setKickedInfo] = useState(null);

  const LS_PID = "dg_pid";
  const LS_ROOM = "dg_room";
  const LS_NAME = "dg_name";

  const saveSession = (room, n, pid) => {
    if (room) localStorage.setItem(LS_ROOM, room);
    if (n) localStorage.setItem(LS_NAME, n);
    if (pid) localStorage.setItem(LS_PID, pid);
  };

  const clearSession = () => {
    localStorage.removeItem(LS_ROOM);
    localStorage.removeItem(LS_NAME);
    localStorage.removeItem(LS_PID);
  };

  // Track our PID from hello (stable reconnect)
  useEffect(() => {
    if (ws.pid) setMyPid(ws.pid);
  }, [ws.pid]);

  // Handle budget_update events (just request snapshot)
  useEffect(() => {
    const msg = ws.lastMsg;
    if (msg?.type === "budget_update" && msg.budget) {
      ws.send({ type: "snapshot" });
    }
  }, [ws.lastMsg, ws]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "player_kicked" && myPid && m.pid === myPid) {
      setKickedInfo({ reason: m.reason || "" });
    }
    if (m.type === "error" && m.code === "KICKED") {
      setKickedInfo({ reason: m.message || "" });
    }
  }, [ws.lastMsg, myPid]);

  // live lobby: whenever someone joins/leaves OR roles/state/budget change, fetch fresh snapshot
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (
      m.type === "player_joined" ||
      m.type === "player_left" ||
      m.type === "roles_assigned" ||
      m.type === "room_state_changed" ||
      m.type === "budget_update" ||
      m.type === "phase_changed" ||
      m.type === "player_updated" ||
      m.type === "modlog_entry" ||
      m.type === "player_kicked"
    ) {
      ws.send({ type: "snapshot" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.lastMsg]);

  // after create_room response: connect to created room and join
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === "room_created" && m.room_code) {
      (async () => {
        const ok = await ws.connectWaitOpen(m.room_code);
        if (!ok) {
          setBusy(false);
          return;
        }
        ws.send({ type: "join", name });
        ws.send({ type: "snapshot" });
        setScreen("LOBBY");
        saveSession(m.room_code, name, ws.pid);
        setBusy(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.lastMsg]);

  // auto-reconnect on refresh
  useEffect(() => {
    const savedRoom = localStorage.getItem(LS_ROOM);
    const savedPid = localStorage.getItem(LS_PID);
    const savedName = localStorage.getItem(LS_NAME);
    if (!savedRoom || !savedPid) return;

    setReconnectAttempted(true);
    if (savedName) setName(savedName);

    (async () => {
      const ok = await ws.connectWaitOpen(savedRoom);
      if (!ok) return;
      ws.send({ type: "reconnect", pid: savedPid });
      ws.send({ type: "snapshot" });
      setScreen("LOBBY");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist pid when received (hello)
  useEffect(() => {
    if (screen !== "LOBBY") return;
    if (!ws.pid) return;
    saveSession(ws.roomCode, name, ws.pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.pid, screen]);

  // if reconnect fails, clear saved session
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m || m.type !== "error") return;
    if (!reconnectAttempted) return;
    if (["ROOM_NOT_FOUND", "PLAYER_NOT_FOUND", "KICKED"].includes(m.code)) {
      clearSession();
      setScreen("HOME");
    }
  }, [ws.lastMsg, reconnectAttempted]);

  const onCreate = async ({ name: n, mode, cap }) => {
    setBusy(true);
    setName(n);

    const ok = await ws.connectWaitOpen("IGNORED");
    if (!ok) {
      setBusy(false);
      return;
    }
    ws.send({ type: "create_room", mode, cap });
  };

  const onJoin = async ({ name: n, roomCode }) => {
    setBusy(true);
    setName(n);

    const ok = await ws.connectWaitOpen(roomCode);
    if (!ok) {
      setBusy(false);
      return;
    }
    ws.send({ type: "join", name: n });
    ws.send({ type: "snapshot" });
    setScreen("LOBBY");
    saveSession(roomCode, n, ws.pid);
    setBusy(false);
  };

  const onBack = () => {
    ws.disconnect();
    clearSession();
    setScreen("HOME");
    setKickedInfo(null);
  };

  return screen === "HOME" ? (
    <Home busy={busy} onCreate={onCreate} onJoin={onJoin} wsBase={WS_BASE} />
  ) : (
    <>
      <Lobby ws={ws} name={name} myPid={myPid} onBack={onBack} />
      {kickedInfo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ background: "#fff", padding: 20, borderRadius: 8, maxWidth: 420, width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>Removed from room</h3>
            <div style={{ marginBottom: 12 }}>
              You have been kicked by the GM.
              {kickedInfo.reason ? ` Reason: ${kickedInfo.reason}` : ""}
            </div>
            <button onClick={onBack}>Back to Home</button>
          </div>
        </div>
      )}
    </>
  );
}
