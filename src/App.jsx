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

function Lobby({ ws, name, onBack }) {
  const players = ws.snapshot?.players ?? [];
  const room = ws.snapshot?.room ?? null;
  const phase = ws.snapshot?.game?.phase ?? "";
  const [devOpen, setDevOpen] = useState(false);
  const [singleSecret, setSingleSecret] = useState("apple");
  const [singleStrokeLimit, setSingleStrokeLimit] = useState(12);
  const [singleTimeLimit, setSingleTimeLimit] = useState(240);

  const [vsSecret, setVsSecret] = useState("elephant");
  const [vsTimeLimit, setVsTimeLimit] = useState(240);
  const [vsStrokes, setVsStrokes] = useState(4);
  const [vsGuessWindow, setVsGuessWindow] = useState(10);

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Lobby</h2>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Room: <b>{ws.roomCode}</b> • You: <b>{name}</b> • WS: <b>{ws.status}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => ws.send({ type: "snapshot" })}
            disabled={ws.status !== "CONNECTED"}
          >
            Snapshot
          </button>
          <button onClick={onBack}>Back</button>
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #ccc", padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Room Info</h3>
          <pre style={{ margin: 0, fontSize: 12 }}>
            {room ? JSON.stringify(room, null, 2) : "(no snapshot yet)"}
          </pre>
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
                  <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
                    ({p.pid})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ccc", padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Round Controls</h3>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          Phase: <b>{phase || "(none)"}</b>
        </div>
        {phase === "VOTING" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => ws.send({ type: "vote_next", vote: "yes" })}
              disabled={ws.status !== "CONNECTED"}
            >
              Vote Yes
            </button>
            <button
              onClick={() => ws.send({ type: "vote_next", vote: "no" })}
              disabled={ws.status !== "CONNECTED"}
            >
              Vote No
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Vote buttons appear during VOTING phase.
          </div>
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
    </div>
  );
}

export default function App() {
  // ✅ Use env if provided, otherwise auto-use the host you loaded the page from
  const WS_BASE =
    import.meta.env.VITE_WS_BASE_URL?.trim() ||
    `ws://${window.location.hostname}:8000`;

  const ws = useRoomWS(WS_BASE);

  const [screen, setScreen] = useState("HOME"); // HOME | LOBBY
  const [name, setName] = useState("Malika");
  const [busy, setBusy] = useState(false);
  const [reconnectAttempted, setReconnectAttempted] = useState(false);

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

  // live lobby: whenever someone joins/leaves, fetch fresh snapshot
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "player_joined" || m.type === "player_left") {
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
  };

  return screen === "HOME" ? (
    <Home busy={busy} onCreate={onCreate} onJoin={onJoin} wsBase={WS_BASE} />
  ) : (
    <Lobby ws={ws} name={name} onBack={onBack} />
  );
}
