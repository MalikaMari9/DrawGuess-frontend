import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRoomWS } from "./useRoomWS";

const RoomWSContext = createContext(null);

export function RoomWSProvider({ children }) {
  const WS_BASE = useMemo(
    () => import.meta.env.VITE_WS_BASE_URL?.trim() || `ws://${window.location.hostname}:8000`,
    []
  );

  const ws = useRoomWS(WS_BASE);
  const [nickname, setNickname] = useState(localStorage.getItem("dg_nickname") || "");
  const didAutoReconnect = useRef(false);

  // Auto-reconnect on refresh if we have a saved session
  useEffect(() => {
    if (didAutoReconnect.current) return;
    const savedRoom = localStorage.getItem("dg_room");
    const savedPid = localStorage.getItem("dg_pid");
    if (!savedRoom || !savedPid) return;
    didAutoReconnect.current = true;
    (async () => {
      const ok = await ws.connectWaitOpen(savedRoom);
      if (!ok) return;
      ws.send({ type: "reconnect", pid: savedPid });
      ws.send({ type: "snapshot" });
    })();
  }, [ws.connectWaitOpen, ws.send]);

  // Save pid/room when we get hello
  useEffect(() => {
    const m = ws.lastMsg;
    if (m?.type === "hello" && m.pid && m.room_code) {
      localStorage.setItem("dg_pid", m.pid);
      localStorage.setItem("dg_room", m.room_code);
    }
  }, [ws.lastMsg]);

  // Keep lobby snapshots fresh on key events
  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (
      m.type === "player_joined" ||
      m.type === "player_left" ||
      m.type === "roles_assigned" ||
      m.type === "room_state_changed" ||
      m.type === "player_updated" ||
      m.type === "teams_updated"
    ) {
      ws.send({ type: "snapshot" });
    }
  }, [ws.lastMsg, ws.send]);

  // Drive server-side phase/round timeout transitions and presence updates.
  useEffect(() => {
    if (ws.status !== "CONNECTED") return;
    const id = setInterval(() => {
      ws.send({ type: "heartbeat" });
    }, 1000);
    return () => clearInterval(id);
  }, [ws.status, ws.send]);

  const setAndStoreNickname = useCallback((name) => {
    setNickname(name);
    if (name) localStorage.setItem("dg_nickname", name);
  }, []);

  const createRoom = useCallback(
    (mode, cap = 8, timeoutMs = 4000) =>
      new Promise((resolve) => {
        const base = WS_BASE.replace(/\/+$/, "");
        const url = `${base}/ws-create`;
        const wsCreate = new WebSocket(url);
        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          try { wsCreate.close(); } catch {}
          resolve(null);
        }, timeoutMs);

        wsCreate.onopen = () => {
          wsCreate.send(JSON.stringify({ type: "create_room", mode, cap }));
        };
        wsCreate.onmessage = (e) => {
          if (done) return;
          let msg;
          try {
            msg = JSON.parse(e.data);
          } catch {
            return;
          }
          if (msg?.type === "room_created" && msg.room_code) {
            done = true;
            clearTimeout(timer);
            try { wsCreate.close(); } catch {}
            resolve(msg.room_code);
          } else if (msg?.type === "error") {
            done = true;
            clearTimeout(timer);
            try { wsCreate.close(); } catch {}
            resolve(null);
          }
        };
        wsCreate.onerror = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        };
        wsCreate.onclose = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        };
      }),
    [WS_BASE]
  );

  const value = useMemo(
    () => ({
      ws,
      nickname,
      setNickname: setAndStoreNickname,
      createRoom,
    }),
    [ws, nickname, setAndStoreNickname, createRoom]
  );

  return <RoomWSContext.Provider value={value}>{children}</RoomWSContext.Provider>;
}

export function useRoomWSContext() {
  const ctx = useContext(RoomWSContext);
  if (!ctx) throw new Error("useRoomWSContext must be used within RoomWSProvider");
  return ctx;
}
