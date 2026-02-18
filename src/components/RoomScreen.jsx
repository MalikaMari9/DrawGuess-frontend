import { useEffect, useMemo, useState } from "react";
import CanvasBoard from "./CanvasBoard";

function formatCountdown(sec) {
  if (sec === null || sec === undefined) return "--:--";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function roleLabel(role) {
  if (!role) return "Spectator";
  if (role === "drawerA") return "Drawer A";
  if (role === "drawerB") return "Drawer B";
  if (role === "guesserA") return "Guesser A";
  if (role === "guesserB") return "Guesser B";
  return role.replace("_", " ");
}

export default function RoomScreen({
  ws,
  name,
  myPid,
  onBack,
  opsByCanvas,
  setOpsByCanvas,
  chat,
}) {
  const snapshot = ws.snapshot;
  const room = snapshot?.room ?? {};
  const players = snapshot?.players ?? [];
  const roundConfig = snapshot?.round_config ?? {};
  const game = snapshot?.game ?? {};
  const modlog = snapshot?.modlog ?? [];
  const mode = room?.mode ?? "SINGLE";
  const state = room?.state ?? "WAITING";
  const phase = game?.phase ?? "";
  const score = game?.score ?? { A: 0, B: 0 };
  const nowBase = Math.floor(Date.now() / 1000);

  const [nowSec, setNowSec] = useState(nowBase);
  const [guessText, setGuessText] = useState("");
  const [tool, setTool] = useState("line");
  const [color, setColor] = useState("#00f5ff");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [sabotageNext, setSabotageNext] = useState(false);

  const [singleSecret, setSingleSecret] = useState("");
  const [singleStrokeLimit, setSingleStrokeLimit] = useState(12);
  const [singleTimeLimit, setSingleTimeLimit] = useState(240);

  const [vsSecret, setVsSecret] = useState("");
  const [vsDrawWindow, setVsDrawWindow] = useState(60);
  const [vsStrokes, setVsStrokes] = useState(4);
  const [vsGuessWindow, setVsGuessWindow] = useState(10);
  const [vsMaxRounds, setVsMaxRounds] = useState(5);

  const [modAction, setModAction] = useState("warn");
  const [modTarget, setModTarget] = useState("");
  const [modReason, setModReason] = useState("");
  const [modDurationSec, setModDurationSec] = useState(60);
  const [lastGuessResult, setLastGuessResult] = useState(null);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "guess_result") setLastGuessResult(m);
    if (m.type === "error") setLastError(m);
  }, [ws.lastMsg]);

  const currentPlayer = useMemo(
    () => (myPid ? players.find((p) => p.pid === myPid) : null),
    [players, myPid]
  );

  const isGM = room?.gm_pid && myPid && room.gm_pid === myPid;
  const currentRole = currentPlayer?.role || "";
  const currentTeam = currentPlayer?.team || null;
  const isDrawer = currentRole.includes("drawer");
  const isGuesser = currentRole.includes("guesser");

  const mutedUntil = Number(currentPlayer?.muted_until || 0);
  const isMuted = mutedUntil > nowSec;
  const mutedRemaining = isMuted ? mutedUntil - nowSec : 0;

  const minPlayers = mode === "VS" ? 5 : 3;
  const connectedCount = players.filter((p) => p.connected).length;
  const canStartRolePick = connectedCount >= minPlayers;
  const canGuessPhase = mode === "SINGLE" ? phase === "DRAW" || phase === "GUESS" : phase === "GUESS";

  const roundEndAt = Number(game?.draw_end_at || 0);
  const guessEndAt = Number(game?.guess_end_at || 0);
  const drawRemaining = roundEndAt ? roundEndAt - nowSec : null;
  const guessRemaining = guessEndAt ? guessEndAt - nowSec : null;

  const gmName = room?.gm_pid ? players.find((p) => p.pid === room.gm_pid)?.name : "—";

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const budget = game?.budget || {};
  const singleBudget = Number(game?.strokes_left || 0);

  const handleStartRolePick = () => {
    if (!canStartRolePick || isMuted) return;
    ws.send({ type: "start_role_pick" });
  };

  const handleGuess = () => {
    if (!guessText.trim()) return;
    if (!canGuessPhase || state !== "IN_GAME") return;
    if (isMuted) return;
    ws.send({ type: "guess", text: guessText.trim() });
    setGuessText("");
  };

  const handlePhaseTick = () => {
    if (!isGM) return;
    if (isMuted) return;
    ws.send({ type: "phase_tick" });
  };

  const handleEndGame = () => {
    if (!isGM) return;
    if (isMuted) return;
    ws.send({ type: "end_game" });
  };

  const handleModeration = () => {
    if (!modTarget) return;
    ws.send({
      type: "moderation",
      action: modAction,
      target: modTarget,
      reason: modReason.trim(),
      duration_sec: modAction === "mute" ? Number(modDurationSec) : undefined,
    });
    setModReason("");
  };

  const handleSetSingleConfig = () => {
    if (!singleSecret.trim()) return;
    if (isMuted) return;
    ws.send({
      type: "set_round_config",
      secret_word: singleSecret.trim(),
      stroke_limit: Number(singleStrokeLimit),
      time_limit_sec: Number(singleTimeLimit),
    });
  };

  const handleStartSingle = () => {
    if (isMuted) return;
    ws.send({ type: "start_game" });
  };

  const handleStartVsGame = () => {
    if (!vsSecret.trim()) return;
    if (isMuted) return;
    ws.send({
      type: "set_vs_config",
      secret_word: vsSecret.trim(),
      draw_window_sec: Number(vsDrawWindow),
      strokes_per_phase: Number(vsStrokes),
      guess_window_sec: Number(vsGuessWindow),
      max_rounds: Number(vsMaxRounds),
    });
    ws.send({ type: "start_game" });
  };

  const appendLocalOp = (target, op) => {
    setOpsByCanvas((prev) => {
      const next = { ...prev, A: [...prev.A], B: [...prev.B], S: [...prev.S] };
      next[target].push({ ...op, by: myPid || "local", ts: Math.floor(Date.now() / 1000) });
      return next;
    });
  };

  const handleDrawOp = (op) => {
    if (!isDrawer || state !== "IN_GAME" || phase !== "DRAW") return;
    if (isMuted) return;
    if (mode === "VS") {
      if (!currentTeam) return;
      if (sabotageNext) {
        const target = currentTeam === "A" ? "B" : "A";
        ws.send({ type: "sabotage", target, op });
        appendLocalOp(target, op);
        setSabotageNext(false);
      } else {
        ws.send({ type: "draw_op", canvas: currentTeam, op });
        appendLocalOp(currentTeam, op);
      }
    } else {
      ws.send({ type: "draw_op", op });
      appendLocalOp("S", op);
    }
  };

  const showVote = phase === "VOTING" && state === "GAME_END";

  let lastGuessLabel = "";
  let lastGuessText = "";
  if (lastGuessResult) {
    const result = lastGuessResult.result || (lastGuessResult.correct ? "CORRECT" : "WRONG");
    lastGuessLabel = result === "CORRECT" ? "Correct" : result === "NO_GUESS" ? "No guess" : "Wrong";
    lastGuessText = lastGuessResult.text || (result === "NO_GUESS" ? "No guess submitted" : "");
  }


  return (
    <div className="screen room">
      <header className="room__top">
        <div className="brand brand--small">
          <div className="brand__logo">DG</div>
          <div>
            <div className="brand__title">DrawGuess</div>
            <div className="brand__subtitle">Room {ws.roomCode}</div>
          </div>
        </div>
        <div className="room__stats">
          <div>
            <div className="stat__label">Mode</div>
            <div className="stat__value">{mode}</div>
          </div>
          <div>
            <div className="stat__label">State</div>
            <div className="stat__value">{state}</div>
          </div>
          <div>
            <div className="stat__label">Phase</div>
            <div className="stat__value">{phase || "—"}</div>
          </div>
          <div>
            <div className="stat__label">GM</div>
            <div className="stat__value">{gmName}</div>
          </div>
        </div>
        <div className="room__actions">
          <button className="btn btn--ghost" onClick={() => ws.send({ type: "snapshot" })}>
            Snapshot
          </button>
          <button className="btn btn--danger" onClick={onBack}>
            Leave
          </button>
        </div>
      </header>

      <div className="room__grid">
        <aside className="panel panel--glow">
          <h3>Players</h3>
          <div className="muted">You: {name}</div>
          <div className="muted">Role: {roleLabel(currentRole)}</div>
          {isMuted && <div className="notice">Muted {mutedRemaining}s</div>}
          {mode === "VS" ? (
            <div className="team-grid">
              <div>
                <div className="team__title team__title--a">Team A</div>
                <ul className="list">
                  {teamA.map((p) => (
                    <li key={p.pid}>
                      {p.name}
                      {p.role ? ` • ${roleLabel(p.role)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="team__title team__title--b">Team B</div>
                <ul className="list">
                  {teamB.map((p) => (
                    <li key={p.pid}>
                      {p.name}
                      {p.role ? ` • ${roleLabel(p.role)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <ul className="list">
              {players.map((p) => (
                <li key={p.pid}>
                  {p.name} {p.role ? `• ${roleLabel(p.role)}` : ""}
                </li>
              ))}
            </ul>
          )}

          {isGM && (
            <div className="panel panel--mini">
              <h4>Moderation</h4>
              <div className="field">
                <label>Action</label>
                <select value={modAction} onChange={(e) => setModAction(e.target.value)}>
                  <option value="warn">Warn</option>
                  <option value="mute">Mute</option>
                  <option value="kick">Kick</option>
                </select>
              </div>
              <div className="field">
                <label>Target</label>
                <select value={modTarget} onChange={(e) => setModTarget(e.target.value)}>
                  <option value="">Select player</option>
                  {players.map((p) => (
                    <option key={p.pid} value={p.pid}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {modAction === "mute" && (
                <div className="field">
                  <label>Duration (sec)</label>
                  <input
                    type="number"
                    min="5"
                    value={modDurationSec}
                    onChange={(e) => setModDurationSec(Number(e.target.value))}
                  />
                </div>
              )}
              <div className="field">
                <label>Reason</label>
                <input
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <button className="btn btn--ghost" onClick={handleModeration}>
                Apply
              </button>
            </div>
          )}
        </aside>

        <main className="room__main">
          <div className="panel panel--glow panel--wide">
            <div className="hud">
              <div>
                <div className="stat__label">Round</div>
                <div className="stat__value">{room?.round_no || 0}</div>
              </div>
              <div>
                <div className="stat__label">Draw Timer</div>
                <div className="stat__value">{formatCountdown(drawRemaining)}</div>
              </div>
              {phase === "GUESS" && (
                <div>
                  <div className="stat__label">Guess Timer</div>
                  <div className="stat__value">{formatCountdown(guessRemaining)}</div>
                </div>
              )}
              {mode === "VS" && (
                <div>
                  <div className="stat__label">Score</div>
                  <div className="stat__value">
                    A {score.A ?? 0} : B {score.B ?? 0}
                  </div>
                </div>
              )}
              {mode === "SINGLE" && (
                <div>
                  <div className="stat__label">Strokes Left</div>
                  <div className="stat__value">{singleBudget || 0}</div>
                </div>
              )}
            </div>
          </div>

          <div className="canvas-grid">
            {mode === "VS" ? (
              <>
                <CanvasBoard
                  label={`Team A Canvas`}
                  ops={opsByCanvas.A}
                  canDraw={isDrawer && currentTeam === "A" && phase === "DRAW" && state === "IN_GAME"}
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  onDraw={handleDrawOp}
                  hint={`Budget: ${budget.A ?? 0}`}
                  accent="a"
                />
                <CanvasBoard
                  label={`Team B Canvas`}
                  ops={opsByCanvas.B}
                  canDraw={isDrawer && currentTeam === "B" && phase === "DRAW" && state === "IN_GAME"}
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  onDraw={handleDrawOp}
                  hint={`Budget: ${budget.B ?? 0}`}
                  accent="b"
                />
              </>
            ) : (
              <CanvasBoard
                label="Shared Canvas"
                ops={opsByCanvas.S}
                canDraw={isDrawer && phase === "DRAW" && state === "IN_GAME"}
                tool={tool}
                color={color}
                strokeWidth={strokeWidth}
                onDraw={handleDrawOp}
                hint={`Strokes left: ${singleBudget || 0}`}
                accent="a"
              />
            )}
          </div>

          {isDrawer && phase === "DRAW" && state === "IN_GAME" && (
            <div className="panel panel--glow panel--toolbar">
              <div className="toolbar">
                <div className="field">
                  <label>Tool</label>
                  <select value={tool} onChange={(e) => setTool(e.target.value)}>
                    <option value="line">Line</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
                <div className="field">
                  <label>Color</label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
                <div className="field">
                  <label>Width</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  />
                </div>
                {mode === "VS" && (
                  <button
                    className={sabotageNext ? "btn btn--danger" : "btn btn--ghost"}
                    onClick={() => setSabotageNext((v) => !v)}
                  >
                    {sabotageNext ? "Sabotage Armed" : "Sabotage"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="panel panel--glow panel--wide">
            <h3>Guess Feed</h3>
            <div className="chat">
              {chat.length === 0 ? (
                <div className="muted">Guesses will show here.</div>
              ) : (
                chat.slice(-40).map((c, idx) => (
                  <div key={`${c.ts}-${idx}`} className="chat__line">
                    <span className="chat__name">{c.name}</span>
                    <span className="chat__text">{c.text}</span>
                  </div>
                ))
              )}
            </div>
            {lastGuessResult && (
              <div className="notice">
                Last guess: {lastGuessText || "-"} - {lastGuessLabel || "Wrong"}
              </div>
            )}
          </div>
        </main>

        <aside className="panel panel--glow panel--stack">
          <div className="panel panel--mini">
            <h3>Room Flow</h3>
            <p>
              Connected: {connectedCount}/{room?.cap || 0}
            </p>
            {(state === "WAITING" || state === "ROLE_PICK") && (
              <>
                <p>Need {minPlayers} players to start role pick.</p>
                <button className="btn btn--primary" onClick={handleStartRolePick} disabled={!canStartRolePick || isMuted}>
                  Start Role Pick
                </button>
              </>
            )}
            {state === "CONFIG" && (
              <p className="muted">
                Waiting for GM to configure the round.
              </p>
            )}
            {state === "IN_GAME" && isGM && (
              <div className="inline">
                <button className="btn btn--ghost" onClick={handlePhaseTick} disabled={isMuted}>
                  Advance Phase
                </button>
                <button className="btn btn--danger" onClick={handleEndGame} disabled={isMuted}>
                  End Game
                </button>
              </div>
            )}
          </div>

          {mode === "SINGLE" && isGM && (state === "ROLE_PICK" || state === "CONFIG") && (
            <div className="panel panel--mini">
              <h3>Single Config</h3>
              <div className="field">
                <label>Secret Word</label>
                <input value={singleSecret} onChange={(e) => setSingleSecret(e.target.value)} />
              </div>
              <div className="field">
                <label>Stroke Limit (10-20)</label>
                <input
                  type="number"
                  min="10"
                  max="20"
                  value={singleStrokeLimit}
                  onChange={(e) => setSingleStrokeLimit(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Draw Window (sec)</label>
                <input
                  type="number"
                  min="180"
                  max="420"
                  value={singleTimeLimit}
                  onChange={(e) => setSingleTimeLimit(Number(e.target.value))}
                />
              </div>
              <div className="inline">
                <button
                  className="btn btn--ghost"
                  onClick={handleSetSingleConfig}
                  disabled={!singleSecret.trim() || isMuted}
                >
                  Set Config
                </button>
                <button className="btn btn--primary" onClick={handleStartSingle} disabled={isMuted}>
                  Start Game
                </button>
              </div>
            </div>
          )}

          {mode === "VS" && isGM && state === "CONFIG" && (
            <div className="panel panel--mini">
              <h3>VS Config</h3>
              <div className="field">
                <label>Secret Word</label>
                <input value={vsSecret} onChange={(e) => setVsSecret(e.target.value)} />
              </div>
              <div className="field">
                <label>Draw Window (sec)</label>
                <input
                  type="number"
                  min="60"
                  max="900"
                  value={vsDrawWindow}
                  onChange={(e) => setVsDrawWindow(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Strokes per Phase (3-5)</label>
                <input
                  type="number"
                  min="3"
                  max="5"
                  value={vsStrokes}
                  onChange={(e) => setVsStrokes(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Guess Window (sec)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={vsGuessWindow}
                  onChange={(e) => setVsGuessWindow(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Max Rounds</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={vsMaxRounds}
                  onChange={(e) => setVsMaxRounds(Number(e.target.value))}
                />
              </div>
              <button
                className="btn btn--primary"
                onClick={handleStartVsGame}
                disabled={!vsSecret.trim() || isMuted}
              >
                Start Game
              </button>
            </div>
          )}

          {canGuessPhase && isGuesser && state === "IN_GAME" && (
            <div className="panel panel--mini">
              <h3>Submit Guess</h3>
              <div className="field">
                <label>Guess</label>
                <input
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                />
              </div>
              <button className="btn btn--primary" onClick={handleGuess} disabled={!guessText.trim() || isMuted}>
                Submit
              </button>
            </div>
          )}

          {showVote && (
            <div className="panel panel--mini">
              <h3>Vote Next Game</h3>
              <div className="inline">
                <button
                  className="btn btn--ghost"
                  onClick={() => ws.send({ type: "vote_next", vote: "yes" })}
                  disabled={isMuted}
                >
                  Vote Yes
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => ws.send({ type: "vote_next", vote: "no" })}
                  disabled={isMuted}
                >
                  Vote No
                </button>
              </div>
            </div>
          )}

          {lastError && (
            <div className="panel panel--mini panel--danger">
              <h3>Error</h3>
              <p>{lastError.code}: {lastError.message}</p>
            </div>
          )}

          {state !== "WAITING" && (
            <div className="panel panel--mini">
              <h3>Round Info</h3>
              <p>Secret Word: {roundConfig.secret_word || "Hidden"}</p>
              {roundConfig.draw_window_sec && <p>Draw Window: {roundConfig.draw_window_sec}s</p>}
              {roundConfig.strokes_per_phase && <p>Strokes/Phase: {roundConfig.strokes_per_phase}</p>}
              {roundConfig.stroke_limit && <p>Stroke Limit: {roundConfig.stroke_limit}</p>}
              {roundConfig.guess_window_sec && <p>Guess Window: {roundConfig.guess_window_sec}s</p>}
              {roundConfig.max_rounds && <p>Max Rounds: {roundConfig.max_rounds}</p>}
            </div>
          )}

          {modlog.length > 0 && (
            <div className="panel panel--mini">
              <h3>Moderation Log</h3>
              <ul className="list">
                {modlog.slice(-8).reverse().map((m, idx) => (
                  <li key={`${m.ts}-${idx}`}>
                    {m.t} • {m.reason || "no reason"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
