import { useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/SingleWin.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const CROWN_ICON = "\uD83D\uDC51";
const TROPHY_ICON = "\uD83C\uDFC6";

const SingleWin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { ws } = useRoomWSContext();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const resultState = location.state || {};
  const snapshotPlayers = Array.isArray(ws.snapshot?.players) ? ws.snapshot.players : [];

  useEffect(() => {
    if (ws.status === "CONNECTED") ws.send({ type: "snapshot" });
  }, [ws.status, ws.send]);

  const players = useMemo(() => {
    const hasRoutePlayers = Array.isArray(resultState.players) && resultState.players.length > 0;
    const rawAll = hasRoutePlayers ? resultState.players : snapshotPlayers;
    const rawConnected = rawAll.filter((p) => p && p.connected !== false);
    const raw = rawConnected.length ? rawConnected : rawAll;
    if (!raw.length) {
      const fallbackName = resultState.winnerName || "Winner";
      return [
        {
          id: "unknown",
          pid: "",
          name: fallbackName,
          avatar: String(fallbackName).charAt(0).toUpperCase() || "W",
          score: 0,
          connected: true,
        },
      ];
    }

    const seen = new Set();
    const unique = [];
    for (const p of raw) {
      const key = p?.pid || p?.id || p?.name || "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }

    return unique.map((p, idx) => {
      const scoreRaw = p?.score ?? p?.points ?? 0;
      const score = Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : 0;
      const name = p?.name || `Player ${idx + 1}`;
      return {
        id: p?.pid || p?.id || `p-${idx}`,
        pid: p?.pid || "",
        name,
        avatar: String(name).charAt(0).toUpperCase(),
        score,
        connected: p?.connected !== false,
      };
    });
  }, [resultState.players, resultState.winnerName, snapshotPlayers]);

  const sortedPlayers = useMemo(() => {
    const list = [...players].sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)));
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

  const topScore = sortedPlayers[0]?.score ?? 0;
  const winners = useMemo(
    () => sortedPlayers.filter((p) => p.score === topScore),
    [sortedPlayers, topScore]
  );

  const winnerNameLine = useMemo(() => {
    if (winners.length > 0) return winners.map((p) => `${p.name} ${CROWN_ICON}`).join(" \u00B7 ");
    const fallbackName = resultState.winnerName || "Winner";
    return `${fallbackName} ${CROWN_ICON}`;
  }, [winners, resultState.winnerName]);

  const winnerAvatar = winners[0]?.avatar || String(resultState.winnerName || "W").charAt(0).toUpperCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const particles = [];
    const particleCount = 100;

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height - height;
        this.size = Math.random() * 6 + 3;
        this.speedY = Math.random() * 3 + 2;
        this.speedX = Math.random() * 2 - 1;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
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

    const timeout = setTimeout(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        ctx.clearRect(0, 0, width, height);
      }
    }, 4000);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeout);
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
            <div className="winner-points">{topScore.toLocaleString()} PTS</div>
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
            {sortedPlayers.map((player) => (
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

export default SingleWin;
