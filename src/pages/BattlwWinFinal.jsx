import React, { useEffect, useRef, useState } from "react";
import { useRoomWSContext } from "../ws/RoomWSContext";
import "../styles/BattleWinFinal.css";

const BattleWinFinal = () => {
  const { ws } = useRoomWSContext();
  const snapshot = ws.snapshot || {};
  const game = snapshot.game || {};
  const score = game.score || { A: 0, B: 0 };
  const computedWinner = score.A === score.B ? null : (score.A > score.B ? 'red' : 'blue');
  const [winner, setWinner] = useState(computedWinner || 'red');
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);

  // Team data
  const teamData = {
    red: {
      theme: 'theme-red',
      badge: 'TEAM 1',
      score: 3,
      opponentScore: 2,
      color: '#ff4757',
      name: 'RED',
      opponentName: 'BLUE'
    },
    blue: {
      theme: 'theme-blue',
      badge: 'TEAM 2',
      score: 3,
      opponentScore: 2,
      color: '#2e86de',
      name: 'BLUE',
      opponentName: 'RED'
    }
  };

  // Round history data
  const roundHistory = (game.history || []).map((h, idx) => ({
    round: `R${idx + 1}`,
    winner: h === 'A' ? 'red' : h === 'B' ? 'blue' : 'none'
  }));

  // Confetti engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particleCount = 100;

    class Particle {
      constructor(color) {
        this.x = Math.random() * width;
        this.y = Math.random() * height - height;
        this.size = Math.random() * 6 + 3;
        this.speedY = Math.random() * 3 + 1.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.color = color;
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

      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }

    const startConfetti = (color) => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(new Particle(color));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particlesRef.current.forEach(p => {
        p.update();
        p.draw(ctx);
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    startConfetti(teamData[winner].color);
    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [winner]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === "room_snapshot") {
      const sc = m.game?.score || { A: 0, B: 0 };
      const w = sc.A === sc.B ? null : (sc.A > sc.B ? 'red' : 'blue');
      setWinner(w || 'red');
    }
  }, [ws.lastMsg]);

  const handleSetWinner = (team) => {
    setWinner(team);
  };

  const currentTeam = teamData[winner];
  const opponentTeam = winner === 'red' ? teamData.blue : teamData.red;

  return (
    <div className={`battle-container ${currentTeam.theme}`}>
      <canvas
        ref={canvasRef}
        id="confetti-canvas"
        className="confetti-canvas"
      />

      <div className="battle-card">
        <div className="header">
          <span className="subtitle">Match Completed</span>
        </div>

        {/* Winner Section */}
        <div className="winner-banner">
          <span className="team-badge">{currentTeam.badge}</span>
          <span className="result-label">Wins!</span>
        </div>

        {/* Score Summary */}
        <div className="score-summary">
          <div className="team-score-box">
            <div className="team-name">{currentTeam.name}</div>
            <div className={`team-score score-winner`}>{currentTeam.score}</div>
          </div>
          <div className="vs-badge">VS</div>
          <div className="team-score-box">
            <div className="team-name">{opponentTeam.name}</div>
            <div className={`team-score score-loser`}>{opponentTeam.score}</div>
          </div>
        </div>

        {/* Round History */}
        <div className="history-section">
          <span className="history-title">Match History</span>
          <div className="timeline">
            {roundHistory.map((round, index) => (
              <div
                key={index}
                className={`round-row winner-${round.winner}`}
              >
                <span className="round-label">{round.round}</span>
                <span className={`round-winner-badge ${round.winner}`}>
                  {round.winner === 'red' ? 'Red' : 'Blue'} Wins
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="action-row">
          <button className="action-btn secondary">Main Menu</button>
          <button className="action-btn">Rematch</button>
        </div>
      </div>

      {/* Demo Controls */}
      <div className="demo-controls">
        <button
          className="demo-btn"
          onClick={() => handleSetWinner('red')}
        >
          Red Wins
        </button>
        <button
          className="demo-btn"
          onClick={() => handleSetWinner('blue')}
        >
          Blue Wins
        </button>
      </div>
    </div>
  );
};

export default BattleWinFinal;
