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
        setBusy(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.lastMsg]);

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
    setBusy(false);
  };

  const onBack = () => {
    ws.disconnect();
    setScreen("HOME");
  };

  return screen === "HOME" ? (
    <Home busy={busy} onCreate={onCreate} onJoin={onJoin} wsBase={WS_BASE} />
  ) : (
    <Lobby ws={ws} name={name} onBack={onBack} />
  );
}
