import { useState } from "react";

export default function HomeScreen({ busy, wsBase, defaultName, onCreate, onJoin }) {
  const [name, setName] = useState(defaultName || "Player");
  const [mode, setMode] = useState("SINGLE");
  const [cap, setCap] = useState(8);
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="screen home">
      <header className="home__hero">
        <div className="brand">
          <div className="brand__logo">DG</div>
          <div>
            <h1>DrawGuess Arcade</h1>
            <p>Real-time drawing & guessing. Neon rooms, fast rounds, zero lag vibes.</p>
          </div>
        </div>
        <div className="hero__meta">
          <span className="tag">WebSocket First</span>
          <span className="tag">VS + Single</span>
          <span className="tag">Server-Authoritative</span>
        </div>
      </header>

      <div className="grid grid--2">
        <section className="panel panel--glow">
          <h2>Create Room</h2>
          <div className="field">
            <label>Player Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="field">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="SINGLE">Single</option>
              <option value="VS">VS (Teams)</option>
            </select>
          </div>
          <div className="field">
            <label>Room Capacity</label>
            <input
              type="number"
              min="3"
              max="16"
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
            />
          </div>
          <button className="btn btn--primary" onClick={() => onCreate({ name, mode, cap: Number(cap) })} disabled={busy}>
            {busy ? "Spinning up..." : "Create Room"}
          </button>
        </section>

        <section className="panel panel--glow panel--accent">
          <h2>Join Room</h2>
          <div className="field">
            <label>Player Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="field">
            <label>Room Code</label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
            />
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => onJoin({ name, roomCode: roomCode.trim() })}
            disabled={busy || !roomCode.trim()}
          >
            {busy ? "Joining..." : "Join Room"}
          </button>
          <p className="muted">Backend WS: {wsBase}</p>
        </section>
      </div>

      <footer className="home__footer">
        <div className="panel panel--mini">
          <h3>How to Play</h3>
          <ol className="steps">
            <li>Create or join a room</li>
            <li>Wait for your squad, then start role pick</li>
            <li>GM sets the round, drawers sketch, guessers shout</li>
          </ol>
        </div>
        <div className="panel panel--mini">
          <h3>LAN Ready</h3>
          <p>
            Open the same Wi-Fi URL on friends’ devices.
            The WS host auto-detects your IP.
          </p>
        </div>
      </footer>
    </div>
  );
}
