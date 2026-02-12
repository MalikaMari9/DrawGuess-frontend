import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SingleWin.css';

const SingleWin = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Mock winner data - replace with actual props/state management later
  const [winner] = useState({
    name: 'Alex',
    avatar: 'A',
    points: '3,450',
    rank: 1
  });

  // Mock players leaderboard data
  const [players] = useState([
    { id: 1, name: 'Alex', avatar: 'A', score: 3450, rank: 1, color: 'var(--gold)' },
    { id: 2, name: 'Mike', avatar: 'M', score: 2100, rank: 2, color: 'var(--silver)' },
    { id: 3, name: 'Sarah', avatar: 'S', score: 1850, rank: 3, color: 'var(--bronze)' },
    { id: 4, name: 'Jess', avatar: 'J', score: 1200, rank: 4 },
    { id: 5, name: 'Tom', avatar: 'K', score: 950, rank: 5 }
  ]);

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

  // Sort players by score (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

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
