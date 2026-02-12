import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/BattleGame.css';

const BattleGame = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Game state from location
  const {
    roomCode = 'BTL-5718',
    round = 1,
    totalRounds = 5,
    redTeam = {
      name: 'Team 1',
      players: ['Alex', 'Sarah'],
      score: 0
    },
    blueTeam = {
      name: 'Team 2',
      players: ['Mike', 'Jess'],
      score: 0
    },
    currentPlayer = 'Alex'
  } = location.state || {};

  // Team states
  const [team1Time, setTeam1Time] = useState(60);
  const [team2Time, setTeam2Time] = useState(60);
  const [team1Strokes, setTeam1Strokes] = useState(0);
  const [team2Strokes, setTeam2Strokes] = useState(0);
  const maxStrokes = 15;

  // Tool states for Team 1
  const [team1Color, setTeam1Color] = useState('#000000');
  const [team1Size, setTeam1Size] = useState(6);
  const [team1Mode, setTeam1Mode] = useState('draw');
  const [team1SabotageUsed, setTeam1SabotageUsed] = useState(false);

  // Tool states for Team 2
  const [team2Color, setTeam2Color] = useState('#000000');
  const [team2Size, setTeam2Size] = useState(6);
  const [team2Mode, setTeam2Mode] = useState('draw');
  const [team2SabotageUsed, setTeam2SabotageUsed] = useState(false);

  // Canvas refs
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const ctx1Ref = useRef(null);
  const ctx2Ref = useRef(null);

  // ✅ FIXED: Drawing states - missing = operator
  const [isDrawing1, setIsDrawing1] = useState(false);
  const [isDrawing2, setIsDrawing2] = useState(false);

  // Chat states
  const [team1Messages, setTeam1Messages] = useState([
    { text: 'Is it a dog?', isOwn: false }
  ]);
  const [team2Messages, setTeam2Messages] = useState([
    { text: 'It looks like a sun?', isOwn: true }
  ]);
  const [team1Input, setTeam1Input] = useState('');
  const [team2Input, setTeam2Input] = useState('');

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

  // Initialize canvases
  useEffect(() => {
    if (canvas1Ref.current) {
      ctx1Ref.current = canvas1Ref.current.getContext('2d');
      resizeCanvas(1);
    }
    if (canvas2Ref.current) {
      ctx2Ref.current = canvas2Ref.current.getContext('2d');
      resizeCanvas(2);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleResize = () => {
    resizeCanvas(1);
    resizeCanvas(2);
  };

  const resizeCanvas = (teamId) => {
    const canvas = teamId === 1 ? canvas1Ref.current : canvas2Ref.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // Save current canvas state
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Restore canvas state
    ctx.putImageData(imageData, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTeam1Time((prev) => (prev > 0 ? prev - 1 : 0));
      setTeam2Time((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Drawing functions for Team 1
  const startDrawing1 = useCallback(
    (e) => {
      e.preventDefault();
      if (team1Strokes >= maxStrokes && team1Mode === 'draw') return;

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

      ctx.moveTo(x, y);
    },
    [team1Strokes, team1Mode, team1Size, team1Color]
  );

  const draw1 = useCallback(
    (e) => {
      e.preventDefault();
      if (!isDrawing1) return;

      const { x, y } = getCanvasCoordinates(e, canvas1Ref.current);
      const ctx = ctx1Ref.current;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing1]
  );

  const stopDrawing1 = useCallback(() => {
    if (isDrawing1) {
      if (team1Mode === 'draw' && team1Strokes < maxStrokes) {
        setTeam1Strokes((prev) => prev + 1);
      }
    }
    setIsDrawing1(false);
    if (ctx1Ref.current) {
      ctx1Ref.current.closePath();
    }
  }, [isDrawing1, team1Mode, team1Strokes]);

  // Drawing functions for Team 2
  const startDrawing2 = useCallback(
    (e) => {
      e.preventDefault();
      if (team2Strokes >= maxStrokes && team2Mode === 'draw') return;

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

      ctx.moveTo(x, y);
    },
    [team2Strokes, team2Mode, team2Size, team2Color]
  );

  const draw2 = useCallback(
    (e) => {
      e.preventDefault();
      if (!isDrawing2) return;

      const { x, y } = getCanvasCoordinates(e, canvas2Ref.current);
      const ctx = ctx2Ref.current;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing2]
  );

  const stopDrawing2 = useCallback(() => {
    if (isDrawing2) {
      if (team2Mode === 'draw' && team2Strokes < maxStrokes) {
        setTeam2Strokes((prev) => prev + 1);
      }
    }
    setIsDrawing2(false);
    if (ctx2Ref.current) {
      ctx2Ref.current.closePath();
    }
  }, [isDrawing2, team2Mode, team2Strokes]);

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
    } else if (type === 'color') {
      setTeam1Color(value);
    }
  };

  const setTeam2Tool = (type, value) => {
    setTeam2Mode('draw');
    if (type === 'size') {
      setTeam2Size(value);
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const clearCanvas2 = () => {
    const canvas = canvas2Ref.current;
    const ctx = ctx2Ref.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Sabotage function for Team 1
  const handleSabotageTeam1 = () => {
    if (team1SabotageUsed) {
      alert('Sabotage already used!');
      return;
    }

    // Add 180 seconds to opponent's time (Team 2)
    setTeam2Time((prev) => prev + 180);

    // Shake opponent's column
    const opponentCol = document.getElementById('col2');
    if (opponentCol) {
      opponentCol.classList.add('shake');
      setTimeout(() => {
        opponentCol.classList.remove('shake');
      }, 500);
    }

    // Mark sabotage as used
    setTeam1SabotageUsed(true);

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
    if (team2SabotageUsed) {
      alert('Sabotage already used!');
      return;
    }

    // Add 180 seconds to opponent's time (Team 1)
    setTeam1Time((prev) => prev + 180);

    // Shake opponent's column
    const opponentCol = document.getElementById('col1');
    if (opponentCol) {
      opponentCol.classList.add('shake');
      setTimeout(() => {
        opponentCol.classList.remove('shake');
      }, 500);
    }

    // Mark sabotage as used
    setTeam2SabotageUsed(true);

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
      if (!team1Input.trim()) return;
      setTeam1Messages((prev) => [...prev, { text: team1Input, isOwn: false }]);
      setTeam1Input('');
    } else {
      if (!team2Input.trim()) return;
      setTeam2Messages((prev) => [...prev, { text: team2Input, isOwn: true }]);
      setTeam2Input('');
    }
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

        <div
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
            <div className="player-names">{redTeam.players.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                TIME{' '}
                <span className="stat-val" style={{ color: team1Time > 90 ? '#ff4757' : '#fff' }}>
                  {team1Time}
                </span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span
                  className="stat-val"
                  style={{ color: team1Strokes >= maxStrokes ? '#ff4757' : '#fff' }}
                >
                  {team1Strokes}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="canvas-wrapper">
            <canvas ref={canvas1Ref} id="c1"></canvas>
          </div>

          {/* Bottom Split */}
          <div className="bottom-split">
            {/* Tools Sidebar */}
            <div className="tools-sidebar">
              {/* Sabotage Button */}
              <div
                id="sab1"
                className={`sabotage-btn ${team1SabotageUsed ? 'used' : ''}`}
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

            {/* Chat Main */}
            <div className="chat-main">
              <div className="chat-log-container" id="log1">
                {team1Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="input-area">
                <input
                  type="text"
                  className="guess-box"
                  placeholder="Guess..."
                  id="inp1"
                  value={team1Input}
                  onChange={(e) => setTeam1Input(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 1)}
                />
                <button className="send-btn send-red" onClick={() => sendMessage(1)}>
                  SEND
                </button>
              </div>
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
            <div className="player-names">{blueTeam.players.join(' • ')}</div>
            <div className="stats-row">
              <div className="stat-item">
                TIME{' '}
                <span className="stat-val" style={{ color: team2Time > 90 ? '#ff4757' : '#fff' }}>
                  {team2Time}
                </span>
              </div>
              <div className="stat-item">
                STROKES{' '}
                <span
                  className="stat-val"
                  style={{ color: team2Strokes >= maxStrokes ? '#ff4757' : '#fff' }}
                >
                  {team2Strokes}/{maxStrokes}
                </span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="canvas-wrapper">
            <canvas ref={canvas2Ref} id="c2"></canvas>
          </div>

          {/* Bottom Split */}
          <div className="bottom-split">
            {/* Tools Sidebar */}
            <div className="tools-sidebar">
              {/* Sabotage Button */}
              <div
                id="sab2"
                className={`sabotage-btn ${team2SabotageUsed ? 'used' : ''}`}
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

            {/* Chat Main */}
            <div className="chat-main">
              <div className="chat-log-container" id="log2">
                {team2Messages.map((msg, index) => (
                  <div key={index} className={`msg ${msg.isOwn ? 'right' : ''}`}>
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="input-area">
                <input
                  type="text"
                  className="guess-box"
                  placeholder="Guess..."
                  id="inp2"
                  value={team2Input}
                  onChange={(e) => setTeam2Input(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 2)}
                />
                <button className="send-btn send-blue" onClick={() => sendMessage(2)}>
                  SEND
                </button>
              </div>
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
                {blueTeam.players[0]?.charAt(0) || '2'}
              </div>
              <div className="p-info">
                <div className="p-name">{blueTeam.players[0] || 'Player 2'}</div>
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
