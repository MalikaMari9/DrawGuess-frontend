import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BattleGame.css';
import { useRoomWSContext } from "../ws/RoomWSContext";

const BattleGame = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();

  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const roundConfig = snapshot.round_config || {};
  const game = snapshot.game || {};

  // ✅ keep a reactive copy of game so timers/budget/phase update instantly
  const [gameState, setGameState] = useState(game);
  useEffect(() => {
    setGameState(snapshot.game || {});
  }, [snapshot.game]);

  const myPid = ws.pid || localStorage.getItem("dg_pid");
  const me = players.find((p) => p.pid === myPid) || {};
  const myName = me.name || "Player";
  const myTeam = me.team || null;
  const myRole = me.role || "";
  const isDrawer = myRole.includes("drawer");
  const isGuesser = myRole.includes("guesser");
  const isGM = myRole === "gm" || (room.gm_pid && myPid && room.gm_pid === myPid);
  const isDrawerA = isDrawer && myTeam === "A";
  const isDrawerB = isDrawer && myTeam === "B";
  const isGuesserA = isGuesser && myTeam === "A";
  const isGuesserB = isGuesser && myTeam === "B";
  const roleLabel = isGM
    ? "GM"
    : isDrawer
    ? "Drawer"
    : isGuesser
    ? "Guesser"
    : "Player";
  const teamLabel = myTeam === "A" ? "Red Team" : myTeam === "B" ? "Blue Team" : "No Team";

  const phaseFromGame = gameState.phase || "";
  const score = gameState.score || { A: 0, B: 0 };
  const teamGuessed = gameState.team_guessed || {};
  const teamAlreadyGuessed = myTeam ? !!teamGuessed[myTeam] : false;

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const redTeam = {
    name: "Red Team",
    players: teamA.map((p) => p.name || "Unknown"),
    score: score.A || 0,
  };
  const blueTeam = {
    name: "Blue Team",
    players: teamB.map((p) => p.name || "Unknown"),
    score: score.B || 0,
  };

  const currentPlayer = myName;

  useEffect(() => {
    if (room.state === "GAME_END") {
      navigate("/battle-round-win");
      return;
    }
    if (room.state === "ROLE_PICK") {
      navigate("/role-pick");
      return;
    }
    if (room.state === "CONFIG") {
      navigate("/waiting-room");
    }
  }, [room.state, navigate]);

  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [phase, setPhase] = useState(phaseFromGame);
  const [budget, setBudget] = useState({ A: 0, B: 0 });
  const [maxStrokes, setMaxStrokes] = useState(4);
  const [lastGuessResult, setLastGuessResult] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [sabotageArmed, setSabotageArmed] = useState(false);
  const [sabotageCooldown, setSabotageCooldown] = useState({ A: 0, B: 0 });

  const canDrawA = isDrawerA && room.state === "IN_GAME" && phase === "DRAW";
  const canDrawB = isDrawerB && room.state === "IN_GAME" && phase === "DRAW";

  // ✅ timers from reactive gameState
  const drawEndAt = Number(gameState?.draw_end_at || 0);
  const guessEndAt = Number(gameState?.guess_end_at || 0);

  const phaseRemaining =
    phase === "DRAW"
      ? (drawEndAt ? Math.max(0, drawEndAt - nowSec) : 0)
      : phase === "GUESS"
      ? (guessEndAt ? Math.max(0, guessEndAt - nowSec) : 0)
      : 0;
  const phaseTimeLabel = phase === "GUESS" ? "GUESS TIME" : phase === "DRAW" ? "DRAW TIME" : "TIME";

  const team1SabotageUsed = (sabotageCooldown.A || 0) > nowSec;
  const team2SabotageUsed = (sabotageCooldown.B || 0) > nowSec;

  // ✅ Phase-based last-30s lock
  const sabotageDisabledLast30 = phaseRemaining > 0 && phaseRemaining <= 30;

  // Canvas refs
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const ctx1Ref = useRef(null);
  const ctx2Ref = useRef(null);
  const strokes1Ref = useRef([]);
  const strokes2Ref = useRef([]);
  const currentStroke1Ref = useRef(null);
  const currentStroke2Ref = useRef(null);
  const pendingOpsRef = useRef([]);
  const phaseTickSentRef = useRef(false);

  // ✅ Request snapshot to seed timers when entering a phase with missing end_at
  useEffect(() => {
    if (room.state !== "IN_GAME") return;
    if (phase === "DRAW" && !drawEndAt) ws.send({ type: "snapshot" });
    if (phase === "GUESS" && !guessEndAt) ws.send({ type: "snapshot" });
  }, [room.state, phase, drawEndAt, guessEndAt, ws]);

  // ✅ Auto-send phase_tick ONLY when an active phase timer has actually reached 0
  useEffect(() => {
    if (room.state !== "IN_GAME") return;

    const hasTimer = phase === "DRAW" ? !!drawEndAt : phase === "GUESS" ? !!guessEndAt : false;
    if (!hasTimer) return;

    if (phaseRemaining > 0) {
      phaseTickSentRef.current = false;
      return;
    }
    if (phaseTickSentRef.current) return;

    phaseTickSentRef.current = true;
    ws.send({ type: "phase_tick" });
  }, [room.state, phaseRemaining, ws, phase, drawEndAt, guessEndAt]);

  // Tool states for Team 1
  const [team1Color, setTeam1Color] = useState('#000000');
  const [team1Size, setTeam1Size] = useState(6);
  const [team1Mode, setTeam1Mode] = useState('draw');
  const [team1Brush, setTeam1Brush] = useState('line');

  // Tool states for Team 2
  const [team2Color, setTeam2Color] = useState('#000000');
  const [team2Size, setTeam2Size] = useState(6);
  const [team2Mode, setTeam2Mode] = useState('draw');
  const [team2Brush, setTeam2Brush] = useState('line');

  // Drawing states
  const [isDrawing1, setIsDrawing1] = useState(false);
  const [isDrawing2, setIsDrawing2] = useState(false);

  // Chat states
  const [team1Messages, setTeam1Messages] = useState([]);
  const [team2Messages, setTeam2Messages] = useState([]);
  const [team1Input, setTeam1Input] = useState('');
  const [team2Input, setTeam2Input] = useState('');

  // Modal states
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Settings states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  const redScore = score.A || 0;
  const blueScore = score.B || 0;
  const round = room.round_no || 0;

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPhase(phaseFromGame || "");
  }, [phaseFromGame]);

  useEffect(() => {
    if (roundConfig?.strokes_per_phase) {
      setMaxStrokes(Number(roundConfig.strokes_per_phase));
    }
  }, [roundConfig?.strokes_per_phase]);

  // ✅ budget comes from server snapshots / budget_update
  useEffect(() => {
    if (gameState?.budget) {
      setBudget(gameState.budget);
    } else {
      setBudget({ A: maxStrokes, B: maxStrokes });
    }
  }, [gameState?.budget, maxStrokes]);

  const remainingA = Number(budget?.A ?? 0);
  const remainingB = Number(budget?.B ?? 0);

  useEffect(() => {
    if (ws.status === "CONNECTED" || ws.status === "CONNECTING") return;
    const savedRoom = localStorage.getItem("dg_room");
    if (!savedRoom) return;
    (async () => {
      const ok = await ws.connectWaitOpen(savedRoom);
      if (ok) ws.send({ type: "snapshot" });
    })();
  }, [ws.status, ws.connectWaitOpen, ws.send]);

  useEffect(() => {
    if (ws.status === "CONNECTED") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, ws.send]);

  const drawStroke = (ctx, stroke) => {
    ctx.save();
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.type === "erase" ? "destination-out" : "source-over";
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
    } else if (stroke.type === 'free' || stroke.type === "erase") {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  const renderStrokes = (teamId) => {
    const canvas = teamId === 1 ? canvas1Ref.current : canvas2Ref.current;
    const ctx = teamId === 1 ? ctx1Ref.current : ctx2Ref.current;
    const strokes = teamId === 1 ? strokes1Ref.current : strokes2Ref.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => drawStroke(ctx, s));
  };

  const opSignature = (op) => {
    const rawPayload = op?.p ? { ...op.p } : { ...(op || {}) };
    delete rawPayload.t;
    delete rawPayload.pid;
    const t = op?.t || rawPayload.t || "line";
    return JSON.stringify({ t, p: rawPayload });
  };

  const opToStroke = (op) => {
    if (!op || !op.t) return null;
    const payload = op.p || {};
    const color = payload.c || "#000000";
    const size = Number(payload.w || 4);

    if (op.t === "line") {
      const pts = payload.pts || (payload.p && payload.p.pts);
      if (!Array.isArray(pts) || pts.length < 2) return null;
      return { type: "free", color, size, points: pts.map((p) => ({ x: p[0], y: p[1] })) };
    }
    if (op.t === "erase") {
      const pts = payload.pts || (payload.p && payload.p.pts);
      if (!Array.isArray(pts) || pts.length < 2) return null;
      return { type: "erase", color: "#000000", size, points: pts.map((p) => ({ x: p[0], y: p[1] })) };
    }
    if (op.t === "clear") return { type: "clear" };

    if (op.t === "circle") {
      const cx = payload.cx ?? payload.p?.cx;
      const cy = payload.cy ?? payload.p?.cy;
      const r = payload.r ?? payload.p?.r;
      if (cx === undefined || cy === undefined || r === undefined) return null;
      return { type: "circle", color, size, center: { x: cx, y: cy }, radius: r };
    }
    return null;
  };

  const buildOpFromStroke = (stroke, forceColor) => {
    if (!stroke) return null;
    const color = forceColor || stroke.color || "#000000";
    const size = Number(stroke.size || 4);

    if (stroke.type === "erase") {
      return { t: "erase", c: "#000000", w: size, pts: (stroke.points || []).map((p) => [p.x, p.y]) };
    }
    if (stroke.type === "circle") {
      return {
        t: "circle",
        c: color,
        w: size,
        cx: stroke.center?.x ?? stroke.start?.x ?? 0,
        cy: stroke.center?.y ?? stroke.start?.y ?? 0,
        r: stroke.radius ?? 0,
      };
    }
    if (stroke.type === "line") {
      return {
        t: "line",
        c: color,
        w: size,
        pts: [
          [stroke.start?.x ?? 0, stroke.start?.y ?? 0],
          [stroke.end?.x ?? 0, stroke.end?.y ?? 0],
        ],
      };
    }
    if (stroke.type === "free") {
      return { t: "line", c: color, w: size, pts: (stroke.points || []).map((p) => [p.x, p.y]) };
    }
    return null;
  };

  const applyOpToCanvas = (op, canvas) => {
    const stroke = opToStroke(op);
    if (!stroke) return;

    if (stroke.type === "clear") {
      if (canvas === "B") {
        strokes2Ref.current = [];
        renderStrokes(2);
      } else {
        strokes1Ref.current = [];
        renderStrokes(1);
      }
      return;
    }

    const target = canvas === "B" ? 2 : 1;
    if (target === 1) strokes1Ref.current = [...strokes1Ref.current, stroke];
    else strokes2Ref.current = [...strokes2Ref.current, stroke];
    renderStrokes(target);
  };

  const loadOpsFromSnapshot = (ops) => {
    const nextA = [];
    const nextB = [];
    ops.forEach((op) => {
      const stroke = opToStroke(op);
      if (!stroke) return;
      if (stroke.type === "clear") {
        if (op.canvas === "B") nextB.length = 0;
        else nextA.length = 0;
        return;
      }
      if (op.canvas === "B") nextB.push(stroke);
      else nextA.push(stroke);
    });
    strokes1Ref.current = nextA;
    strokes2Ref.current = nextB;
    renderStrokes(1);
    renderStrokes(2);
  };

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === "error") setLastError(m);
    if (m.type === "guess_result") setLastGuessResult(m);

    // ✅ when phase changes, refresh snapshot so draw_end_at / guess_end_at arrive immediately
    if (m.type === "phase_changed") {
      setPhase(m.phase || "");
      ws.send({ type: "snapshot" });
    }

    if (m.type === "budget_update" && m.budget) setBudget(m.budget);

    if (m.type === "sabotage_used") {
      const p = players.find((pl) => pl.pid === m.by);
      const team = p?.team;
      if (team === "A" || team === "B") {
        setSabotageCooldown((prev) => ({ ...prev, [team]: Number(m.cooldown_until || 0) }));
      }
    }

        if (m.type === "guess_result") {
      const team = m.team;
      const result = m.result || (m.correct ? "CORRECT" : "WRONG");
      if (result === "NO_GUESS" && (team === "A" || team === "B")) {
        const msg = { text: "No guess submitted", isOwn: false, name: team === "A" ? "Team A" : "Team B" };
        if (team === "A") setTeam1Messages((prev) => [...prev, msg]);
        if (team === "B") setTeam2Messages((prev) => [...prev, msg]);
      }
    }

    if (m.type === "guess_chat" || m.type === "guess_result") {
      const pid = m.pid || m.by;
      const p = players.find((pl) => pl.pid === pid);
      const team = p?.team || m.team;
      const name = p?.name || "Player";
      const text = m.text || "";
      if (!text) return;

      if (team === "A") setTeam1Messages((prev) => [...prev, { text, isOwn: pid === myPid, name }]);
      else if (team === "B") setTeam2Messages((prev) => [...prev, { text, isOwn: pid === myPid, name }]);
    }

    if (m.type === "op_broadcast" && m.op) {
      const sig = opSignature(m.op);
      if (m.by && m.by === myPid) {
        const idx = pendingOpsRef.current.indexOf(sig);
        if (idx !== -1) {
          pendingOpsRef.current.splice(idx, 1);
          return;
        }
      }
      applyOpToCanvas(m.op, m.canvas);
    }

    // ✅ room_snapshot is authoritative
    if (m.type === "room_snapshot") {
      if (m.game) setGameState(m.game);
      if (m.game?.budget) setBudget(m.game.budget);
      if (m.game?.phase) setPhase(m.game.phase);
      if (Array.isArray(m.ops)) loadOpsFromSnapshot(m.ops);
    }
  }, [ws.lastMsg, players, myPid, ws]);

  useEffect(() => {
    if (Array.isArray(snapshot.ops)) loadOpsFromSnapshot(snapshot.ops);
  }, [snapshot.ops]);

  // Initialize canvases
  useEffect(() => {
    const resizeCanvas = (teamId) => {
      const canvas = teamId === 1 ? canvas1Ref.current : canvas2Ref.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const imageData = canvas.width && canvas.height ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;

      canvas.width = rect.width;
      canvas.height = rect.height;

      if (imageData) ctx.putImageData(imageData, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      renderStrokes(teamId);
    };

    const handleResize = () => {
      resizeCanvas(1);
      resizeCanvas(2);
    };

    if (canvas1Ref.current) {
      ctx1Ref.current = canvas1Ref.current.getContext('2d', { willReadFrequently: true });
      resizeCanvas(1);
    }
    if (canvas2Ref.current) {
      ctx2Ref.current = canvas2Ref.current.getContext('2d', { willReadFrequently: true });
      resizeCanvas(2);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCanvasCoordinates = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Drawing functions for Team 1
  const startDrawing1 = useCallback((e) => {
    e.preventDefault();
    if (!canDrawA) return;
    if (remainingA <= 0 && team1Mode === 'draw') return;

    setIsDrawing1(true);
    const { x, y } = getCanvasCoordinates(e, canvas1Ref.current);

    const ctx = ctx1Ref.current;
    ctx.beginPath();
    ctx.lineWidth = team1Size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (team1Mode === 'erase') ctx.globalCompositeOperation = 'destination-out';
    else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = team1Color;
    }

    if (team1Mode === 'erase') {
      currentStroke1Ref.current = { type: 'erase', color: team1Color, size: team1Size * 1.5, points: [{ x, y }] };
    } else if (team1Brush === 'line' || team1Brush === 'circle') {
      currentStroke1Ref.current = { type: team1Brush, color: team1Color, size: team1Size, start: { x, y }, end: { x, y }, center: { x, y }, radius: 0 };
    } else {
      ctx.moveTo(x, y);
      currentStroke1Ref.current = { type: 'free', color: team1Color, size: team1Size, points: [{ x, y }] };
    }
  }, [canDrawA, remainingA, team1Mode, team1Size, team1Color, team1Brush]);

  const draw1 = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing1) return;

    const { x, y } = getCanvasCoordinates(e, canvas1Ref.current);
    const ctx = ctx1Ref.current;

    const stroke = currentStroke1Ref.current;
    if (!stroke) return;

    if (stroke.type === 'erase' || stroke.type === 'free') {
      stroke.points.push({ x, y });
      renderStrokes(1);
      drawStroke(ctx, stroke);
      return;
    }

    stroke.end = { x, y };
    if (stroke.type === 'circle') {
      const dx = x - stroke.start.x;
      const dy = y - stroke.start.y;
      stroke.center = { x: stroke.start.x, y: stroke.start.y };
      stroke.radius = Math.sqrt(dx * dx + dy * dy);
    }
    renderStrokes(1);
    drawStroke(ctx, stroke);
  }, [isDrawing1]);

  const stopDrawing1 = useCallback(() => {
    if (!isDrawing1) return;
    setIsDrawing1(false);

    const stroke = currentStroke1Ref.current;
    currentStroke1Ref.current = null;

    if (!stroke) return;
    const op = buildOpFromStroke(stroke);
    if (!op || !canDrawA) {
      renderStrokes(1);
      return;
    }

    const sabotageOpOk = op.t === "line" || op.t === "circle";
    const sabotageAllowedNow =
      canDrawA &&
      remainingA > 0 &&
      !team1SabotageUsed &&
      !sabotageDisabledLast30 &&
      team1Mode === "draw" &&
      sabotageOpOk;

    if (sabotageArmed && sabotageAllowedNow) {
      renderStrokes(1);
      const target = "B";
      applyOpToCanvas(op, target);
      ws.send({ type: "sabotage", target, op });
      setSabotageArmed(false);
      return;
    }

    strokes1Ref.current.push(stroke);
    renderStrokes(1);
    const sig = opSignature(op);
    pendingOpsRef.current.push(sig);
    if (sabotageArmed) setSabotageArmed(false);
    ws.send({ type: "draw_op", canvas: "A", op });
  }, [isDrawing1, canDrawA, ws, sabotageArmed, remainingA, team1SabotageUsed, sabotageDisabledLast30, team1Mode]);

  // Drawing functions for Team 2
  const startDrawing2 = useCallback((e) => {
    e.preventDefault();
    if (!canDrawB) return;
    if (remainingB <= 0 && team2Mode === 'draw') return;

    setIsDrawing2(true);
    const { x, y } = getCanvasCoordinates(e, canvas2Ref.current);

    const ctx = ctx2Ref.current;
    ctx.beginPath();
    ctx.lineWidth = team2Size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (team2Mode === 'erase') ctx.globalCompositeOperation = 'destination-out';
    else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = team2Color;
    }

    if (team2Mode === 'erase') {
      currentStroke2Ref.current = { type: 'erase', color: team2Color, size: team2Size * 1.5, points: [{ x, y }] };
    } else if (team2Brush === 'line' || team2Brush === 'circle') {
      currentStroke2Ref.current = { type: team2Brush, color: team2Color, size: team2Size, start: { x, y }, end: { x, y }, center: { x, y }, radius: 0 };
    } else {
      ctx.moveTo(x, y);
      currentStroke2Ref.current = { type: 'free', color: team2Color, size: team2Size, points: [{ x, y }] };
    }
  }, [canDrawB, remainingB, team2Mode, team2Size, team2Color, team2Brush]);

  const draw2 = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing2) return;

    const { x, y } = getCanvasCoordinates(e, canvas2Ref.current);
    const ctx = ctx2Ref.current;

    const stroke = currentStroke2Ref.current;
    if (!stroke) return;

    if (stroke.type === 'erase' || stroke.type === 'free') {
      stroke.points.push({ x, y });
      renderStrokes(2);
      drawStroke(ctx, stroke);
      return;
    }

    stroke.end = { x, y };
    if (stroke.type === 'circle') {
      const dx = x - stroke.start.x;
      const dy = y - stroke.start.y;
      stroke.center = { x: stroke.start.x, y: stroke.start.y };
      stroke.radius = Math.sqrt(dx * dx + dy * dy);
    }
    renderStrokes(2);
    drawStroke(ctx, stroke);
  }, [isDrawing2]);

  const stopDrawing2 = useCallback(() => {
    if (!isDrawing2) return;
    setIsDrawing2(false);

    const stroke = currentStroke2Ref.current;
    currentStroke2Ref.current = null;

    if (!stroke) return;
    const op = buildOpFromStroke(stroke);
    if (!op || !canDrawB) {
      renderStrokes(2);
      return;
    }

    const sabotageOpOk = op.t === "line" || op.t === "circle";
    const sabotageAllowedNow =
      canDrawB &&
      remainingB > 0 &&
      !team2SabotageUsed &&
      !sabotageDisabledLast30 &&
      team2Mode === "draw" &&
      sabotageOpOk;

    if (sabotageArmed && sabotageAllowedNow) {
      renderStrokes(2);
      const target = "A";
      applyOpToCanvas(op, target);
      ws.send({ type: "sabotage", target, op });
      setSabotageArmed(false);
      return;
    }

    strokes2Ref.current.push(stroke);
    renderStrokes(2);
    const sig = opSignature(op);
    pendingOpsRef.current.push(sig);
    if (sabotageArmed) setSabotageArmed(false);
    ws.send({ type: "draw_op", canvas: "B", op });
  }, [isDrawing2, canDrawB, ws, sabotageArmed, remainingB, team2SabotageUsed, sabotageDisabledLast30, team2Mode]);

  // Event listeners
  useEffect(() => {
    const c1 = canvas1Ref.current;
    if (!c1) return;
    c1.addEventListener('mousedown', startDrawing1);
    c1.addEventListener('mousemove', draw1);
    c1.addEventListener('mouseup', stopDrawing1);
    c1.addEventListener('mouseout', stopDrawing1);
    c1.addEventListener('touchstart', startDrawing1, { passive: false });
    c1.addEventListener('touchmove', draw1, { passive: false });
    c1.addEventListener('touchend', stopDrawing1);
    c1.addEventListener('touchcancel', stopDrawing1);
    return () => {
      c1.removeEventListener('mousedown', startDrawing1);
      c1.removeEventListener('mousemove', draw1);
      c1.removeEventListener('mouseup', stopDrawing1);
      c1.removeEventListener('mouseout', stopDrawing1);
      c1.removeEventListener('touchstart', startDrawing1);
      c1.removeEventListener('touchmove', draw1);
      c1.removeEventListener('touchend', stopDrawing1);
      c1.removeEventListener('touchcancel', stopDrawing1);
    };
  }, [startDrawing1, draw1, stopDrawing1]);

  useEffect(() => {
    const c2 = canvas2Ref.current;
    if (!c2) return;
    c2.addEventListener('mousedown', startDrawing2);
    c2.addEventListener('mousemove', draw2);
    c2.addEventListener('mouseup', stopDrawing2);
    c2.addEventListener('mouseout', stopDrawing2);
    c2.addEventListener('touchstart', startDrawing2, { passive: false });
    c2.addEventListener('touchmove', draw2, { passive: false });
    c2.addEventListener('touchend', stopDrawing2);
    c2.addEventListener('touchcancel', stopDrawing2);
    return () => {
      c2.removeEventListener('mousedown', startDrawing2);
      c2.removeEventListener('mousemove', draw2);
      c2.removeEventListener('mouseup', stopDrawing2);
      c2.removeEventListener('mouseout', stopDrawing2);
      c2.removeEventListener('touchstart', startDrawing2);
      c2.removeEventListener('touchmove', draw2);
      c2.removeEventListener('touchend', stopDrawing2);
      c2.removeEventListener('touchcancel', stopDrawing2);
    };
  }, [startDrawing2, draw2, stopDrawing2]);

  // Tools
  const setTeam1Tool = (type, value) => {
    setTeam1Mode('draw');
    if (type === 'size') setTeam1Size(value);
    else if (type === 'brush') setTeam1Brush(value);
    else if (type === 'color') setTeam1Color(value);
  };

  const setTeam2Tool = (type, value) => {
    setTeam2Mode('draw');
    if (type === 'size') setTeam2Size(value);
    else if (type === 'brush') setTeam2Brush(value);
    else if (type === 'color') setTeam2Color(value);
  };

  const useEraser1 = () => setTeam1Mode('erase');
  const useEraser2 = () => setTeam2Mode('erase');

  const clearCanvas1 = () => {
    if (!canDrawA) return;
    const op = { t: "clear" };
    const sig = opSignature(op);
    pendingOpsRef.current.push(sig);
    ws.send({ type: "draw_op", canvas: "A", op });
    strokes1Ref.current = [];
    renderStrokes(1);
  };

  const clearCanvas2 = () => {
    if (!canDrawB) return;
    const op = { t: "clear" };
    const sig = opSignature(op);
    pendingOpsRef.current.push(sig);
    ws.send({ type: "draw_op", canvas: "B", op });
    strokes2Ref.current = [];
    renderStrokes(2);
  };

  const handleSabotageTeam1 = () => {
    if (!canDrawA) return;
    if (remainingA <= 0) return alert('Not enough strokes for sabotage.');
    if (sabotageDisabledLast30) return alert('Sabotage is disabled in the last 30 seconds.');
    if (team1SabotageUsed) return alert('Sabotage is on cooldown.');
    if (team1Mode !== "draw" || (team1Brush !== "line" && team1Brush !== "circle")) return alert('Sabotage only supports line or circle.');
    setSabotageArmed((v) => !v);
  };

  const handleSabotageTeam2 = () => {
    if (!canDrawB) return;
    if (remainingB <= 0) return alert('Not enough strokes for sabotage.');
    if (sabotageDisabledLast30) return alert('Sabotage is disabled in the last 30 seconds.');
    if (team2SabotageUsed) return alert('Sabotage is on cooldown.');
    if (team2Mode !== "draw" || (team2Brush !== "line" && team2Brush !== "circle")) return alert('Sabotage only supports line or circle.');
    setSabotageArmed((v) => !v);
  };

  // ✅✅ GUESS SENDING FIX (Enter + click)
  const sendGuess = (team) => {
    // clear error so you can see new one
    setLastError(null);

    if (ws.status !== "CONNECTED") return console.warn("guess blocked: ws not connected");
    if (!isGuesser) return console.warn("guess blocked: not a guesser");
    if (room.state !== "IN_GAME") return console.warn("guess blocked: not in round");
    if (phase !== "GUESS") return console.warn("guess blocked: not in GUESS phase");

    if (team === 1) {
      if (myTeam !== "A") return console.warn("guess blocked: not team A");
      const text = team1Input.trim();
      if (!text) return;
      ws.send({ type: "guess", text });
      setTeam1Input('');
      return;
    }

    if (team === 2) {
      if (myTeam !== "B") return console.warn("guess blocked: not team B");
      const text = team2Input.trim();
      if (!text) return;
      ws.send({ type: "guess", text });
      setTeam2Input('');
    }
  };

  const handleGuessKeyDown = (e, team) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    sendGuess(team);
  };

  const openModal = (modalId) => {
    if (modalId === 'exitModal') setExitModalOpen(true);
    if (modalId === 'settingsModal') setSettingsModalOpen(true);
  };

  const exitToMenu = () => navigate('/');
  const resumeGame = () => { setExitModalOpen(false); setSettingsModalOpen(false); };

  return (
    <div className="battle-game-body">
      <div style={{ position: "fixed", top: 8, left: 8, zIndex: 9999, background: "#111827", color: "#e5e7eb", padding: "8px 10px", borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}>
        <div>status: {ws.status}</div>
        <div>state: {room.state || "?"}</div>
        <div>phase: {phase || "?"}</div>
        <div>pid: {myPid || "?"}</div>
        <div>role: {myRole || "?"}</div>
        <div>team: {myTeam || "?"}</div>
        <div>isDrawer: {String(isDrawer)}</div>
        <div>isGuesser: {String(isGuesser)}</div>
        <div>budget A/B: {remainingA} / {remainingB}</div>
        <div>drawEndAt: {drawEndAt || 0}</div>
        <div>guessEndAt: {guessEndAt || 0}</div>
        {lastError && (
          <div style={{ marginTop: 6, color: "#fca5a5" }}>
            lastError: {lastError.code} - {lastError.message}
          </div>
        )}
      </div>

      <div className="top-bar">
        <div style={{ display: 'flex', gap: '10px' }}>
          {isGM && (
            <button className="top-btn" onClick={() => ws.send({ type: "phase_tick" })}>
              Advance Phase
            </button>
          )}
          <button className="top-btn" onClick={() => openModal('settingsModal')}>
            ⚙️ Settings
          </button>
          <button className="top-btn" onClick={() => openModal('exitModal')}>
            ❌ Exit
          </button>
        </div>

        <div className="round-info">ROUND {round}</div>

        <div className="top-right">
          <div className="score-display" style={{ fontFamily: "'Bitcount Single'", fontWeight: 900, fontSize: '1rem' }}>
            SCORE:{' '}
            <span style={{ color: 'var(--c-red)', textShadow: '0 0 10px var(--c-red-glow)' }}>{redScore}</span>
            <span style={{ color: 'var(--text-muted)' }}> - </span>
            <span style={{ color: 'var(--c-blue)', textShadow: '0 0 10px var(--c-blue-glow)' }}>{blueScore}</span>
          </div>
          <div className="you-info">
            <div className="you-name">You: {myName}</div>
            <div className="you-role">
              {roleLabel}
              {!isGM && myTeam ? ` · ${teamLabel}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="game-container">
        <div className="team-column" id="col1">
          <div className="team-header header-red">
            <div className="team-title-row">
              <span className="team-name" style={{ textShadow: '0 0 15px var(--c-red-glow)' }}>{redTeam.name}</span>
            </div>
            <div className="player-names">{redTeam.players.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                {phaseTimeLabel}{' '}
                <span className="stat-val">{phaseRemaining}</span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span className="stat-val" style={{ color: remainingA <= 0 ? '#ff4757' : '#fff' }}>
                  {remainingA}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          <div className={`canvas-wrapper ${canDrawA ? "can-draw" : ""}`}>
            <canvas ref={canvas1Ref} id="c1"></canvas>
          </div>

          <div className="bottom-split">
            {isDrawerA && (
            <div className="tools-sidebar">
              <div id="sab1" className={`sabotage-btn ${team1SabotageUsed ? 'used' : ''}`} onClick={handleSabotageTeam1}>
                🔥
              </div>

              <div>
                <div className="tool-group-label">Size</div>
                <div className="brush-stack">
                  <div className={`brush-btn ${team1Size === 2 ? 'active' : ''}`} onClick={() => setTeam1Tool('size', 2)}>
                    <div className="dot" style={{ width: '3px', height: '3px', opacity: 0.7 }}></div>
                  </div>
                  <div className={`brush-btn ${team1Size === 6 ? 'active' : ''}`} onClick={() => setTeam1Tool('size', 6)}>
                    <div className="dot" style={{ width: '6px', height: '6px' }}></div>
                  </div>
                  <div className={`brush-btn ${team1Size === 12 ? 'active' : ''}`} onClick={() => setTeam1Tool('size', 12)}>
                    <div className="dot" style={{ width: '12px', height: '12px' }}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Brush</div>
                <div className="brush-type-group">
                  <button className={`brush-type-btn ${team1Brush === 'line' ? 'active' : ''}`} onClick={() => setTeam1Tool('brush', 'line')}>Line</button>
                  <button className={`brush-type-btn ${team1Brush === 'circle' ? 'active' : ''}`} onClick={() => setTeam1Tool('brush', 'circle')}>Circle</button>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Color</div>
                <div className="color-grid">
                  {['#000000', '#ff4757', '#2e86de', '#2ed573', '#ffa502', '#ff98cd'].map((c) => (
                    <div
                      key={c}
                      className={`color-btn ${team1Color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setTeam1Tool('color', c)}
                    />
                  ))}
                </div>
              </div>

              <div className="action-stack">
                <button className={`action-btn ${team1Mode === 'erase' ? 'active-eraser' : ''}`} onClick={useEraser1} title="Eraser">🧽</button>
                <button className="action-btn" onClick={clearCanvas1} title="Clear">🗑️</button>
              </div>
            </div>
            )}

            <div className="chat-main">
              <div className="chat-log-container" id="log1">
                {team1Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>{msg.text}</div>
                ))}
              </div>
              {isGuesserA && (
                <div className="input-area">
                  <input
                    type="text"
                    className="guess-box"
                    placeholder="Guess..."
                    id="inp1"
                    value={team1Input}
                    onChange={(e) => setTeam1Input(e.target.value)}
                    onKeyDown={(e) => handleGuessKeyDown(e, 1)}
                    disabled={ws.status !== "CONNECTED" || myTeam !== "A" || !isGuesser || room.state !== "IN_GAME" || phase !== "GUESS" || teamAlreadyGuessed}
                  />
                  <button
                    className="send-btn send-red"
                    onClick={() => sendGuess(1)}
                    disabled={ws.status !== "CONNECTED" || myTeam !== "A" || !isGuesser || room.state !== "IN_GAME" || phase !== "GUESS" || teamAlreadyGuessed}
                  >
                    SEND
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="team-column" id="col2">
          <div className="team-header header-blue">
            <div className="team-title-row">
              <span className="team-name" style={{ textShadow: '0 0 15px var(--c-blue-glow)' }}>{blueTeam.name}</span>
            </div>
            <div className="player-names">{blueTeam.players.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                {phaseTimeLabel}{' '}
                <span className="stat-val">{phaseRemaining}</span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span className="stat-val" style={{ color: remainingB <= 0 ? '#ff4757' : '#fff' }}>
                  {remainingB}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          <div className={`canvas-wrapper ${canDrawB ? "can-draw" : ""}`}>
            <canvas ref={canvas2Ref} id="c2"></canvas>
          </div>

          <div className="bottom-split">
            {isDrawerB && (
            <div className="tools-sidebar">
              <div id="sab2" className={`sabotage-btn ${team2SabotageUsed ? 'used' : ''}`} onClick={handleSabotageTeam2}>
                🔥
              </div>

              <div>
                <div className="tool-group-label">Size</div>
                <div className="brush-stack">
                  <div className={`brush-btn ${team2Size === 2 ? 'active' : ''}`} onClick={() => setTeam2Tool('size', 2)}>
                    <div className="dot" style={{ width: '3px', height: '3px', opacity: 0.7 }}></div>
                  </div>
                  <div className={`brush-btn ${team2Size === 6 ? 'active' : ''}`} onClick={() => setTeam2Tool('size', 6)}>
                    <div className="dot" style={{ width: '6px', height: '6px' }}></div>
                  </div>
                  <div className={`brush-btn ${team2Size === 12 ? 'active' : ''}`} onClick={() => setTeam2Tool('size', 12)}>
                    <div className="dot" style={{ width: '12px', height: '12px' }}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Brush</div>
                <div className="brush-type-group">
                  <button className={`brush-type-btn ${team2Brush === 'line' ? 'active' : ''}`} onClick={() => setTeam2Tool('brush', 'line')}>Line</button>
                  <button className={`brush-type-btn ${team2Brush === 'circle' ? 'active' : ''}`} onClick={() => setTeam2Tool('brush', 'circle')}>Circle</button>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Color</div>
                <div className="color-grid">
                  {['#000000', '#2e86de', '#ff4757', '#2ed573', '#ffa502', '#ff98cd'].map((c) => (
                    <div
                      key={c}
                      className={`color-btn ${team2Color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setTeam2Tool('color', c)}
                    />
                  ))}
                </div>
              </div>

              <div className="action-stack">
                <button className={`action-btn ${team2Mode === 'erase' ? 'active-eraser' : ''}`} onClick={useEraser2} title="Eraser">🧽</button>
                <button className="action-btn" onClick={clearCanvas2} title="Clear">🗑️</button>
              </div>
            </div>
            )}

            <div className="chat-main">
              <div className="chat-log-container" id="log2">
                {team2Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>{msg.text}</div>
                ))}
              </div>
              {isGuesserB && (
                <div className="input-area">
                  <input
                    type="text"
                    className="guess-box"
                    placeholder="Guess..."
                    id="inp2"
                    value={team2Input}
                    onChange={(e) => setTeam2Input(e.target.value)}
                    onKeyDown={(e) => handleGuessKeyDown(e, 2)}
                    disabled={ws.status !== "CONNECTED" || myTeam !== "B" || !isGuesser || room.state !== "IN_GAME" || phase !== "GUESS" || teamAlreadyGuessed}
                  />
                  <button
                    className="send-btn send-blue"
                    onClick={() => sendGuess(2)}
                    disabled={ws.status !== "CONNECTED" || myTeam !== "B" || !isGuesser || room.state !== "IN_GAME" || phase !== "GUESS" || teamAlreadyGuessed}
                  >
                    SEND
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${exitModalOpen ? 'active' : ''}`} id="exitModal">
        <div className="modal-card">
          <div className="modal-header">
            <h2 className="modal-title">GAME PAUSED</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Current Round Summary</p>
          </div>
          <div className="player-list-exit">
            <div className="player-row">
              <div className="p-avatar" style={{ background: 'var(--c-red)' }}>{currentPlayer.charAt(0)}</div>
              <div className="p-info">
                <div className="p-name">{currentPlayer} (You)</div>
                <div className="p-score">Score: {redScore}</div>
              </div>
            </div>
            <div className="player-row">
              <div className="p-avatar" style={{ background: 'var(--c-blue)' }}>{blueTeam.players[0]?.charAt(0) || '2'}</div>
              <div className="p-info">
                <div className="p-name">{blueTeam.players[0] || 'Player 2'}</div>
                <div className="p-score">Score: {blueScore}</div>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-modal btn-resume" onClick={resumeGame}>RESUME GAME</button>
            <button className="btn-modal btn-exit" onClick={exitToMenu}>EXIT TO MENU</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${settingsModalOpen ? 'active' : ''}`} id="settingsModal">
        <div className="modal-card">
          <div className="modal-header">
            <h2 className="modal-title">SETTINGS</h2>
          </div>
          <div className="setting-row">
            <span>Sound Effects</span>
            <label className="switch">
              <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-row">
            <span>Music</span>
            <label className="switch">
              <input type="checkbox" checked={musicEnabled} onChange={(e) => setMusicEnabled(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-row">
            <span>Show Hints</span>
            <label className="switch">
              <input type="checkbox" checked={hintsEnabled} onChange={(e) => setHintsEnabled(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button className="btn-modal btn-resume" onClick={resumeGame}>DONE</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleGame;
