
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function now() {
  return new Date().toISOString().slice(11, 23);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeRoomCode(code, trim = false) {
  const raw = `${code ?? ""}`;
  const cleaned = trim ? raw.trim() : raw;
  return cleaned.toUpperCase();
}

function isFlowTraceEnabled() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem("dg_flow_trace");
  return raw !== "0";
}

function isTraceMessageType(type) {
  return (
    type === "snapshot" ||
    type === "heartbeat" ||
    type === "start_role_pick" ||
    type === "start_game" ||
    type === "set_round_config" ||
    type === "set_vs_config" ||
    type === "vote_next" ||
    type === "join" ||
    type === "reconnect" ||
    type === "create_room" ||
    type === "room_snapshot" ||
    type === "room_state_changed" ||
    type === "phase_changed" ||
    type === "roles_assigned" ||
    type === "vote_progress" ||
    type === "vote_resolved" ||
    type === "game_end" ||
    type === "error"
  );
}

const MSG_BUFFER_LIMIT = 1000;

export function useRoomWS(baseUrl) {
  const wsRef = useRef(null);
  const baseUrlRef = useRef(baseUrl);
  const msgSeqRef = useRef(0);
  const msgBufferRef = useRef([]);

  const [status, setStatus] = useState("DISCONNECTED"); // DISCONNECTED | CONNECTING | CONNECTED | ERROR
  const [roomCode, setRoomCode] = useState("");
  const [pid, setPid] = useState("");
  const [log, setLog] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [lastCloseCode, setLastCloseCode] = useState(null);
  const [lastMsg, setLastMsg] = useState(null); // <- NEW (parsed last incoming)
  const [msgSeq, setMsgSeq] = useState(0);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

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
      } catch {
        // Ignore close failures.
      }
      wsRef.current = null;
    }
    setPid("");
  }, []);

  const connect = useCallback(
    (code, baseOverride = "") => {
      const cleanCode = normalizeRoomCode(code, true);
      if (!cleanCode) {
        pushLog("ERR", "Room code is empty");
        return;
      }

      // close old
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close failures during reconnect.
        }
        wsRef.current = null;
      }

      setRoomCode(cleanCode);
      setStatus("CONNECTING");
      // Prevent rendering stale room/player data while switching rooms.
      setSnapshot(null);
      setLastMsg(null);
      msgSeqRef.current = 0;
      msgBufferRef.current = [];
      setMsgSeq(0);

      const resolvedBase = `${baseOverride || baseUrlRef.current || baseUrl}`.replace(/\/+$/, "");
      const url = `${resolvedBase}/ws/${cleanCode}`;
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
        setLastCloseCode(e.code);
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

        const seq = msgSeqRef.current + 1;
        msgSeqRef.current = seq;
        msgBufferRef.current.push({ seq, msg });
        if (msgBufferRef.current.length > MSG_BUFFER_LIMIT) {
          msgBufferRef.current = msgBufferRef.current.slice(-MSG_BUFFER_LIMIT);
        }

        setMsgSeq(seq);
        setLastMsg(msg);
        pushLog("IN", msg);
        if (isFlowTraceEnabled() && isTraceMessageType(msg?.type)) {
          const roomState = msg?.room?.state ?? msg?.state ?? null;
          const phase = msg?.game?.phase ?? msg?.phase ?? null;
          console.log("[FLOW][WS][IN]", {
            seq,
            room: cleanCode,
            type: msg?.type,
            roomState,
            phase,
            voteOutcome: msg?.outcome ?? msg?.game?.vote_outcome ?? null,
          });
        }

        if (msg.type === "hello" && msg.pid) setPid(msg.pid);
        if (msg.type === "room_snapshot") setSnapshot(msg);
      };
    },
    [baseUrl, pushLog]
  );

  // NEW: connect + wait until OPEN (no more "click twice")
  const connectWaitOpen = useCallback(
    async (code, timeoutMs = 3000, baseOverride = "") => {
      connect(code, baseOverride);

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
      if (isFlowTraceEnabled() && isTraceMessageType(obj?.type)) {
        console.log("[FLOW][WS][OUT]", {
          room: roomCode || "(pending)",
          type: obj?.type,
          payload: obj,
        });
      }
      pushLog("OUT", obj);
      ws.send(JSON.stringify(obj));
      return true;
    },
    [pushLog, roomCode]
  );

  const getMessagesSince = useCallback((afterSeq = 0) => {
    const target = Number(afterSeq) || 0;
    const queue = msgBufferRef.current;
    if (!queue.length) return [];
    let idx = -1;
    for (let i = 0; i < queue.length; i += 1) {
      if (queue[i].seq > target) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return [];
    return queue.slice(idx);
  }, []);

  const getMessageWindow = useCallback(() => {
    const queue = msgBufferRef.current;
    return {
      firstSeq: queue[0]?.seq || 0,
      lastSeq: msgSeqRef.current || 0,
    };
  }, []);

  const api = useMemo(
    () => ({
      status,
      roomCode,
      setRoomCode: (code) => setRoomCode(normalizeRoomCode(code)),
      pid,
      log,
      snapshot,
      lastMsg,
      msgSeq,
      getMessagesSince,
      getMessageWindow,
      lastCloseCode,
      connect,
      connectWaitOpen,  // <- NEW
      disconnect,
      send,
      clearLog: () => setLog([]),
    }),
    [
      status,
      roomCode,
      pid,
      log,
      snapshot,
      lastMsg,
      msgSeq,
      getMessagesSince,
      getMessageWindow,
      lastCloseCode,
      connect,
      connectWaitOpen,
      disconnect,
      send,
    ]
  );

  return api;
}
