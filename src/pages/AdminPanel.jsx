import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/AdminPanel.css";

const AdminPanel = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const httpBase = useMemo(() => {
    const wsBase = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";
    if (wsBase.startsWith("wss://")) return wsBase.replace("wss://", "https://");
    if (wsBase.startsWith("ws://")) return wsBase.replace("ws://", "http://");
    return wsBase;
  }, []);

  const fetchRooms = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${httpBase}/admin/rooms`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, [httpBase]);

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 5000);
    return () => clearInterval(t);
  }, [fetchRooms]);

  const handleClose = async (roomCode) => {
    setClosing(roomCode);
    setError("");
    try {
      const res = await fetch(`${httpBase}/admin/rooms/${roomCode}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await fetchRooms();
    } catch (err) {
      setError(err.message || "Failed to close room");
    } finally {
      setClosing("");
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <header>
          <div>
            <h1>Admin Panel</h1>
            <p className="subtitle">Test-only room monitor</p>
          </div>
          <div className="meta">
            <div className="meta-item">API: {httpBase}</div>
            <div className="meta-item">
              Updated: {lastUpdated || "—"}
            </div>
          </div>
        </header>

        <div className="actions">
          <button className="secondary-btn" onClick={fetchRooms}>
            Refresh
          </button>
        </div>

        {error && <div className="error-banner">Error: {error}</div>}

        {loading ? (
          <div className="loading">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="empty">No active rooms</div>
        ) : (
          <div className="table">
            <div className="row header">
              <div>Room</div>
              <div>Mode</div>
              <div>State</div>
              <div>Players</div>
              <div>Connected</div>
              <div>Round</div>
              <div>Actions</div>
            </div>
            {rooms.map((room) => (
              <div className="row" key={room.room_code}>
                <div className="mono">{room.room_code}</div>
                <div>{room.mode}</div>
                <div>{room.state}</div>
                <div>{room.players}/{room.cap}</div>
                <div>{room.connected}</div>
                <div>{room.round_no}</div>
                <div>
                  <button
                    className="danger-btn"
                    onClick={() => handleClose(room.room_code)}
                    disabled={closing === room.room_code}
                  >
                    {closing === room.room_code ? "Closing..." : "Close"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
