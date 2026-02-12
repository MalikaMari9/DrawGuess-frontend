import { useMemo, useState } from "react";
import EventLog from "./EventLog";

export default function RoomPanel({ ws }) {
  const [name, setName] = useState("Malika");
  const [mode, setMode] = useState("SINGLE");
  const [cap, setCap] = useState(8);
  const [raw, setRaw] = useState('{ "type": "snapshot" }');

  const players = useMemo(() => ws.snapshot?.players ?? [], [ws.snapshot]);
  const state = ws.snapshot?.room?.state ?? "(none)";
  const snapPretty = useMemo(
    () => (ws.snapshot ? JSON.stringify(ws.snapshot, null, 2) : "(none yet)"),
    [ws.snapshot]
  );

  const createRoom = () => ws.send({ type: "create_room", mode, cap: Number(cap) });
  const join = () => ws.send({ type: "join", name });
  const snapshot = () => ws.send({ type: "snapshot" });
  const heartbeat = () => ws.send({ type: "heartbeat" });
  const leave = () => ws.send({ type: "leave" });

  const sendRaw = () => {
    try {
      ws.send(JSON.parse(raw));
    } catch {
      alert("Invalid JSON");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <b>Connection</b>
            <span>
              Status: <b>{ws.status}</b>
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              value={ws.roomCode}
              onChange={(e) => ws.setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOMCODE"
            />
            <button onClick={() => ws.connect(ws.roomCode)}>Connect</button>
            <button onClick={ws.disconnect}>Disconnect</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="SINGLE">SINGLE</option>
              <option value="VS">VS</option>
            </select>
            <input
              type="number"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              style={{ width: 90 }}
            />
            <button onClick={createRoom} disabled={ws.status !== "CONNECTED"}>
              create_room
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <button onClick={join} disabled={ws.status !== "CONNECTED"}>
              join
            </button>
            <button onClick={snapshot} disabled={ws.status !== "CONNECTED"}>
              snapshot
            </button>
            <button onClick={heartbeat} disabled={ws.status !== "CONNECTED"}>
              heartbeat
            </button>
            <button onClick={leave} disabled={ws.status !== "CONNECTED"}>
              leave
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Room State: {state}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <b>Players</b>
          <div style={{ marginTop: 8 }}>
            {players.length === 0 ? (
              <div style={{ opacity: 0.7 }}>(none)</div>
            ) : (
              players.map((p) => (
                <div key={p.pid} style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {p.pid} - {p.name} - connected:{String(p.connected)} - team:{String(p.team)}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <b>Raw JSON (dev)</b>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            style={{ width: "100%", height: 100, marginTop: 8, fontFamily: "monospace" }}
          />
          <button onClick={sendRaw} disabled={ws.status !== "CONNECTED"}>
            Send JSON
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EventLog items={ws.log} onClear={ws.clearLog} />

        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <b>Latest Snapshot</b>
          <pre
            style={{
              marginTop: 8,
              height: 260,
              overflow: "auto",
              background: "#111",
              color: "#eee",
              padding: 10,
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {snapPretty}
          </pre>
        </div>
      </div>
    </div>
  );
}
