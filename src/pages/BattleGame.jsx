import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomWSContext } from "../ws/RoomWSContext";
import '../styles/BattleGame.css';

const BattleGame = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();
  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = snapshot.players || [];
  const myPid = ws.pid || localStorage.getItem("dg_pid");
  const me = players.find((p) => p.pid === myPid) || {};
  const myName = me.name || "Player";
  const myTeam = me.team || null;
  const myRole = me.role || "";
  const isGM = myRole === "gm" || (room.gm_pid && myPid && room.gm_pid === myPid);
  const isDrawerA = myRole.includes("drawer") && myTeam === "A";
  const isDrawerB = myRole.includes("drawer") && myTeam === "B";
  const isGuesserA = myRole.includes("guesser") && myTeam === "A";
  const isGuesserB = myRole.includes("guesser") && myTeam === "B";
  const roleLabel = isGM
    ? "GM"
    : myRole.includes("drawer")
    ? "Drawer"
    : myRole.includes("guesser")
    ? "Guesser"
    : "Player";
  const teamLabel = myTeam === "A" ? "Red Team" : myTeam === "B" ? "Blue Team" : "No Team";
  const teamAPlayers = players.filter((p) => p.team === "A").map((p) => p.name || "Player");
  const teamBPlayers = players.filter((p) => p.team === "B").map((p) => p.name || "Player");

  const round = Number(room?.round_no || 1);
  const redTeam = { name: 'Red Team', players: teamAPlayers };
  const blueTeam = { name: 'Blue Team', players: teamBPlayers };
  const currentPlayer = myName;

  // Team states
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [roundEndAt, setRoundEndAt] = useState(Number(snapshot.game?.draw_end_at || 0));
  const [guessEndAt, setGuessEndAt] = useState(Number(snapshot.game?.guess_end_at || 0));
  const [maxStrokes, setMaxStrokes] = useState(
    typeof snapshot.round_config?.strokes_per_phase === "number"
      ? snapshot.round_config.strokes_per_phase
      : 15
  );
  const [phase, setPhase] = useState(snapshot.game?.phase || "");
  const [budget, setBudget] = useState({ A: 0, B: 0 });
  const [sabotageCooldown, setSabotageCooldown] = useState({ A: 0, B: 0 });
  const remainingA = Number(budget?.A ?? maxStrokes);
  const remainingB = Number(budget?.B ?? maxStrokes);
  const team1Strokes = Math.max(0, maxStrokes - remainingA);
  const team2Strokes = Math.max(0, maxStrokes - remainingB);
  const team1CooldownLeft = Math.max(0, Number(sabotageCooldown.A || 0) - nowSec);
  const team2CooldownLeft = Math.max(0, Number(sabotageCooldown.B || 0) - nowSec);
  const team1SabotageOnCooldown = team1CooldownLeft > 0;
  const team2SabotageOnCooldown = team2CooldownLeft > 0;
  const drawTimeLeft = roundEndAt > 0 ? Math.max(0, roundEndAt - nowSec) : 0;
  const guessTimeLeft = guessEndAt > 0 ? Math.max(0, guessEndAt - nowSec) : 0;
  const phaseTimeLeft = phase === "GUESS" ? guessTimeLeft : phase === "DRAW" ? drawTimeLeft : 0;
  const phaseTimeLabel = phase === "GUESS" ? "GUESS TIME" : phase === "DRAW" ? "DRAW TIME" : "TIME";
  const canGuessA = ws.status === "CONNECTED" && phase === "GUESS" && isGuesserA;
  const canGuessB = ws.status === "CONNECTED" && phase === "GUESS" && isGuesserB;
  const canDrawA = phase === "DRAW" && isDrawerA;
  const canDrawB = phase === "DRAW" && isDrawerB;
  const teamGuessed = snapshot.game?.team_guessed || {};
  const teamAlreadyGuessed = myTeam ? !!teamGuessed[myTeam] : false;

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

  // Canvas refs
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const ctx1Ref = useRef(null);
  const ctx2Ref = useRef(null);
  const shapeStart1Ref = useRef(null);
  const shapeStart2Ref = useRef(null);
  const shapeBase1Ref = useRef(null);
  const shapeBase2Ref = useRef(null);
  const strokes1Ref = useRef([]);
  const strokes2Ref = useRef([]);
  const currentStroke1Ref = useRef(null);
  const currentStroke2Ref = useRef(null);
  const eraserPath1Ref = useRef([]);
  const eraserPath2Ref = useRef([]);
  const phaseZeroSnapshotRef = useRef(false);

  // ✅ FIXED: Drawing states - missing = operator
  const [isDrawing1, setIsDrawing1] = useState(false);
  const [isDrawing2, setIsDrawing2] = useState(false);

  // Chat states
  const [team1Messages, setTeam1Messages] = useState([]);
  const [team2Messages, setTeam2Messages] = useState([]);
  const [team1Input, setTeam1Input] = useState('');
  const [team2Input, setTeam2Input] = useState('');
  const [hasGuessedThisPhase, setHasGuessedThisPhase] = useState(false);

  // Modal states
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Settings states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  // Score state
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const sabotageArmed1Ref = useRef(false);
  const sabotageArmed2Ref = useRef(false);
  const [lastError, setLastError] = useState(null);

  // Initialize canvases
  useEffect(() => {
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

  useEffect(() => {
    if (ws.status === "CONNECTED") {
      ws.send({ type: "snapshot" });
    }
  }, [ws.status, ws.send]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setRoundEndAt(Number(snapshot.game?.draw_end_at || 0));
    setGuessEndAt(Number(snapshot.game?.guess_end_at || 0));
  }, [snapshot.game?.draw_end_at, snapshot.game?.guess_end_at]);

  useEffect(() => {
    if (teamAlreadyGuessed) setHasGuessedThisPhase(true);
  }, [teamAlreadyGuessed]);

  useEffect(() => {
    if (phaseTimeLeft > 0) {
      phaseZeroSnapshotRef.current = false;
      return;
    }
    if (!phase || phase === "VOTING") return;
    if (ws.status !== "CONNECTED") return;
    if (phaseZeroSnapshotRef.current) return;
    phaseZeroSnapshotRef.current = true;
    ws.send({ type: "snapshot" });
  }, [phaseTimeLeft, phase, ws.status, ws.send]);

  const handleResize = () => {
    resizeCanvas(1);
    resizeCanvas(2);
  };

  const drawStroke = (ctx, stroke) => {
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
  };

  const convertOpToStroke = (op) => {
    const t = op?.t || op?.type || "line";
    let p = op?.p || op || {};
    if (p && typeof p === "object" && p.p && typeof p.p === "object") {
      p = { ...p.p, ...p };
    }
    const color = p.c || "#000000";
    const size = Math.max(1, Number(p.w || 3));
    if (p.clear) {
      return { type: "clear" };
    }
    if (p.erase) {
      const pts = p.pts || [];
      return {
        type: "erase",
        size,
        points: pts.map(([x, y]) => ({ x, y })),
      };
    }
    if (t === "circle") {
      return {
        type: "circle",
        color,
        size,
        center: { x: Number(p.cx || 0), y: Number(p.cy || 0) },
        radius: Number(p.r || 0),
      };
    }
    const pts = p.pts || [];
    if (pts.length >= 2) {
      return {
        type: "free",
        color,
        size,
        points: pts.map(([x, y]) => ({ x, y })),
      };
    }
    return null;
  };

  const strokeToOp = (stroke) => {
    if (!stroke) return null;
    if (stroke.type === "circle") {
      return {
        t: "circle",
        p: { cx: stroke.center.x, cy: stroke.center.y, r: stroke.radius, c: stroke.color, w: stroke.size },
      };
    }
    if (stroke.type === "line") {
      return {
        t: "line",
        p: { pts: [[stroke.start.x, stroke.start.y], [stroke.end.x, stroke.end.y]], c: stroke.color, w: stroke.size },
      };
    }
    if (stroke.type === "free") {
      return {
        t: "line",
        p: { pts: stroke.points.map((pt) => [pt.x, pt.y]), c: stroke.color, w: stroke.size },
      };
    }
    return null;
  };

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === "room_snapshot") {
      setPhase(m.game?.phase || "");
      setRoundEndAt(Number(m.game?.draw_end_at || 0));
      setGuessEndAt(Number(m.game?.guess_end_at || 0));
      const snapBudget = m.game?.budget;
      if (snapBudget && (typeof snapBudget.A === "number" || typeof snapBudget.B === "number")) {
        setBudget({
          A: Number(snapBudget.A ?? 0),
          B: Number(snapBudget.B ?? 0),
        });
      }
      const snapCooldown = m.game?.cooldown || {};
      setSabotageCooldown({
        A: Number(snapCooldown.sabotage_next_ts_A || 0),
        B: Number(snapCooldown.sabotage_next_ts_B || 0),
      });
      const sp = m.round_config?.strokes_per_phase;
      if (typeof sp === "number" && sp > 0) setMaxStrokes(sp);
      const score = m.game?.score || {};
      if (typeof score.A === "number") setRedScore(score.A);
      if (typeof score.B === "number") setBlueScore(score.B);
      const snapTeamGuessed = m.game?.team_guessed || {};
      if (myTeam && snapTeamGuessed[myTeam]) {
        setHasGuessedThisPhase(true);
      }
      const ops = Array.isArray(m.ops) ? m.ops : [];
      if (ops.length > 0) {
        strokes1Ref.current = [];
        strokes2Ref.current = [];
        ops.forEach((o) => {
          const canvas = o.canvas || null;
          const st = convertOpToStroke(o.op || o);
          if (!st) return;
          if (st.type === "clear") {
            if (canvas === "A") strokes1Ref.current = [];
            else if (canvas === "B") strokes2Ref.current = [];
            return;
          }
          if (st.type === "erase") {
            const radius = Math.max(6, (st.size || 6) * 1.5);
            st.points.forEach((pt) => {
              if (canvas === "A") eraseAt(1, pt, radius);
              else if (canvas === "B") eraseAt(2, pt, radius);
            });
            return;
          }
          if (canvas === "A") strokes1Ref.current.push(st);
          else if (canvas === "B") strokes2Ref.current.push(st);
        });
        renderStrokes(1);
        renderStrokes(2);
      }
    }

    if (m.type === "op_broadcast") {
      const canvas = m.canvas || null;
      const st = convertOpToStroke(m.op);
      if (!st) return;
      // Avoid double-applying our own ops on our own canvas (we already rendered locally)
      const myPidNow = ws.pid || localStorage.getItem("dg_pid");
      const myTeamNow = myTeam;
      if (m.by === myPidNow && canvas && canvas === myTeamNow) {
        return;
      }
      if (st.type === "clear") {
        if (canvas === "A") {
          strokes1Ref.current = [];
          renderStrokes(1);
        } else if (canvas === "B") {
          strokes2Ref.current = [];
          renderStrokes(2);
        }
        return;
      }
      if (st.type === "erase") {
        const radius = Math.max(6, (st.size || 6) * 1.5);
        if (canvas === "A") {
          st.points.forEach((pt) => eraseAt(1, pt, radius));
          renderStrokes(1);
        } else if (canvas === "B") {
          st.points.forEach((pt) => eraseAt(2, pt, radius));
          renderStrokes(2);
        }
        return;
      }
      if (canvas === "A") {
        strokes1Ref.current.push(st);
        renderStrokes(1);
      } else if (canvas === "B") {
        strokes2Ref.current.push(st);
        renderStrokes(2);
      }
    }

    if (m.type === "guess_chat") {
      const pid = m.pid;
      const isTeamA = players.find((x) => x.pid === pid)?.team === "A";
      const line = { text: m.text || "", isOwn: pid === (ws.pid || localStorage.getItem("dg_pid")) };
      if (isTeamA) {
        setTeam1Messages((prev) => [...prev, line]);
      } else {
        setTeam2Messages((prev) => [...prev, line]);
      }
    }

    if (m.type === "guess_result") {
      const pid = m.by;
      const team = m.team || players.find((x) => x.pid === pid)?.team;
      const result = m.result || (m.correct ? "CORRECT" : "WRONG");
      const prefix = result === "CORRECT" ? "? Correct:" : result === "NO_GUESS" ? "? No guess:" : "? Wrong:";
      const text = m.text || (result === "NO_GUESS" ? "No guess submitted" : "");
      const lineText = text ? `${prefix} ${text}` : prefix;
      const line = { text: lineText, isOwn: pid === (ws.pid || localStorage.getItem("dg_pid")) };
      if (team && team === myTeam) {
        setHasGuessedThisPhase(true);
      }
      if (team === "A") {
        setTeam1Messages((prev) => [...prev, line]);
      } else if (team === "B") {
        setTeam2Messages((prev) => [...prev, line]);
      }
    }

    if (m.type === "budget_update") {
      const b = m.budget || {};
      setBudget({
        A: Number(b.A ?? 0),
        B: Number(b.B ?? 0),
      });
    }

    if (m.type === "phase_changed") {
      setPhase(m.phase || "");
      setHasGuessedThisPhase(false);
      ws.send({ type: "snapshot" });
    }

    if (m.type === "sabotage_used") {
      const byPid = m.by;
      const p = players.find((x) => x.pid === byPid);
      const team = p?.team;
      if (team === "A" || team === "B") {
        setSabotageCooldown((prev) => ({ ...prev, [team]: Number(m.cooldown_until || 0) }));
      }
      sabotageArmed1Ref.current = false;
      sabotageArmed2Ref.current = false;
    }

    if (m.type === "game_end") {
      const winnerTeam = m.winner || "";
      const winnerName =
        winnerTeam === "A" ? "Red Team" : winnerTeam === "B" ? "Blue Team" : "";
      const totalRounds = Number(snapshot.round_config?.max_rounds || 5);
      navigate("/battle-round-win", {
        state: {
          round: m.round_no || room.round_no || 1,
          totalRounds,
          isWin: Boolean(winnerTeam),
          word: m.word || snapshot.round_config?.secret_word || "",
          reason: m.reason || "",
          winner: {
            name: winnerName || winnerTeam || "",
            avatar: winnerTeam,
            points: 0,
          },
          nextRoundDelay: 5,
        },
      });
    }

    if (m.type === "room_state_changed") {
      if (m.state === "GAME_END") navigate("/battle-round-win");
      if (m.state === "ROLE_PICK") navigate("/role-pick");
      if (m.state === "CONFIG") navigate("/waiting-room");
    }

    if (m.type === "error") {
      setLastError(m);
      const code = m.code || "";
      if (code.includes("SABOTAGE") || code === "INSUFFICIENT_BUDGET" || code === "NO_BUDGET") {
        sabotageArmed1Ref.current = false;
        sabotageArmed2Ref.current = false;
        ws.send({ type: "snapshot" });
      }
    }
  }, [ws.lastMsg, players, ws.pid, ws.send, navigate, snapshot.round_config, maxStrokes]);
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

  const eraseAt = (teamId, point, radius) => {
    if (teamId === 1) {
      strokes1Ref.current = strokes1Ref.current.filter((s) => !hitStroke(s, point, radius));
    } else {
      strokes2Ref.current = strokes2Ref.current.filter((s) => !hitStroke(s, point, radius));
    }
    renderStrokes(teamId);
  };

  const resizeCanvas = (teamId) => {
    const canvas = teamId === 1 ? canvas1Ref.current : canvas2Ref.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // Save current canvas state
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Restore canvas state
    ctx.putImageData(imageData, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderStrokes(teamId);
  };

  // Drawing functions for Team 1
  const startDrawing1 = useCallback(
    (e) => {
      e.preventDefault();
      if (!canDrawA) return;
      if (team1Mode === 'draw' && remainingA <= 0) return;

      setIsDrawing1(true);
      const { x, y } = getCanvasCoordinates(e, canvas1Ref.current);

      const ctx = ctx1Ref.current;
      ctx.beginPath();
      ctx.lineWidth = team1Size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (team1Mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = team1Color;
      }

      if (team1Mode !== 'erase') {
        ctx.fillStyle = team1Color;
      }

      if (team1Mode === 'erase') {
        currentStroke1Ref.current = null;
        eraserPath1Ref.current = [{ x, y }];
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (team1Mode === 'draw' && (team1Brush === 'line' || team1Brush === 'circle')) {
        currentStroke1Ref.current = {
          type: team1Brush,
          color: team1Color,
          size: team1Size,
          start: { x, y },
          end: { x, y },
          center: { x, y },
          radius: 0
        };
      } else if (team1Brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, team1Size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y);
        currentStroke1Ref.current = {
          type: 'free',
          color: team1Color,
          size: team1Size,
          points: [{ x, y }]
        };
      }
    },
    [canDrawA, remainingA, team1Mode, team1Size, team1Color, team1Brush]
  );

  const draw1 = useCallback(
    (e) => {
      e.preventDefault();
      if (!isDrawing1) return;

      const { x, y } = getCanvasCoordinates(e, canvas1Ref.current);
      const ctx = ctx1Ref.current;
      if (team1Mode === 'erase') {
        const eraserRadius = Math.max(6, team1Size * 1.5);
        eraserPath1Ref.current.push({ x, y });
        eraseAt(1, { x, y }, eraserRadius);
      } else if (team1Mode === 'draw' && (team1Brush === 'line' || team1Brush === 'circle')) {
        const stroke = currentStroke1Ref.current;
        if (stroke) {
          stroke.end = { x, y };
          if (stroke.type === 'circle') {
            const dx = x - stroke.start.x;
            const dy = y - stroke.start.y;
            stroke.center = { x: stroke.start.x, y: stroke.start.y };
            stroke.radius = Math.sqrt(dx * dx + dy * dy);
          }
          renderStrokes(1);
          drawStroke(ctx, stroke);
        }
      } else if (team1Brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, team1Size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const stroke = currentStroke1Ref.current;
        if (stroke && stroke.type === 'free') {
          stroke.points.push({ x, y });
          renderStrokes(1);
          drawStroke(ctx, stroke);
        }
      }
    },
    [isDrawing1, team1Brush, team1Size, team1Mode]
  );

  const stopDrawing1 = useCallback(() => {
    if (isDrawing1) {
      if (team1Mode === 'erase') {
        // send erase op
        const path = eraserPath1Ref.current || [];
        eraserPath1Ref.current = [];
        if (path.length >= 2) {
          const canSendErase = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "A" && myRole.includes("drawer");
          if (canSendErase) {
            const pts = path.map((pt) => [pt.x, pt.y]);
            const op = { t: "line", p: { pts, w: team1Size, erase: 1 } };
            ws.send({ type: "draw_op", canvas: "A", op });
          }
        }
      }
    }
    setIsDrawing1(false);
    if (ctx1Ref.current) {
      if (team1Mode === 'draw') {
        const stroke = currentStroke1Ref.current;
        if (stroke) {
          const canSend = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "A" && myRole.includes("drawer");
          const op = strokeToOp(stroke);
          const sabotageArmed = sabotageArmed1Ref.current;
          currentStroke1Ref.current = null;
          if (canSend && op) {
            if (sabotageArmed) {
              ws.send({ type: "sabotage", target: "B", op });
              sabotageArmed1Ref.current = false;
              renderStrokes(1);
            } else {
              strokes1Ref.current.push(stroke);
              renderStrokes(1);
              ws.send({ type: "draw_op", canvas: "A", op });
            }
          } else {
            // Keep local-only preview if send is not possible.
            strokes1Ref.current.push(stroke);
            renderStrokes(1);
          }
        }
      }
      ctx1Ref.current.closePath();
    }
  }, [isDrawing1, team1Mode, ws.status, phase, myTeam, myRole]);

  // Drawing functions for Team 2
  const startDrawing2 = useCallback(
    (e) => {
      e.preventDefault();
      if (!canDrawB) return;
      if (team2Mode === 'draw' && remainingB <= 0) return;

      setIsDrawing2(true);
      const { x, y } = getCanvasCoordinates(e, canvas2Ref.current);

      const ctx = ctx2Ref.current;
      ctx.beginPath();
      ctx.lineWidth = team2Size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (team2Mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = team2Color;
      }

      if (team2Mode !== 'erase') {
        ctx.fillStyle = team2Color;
      }

      if (team2Mode === 'erase') {
        currentStroke2Ref.current = null;
        eraserPath2Ref.current = [{ x, y }];
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (team2Mode === 'draw' && (team2Brush === 'line' || team2Brush === 'circle')) {
        currentStroke2Ref.current = {
          type: team2Brush,
          color: team2Color,
          size: team2Size,
          start: { x, y },
          end: { x, y },
          center: { x, y },
          radius: 0
        };
      } else if (team2Brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, team2Size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y);
        currentStroke2Ref.current = {
          type: 'free',
          color: team2Color,
          size: team2Size,
          points: [{ x, y }]
        };
      }
    },
    [canDrawB, remainingB, team2Mode, team2Size, team2Color, team2Brush]
  );

  const draw2 = useCallback(
    (e) => {
      e.preventDefault();
      if (!isDrawing2) return;

      const { x, y } = getCanvasCoordinates(e, canvas2Ref.current);
      const ctx = ctx2Ref.current;
      if (team2Mode === 'erase') {
        const eraserRadius = Math.max(6, team2Size * 1.5);
        eraserPath2Ref.current.push({ x, y });
        eraseAt(2, { x, y }, eraserRadius);
      } else if (team2Mode === 'draw' && (team2Brush === 'line' || team2Brush === 'circle')) {
        const stroke = currentStroke2Ref.current;
        if (stroke) {
          stroke.end = { x, y };
          if (stroke.type === 'circle') {
            const dx = x - stroke.start.x;
            const dy = y - stroke.start.y;
            stroke.center = { x: stroke.start.x, y: stroke.start.y };
            stroke.radius = Math.sqrt(dx * dx + dy * dy);
          }
          renderStrokes(2);
          drawStroke(ctx, stroke);
        }
      } else if (team2Brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, team2Size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const stroke = currentStroke2Ref.current;
        if (stroke && stroke.type === 'free') {
          stroke.points.push({ x, y });
          renderStrokes(2);
          drawStroke(ctx, stroke);
        }
      }
    },
    [isDrawing2, team2Brush, team2Size, team2Mode]
  );

  const stopDrawing2 = useCallback(() => {
    if (isDrawing2) {
      if (team2Mode === 'erase') {
        // send erase op
        const path = eraserPath2Ref.current || [];
        eraserPath2Ref.current = [];
        if (path.length >= 2) {
          const canSendErase = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "B" && myRole.includes("drawer");
          if (canSendErase) {
            const pts = path.map((pt) => [pt.x, pt.y]);
            const op = { t: "line", p: { pts, w: team2Size, erase: 1 } };
            ws.send({ type: "draw_op", canvas: "B", op });
          }
        }
      }
    }
    setIsDrawing2(false);
    if (ctx2Ref.current) {
      if (team2Mode === 'draw') {
        const stroke = currentStroke2Ref.current;
        if (stroke) {
          const canSend = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "B" && myRole.includes("drawer");
          const op = strokeToOp(stroke);
          const sabotageArmed = sabotageArmed2Ref.current;
          currentStroke2Ref.current = null;
          if (canSend && op) {
            if (sabotageArmed) {
              ws.send({ type: "sabotage", target: "A", op });
              sabotageArmed2Ref.current = false;
              renderStrokes(2);
            } else {
              strokes2Ref.current.push(stroke);
              renderStrokes(2);
              ws.send({ type: "draw_op", canvas: "B", op });
            }
          } else {
            // Keep local-only preview if send is not possible.
            strokes2Ref.current.push(stroke);
            renderStrokes(2);
          }
        }
      }
      ctx2Ref.current.closePath();
    }
  }, [isDrawing2, team2Mode, ws.status, phase, myTeam, myRole]);

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

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Team 1 event listeners
  useEffect(() => {
    const canvas = canvas1Ref.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing1);
    canvas.addEventListener('mousemove', draw1);
    canvas.addEventListener('mouseup', stopDrawing1);
    canvas.addEventListener('mouseout', stopDrawing1);

    canvas.addEventListener('touchstart', startDrawing1, { passive: false });
    canvas.addEventListener('touchmove', draw1, { passive: false });
    canvas.addEventListener('touchend', stopDrawing1);
    canvas.addEventListener('touchcancel', stopDrawing1);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing1);
      canvas.removeEventListener('mousemove', draw1);
      canvas.removeEventListener('mouseup', stopDrawing1);
      canvas.removeEventListener('mouseout', stopDrawing1);
      canvas.removeEventListener('touchstart', startDrawing1);
      canvas.removeEventListener('touchmove', draw1);
      canvas.removeEventListener('touchend', stopDrawing1);
      canvas.removeEventListener('touchcancel', stopDrawing1);
    };
  }, [startDrawing1, draw1, stopDrawing1]);

  // Team 2 event listeners
  useEffect(() => {
    const canvas = canvas2Ref.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing2);
    canvas.addEventListener('mousemove', draw2);
    canvas.addEventListener('mouseup', stopDrawing2);
    canvas.addEventListener('mouseout', stopDrawing2);

    canvas.addEventListener('touchstart', startDrawing2, { passive: false });
    canvas.addEventListener('touchmove', draw2, { passive: false });
    canvas.addEventListener('touchend', stopDrawing2);
    canvas.addEventListener('touchcancel', stopDrawing2);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing2);
      canvas.removeEventListener('mousemove', draw2);
      canvas.removeEventListener('mouseup', stopDrawing2);
      canvas.removeEventListener('mouseout', stopDrawing2);
      canvas.removeEventListener('touchstart', startDrawing2);
      canvas.removeEventListener('touchmove', draw2);
      canvas.removeEventListener('touchend', stopDrawing2);
      canvas.removeEventListener('touchcancel', stopDrawing2);
    };
  }, [startDrawing2, draw2, stopDrawing2]);

  // Tool functions
  const setTeam1Tool = (type, value) => {
    setTeam1Mode('draw');
    if (type === 'size') {
      setTeam1Size(value);
    } else if (type === 'brush') {
      setTeam1Brush(value);
    } else if (type === 'color') {
      setTeam1Color(value);
    }
  };

  const setTeam2Tool = (type, value) => {
    setTeam2Mode('draw');
    if (type === 'size') {
      setTeam2Size(value);
    } else if (type === 'brush') {
      setTeam2Brush(value);
    } else if (type === 'color') {
      setTeam2Color(value);
    }
  };

  const useEraser1 = () => {
    setTeam1Mode('erase');
  };

  const useEraser2 = () => {
    setTeam2Mode('erase');
  };

  const clearCanvas1 = () => {
    const canvas = canvas1Ref.current;
    const ctx = ctx1Ref.current;
    if (canvas && ctx) {
      strokes1Ref.current = [];
      currentStroke1Ref.current = null;
      renderStrokes(1);
      const canSendClear = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "A" && myRole.includes("drawer");
      if (canSendClear) {
        const op = { t: "line", p: { pts: [[0, 0], [0, 0]], w: team1Size, clear: 1 } };
        ws.send({ type: "draw_op", canvas: "A", op });
      }
    }
  };

  const clearCanvas2 = () => {
    const canvas = canvas2Ref.current;
    const ctx = ctx2Ref.current;
    if (canvas && ctx) {
      strokes2Ref.current = [];
      currentStroke2Ref.current = null;
      renderStrokes(2);
      const canSendClear = ws.status === "CONNECTED" && phase === "DRAW" && myTeam === "B" && myRole.includes("drawer");
      if (canSendClear) {
        const op = { t: "line", p: { pts: [[0, 0], [0, 0]], w: team2Size, clear: 1 } };
        ws.send({ type: "draw_op", canvas: "B", op });
      }
    }
  };

  // Sabotage function for Team 1
  const handleSabotageTeam1 = () => {
    if (!canDrawA) return;
    if (remainingA <= 0) {
      alert('Not enough strokes for sabotage.');
      return;
    }
    if (team1SabotageOnCooldown) {
      alert(`Sabotage on cooldown (${team1CooldownLeft}s).`);
      return;
    }
    sabotageArmed1Ref.current = true;

    // Shake opponent's column
    const opponentCol = document.getElementById('col2');
    if (opponentCol) {
      opponentCol.classList.add('shake');
      setTimeout(() => {
        opponentCol.classList.remove('shake');
      }, 500);
    }

    // Visual feedback
    const myBtn = document.getElementById('sab1');
    if (myBtn) {
      myBtn.style.transform = 'scale(0.8) rotate(360deg)';
      myBtn.style.filter = 'brightness(200%)';
      setTimeout(() => {
        myBtn.style.transform = '';
        myBtn.style.filter = '';
      }, 300);
    }
  };

  // Sabotage function for Team 2
  const handleSabotageTeam2 = () => {
    if (!canDrawB) return;
    if (remainingB <= 0) {
      alert('Not enough strokes for sabotage.');
      return;
    }
    if (team2SabotageOnCooldown) {
      alert(`Sabotage on cooldown (${team2CooldownLeft}s).`);
      return;
    }
    sabotageArmed2Ref.current = true;

    // Shake opponent's column
    const opponentCol = document.getElementById('col1');
    if (opponentCol) {
      opponentCol.classList.add('shake');
      setTimeout(() => {
        opponentCol.classList.remove('shake');
      }, 500);
    }

    // Visual feedback
    const myBtn = document.getElementById('sab2');
    if (myBtn) {
      myBtn.style.transform = 'scale(0.8) rotate(360deg)';
      myBtn.style.filter = 'brightness(200%)';
      setTimeout(() => {
        myBtn.style.transform = '';
        myBtn.style.filter = '';
      }, 300);
    }
  };

  // Chat functions
  const sendMessage = (team) => {
    if (team === 1) {
      if (!canGuessA || hasGuessedThisPhase) return;
      const text = team1Input.trim();
      if (!text) return;
      ws.send({ type: "guess", text });
      setTeam1Input('');
      return;
    }
    if (!canGuessB || hasGuessedThisPhase) return;
    const text = team2Input.trim();
    if (!text) return;
    ws.send({ type: "guess", text });
    setTeam2Input('');
  };

  const handleKeyPress = (e, team) => {
    if (e.key === 'Enter') {
      sendMessage(team);
    }
  };

  // Modal functions
  const openModal = (modalId) => {
    if (modalId === 'exitModal') setExitModalOpen(true);
    if (modalId === 'settingsModal') setSettingsModalOpen(true);
  };

  const closeModal = (modalId) => {
    if (modalId === 'exitModal') setExitModalOpen(false);
    if (modalId === 'settingsModal') setSettingsModalOpen(false);
  };

  const exitToMenu = () => {
    navigate('/');
  };

  const resumeGame = () => {
    setExitModalOpen(false);
    setSettingsModalOpen(false);
  };

  return (
    <div className="battle-game-body">
      {/* Top Bar */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="top-btn" onClick={() => openModal('settingsModal')}>
            ⚙️ Settings
          </button>
          <button className="top-btn" onClick={() => openModal('exitModal')}>
            ❌ Exit
          </button>
        </div>

        <div className="round-info">ROUND {round}</div>

        <div className="top-right">
          <div
            className="score-display"
            style={{
              fontFamily: "'Bitcount Single'",
              fontWeight: 900,
              fontSize: '1rem'
            }}
          >
            SCORE:{' '}
            <span style={{ color: 'var(--c-red)', textShadow: '0 0 10px var(--c-red-glow)' }}>
              {redScore}
            </span>
            <span style={{ color: 'var(--text-muted)' }}> - </span>
            <span style={{ color: 'var(--c-blue)', textShadow: '0 0 10px var(--c-blue-glow)' }}>
              {blueScore}
            </span>
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

      {/* Game Container */}
      <div className="game-container">
        {/* TEAM 1 (RED) */}
        <div className="team-column" id="col1">
          {/* Header */}
          <div className="team-header header-red">
            <div className="team-title-row">
              <span className="team-name" style={{ textShadow: '0 0 15px var(--c-red-glow)' }}>
                {redTeam.name}
              </span>
            </div>
            <div className="player-names">{teamAPlayers.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                {phaseTimeLabel}{' '}
                <span className="stat-val" style={{ color: phaseTimeLeft <= 10 ? '#ff4757' : '#fff' }}>
                  {phaseTimeLeft}
                </span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span
                  className="stat-val"
                  style={{ color: remainingA <= 0 ? '#ff4757' : '#fff' }}
                >
                  {team1Strokes}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className={`canvas-wrapper ${canDrawA ? "can-draw" : ""}`}>
            <canvas ref={canvas1Ref} id="c1"></canvas>
          </div>

          {/* Bottom Split */}
          <div className="bottom-split">
            {/* Tools Sidebar */}
            {isDrawerA && (
            <div className="tools-sidebar">
              {/* Sabotage Button */}
                <div
                  id="sab1"
                  className={`sabotage-btn ${team1SabotageOnCooldown ? 'used' : ''}`}
                  onClick={handleSabotageTeam1}
                >
                🔥
              </div>

              {/* Brush Size */}
              <div>
                <div className="tool-group-label">Size</div>
                <div className="brush-stack">
                  <div
                    className={`brush-btn ${team1Size === 2 ? 'active' : ''}`}
                    onClick={() => setTeam1Tool('size', 2)}
                  >
                    <div className="dot" style={{ width: '3px', height: '3px', opacity: 0.7 }}></div>
                  </div>
                  <div
                    className={`brush-btn ${team1Size === 6 ? 'active' : ''}`}
                    onClick={() => setTeam1Tool('size', 6)}
                  >
                    <div className="dot" style={{ width: '6px', height: '6px' }}></div>
                  </div>
                  <div
                    className={`brush-btn ${team1Size === 12 ? 'active' : ''}`}
                    onClick={() => setTeam1Tool('size', 12)}
                  >
                    <div className="dot" style={{ width: '12px', height: '12px' }}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Brush</div>
                <div className="brush-type-group">
                  <button
                    className={`brush-type-btn ${team1Brush === 'line' ? 'active' : ''}`}
                    onClick={() => setTeam1Tool('brush', 'line')}
                  >
                    Line
                  </button>
                  <button
                    className={`brush-type-btn ${team1Brush === 'circle' ? 'active' : ''}`}
                    onClick={() => setTeam1Tool('brush', 'circle')}
                  >
                    Circle
                  </button>
                </div>
              </div>

              {/* Color Grid */}
              <div>
                <div className="tool-group-label">Color</div>
                <div className="color-grid">
                  <div
                    className={`color-btn ${team1Color === '#000000' ? 'active' : ''}`}
                    style={{ background: '#000000' }}
                    onClick={() => setTeam1Tool('color', '#000000')}
                  ></div>
                  <div
                    className={`color-btn ${team1Color === '#ff4757' ? 'active' : ''}`}
                    style={{ background: '#ff4757' }}
                    onClick={() => setTeam1Tool('color', '#ff4757')}
                  ></div>
                  <div
                    className={`color-btn ${team1Color === '#2e86de' ? 'active' : ''}`}
                    style={{ background: '#2e86de' }}
                    onClick={() => setTeam1Tool('color', '#2e86de')}
                  ></div>
                  <div
                    className={`color-btn ${team1Color === '#2ed573' ? 'active' : ''}`}
                    style={{ background: '#2ed573' }}
                    onClick={() => setTeam1Tool('color', '#2ed573')}
                  ></div>
                  <div
                    className={`color-btn ${team1Color === '#ffa502' ? 'active' : ''}`}
                    style={{ background: '#ffa502' }}
                    onClick={() => setTeam1Tool('color', '#ffa502')}
                  ></div>
                  <div
                    className={`color-btn ${team1Color === '#ff98cd' ? 'active' : ''}`}
                    style={{ background: '#ff98cd' }}
                    onClick={() => setTeam1Tool('color', '#ff98cd')}
                  ></div>
                </div>
              </div>

              {/* Eraser and Trash */}
              <div className="action-stack">
                <button
                  className={`action-btn ${team1Mode === 'erase' ? 'active-eraser' : ''}`}
                  onClick={useEraser1}
                  title="Eraser"
                >
                  🧽
                </button>
                <button className="action-btn" onClick={clearCanvas1} title="Clear">
                  🗑️
                </button>
              </div>
            </div>
            )}

            {/* Chat Main */}
            <div className="chat-main">
              <div className="chat-log-container" id="log1">
                {team1Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>
                    {msg.text}
                  </div>
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
                    onKeyPress={(e) => handleKeyPress(e, 1)}
                    disabled={!canGuessA || hasGuessedThisPhase}
                  />
                  <button className="send-btn send-red" onClick={() => sendMessage(1)} disabled={!canGuessA || hasGuessedThisPhase}>
                    SEND
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TEAM 2 (BLUE) */}
        <div className="team-column" id="col2">
          {/* Header */}
          <div className="team-header header-blue">
            <div className="team-title-row">
              <span className="team-name" style={{ textShadow: '0 0 15px var(--c-blue-glow)' }}>
                {blueTeam.name}
              </span>
            </div>
            <div className="player-names">{teamBPlayers.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                {phaseTimeLabel}{' '}
                <span className="stat-val" style={{ color: phaseTimeLeft <= 10 ? '#ff4757' : '#fff' }}>
                  {phaseTimeLeft}
                </span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span
                  className="stat-val"
                  style={{ color: remainingB <= 0 ? '#ff4757' : '#fff' }}
                >
                  {team2Strokes}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className={`canvas-wrapper ${canDrawB ? "can-draw" : ""}`}>
            <canvas ref={canvas2Ref} id="c2"></canvas>
          </div>

          {/* Bottom Split */}
          <div className="bottom-split">
            {/* Tools Sidebar */}
            {isDrawerB && (
            <div className="tools-sidebar">
              {/* Sabotage Button */}
                <div
                  id="sab2"
                  className={`sabotage-btn ${team2SabotageOnCooldown ? 'used' : ''}`}
                  onClick={handleSabotageTeam2}
                >
                🔥
              </div>

              {/* Brush Size */}
              <div>
                <div className="tool-group-label">Size</div>
                <div className="brush-stack">
                  <div
                    className={`brush-btn ${team2Size === 2 ? 'active' : ''}`}
                    onClick={() => setTeam2Tool('size', 2)}
                  >
                    <div className="dot" style={{ width: '3px', height: '3px', opacity: 0.7 }}></div>
                  </div>
                  <div
                    className={`brush-btn ${team2Size === 6 ? 'active' : ''}`}
                    onClick={() => setTeam2Tool('size', 6)}
                  >
                    <div className="dot" style={{ width: '6px', height: '6px' }}></div>
                  </div>
                  <div
                    className={`brush-btn ${team2Size === 12 ? 'active' : ''}`}
                    onClick={() => setTeam2Tool('size', 12)}
                  >
                    <div className="dot" style={{ width: '12px', height: '12px' }}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="tool-group-label">Brush</div>
                <div className="brush-type-group">
                  <button
                    className={`brush-type-btn ${team2Brush === 'line' ? 'active' : ''}`}
                    onClick={() => setTeam2Tool('brush', 'line')}
                  >
                    Line
                  </button>
                  <button
                    className={`brush-type-btn ${team2Brush === 'circle' ? 'active' : ''}`}
                    onClick={() => setTeam2Tool('brush', 'circle')}
                  >
                    Circle
                  </button>
                </div>
              </div>

              {/* Color Grid */}
              <div>
                <div className="tool-group-label">Color</div>
                <div className="color-grid">
                  <div
                    className={`color-btn ${team2Color === '#000000' ? 'active' : ''}`}
                    style={{ background: '#000000' }}
                    onClick={() => setTeam2Tool('color', '#000000')}
                  ></div>
                  <div
                    className={`color-btn ${team2Color === '#2e86de' ? 'active' : ''}`}
                    style={{ background: '#2e86de' }}
                    onClick={() => setTeam2Tool('color', '#2e86de')}
                  ></div>
                  <div
                    className={`color-btn ${team2Color === '#ff4757' ? 'active' : ''}`}
                    style={{ background: '#ff4757' }}
                    onClick={() => setTeam2Tool('color', '#ff4757')}
                  ></div>
                  <div
                    className={`color-btn ${team2Color === '#2ed573' ? 'active' : ''}`}
                    style={{ background: '#2ed573' }}
                    onClick={() => setTeam2Tool('color', '#2ed573')}
                  ></div>
                  <div
                    className={`color-btn ${team2Color === '#ffa502' ? 'active' : ''}`}
                    style={{ background: '#ffa502' }}
                    onClick={() => setTeam2Tool('color', '#ffa502')}
                  ></div>
                  <div
                    className={`color-btn ${team2Color === '#ff98cd' ? 'active' : ''}`}
                    style={{ background: '#ff98cd' }}
                    onClick={() => setTeam2Tool('color', '#ff98cd')}
                  ></div>
                </div>
              </div>

              {/* Eraser and Trash */}
              <div className="action-stack">
                <button
                  className={`action-btn ${team2Mode === 'erase' ? 'active-eraser' : ''}`}
                  onClick={useEraser2}
                  title="Eraser"
                >
                  🧽
                </button>
                <button className="action-btn" onClick={clearCanvas2} title="Clear">
                  🗑️
                </button>
              </div>
            </div>
            )}

            {/* Chat Main */}
            <div className="chat-main">
              <div className="chat-log-container" id="log2">
                {team2Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>
                    {msg.text}
                  </div>
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
                    onKeyPress={(e) => handleKeyPress(e, 2)}
                    disabled={!canGuessB || hasGuessedThisPhase}
                  />
                  <button className="send-btn send-blue" onClick={() => sendMessage(2)} disabled={!canGuessB || hasGuessedThisPhase}>
                    SEND
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit / Pause Menu Modal */}
      <div className={`modal-overlay ${exitModalOpen ? 'active' : ''}`} id="exitModal">
        <div className="modal-card">
          <div className="modal-header">
            <h2 className="modal-title">GAME PAUSED</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Current Round Summary</p>
          </div>
          <div className="player-list-exit">
            <div className="player-row">
              <div className="p-avatar" style={{ background: 'var(--c-red)' }}>
                {currentPlayer.charAt(0)}
              </div>
              <div className="p-info">
                <div className="p-name">{currentPlayer} (You)</div>
                <div className="p-score">Score: {redScore}</div>
              </div>
            </div>
            <div className="player-row">
              <div className="p-avatar" style={{ background: 'var(--c-blue)' }}>
                {(teamBPlayers[0] || 'P').charAt(0)}
              </div>
              <div className="p-info">
                <div className="p-name">{teamBPlayers[0] || 'Player'}</div>
                <div className="p-score">Score: {blueScore}</div>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-modal btn-resume" onClick={resumeGame}>
              RESUME GAME
            </button>
            <button className="btn-modal btn-exit" onClick={exitToMenu}>
              EXIT TO MENU
            </button>
          </div>
        </div>
      </div>

      {/* Settings Menu Modal */}
      <div className={`modal-overlay ${settingsModalOpen ? 'active' : ''}`} id="settingsModal">
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
            <button className="btn-modal btn-resume" onClick={resumeGame}>
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleGame;
