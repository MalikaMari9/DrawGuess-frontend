
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomWSContext } from "../ws/RoomWSContext";
import "../styles/BattleWinFinal.css";

const BattleWinFinal = () => {
  const navigate = useNavigate();
  const { ws } = useRoomWSContext();

  const snapshot = ws.snapshot || {};
  const players = snapshot.players || [];
  const myPid = ws.pid || localStorage.getItem("dg_pid");

  const leaderboard = useMemo(() => {
    const list = (players || []).map((p) => ({
      pid: p.pid,
      name: p.name || "Unknown",
      points: Number(p.points || 0),
      connected: p?.connected !== false,
      isSelf: myPid && p.pid === myPid,
    }));
    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (a.name || "").localeCompare(b.name || "");
    });
    let rank = 0;
    let prevPoints = null;
    list.forEach((p, idx) => {
      if (prevPoints === null || p.points < prevPoints) {
        rank = idx + 1;
        prevPoints = p.points;
      }
      p.rank = rank;
    });
    return list;
  }, [players, myPid]);

  const champion = leaderboard[0] || null;
  const topScore = champion ? champion.points : null;
  const winners = topScore === null ? [] : leaderboard.filter((p) => p.points === topScore);
  const winnerNames = winners.length ? winners.map((p) => p.name).join(" · ") : "-";

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

    const colors = ["#ffffff", "#e6f0ff", "#ffe6f0", "#e8f7ff", "#f3e8ff"];
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
      draw(c) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation * Math.PI) / 180);
        c.fillStyle = this.color;
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
  }, []);

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
    <div className="battle-container">
      <canvas ref={canvasRef} id="confetti-canvas" className="confetti-canvas" />

      <div className="battle-card">
        <div className="header">
          <span className="subtitle">Final Leaderboard</span>
          <span className="subtitle" style={{ marginTop: "6px" }}>
            Points only
          </span>
        </div>

        <div className="winner-banner">
          <span className="team-badge">{winnerNames}</span>
          <span className="result-label">
            {topScore !== null ? `Top Score: ${topScore}` : "No players"}
          </span>
        </div>

        <div className="history-section">
          <span className="history-title">Player Rankings</span>
          <div className="timeline">
            {leaderboard.map((p, idx) => {
              const opacity = p.connected ? 1 : 0.55;
              return (
                <div key={p.pid || `${p.name}-${idx}`} className="round-row" style={{ opacity }}>
                  <span className="round-label">#{p.rank}</span>
                  <span className="round-winner-badge">
                    {p.name}
                    {p.rank === 1 ? " 👑" : ""}
                    {p.isSelf ? <span className="you-badge">YOU</span> : null}
                    {" · "}
                    {p.points} pts{p.connected ? "" : " (disconnected)"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="action-row">
          <button className="action-btn" onClick={() => navigate("/")}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattleWinFinal;
