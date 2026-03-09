import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomWSContext } from "../ws/RoomWSContext";
import "../styles/SingleWin.css";

const CROWN_ICON = "\uD83D\uDC51";
const TROPHY_ICON = "\uD83C\uDFC6";

const BattleWinFinal = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const snapshot = ws.snapshot || {};
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];

  const leaderboard = useMemo(() => {
    const list = (players || []).map((p, idx) => {
      const name = p?.name || `Player ${idx + 1}`;
      return {
        id: p?.pid || `p-${idx}`,
        pid: p?.pid || "",
        name,
        avatar: String(name).charAt(0).toUpperCase(),
        score: Number(p?.points || 0),
        connected: p?.connected !== false,
      };
    });

    if (!list.length) {
      return [{ id: "unknown", pid: "", name: "Winner", avatar: "W", score: 0, connected: true, rank: 1 }];
    }

    list.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)));
    let rank = 0;
    let prevScore = null;
    return list.map((p, idx) => {
      if (prevScore === null || p.score < prevScore) {
        rank = idx + 1;
        prevScore = p.score;
      }
      return { ...p, rank };
    });
  }, [players]);

  const topScore = leaderboard[0]?.score ?? 0;
  const winners = useMemo(
    () => leaderboard.filter((p) => p.score === topScore),
    [leaderboard, topScore]
  );
  const winnerNameLine = winners.length
    ? winners.map((p) => `${p.name} ${CROWN_ICON}`).join(" \u00B7 ")
    : `Winner ${CROWN_ICON}`;
  const winnerAvatar = winners[0]?.avatar || "W";

  useEffect(() => {
    if (ws.status === "CONNECTED") ws.send({ type: "snapshot" });
  }, [ws.status, ws.send]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "room_state_changed" && m.state === "WAITING") {
      navigate("/battle-lobby");
    }
  }, [ws.lastMsg, navigate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles = [];
    const particleCount = 90;
    const colors = ["#ffffff", "#e6f0ff", "#ffe6f0", "#e8f7ff", "#f3e8ff"];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height - height;
        this.size = Math.random() * 6 + 3;
        this.speedY = Math.random() * 3 + 1.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 5 - 2.5;
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        if (this.y > height) {
          this.y = -10;
          this.x = Math.random() * width;
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }

    for (let i = 0; i < particleCount; i += 1) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.update();
        p.draw();
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const getRankClass = (rank) => {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "";
  };

  return (
    <div className="win-wrapper">
      <canvas ref={canvasRef} id="confetti-canvas" className="confetti-canvas" />

      <div className="main-layout">
        <div className="frame frame-winner">
          <h1 className="victory-title">VICTORY</h1>
          <div className="subtitle">Game Over</div>

          <div className="winner-card">
            <div className="trophy-icon">{TROPHY_ICON}</div>
            <div className="winner-avatar">{winnerAvatar}</div>
            <div className="winner-name">{winnerNameLine}</div>
          </div>

          <div className="actions">
            <button className="btn" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </div>

        <div className="frame">
          <div className="frame-title">Final Standings</div>
          <div className="score-list">
            {leaderboard.map((player) => (
              <div
                key={player.id}
                className="score-row"
                style={{ opacity: player.connected ? 1 : 0.62 }}
              >
                <div className={`rank-num ${getRankClass(player.rank)}`}>{player.rank}</div>
                <div className="row-avatar">{player.avatar}</div>
                <div className="row-info">
                  <div className="row-name">{player.name}</div>
                </div>
                <div className="row-score">{player.score.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleWinFinal;
