import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomWSContext } from '../ws/RoomWSContext';
import '../styles/SingleGame.css';

const LOGICAL_CANVAS_W = 1024;
const LOGICAL_CANVAS_H = 768;

const fitCanvasToWrapper = (canvas) => {
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(rect.width / LOGICAL_CANVAS_W, rect.height / LOGICAL_CANVAS_H);
  const displayW = Math.max(1, Math.floor(LOGICAL_CANVAS_W * scale));
  const displayH = Math.max(1, Math.floor(LOGICAL_CANVAS_H * scale));
  canvas.width = LOGICAL_CANVAS_W;
  canvas.height = LOGICAL_CANVAS_H;
  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
};

function getStored(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
}

function getStoredPid() {
  // PID should be tab-scoped to avoid cross-tab identity collisions.
  return sessionStorage.getItem("dg_pid") || "";
}

function opListFromSnapshot(msg) {
  return Array.isArray(msg?.ops) ? msg.ops : [];
}

function canonicalToPixelPoint(x, y, canvas) {
  const sx = (canvas?.width || 1) / LOGICAL_CANVAS_W;
  const sy = (canvas?.height || 1) / LOGICAL_CANVAS_H;
  return { x: x * sx, y: y * sy };
}

function opToStroke(op, canvas) {
  const t = op?.t || op?.type || "line";
  const p = op?.p || op || {};
  const sx = (canvas?.width || 1) / LOGICAL_CANVAS_W;
  const size = Math.max(1, Number(p.w || 3)) * sx;

  if (p.clear) {
    return { type: "clear" };
  }
  if (p.erase) {
    const pts = Array.isArray(p.pts) ? p.pts : [];
    if (pts.length < 2) return null;
    return {
      type: "erase",
      size,
      points: pts.map((pt) => canonicalToPixelPoint(pt[0], pt[1], canvas)),
    };
  }

  if (t === "circle") {
    const cx = Number(p.cx || 0);
    const cy = Number(p.cy || 0);
    const r = Number(p.r || 0);
    return {
      type: "circle",
      color: p.c || "#2f3542",
      size,
      center: canonicalToPixelPoint(cx, cy, canvas),
      radius: r * sx,
    };
  }

  // default: line
  const pts = Array.isArray(p.pts) ? p.pts : [];
  if (pts.length < 2) return null;
  return {
    type: "free",
    color: p.c || "#2f3542",
    size,
    points: pts.map((pt) => canonicalToPixelPoint(pt[0], pt[1], canvas)),
  };
}

function strokeToOp(stroke, canvas) {
  const sx = (canvas?.width || 1) / LOGICAL_CANVAS_W;
  const sy = (canvas?.height || 1) / LOGICAL_CANVAS_H;
  const w = Math.max(1, Number(stroke?.size || 3)) / sx;

  if (stroke?.type === "circle") {
    const cx = (stroke.center?.x || 0) / sx;
    const cy = (stroke.center?.y || 0) / sy;
    const r = (stroke.radius || 0) / sx;
    return { t: "circle", p: { cx, cy, r, c: stroke.color, w }, start_ts: Date.now() };
  }

  // line / free
  const pts = (stroke?.type === "line" && stroke.start && stroke.end)
    ? [[stroke.start.x / sx, stroke.start.y / sy], [stroke.end.x / sx, stroke.end.y / sy]]
    : Array.isArray(stroke?.points)
      ? stroke.points.map((pt) => [pt.x / sx, pt.y / sy])
      : [];

  if (pts.length < 2) return null;
  return { t: "line", p: { pts, c: stroke.color, w }, start_ts: Date.now() };
}



const SingleGame = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();
  const canvasRef = useRef(null);
  const audioEngineRef = useRef(null);
  const gameIntervalRef = useRef(null);
  const shapeStartRef = useRef(null);
  const shapeBaseImageRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const eraserPathRef = useRef([]);
  const playersByPidRef = useRef({});
  const roundEndHandledKeyRef = useRef("");
  const routedToWinRef = useRef(false);
  const rolePickHandledRef = useRef(false);

  // ===== Shared canvas ops (from backend) =====
  const opsRef = useRef([]);         // canonical ops (1024x768) from server
  const [opsVersion, setOpsVersion] = useState(0); // bump to trigger re-render/rebuild
  const bumpOps = useCallback(() => setOpsVersion((v) => v + 1), []);

  // ===== WebSocket snapshot state (for countdown + secret display) =====
  const [snapshot, setSnapshot] = useState(ws.snapshot || null);

  const roomCode = ws.roomCode || getStored("dg_room");
  const myPid = ws.pid || getStoredPid() || "";
  const backendRole = useMemo(() => {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const me = players.find((p) => p?.pid === myPid);
    return String(me?.role || "").toLowerCase();
  }, [snapshot, myPid]);

  const roundConfig = snapshot?.round_config || {};
  const gameSnap = snapshot?.game || {};
  const strokeLimit = Number(gameSnap?.stroke_limit || roundConfig?.stroke_limit || 0);
  const strokesLeft = Number(gameSnap?.strokes_left || 0);
  const strokesUsed = strokeLimit ? Math.max(0, strokeLimit - strokesLeft) : 0;
  const roomRoundNo = Number(snapshot?.room?.round_no || 0);
  const isInRound = snapshot?.room?.state === "IN_GAME";
  const isVotingPhase = snapshot?.room?.state === "GAME_END" && String(gameSnap?.phase || "") === "VOTING";
  const phase = String(gameSnap?.phase || "");
  const gmPid = String(snapshot?.room?.gm_pid || snapshot?.roles?.gm || "");
  const drawerPid = String(gameSnap?.drawer_pid || snapshot?.roles?.drawer || "");
  const isGmByPid = Boolean(myPid) && gmPid === myPid;
  const isDrawerByPid = Boolean(myPid) && drawerPid === myPid;
  // Strict permission source: backend per-player role first.
  // Fallback to pid mapping only for drawer (game.drawer_pid is authoritative in SINGLE).
  const canDraw = isInRound && phase === "DRAW" && (backendRole === "drawer" || isDrawerByPid);
  const canGuess = isInRound && backendRole === "guesser";
  const roundEndWinnerPid = String(gameSnap?.winner_pid || "");
  const roundEndWinnerName = useMemo(() => {
    if (!roundEndWinnerPid) return "";
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const matched = players.find((p) => p?.pid === roundEndWinnerPid);
    return matched?.name || playersByPidRef.current[roundEndWinnerPid] || `Player ${roundEndWinnerPid.slice(0, 4)}`;
  }, [roundEndWinnerPid, snapshot]);
  const livePlayers = useMemo(() => {
    const list = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const gmPid = snapshot?.room?.gm_pid || "";
    return list
      .filter((p) => p && p.connected !== false)
      .map((p) => ({
        id: p.pid,
        name: p.name || "Unknown",
        avatar: String(p.name || "?")[0]?.toUpperCase() || "?",
        score: Number(p.score || 0),
        isHost: p.pid === gmPid,
        color: p.pid === myPid ? 'var(--accent)' : undefined,
      }))
      .sort((a, b) => b.score - a.score);
  }, [snapshot, myPid]);
  const myScore = useMemo(() => {
    const me = livePlayers.find((p) => p.id === myPid);
    return me ? me.score : 0;
  }, [livePlayers, myPid]);
  const secretWord = String(roundConfig?.secret_word || "");
  const canSeeSecret = isGmByPid || isDrawerByPid;

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const timeLimitSec = Number(roundConfig?.time_limit_sec || 0);
  const gameStartedAt = Number(gameSnap?.game_started_at || 0);
  const gameEndAt =
    Number(gameSnap?.game_end_at || 0) ||
    (gameStartedAt && timeLimitSec ? gameStartedAt + timeLimitSec : 0);

  const serverTimeLeft =
    gameEndAt ? Math.max(0, Math.floor(gameEndAt - nowSec)) : 0;
  const hasServerTimer = Boolean(gameStartedAt && timeLimitSec);
  const goToSingleWin = useCallback((payload) => {
    if (routedToWinRef.current) return;
    routedToWinRef.current = true;
    navigate('/single-win', { state: payload });
  }, [navigate]);
  const handoffToRolePick = useCallback(() => {
    navigate('/role-pick');
  }, [navigate]);

  useEffect(() => {
    if (ws.snapshot) {
      setSnapshot(ws.snapshot);
    }
  }, [ws.snapshot]);

  useEffect(() => {
    if (!snapshot) return;

    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    playersByPidRef.current = Object.fromEntries(
      players.map((p) => [p.pid, p.name || "Player"])
    );

    const ops = opListFromSnapshot(snapshot);
    opsRef.current = ops;
    const canvas = canvasRef.current;
    if (canvas) {
      const rebuilt = [];
      const distPointToSegmentLocal = (p, a, b) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
        const clamped = Math.max(0, Math.min(1, t));
        const cx = a.x + clamped * dx;
        const cy = a.y + clamped * dy;
        return Math.hypot(p.x - cx, p.y - cy);
      };
      const hitStrokeLocal = (stroke, point, radius) => {
        const r = radius + (stroke.size || 1) / 2;
        if (stroke.type === 'line') {
          return distPointToSegmentLocal(point, stroke.start, stroke.end) <= r;
        }
        if (stroke.type === 'circle') {
          const d = Math.hypot(point.x - stroke.center.x, point.y - stroke.center.y);
          return Math.abs(d - stroke.radius) <= r;
        }
        if (stroke.type === 'free') {
          const pts = stroke.points || [];
          for (let i = 1; i < pts.length; i += 1) {
            if (distPointToSegmentLocal(point, pts[i - 1], pts[i]) <= r) return true;
          }
          return false;
        }
        return false;
      };
      const applyEraseLocal = (point, radius) => {
        for (let i = rebuilt.length - 1; i >= 0; i -= 1) {
          if (hitStrokeLocal(rebuilt[i], point, radius)) {
            rebuilt.splice(i, 1);
          }
        }
      };

      ops.forEach((opWrap) => {
        const st = opToStroke(opWrap?.p ? opWrap : opWrap, canvas);
        if (!st) return;
        if (st.type === 'clear') {
          rebuilt.length = 0;
          return;
        }
        if (st.type === 'erase') {
          const radius = Math.max(6, (st.size || 6) * 1.5);
          st.points.forEach((pt) => applyEraseLocal(pt, radius));
          return;
        }
        rebuilt.push(st);
      });

      strokesRef.current = rebuilt;
      renderStrokes();
    }
    bumpOps();

    if (snapshot?.room?.state === "GAME_END") {
      const winnerPid = String(snapshot?.game?.winner_pid || "");
      const reason = String(snapshot?.game?.end_reason || "");
      const phase = String(snapshot?.game?.phase || "");
      const roundNo = Number(snapshot?.room?.round_no || 0);
      const dedupeKey = `${roundNo}:${reason}:${phase}:${winnerPid}`;
      if (roundEndHandledKeyRef.current !== dedupeKey) {
        roundEndHandledKeyRef.current = dedupeKey;
        const winnerName = winnerPid
          ? (playersByPidRef.current[winnerPid] || `Player ${winnerPid.slice(0, 4)}`)
          : "";

        setGameState((prev) => ({ ...prev, isGameOver: true, isPaused: true }));
        if (reason === "VOTE_NO") {
          const connectedPlayers = players.filter((p) => p && p.connected !== false);
          const sortedByScore = [...connectedPlayers].sort(
            (a, b) => Number(b?.score || 0) - Number(a?.score || 0)
          );
          const top = sortedByScore[0] || null;
          goToSingleWin({
            roomCode: snapshot?.room_code || roomCode,
            roundNo,
            endReason: reason,
            winnerPid: top?.pid || "",
            winnerName: top?.name || "Winner",
            players: connectedPlayers,
          });
        } else if (phase === "VOTING" && winnerPid) {
          setChatMessages((prev) => [...prev, { type: "system", text: `${winnerName} guessed correctly. Round ended. Vote next.` }]);
          setShowMessage(true);
          setMessage("Round ended. Vote next.");
        } else if (phase === "VOTING") {
          setChatMessages((prev) => [...prev, { type: "system", text: "Time is up. No correct guess this round. Vote next." }]);
          setShowMessage(true);
          setMessage("TIME'S UP! Vote next.");
        }
      }
    } else {
      roundEndHandledKeyRef.current = "";
      routedToWinRef.current = false;
    }

    if (snapshot?.room?.state === "ROLE_PICK") {
      if (!rolePickHandledRef.current) {
        rolePickHandledRef.current = true;
        setShowMessage(true);
        setMessage("Play Again wins! New roles assigned.");
        setTimeout(() => { handoffToRolePick(); }, 900);
      }
      return;
    }

    if (snapshot?.room?.state !== "GAME_END" || String(snapshot?.game?.phase || "") !== "VOTING") {
      setHasVoted(false);
    }
    if (snapshot?.room?.state === "IN_GAME") {
      rolePickHandledRef.current = false;
      setGameState((prev) => ({ ...prev, isGameOver: false, isPaused: false }));
    }
  }, [snapshot, goToSingleWin, roomCode, handoffToRolePick]);

  useEffect(() => {
    const msg = ws.lastMsg;
    if (!msg) return;

    if (msg.type === "op_broadcast" && msg.op) {
      opsRef.current = [...opsRef.current, msg.op];
      const canvas = canvasRef.current;
      if (canvas) {
        const s = opToStroke(msg.op, canvas);
        if (s?.type === "clear") {
          strokesRef.current = [];
          renderStrokes();
        } else if (s?.type === "erase") {
          const radius = Math.max(6, (s.size || 6) * 1.5);
          const distPointToSegmentLocal = (p, a, b) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
            const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
            const clamped = Math.max(0, Math.min(1, t));
            const cx = a.x + clamped * dx;
            const cy = a.y + clamped * dy;
            return Math.hypot(p.x - cx, p.y - cy);
          };
          const hitStrokeLocal = (stroke, point) => {
            const r = radius + (stroke.size || 1) / 2;
            if (stroke.type === 'line') {
              return distPointToSegmentLocal(point, stroke.start, stroke.end) <= r;
            }
            if (stroke.type === 'circle') {
              const d = Math.hypot(point.x - stroke.center.x, point.y - stroke.center.y);
              return Math.abs(d - stroke.radius) <= r;
            }
            if (stroke.type === 'free') {
              const pts = stroke.points || [];
              for (let i = 1; i < pts.length; i += 1) {
                if (distPointToSegmentLocal(point, pts[i - 1], pts[i]) <= r) return true;
              }
              return false;
            }
            return false;
          };
          const next = [];
          strokesRef.current.forEach((st) => {
            const shouldErase = s.points.some((pt) => hitStrokeLocal(st, pt));
            if (!shouldErase) next.push(st);
          });
          strokesRef.current = next;
          renderStrokes();
        } else if (s) {
          strokesRef.current = [...strokesRef.current, s];
          renderStrokes();
        }
      }
      bumpOps();
    }

    if (msg.type === "guess_chat") {
      const sender = String(msg.name || "Player");
      const text = String(msg.text || "").trim();
      if (!text) return;
      setChatMessages((prev) => [...prev, { type: "user", text: `${sender}: ${text}` }]);
    }

    if (msg.type === "guess_result" && msg.correct) {
      ws.send({ type: "snapshot" });
    }

    if (msg.type === "budget_update" && msg.budget && typeof msg.budget.stroke_remaining === "number") {
      setGameState((prev) => {
        const used = Math.max(0, strokeLimit - Number(msg.budget.stroke_remaining));
        return { ...prev, strokesUsed: used };
      });
    }

    if (msg.type === "error" && msg.code === "NOT_GUESSER") {
      setShowMessage(true);
      setMessage("Only guessers can send guesses.");
    }

    if (msg.type === "room_state_changed" && msg.state === "ROLE_PICK") {
      if (!rolePickHandledRef.current) {
        rolePickHandledRef.current = true;
        setShowMessage(true);
        setMessage("Play Again wins! New roles assigned.");
        setTimeout(() => { handoffToRolePick(); }, 900);
      }
      return;
    }

    if (
      msg.type === "room_state_changed" ||
      msg.type === "phase_changed" ||
      msg.type === "roles_assigned" ||
      msg.type === "player_joined" ||
      msg.type === "player_left" ||
      msg.type === "game_end"
    ) {
      ws.send({ type: "snapshot" });
    }
  }, [ws.lastMsg, ws.send, strokeLimit, handoffToRolePick]);

  useEffect(() => {
    if (ws.status === "CONNECTED") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, ws.send]);

const MAX_TIME = 60;
  const MAX_STROKES = 30;
  
  // Game state
  const [gameState, setGameState] = useState({
    color: '#2f3542',
    size: 8,
    brush: 'line',
    mode: 'draw',
    timeLeft: MAX_TIME,
    strokesUsed: 0,
    isGameOver: false,
    isPaused: false,
    round: 1,
    maxRounds: 3,
    score: 0
  });

  const strokesRemaining = strokeLimit ? Math.max(0, strokeLimit - (gameState?.strokesUsed || 0)) : 0;

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { type: 'system', text: 'Game Started! Good luck!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  
  // Audio settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  // ================= AUDIO ENGINE =================
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.musicOsc = null;
      this.musicGain = null;
      this.drawingOsc = null;
      this.drawingGain = null;
      this.isMusicPlaying = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playTone(freq, type, duration, vol = 0.1) {
      if (!soundEnabled) return;
      if (!this.ctx) this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }

    playHover() { this.playTone(600, 'sine', 0.1, 0.05); }
    playClick() { 
      this.playTone(800, 'triangle', 0.1, 0.1); 
      setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 50); 
    }
    playError() { 
      this.playTone(150, 'sawtooth', 0.3, 0.1); 
      setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.1), 100); 
    }
    playTyping() { 
      this.playTone(200 + Math.random() * 100, 'square', 0.05, 0.02); 
    }
    
    playDrawStart() {
      if (!soundEnabled) return;
      if (!this.ctx) this.init(); 
      if (this.drawingOsc) return;
      
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      this.drawingOsc = this.ctx.createBufferSource();
      this.drawingOsc.buffer = buffer;
      this.drawingOsc.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; 
      filter.frequency.value = 800;
      
      this.drawingGain = this.ctx.createGain();
      this.drawingGain.gain.value = 0.05;
      
      this.drawingOsc.connect(filter); 
      filter.connect(this.drawingGain); 
      this.drawingGain.connect(this.ctx.destination);
      this.drawingOsc.start();
    }
    
    playDrawStop() {
      if (this.drawingOsc && this.ctx) {
        const currTime = this.ctx.currentTime;
        this.drawingGain.gain.setValueAtTime(this.drawingGain.gain.value, currTime);
        this.drawingGain.gain.exponentialRampToValueAtTime(0.001, currTime + 0.1);
        this.drawingOsc.stop(currTime + 0.1);
        this.drawingOsc = null;
      }
    }
    
    playClear() {
      if (!soundEnabled) return;
      if (!this.ctx) this.init();
      const bufferSize = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const osc = this.ctx.createBufferSource();
      osc.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    }
    
    playGameOver() {
      if (!soundEnabled) return;
      this.playTone(400, 'sine', 0.4);
      setTimeout(() => this.playTone(300, 'sine', 0.4), 200);
      setTimeout(() => this.playTone(200, 'sine', 0.8), 400);
    }
  }

  // ========== INIT EFFECTS ==========
  // Initialize audio engine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    
    const initAudio = () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.init();
      }
    };
    
    document.body.addEventListener('click', initAudio, { once: true });
    
    return () => {
      document.body.removeEventListener('click', initAudio);
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  });

  // Canvas setup - ဒီမှာ ctx ကို ချိတ်မယ်
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      fitCanvasToWrapper(canvas);
      
      // Canvas clear လုပ်ပြီး background ပြန်ဖြည့်
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      renderStrokes();
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Game timer
  useEffect(() => {
    if (!hasServerTimer) return;
    setGameState((prev) => ({
      ...prev,
      timeLeft: serverTimeLeft,
    }));
  }, [hasServerTimer, serverTimeLeft]);

  useEffect(() => {
    if (!strokeLimit) return;
    setGameState((prev) => ({ ...prev, strokesUsed }));
  }, [strokeLimit, strokesUsed]);

  // Message timeout
  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showMessage]);

  // Button hover sounds
  useEffect(() => {
    const buttons = document.querySelectorAll('button');
    const handleMouseEnter = () => audioEngineRef.current?.playHover();
    
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', handleMouseEnter);
    });
    
    return () => {
      buttons.forEach(btn => {
        btn.removeEventListener('mouseenter', handleMouseEnter);
      });
    };
  }, []);

  // ========== DRAWING FUNCTIONS ==========
  const drawStroke = useCallback((ctx, stroke) => {
    ctx.save();
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    if (stroke.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(stroke.start.x, stroke.start.y);
      ctx.lineTo(stroke.end.x, stroke.end.y);
      ctx.stroke();
    } else if (stroke.type === 'circle') {
      ctx.beginPath();
      ctx.arc(stroke.center.x, stroke.center.y, stroke.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.type === 'free') {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const renderStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((s) => drawStroke(ctx, s));
  }, [drawStroke]);

  const distPointToSegment = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const cx = a.x + clamped * dx;
    const cy = a.y + clamped * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  };

  const hitStroke = (stroke, point, radius) => {
    const r = radius + (stroke.size || 1) / 2;
    if (stroke.type === 'line') {
      return distPointToSegment(point, stroke.start, stroke.end) <= r;
    }
    if (stroke.type === 'circle') {
      const d = Math.hypot(point.x - stroke.center.x, point.y - stroke.center.y);
      return Math.abs(d - stroke.radius) <= r;
    }
    if (stroke.type === 'free') {
      const pts = stroke.points || [];
      for (let i = 1; i < pts.length; i += 1) {
        if (distPointToSegment(point, pts[i - 1], pts[i]) <= r) return true;
      }
      return false;
    }
    return false;
  };

  const eraseAt = useCallback((point, radius) => {
    strokesRef.current = strokesRef.current.filter((s) => !hitStroke(s, point, radius));
    renderStrokes();
  }, [renderStrokes]);
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const scaleX = LOGICAL_CANVAS_W / rect.width;
    const scaleY = LOGICAL_CANVAS_H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return {
      x: Math.max(0, Math.min(LOGICAL_CANVAS_W, x)),
      y: Math.max(0, Math.min(LOGICAL_CANVAS_H, y))
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault?.();
    if (!canDraw) return;
    if (strokeLimit && strokesRemaining <= 0) {
      audioEngineRef.current?.playError();
      setShowMessage(true);
      setMessage("OUT OF INK!");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameState.isGameOver || gameState.isPaused) return;
    setIsDrawing(true);
    audioEngineRef.current?.playDrawStart();

    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.lineWidth = gameState.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (gameState.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = gameState.color;
      ctx.fillStyle = gameState.color;
    }

    if (gameState.mode === 'erase') {
      shapeStartRef.current = null;
      shapeBaseImageRef.current = null;
      ctx.beginPath();
      ctx.moveTo(x, y);
      eraserPathRef.current = [{ x, y }];
    } else if (gameState.mode === 'draw' && (gameState.brush === 'line' || gameState.brush === 'circle')) {
      currentStrokeRef.current = {
        type: gameState.brush,
        color: gameState.color,
        size: gameState.size,
        start: { x, y },
        end: { x, y },
        center: { x, y },
        radius: 0
      };
    } else if (gameState.brush === 'circle') {
      ctx.beginPath();
      ctx.arc(x, y, gameState.size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
      currentStrokeRef.current = {
        type: 'free',
        color: gameState.color,
        size: gameState.size,
        points: [{ x, y }]
      };
    }
  }, [canDraw, strokeLimit, strokesRemaining, gameState, getCanvasCoordinates]);

  const draw = useCallback((e) => {
    e.preventDefault?.();
    if (!canDraw) return;
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setGameState(prev => {
      if (prev.isGameOver || prev.isPaused) return prev;
      
      const { x, y } = getCanvasCoordinates(e);

      if (prev.mode === 'erase') {
        const eraserRadius = Math.max(6, prev.size * 1.5);
        eraserPathRef.current.push({ x, y });
        eraseAt({ x, y }, eraserRadius);
      } else if (prev.mode === 'draw' && (prev.brush === 'line' || prev.brush === 'circle')) {
        const stroke = currentStrokeRef.current;
        if (stroke) {
          stroke.end = { x, y };
          if (stroke.type === 'circle') {
            const dx = x - stroke.start.x;
            const dy = y - stroke.start.y;
            stroke.center = { x: stroke.start.x, y: stroke.start.y };
            stroke.radius = Math.sqrt(dx * dx + dy * dy);
          }
          renderStrokes();
          const previewCtx = canvas.getContext('2d');
          drawStroke(previewCtx, stroke);
        }
      } else if (prev.brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, prev.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const stroke = currentStrokeRef.current;
        if (stroke && stroke.type === 'free') {
          stroke.points.push({ x, y });
          renderStrokes();
          const previewCtx = canvas.getContext('2d');
          drawStroke(previewCtx, stroke);
        }
      }
      
      return prev;
    });
  }, [canDraw, isDrawing, getCanvasCoordinates, drawStroke, renderStrokes, eraseAt]);

  const stopDrawing = useCallback(() => {
    if (!canDraw) return;
    setIsDrawing(false);
    audioEngineRef.current?.playDrawStop();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (gameState.mode === 'erase') {
        const path = eraserPathRef.current || [];
        eraserPathRef.current = [];
        if (path.length >= 2) {
          const pts = path.map((pt) => [pt.x, pt.y]);
          const op = { t: "line", p: { pts, w: gameState.size, erase: 1 } };
          opsRef.current = [...opsRef.current, op];
          ws.send({ type: "draw_op", op });
          bumpOps();
        }
        ctx.closePath();
        ctx.globalCompositeOperation = 'source-over';
        return;
      }

      if (gameState.mode === 'draw') {
        const stroke = currentStrokeRef.current;
        if (stroke) {
          // 1) keep local render smooth
          strokesRef.current.push(stroke);
          currentStrokeRef.current = null;
          renderStrokes();

          // 2) broadcast to server so everyone sees it
          const op = strokeToOp(stroke, canvas);
          if (op) {
            opsRef.current = [...opsRef.current, op];
            ws.send({ type: "draw_op", op });
            bumpOps();
          }
        }
      }
      ctx.closePath();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [canDraw, gameState.mode, gameState.size, renderStrokes, bumpOps, ws.send]);

  // Canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  // ========== TOOL FUNCTIONS ==========
  const setTool = (type, value, el) => {
    if (!canDraw) return;
    setGameState(prev => {
      const limit = strokeLimit || MAX_STROKES;
      if (prev.strokesUsed >= limit || prev.isPaused) return prev;
      
      audioEngineRef.current?.playClick();
      
      if (type === 'size') {
        return { ...prev, mode: 'draw', size: value };
      }
      if (type === 'brush') {
        return { ...prev, mode: 'draw', brush: value };
      }
      if (type === 'color') {
        return { ...prev, mode: 'draw', color: value };
      }
      return prev;
    });
  };

  const useEraser = () => {
    if (!canDraw) return;
    setGameState(prev => {
      const limit = strokeLimit || MAX_STROKES;
      if (prev.strokesUsed >= limit || prev.isPaused) return prev;
      audioEngineRef.current?.playClick();
      return { ...prev, mode: 'erase' };
    });
  };

  const clearCanvas = () => {
    if (!canDraw) return;
    setGameState(prev => {
      if (prev.isPaused) return prev;
      
      audioEngineRef.current?.playClear();
      strokesRef.current = [];
      currentStrokeRef.current = null;
      renderStrokes();
      return prev;
    });
    const op = { t: "line", p: { pts: [[0, 0], [0, 0]], w: gameState.size, clear: 1 } };
    opsRef.current = [...opsRef.current, op];
    ws.send({ type: "draw_op", op });
  };

  // ========== CHAT FUNCTIONS ==========
  const sendMessage = () => {
    if (!canGuess) return;
    if (!chatInput.trim()) return;
    const guessText = chatInput.trim();

    ws.send({ type: "guess", text: guessText });
    setChatInput('');
    audioEngineRef.current?.playClick();
  };

  const sendVoteNext = (vote) => {
    if (!isVotingPhase || hasVoted) return;
    ws.send({ type: "vote_next", vote });
    setHasVoted(true);
    setShowMessage(true);
    setMessage(vote === "yes" ? "Voted: Play Again" : "Voted: Stop");
  };

  // ========== MODAL FUNCTIONS ==========
  const openExitMenu = () => {
    setGameState(prev => ({ ...prev, isPaused: true }));
    setShowExitModal(true);
  };

  const openSettings = () => {
    setGameState(prev => ({ ...prev, isPaused: true }));
    setShowSettingsModal(true);
  };

  const closeModal = () => {
    setShowExitModal(false);
    setShowSettingsModal(false);
    setGameState(prev => ({ ...prev, isPaused: false }));
  };

  const exitToMenu = () => {
    navigate('/');
  };

  // ========== UI CALCULATIONS ==========
  const effectiveMaxStrokes = strokeLimit || MAX_STROKES;
  const strokePercentage = (gameState.strokesUsed / Math.max(1, effectiveMaxStrokes)) * 100;
  const effectiveMaxTime = hasServerTimer && timeLimitSec ? timeLimitSec : MAX_TIME;
  const timePercentage = (gameState.timeLeft / Math.max(1, effectiveMaxTime)) * 100;
  
  const getStrokeBarColor = () => {
    if (strokePercentage > 80) return '#ef4444';
    if (strokePercentage > 50) return '#facc15';
    return '#6d4aff';
  };

  const getTimerColor = () => {
    return gameState.timeLeft <= 10 ? '#ef4444' : '#f97316';
  };

  // ========== RENDER ==========
  return (
    <div className="game-wrapper">
      {/* Header with Icons */}
      <header className="top-bar">
        {/* Left: Settings + Data */}
        <div className="left-group">
          {/* Settings Icon */}
          <button className="icon-btn" onClick={openSettings} title="Settings">
            <svg viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>

          <div className="data-item">
            <span className="data-label">Round</span>
            <span className="data-value">{roomRoundNo}</span>
          </div>

          <div className="data-item">
            <span className="data-label">Ink</span>
            <span className="data-value stroke">{gameState.strokesUsed}</span>
            <div className="data-bar-bg">
              <div 
                className="data-bar-fill stroke" 
                style={{ 
                  width: `${strokePercentage}%`,
                  background: getStrokeBarColor()
                }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Center: Timer */}
        <div className="center-group">
          {canSeeSecret && secretWord && (
            <div className="secret-pill" style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
              Word: <b>{secretWord}</b>
            </div>
          )}

          <div className="timer-box" style={{ color: getTimerColor() }}>
            {gameState.timeLeft}
          </div>
          <div className="data-bar-bg" style={{ width: '100px' }}>
            <div 
              className="data-bar-fill time" 
              style={{ 
                width: `${timePercentage}%`,
                background: getTimerColor()
              }}
            ></div>
          </div>
        </div>
        
        {/* Right: Score + Exit */}
        <div className="right-group">
          <div className="data-item">
            <span className="data-label">Score</span>
            <span className="data-value score">{myScore}</span>
          </div>

          {/* Exit Icon */}
          <button 
            className="icon-btn exit-btn" 
            onClick={openExitMenu} 
            title="Exit / Pause"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Game Container */}
      <div className="game-container">
        
        <div className="canvas-area">
          <canvas ref={canvasRef} id="canvasMain" style={!canDraw ? { pointerEvents: 'none' } : undefined}></canvas>
          {showMessage && (
            <div className="overlay-msg" id="gameMsg">
              {message}
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="panel-card tools-card">
            <div className="tools-row">
              <span className="tools-label">Color</span>
              <div className="color-grid">
                {['#2f3542', '#ff4757', '#2e86de', '#2ed573', '#ffa502'].map(color => (
                  <div 
                    key={color}
                    className={`color-btn ${gameState.color === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={(e) => setTool('color', color, e.target)}
                  ></div>
                ))}
              </div>
            </div>
            
            <div className="tools-row">
              <span className="tools-label">Size</span>
              <div className="brush-stack">
                {[3, 8, 15].map(size => (
                  <div 
                    key={size}
                    className={`brush-btn ${gameState.size === size ? 'active' : ''}`}
                    onClick={(e) => setTool('size', size, e.target)}
                  >
                    <div 
                      className="dot" 
                      style={{ 
                        width: size === 3 ? '3px' : size === 8 ? '6px' : '10px',
                        height: size === 3 ? '3px' : size === 8 ? '6px' : '10px'
                      }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tools-row">
              <span className="tools-label">Brush</span>
              <div className="brush-type-group">
                <button
                  className={`brush-type-btn ${gameState.brush === 'line' ? 'active' : ''}`}
                  onClick={() => setTool('brush', 'line')}
                >
                  Line
                </button>
                <button
                  className={`brush-type-btn ${gameState.brush === 'circle' ? 'active' : ''}`}
                  onClick={() => setTool('brush', 'circle')}
                >
                  Circle
                </button>
              </div>
            </div>
            
            <div className="tools-row" style={{ justifyContent: 'flex-end', marginTop: '5px' }}>
              <div className="action-group">
                <button 
                  className={`action-btn ${gameState.mode === 'erase' ? 'active-eraser' : ''}`}
                  onClick={useEraser}
                  title="Eraser"
                >
                  🧽
                </button>
                <button 
                  className="action-btn"
                  onClick={clearCanvas}
                  title="Clear"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div className="panel-card chat-card">
            <div className="chat-log-container" id="chatLog">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`msg ${msg.type === 'system' ? 'system' : ''}`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="input-area">
              <input 
                type="text" 
                className="guess-box" 
                placeholder={
                  canGuess
                    ? "Type guess..."
                    : !isInRound
                      ? "Guessing opens when game starts"
                      : "Only guessers can type guesses"
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!canGuess}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                  if (!canGuess) return;
                  audioEngineRef.current?.playTyping();
                }}
              />
              <button className="send-btn" onClick={sendMessage} disabled={!canGuess}>SEND</button>
            </div>
          </div>

        </aside>
      </div>

      {/* ================= MODALS ================= */}

      {/* Round End Vote Popup */}
      {isVotingPhase && !showExitModal && !showSettingsModal && (
        <div className="modal-overlay active" id="roundEndVoteModal">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {roundEndWinnerPid ? `${roundEndWinnerName} is correct!` : "TIME'S UP!"}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                Play next round or stop?
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal btn-resume"
                disabled={hasVoted}
                onClick={() => sendVoteNext('yes')}
              >
                PLAY NEXT ROUND
              </button>
              <button
                className="btn-modal btn-exit"
                disabled={hasVoted}
                onClick={() => sendVoteNext('no')}
              >
                STOP
              </button>
            </div>
            {hasVoted && (
              <p style={{ color: '#a3e635', marginTop: '10px', textAlign: 'center' }}>
                Vote submitted. Waiting for other players...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Exit / Pause Menu */}
      {showExitModal && (
        <div className="modal-overlay active" id="exitModal">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">GAME PAUSED</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Current Round Summary</p>
            </div>
            <div className="player-list-exit">
              {livePlayers.map((player) => (
                <div key={player.id} className="player-row">
                  <div 
                    className="p-avatar" 
                    style={player.color ? { background: player.color } : {}}
                  >
                    {player.avatar}
                  </div>
                  <div className="p-info">
                    <div className="p-name">{player.name}</div>
                    <div className="p-score">Score: {player.score}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-modal btn-resume" onClick={closeModal}>
                RESUME GAME
              </button>
              <button className="btn-modal btn-exit" onClick={exitToMenu}>
                EXIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      {showSettingsModal && (
        <div className="modal-overlay active" id="settingsModal">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">SETTINGS</h2>
            </div>
            <div className="setting-row">
              <span>Sound Effects</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <span>Music</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={musicEnabled}
                  onChange={(e) => setMusicEnabled(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <span>Show Hints</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={hintsEnabled}
                  onChange={(e) => setHintsEnabled(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-modal btn-resume" onClick={closeModal}>
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleGame;
