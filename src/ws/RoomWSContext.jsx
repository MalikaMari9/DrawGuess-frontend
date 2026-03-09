import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRoomWS } from "./useRoomWS";
import { buildWsCandidates, discoverWorkingWsBase, setCachedWsBase } from "./discovery";

const RoomWSContext = createContext(null);

export function RoomWSProvider({ children }) {
  const envWsBase = useMemo(() => import.meta.env.VITE_WS_BASE_URL?.trim() || "", []);
  const initialWsBase = useMemo(() => {
    const fallbackProto = window.location.protocol === "https:" ? "wss" : "ws";
    const fallbackHost = window.location.hostname || "127.0.0.1";
    const fallbackBase = `${fallbackProto}://${fallbackHost}:8000`;
    return buildWsCandidates({ preferredBase: envWsBase, envBase: envWsBase })[0] || fallbackBase;
  }, [envWsBase]);
  const [wsBase, setWsBase] = useState(initialWsBase);
  const wsRaw = useRoomWS(wsBase);

  const [nickname, setNickname] = useState(localStorage.getItem("dg_nickname") || "");
  const didAutoReconnect = useRef(false);
  const reconnectingRef = useRef(false);

  const ensureWsBase = useCallback(
    async (forceProbe = false) => {
      const preferredCandidates = buildWsCandidates({ preferredBase: "", envBase: envWsBase });
      const preferred = preferredCandidates[0] || wsBase || "";

      if (!forceProbe) {
        if (preferred && preferred !== wsBase) setWsBase(preferred);
        return preferred;
      }

      const discovered = await discoverWorkingWsBase({
        preferredBase: preferred,
        envBase: envWsBase,
      });
      const chosen = discovered || preferred;
      if (chosen && chosen !== wsBase) setWsBase(chosen);
      if (chosen) setCachedWsBase(chosen);
      return chosen;
    },
    [envWsBase, wsBase]
  );

  const connectWaitOpen = useCallback(
    async (room, timeoutMs = 3000) => {
      const preferredBase = await ensureWsBase(false);
      let ok = await wsRaw.connectWaitOpen(room, timeoutMs, preferredBase);
      if (ok) {
        setCachedWsBase(preferredBase);
        return true;
      }

      const discovered = await ensureWsBase(true);
      if (!discovered || discovered === preferredBase) return false;
      ok = await wsRaw.connectWaitOpen(room, timeoutMs, discovered);
      if (ok) setCachedWsBase(discovered);
      return ok;
    },
    [ensureWsBase, wsRaw]
  );

  const connect = useCallback(
    (room) => {
      void connectWaitOpen(room, 3000);
    },
    [connectWaitOpen]
  );

  const ws = useMemo(
    () => ({
      ...wsRaw,
      connect,
      connectWaitOpen,
    }),
    [wsRaw, connect, connectWaitOpen]
  );

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


  useEffect(() => {
    if (ws.status !== "DISCONNECTED") return;
    if (ws.lastCloseCode === 1000 || ws.lastCloseCode === 1001) return;
    const savedRoom = localStorage.getItem("dg_room");
    const savedPid = localStorage.getItem("dg_pid");
    if (!savedRoom || !savedPid) return;
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    (async () => {
      const ok = await ws.connectWaitOpen(savedRoom);
      reconnectingRef.current = false;
      if (!ok) return;
      ws.send({ type: "reconnect", pid: savedPid });
      ws.send({ type: "snapshot" });
    })();
  }, [ws.status, ws.lastCloseCode, ws.connectWaitOpen, ws.send]);

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
      m.type === "game_end" ||
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

  const createRoomAtBase = useCallback((base, mode, cap, timeoutMs) => {
    if (!base) return Promise.resolve(null);
    return new Promise((resolve) => {
      const cleanBase = `${base}`.replace(/\/+$/, "");
      const url = `${cleanBase}/ws-create`;
      let wsCreate = null;
      let done = false;

      const finish = (code) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        try {
          if (wsCreate) wsCreate.close();
        } catch {
          // Ignore close errors during ws-create cleanup.
        }
        resolve(code || null);
      };

      let timer = null;
      try {
        wsCreate = new WebSocket(url);
      } catch {
        finish(null);
        return;
      }

      timer = setTimeout(() => finish(null), timeoutMs);

      wsCreate.onopen = () => {
        wsCreate.send(JSON.stringify({ type: "create_room", mode, cap }));
      };
      wsCreate.onmessage = (e) => {
        if (done) return;
        let msg = null;
        try {
          msg = JSON.parse(e.data);
        } catch {
          // Ignore malformed ws-create payloads.
          return;
        }
        if (msg?.type === "room_created" && msg.room_code) {
          finish(msg.room_code);
          return;
        }
        if (msg?.type === "error") finish(null);
      };
      wsCreate.onerror = () => finish(null);
      wsCreate.onclose = () => finish(null);
    });
  }, []);

  const createRoom = useCallback(
    async (mode, cap = 8, timeoutMs = 4000) => {
      const preferredBase = await ensureWsBase(false);
      let roomCode = await createRoomAtBase(preferredBase, mode, cap, timeoutMs);
      if (roomCode) {
        if (preferredBase && preferredBase !== wsBase) setWsBase(preferredBase);
        setCachedWsBase(preferredBase);
        return roomCode;
      }

      const discovered = await ensureWsBase(true);
      if (!discovered || discovered === preferredBase) return null;
      roomCode = await createRoomAtBase(discovered, mode, cap, timeoutMs);
      if (roomCode) {
        if (discovered !== wsBase) setWsBase(discovered);
        setCachedWsBase(discovered);
      }
      return roomCode;
    },
    [createRoomAtBase, ensureWsBase, wsBase]
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
