import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomWSContext } from "../ws/RoomWSContext";
import "../styles/BattleWinFinal.css";

const pickTheme = (p) => {
  const key = (p?.pid || p?.name || "").toString();
  if (!key) return "theme-red";
  const c = key.charCodeAt(key.length - 1) || 0;
  return c % 2 === 0 ? "theme-blue" : "theme-red";
};

const BattleWinFinal = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();

  const snapshot = ws.snapshot || {};
  const players = snapshot.players || [];

  const leaderboard = useMemo(() => {
    const list = (players || []).map((p) => ({
      pid: p.pid,
      name: p.name || "Unknown",
      points: Number(p.points || 0),
      connected: p?.connected !== false,
    }));
    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [players]);

  const champion = leaderboard[0] || null;
  const theme = pickTheme(champion);

  // Confetti (simple + light)
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const color = theme === "theme-blue" ? "#2e86de" : "#ff4757";
    const particleCount = 90;

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height - height;
        this.size = Math.random() * 6 + 3;
        this.speedY = Math.random() * 3 + 1.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 5 - 2.5;
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
      draw(c) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation * Math.PI) / 180);
        c.fillStyle = color;
        c.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        c.restore();
      }
    }

    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) particlesRef.current.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particlesRef.current) {
        p.update();
        p.draw(ctx);
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
  }, [theme]);

  useEffect(() => {
    if (ws.status === "CONNECTED") ws.send({ type: "snapshot" });
  }, [ws.status, ws.send]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "room_state_changed") {
      if (m.state === "WAITING") navigate("/battle-lobby");
    }
  }, [ws.lastMsg, navigate]);

  return (
    <div className={`battle-container ${theme}`}>
      <canvas ref={canvasRef} id="confetti-canvas" className="confetti-canvas" />

      <div className="battle-card">
        <div className="header">
          <span className="subtitle">Final Leaderboard</span>
          <span className="subtitle" style={{ marginTop: "6px" }}>
            Points only
          </span>
        </div>

        <div className="winner-banner">
          <span className="team-badge">{champion ? champion.name : "-"}</span>
          <span className="result-label">{champion ? `Top Score: ${champion.points}` : "No players"}</span>
        </div>

        <div className="history-section">
          <span className="history-title">Player Rankings</span>
          <div className="timeline">
            {leaderboard.map((p, idx) => {
              const opacity = p.connected ? 1 : 0.55;
              return (
                <div key={p.pid || `${p.name}-${idx}`} className="round-row" style={{ opacity }}>
                  <span className="round-label">#{idx + 1}</span>
                  <span className="round-winner-badge">
                    {p.name} · {p.points} pts{p.connected ? "" : " (disconnected)"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="action-row">
          <button className="action-btn" onClick={() => navigate("/select-mode")}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattleWinFinal;
