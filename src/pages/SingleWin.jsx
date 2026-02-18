import React, { useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/SingleWin.css';

const SingleWin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const resultState = location.state || {};
  const players = useMemo(() => {
    const rawAll = Array.isArray(resultState.players) ? resultState.players : [];
    const rawConnected = rawAll.filter((p) => p && p.connected !== false);
    const raw = rawConnected.length ? rawConnected : rawAll;
    if (!raw.length) {
      return [{ id: 'unknown', name: resultState.winnerName || 'Winner', avatar: (resultState.winnerName || 'W')[0], score: 0, rank: 1 }];
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
        pid: p?.pid || '',
        name,
        avatar: String(name).charAt(0).toUpperCase(),
        score,
      };
    });
  }, [resultState.players, resultState.winnerName]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score).map((p, idx) => ({ ...p, rank: idx + 1 })),
    [players]
  );

  const winner = useMemo(() => {
    const winnerPid = resultState.winnerPid || '';
    const byPid = winnerPid ? sortedPlayers.find((p) => p.pid === winnerPid) : null;
    const byName = resultState.winnerName
      ? sortedPlayers.find((p) => p.name === resultState.winnerName)
      : null;
    const selected = byPid || byName || sortedPlayers[0] || { name: resultState.winnerName || 'Winner', avatar: 'W', score: 0, rank: 1 };
    return {
      ...selected,
      points: Number(selected.score || 0).toLocaleString(),
    };
  }, [resultState.winnerName, resultState.winnerPid, sortedPlayers]);

  // ========== CONFETTI ENGINE ==========
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
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
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Stop confetti after 4 seconds
    const timeout = setTimeout(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        ctx.clearRect(0, 0, width, height);
      }
    }, 4000);

    // Handle resize
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // ========== HANDLERS ==========
  const playAgain = () => {
    navigate('/single-lobby'); // or navigate to game creation
  };

  const goToMainMenu = () => {
    navigate('/');
  };

  // Get rank class for styling
  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  };

  return (
    <div className="win-wrapper">
      <canvas ref={canvasRef} id="confetti-canvas" className="confetti-canvas"></canvas>

      <div className="main-layout">
        
        {/* LEFT FRAME: Winner */}
        <div className="frame frame-winner">
          <h1 className="victory-title">VICTORY</h1>
          <div className="subtitle">Game Over</div>
          
          <div className="winner-card">
            <div className="trophy-icon">🏆</div>
            <div className="winner-avatar">{winner.avatar}</div>
            <div className="winner-name">{winner.name}</div>
            <div className="winner-points">{winner.points} PTS</div>
          </div>

          <div className="actions">
            <button className="btn btn-primary" onClick={playAgain}>
              Play Again
            </button>
            <button className="btn" onClick={goToMainMenu}>
              Main Menu
            </button>
          </div>
        </div>

        {/* RIGHT FRAME: Leaderboard */}
        <div className="frame">
          <div className="frame-title">Final Standings</div>
          
          <div className="score-list">
            {sortedPlayers.map((player) => (
              <div key={player.id} className="score-row">
                <div className={`rank-num ${getRankClass(player.rank)}`}>
                  {player.rank}
                </div>
                <div 
                  className="row-avatar" 
                  style={{ 
                    background: player.color || '#334155',
                    boxShadow: player.color ? `0 0 10px ${player.color}` : 'none'
                  }}
                >
                  {player.avatar}
                </div>
                <div className="row-info">
                  <div className="row-name">{player.name}</div>
                </div>
                <div className="row-score">
                  {player.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SingleWin;
