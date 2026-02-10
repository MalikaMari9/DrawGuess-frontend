import { useCallback, useMemo, useRef, useState } from "react";

function now() {
  return new Date().toISOString().slice(11, 23);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useRoomWS(baseUrl) {
  const wsRef = useRef(null);

  const [status, setStatus] = useState("DISCONNECTED"); // DISCONNECTED | CONNECTING | CONNECTED | ERROR
  const [roomCode, setRoomCode] = useState("");
  const [pid, setPid] = useState("");
  const [log, setLog] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [lastMsg, setLastMsg] = useState(null); // <- NEW (parsed last incoming)

  const pushLog = useCallback((dir, obj) => {
    setLog((prev) => [
      ...prev,
      { t: now(), dir, text: typeof obj === "string" ? obj : JSON.stringify(obj) },
    ]);
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    }
    setPid("");
  }, []);

  const connect = useCallback(
    (code) => {
      if (!code) {
        pushLog("ERR", "Room code is empty");
        return;
      }

      // close old
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      setRoomCode(code);
      setStatus("CONNECTING");

      const url = `${baseUrl.replace(/\/+$/, "")}/ws/${code}`;
      pushLog("SYS", `Connecting: ${url}`);

      const myWs = new WebSocket(url);
      wsRef.current = myWs;

      myWs.onopen = () => {
        if (wsRef.current !== myWs) return;
        setStatus("CONNECTED");
        pushLog("SYS", "WebSocket opened");
      };

      myWs.onerror = () => {
        if (wsRef.current !== myWs) return;
        setStatus("ERROR");
        pushLog("ERR", "WebSocket error");
      };

      myWs.onclose = (e) => {
        if (wsRef.current !== myWs) return;
        setStatus("DISCONNECTED");
        pushLog("SYS", `WebSocket closed (code=${e.code})`);
        wsRef.current = null;
        setPid("");
      };

      myWs.onmessage = (e) => {
        if (wsRef.current !== myWs) return;

        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          pushLog("ERR", e.data);
          return;
        }

        setLastMsg(msg);
        pushLog("IN", msg);

        if (msg.type === "hello" && msg.pid) setPid(msg.pid);
        if (msg.type === "room_snapshot") setSnapshot(msg);
      };
    },
    [baseUrl, pushLog]
  );

  // NEW: connect + wait until OPEN (no more "click twice")
  const connectWaitOpen = useCallback(
    async (code, timeoutMs = 3000) => {
      connect(code);

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) return true;
        await sleep(50);
      }
      return false;
    },
    [connect]
  );

  const send = useCallback(
    (obj) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        pushLog("ERR", "Cannot send: websocket not open");
        return false;
      }
      pushLog("OUT", obj);
      ws.send(JSON.stringify(obj));
      return true;
    },
    [pushLog]
  );

  const api = useMemo(
    () => ({
      status,
      roomCode,
      setRoomCode,
      pid,
      log,
      snapshot,
      lastMsg,          // <- NEW
      connect,
      connectWaitOpen,  // <- NEW
      disconnect,
      send,
      clearLog: () => setLog([]),
    }),
    [status, roomCode, pid, log, snapshot, lastMsg, connect, connectWaitOpen, disconnect, send]
  );

  return api;
}
