import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SingleGame.css';

const SingleGame = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const audioEngineRef = useRef(null);
  const gameIntervalRef = useRef(null);
  const shapeStartRef = useRef(null);
  const shapeBaseImageRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const eraserPathRef = useRef([]);
  
  // Game constants
  const MAX_TIME = 60;
  const MAX_STROKES = 30;
  
  // Game state
  const [gameState, setGameState] = useState({
    color: '#2f3542',
    size: 8,
    brush: 'line',
    mode: 'draw',
    timeLeft: MAX_TIME,
    strokesUsed: 0,
    isGameOver: false,
    isPaused: false,
    round: 1,
    maxRounds: 3,
    score: 0
  });

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { type: 'system', text: 'Game Started! Good luck!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  
  // Audio settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  // Mock players data
  const players = [
    { id: 1, name: 'Aye Aye (You)', avatar: 'A', score: 1200, isHost: true, color: 'var(--accent)' },
    { id: 2, name: 'Player 2', avatar: '2', score: 950, isHost: false },
    { id: 3, name: 'Player 3', avatar: '3', score: 800, isHost: false }
  ];

  // ================= AUDIO ENGINE =================
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.musicOsc = null;
      this.musicGain = null;
      this.drawingOsc = null;
      this.drawingGain = null;
      this.isMusicPlaying = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playTone(freq, type, duration, vol = 0.1) {
      if (!soundEnabled) return;
      if (!this.ctx) this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }

    playHover() { this.playTone(600, 'sine', 0.1, 0.05); }
    playClick() { 
      this.playTone(800, 'triangle', 0.1, 0.1); 
      setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 50); 
    }
    playError() { 
      this.playTone(150, 'sawtooth', 0.3, 0.1); 
      setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.1), 100); 
    }
    playTyping() { 
      this.playTone(200 + Math.random() * 100, 'square', 0.05, 0.02); 
    }
    
    playDrawStart() {
      if (!soundEnabled) return;
      if (!this.ctx) this.init(); 
      if (this.drawingOsc) return;
      
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      this.drawingOsc = this.ctx.createBufferSource();
      this.drawingOsc.buffer = buffer;
      this.drawingOsc.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; 
      filter.frequency.value = 800;
      
      this.drawingGain = this.ctx.createGain();
      this.drawingGain.gain.value = 0.05;
      
      this.drawingOsc.connect(filter); 
      filter.connect(this.drawingGain); 
      this.drawingGain.connect(this.ctx.destination);
      this.drawingOsc.start();
    }
    
    playDrawStop() {
      if (this.drawingOsc && this.ctx) {
        const currTime = this.ctx.currentTime;
        this.drawingGain.gain.setValueAtTime(this.drawingGain.gain.value, currTime);
        this.drawingGain.gain.exponentialRampToValueAtTime(0.001, currTime + 0.1);
        this.drawingOsc.stop(currTime + 0.1);
        this.drawingOsc = null;
      }
    }
    
    playClear() {
      if (!soundEnabled) return;
      if (!this.ctx) this.init();
      const bufferSize = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const osc = this.ctx.createBufferSource();
      osc.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    }
    
    playGameOver() {
      if (!soundEnabled) return;
      this.playTone(400, 'sine', 0.4);
      setTimeout(() => this.playTone(300, 'sine', 0.4), 200);
      setTimeout(() => this.playTone(200, 'sine', 0.8), 400);
    }
  }

  // ========== INIT EFFECTS ==========
  // Initialize audio engine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    
    const initAudio = () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.init();
      }
    };
    
    document.body.addEventListener('click', initAudio, { once: true });
    
    return () => {
      document.body.removeEventListener('click', initAudio);
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  });

  // Canvas setup - ဒီမှာ ctx ကို ချိတ်မယ်
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Canvas clear လုပ်ပြီး background ပြန်ဖြည့်
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      renderStrokes();
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Game timer
  useEffect(() => {
    gameIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft > 0 && !prev.isPaused && !prev.isGameOver) {
          const newTimeLeft = prev.timeLeft - 1;
          return { ...prev, timeLeft: newTimeLeft };
        } else if (prev.timeLeft <= 0 && !prev.isGameOver) {
          clearInterval(gameIntervalRef.current);
          audioEngineRef.current?.playGameOver();
          setShowMessage(true);
          setMessage("TIME'S UP!");
          return { ...prev, isGameOver: true };
        }
        return prev;
      });
    }, 1000);
    
    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, []);

  // Message timeout
  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showMessage]);

  // Button hover sounds
  useEffect(() => {
    const buttons = document.querySelectorAll('button');
    const handleMouseEnter = () => audioEngineRef.current?.playHover();
    
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', handleMouseEnter);
    });
    
    return () => {
      buttons.forEach(btn => {
        btn.removeEventListener('mouseenter', handleMouseEnter);
      });
    };
  }, []);

  // ========== DRAWING FUNCTIONS ==========
  const drawStroke = useCallback((ctx, stroke) => {
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
  }, []);

  const renderStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((s) => drawStroke(ctx, s));
  }, [drawStroke]);

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

  const eraseAt = useCallback((point, radius) => {
    strokesRef.current = strokesRef.current.filter((s) => !hitStroke(s, point, radius));
    renderStrokes();
  }, [renderStrokes]);
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
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
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault?.();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setGameState(prev => {
      if (prev.isGameOver || prev.isPaused) return prev;
      if (prev.strokesUsed >= MAX_STROKES) {
        audioEngineRef.current?.playError();
        setShowMessage(true);
        setMessage("OUT OF INK!");
        return prev;
      }
      
      const newStrokes = prev.mode === 'erase' ? prev.strokesUsed : prev.strokesUsed + 1;
      setIsDrawing(true);
      audioEngineRef.current?.playDrawStart();
      
      const { x, y } = getCanvasCoordinates(e);

      ctx.beginPath();
      ctx.lineWidth = prev.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (prev.mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = prev.color;
        ctx.fillStyle = prev.color;
      }

      if (prev.mode === 'erase') {
        shapeStartRef.current = null;
        shapeBaseImageRef.current = null;
        ctx.beginPath();
        ctx.moveTo(x, y);
        eraserPathRef.current = [{ x, y }];
      } else if (prev.mode === 'draw' && (prev.brush === 'line' || prev.brush === 'circle')) {
        currentStrokeRef.current = {
          type: prev.brush,
          color: prev.color,
          size: prev.size,
          start: { x, y },
          end: { x, y },
          center: { x, y },
          radius: 0
        };
      } else if (prev.brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, prev.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y);
        currentStrokeRef.current = {
          type: 'free',
          color: prev.color,
          size: prev.size,
          points: [{ x, y }]
        };
      }
      
      return { ...prev, strokesUsed: newStrokes };
    });
  }, [getCanvasCoordinates]);

  const draw = useCallback((e) => {
    e.preventDefault?.();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setGameState(prev => {
      if (prev.isGameOver || prev.isPaused) return prev;
      
      const { x, y } = getCanvasCoordinates(e);

      if (prev.mode === 'erase') {
        const eraserRadius = Math.max(6, prev.size * 1.5);
        eraserPathRef.current.push({ x, y });
        eraseAt({ x, y }, eraserRadius);
      } else if (prev.mode === 'draw' && (prev.brush === 'line' || prev.brush === 'circle')) {
        const stroke = currentStrokeRef.current;
        if (stroke) {
          stroke.end = { x, y };
          if (stroke.type === 'circle') {
            const dx = x - stroke.start.x;
            const dy = y - stroke.start.y;
            stroke.center = { x: stroke.start.x, y: stroke.start.y };
            stroke.radius = Math.sqrt(dx * dx + dy * dy);
          }
          renderStrokes();
          const previewCtx = canvas.getContext('2d');
          drawStroke(previewCtx, stroke);
        }
      } else if (prev.brush === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, prev.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const stroke = currentStrokeRef.current;
        if (stroke && stroke.type === 'free') {
          stroke.points.push({ x, y });
          renderStrokes();
          const previewCtx = canvas.getContext('2d');
          drawStroke(previewCtx, stroke);
        }
      }
      
      return prev;
    });
  }, [isDrawing, getCanvasCoordinates, drawStroke, renderStrokes, eraseAt]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    audioEngineRef.current?.playDrawStop();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (gameState.mode === 'draw') {
        const stroke = currentStrokeRef.current;
        if (stroke) {
          strokesRef.current.push(stroke);
          currentStrokeRef.current = null;
          renderStrokes();
        }
      }
      ctx.closePath();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [gameState.mode, renderStrokes]);

  // Canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  // ========== TOOL FUNCTIONS ==========
  const setTool = (type, value, el) => {
    setGameState(prev => {
      if (prev.strokesUsed >= MAX_STROKES || prev.isPaused) return prev;
      
      audioEngineRef.current?.playClick();
      
      if (type === 'size') {
        return { ...prev, mode: 'draw', size: value };
      }
      if (type === 'brush') {
        return { ...prev, mode: 'draw', brush: value };
      }
      if (type === 'color') {
        return { ...prev, mode: 'draw', color: value };
      }
      return prev;
    });
  };

  const useEraser = () => {
    setGameState(prev => {
      if (prev.strokesUsed >= MAX_STROKES || prev.isPaused) return prev;
      audioEngineRef.current?.playClick();
      return { ...prev, mode: 'erase' };
    });
  };

  const clearCanvas = () => {
    setGameState(prev => {
      if (prev.isPaused) return prev;
      
      audioEngineRef.current?.playClear();
      strokesRef.current = [];
      currentStrokeRef.current = null;
      renderStrokes();
      
      return prev;
    });
  };

  // ========== CHAT FUNCTIONS ==========
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [
      ...prev,
      { type: 'user', text: chatInput }
    ]);
    
    setChatInput('');
    audioEngineRef.current?.playClick();
  };

  // ========== MODAL FUNCTIONS ==========
  const openExitMenu = () => {
    setGameState(prev => ({ ...prev, isPaused: true }));
    setShowExitModal(true);
  };

  const openSettings = () => {
    setGameState(prev => ({ ...prev, isPaused: true }));
    setShowSettingsModal(true);
  };

  const closeModal = () => {
    setShowExitModal(false);
    setShowSettingsModal(false);
    setGameState(prev => ({ ...prev, isPaused: false }));
  };

  const exitToMenu = () => {
    navigate('/');
  };

  // ========== UI CALCULATIONS ==========
  const strokePercentage = (gameState.strokesUsed / MAX_STROKES) * 100;
  const timePercentage = (gameState.timeLeft / MAX_TIME) * 100;
  
  const getStrokeBarColor = () => {
    if (strokePercentage > 80) return '#ef4444';
    if (strokePercentage > 50) return '#facc15';
    return '#6d4aff';
  };

  const getTimerColor = () => {
    return gameState.timeLeft <= 10 ? '#ef4444' : '#f97316';
  };

  // ========== RENDER ==========
  return (
    <div className="game-wrapper">
      {/* Header with Icons */}
      <header className="top-bar">
        {/* Left: Settings + Data */}
        <div className="left-group">
          {/* Settings Icon */}
          <button className="icon-btn" onClick={openSettings} title="Settings">
            <svg viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>

          <div className="data-item">
            <span className="data-label">Round</span>
            <span className="data-value">{gameState.round}/{gameState.maxRounds}</span>
          </div>

          <div className="data-item">
            <span className="data-label">Ink</span>
            <span className="data-value stroke">{gameState.strokesUsed}</span>
            <div className="data-bar-bg">
              <div 
                className="data-bar-fill stroke" 
                style={{ 
                  width: `${strokePercentage}%`,
                  background: getStrokeBarColor()
                }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Center: Timer */}
        <div className="center-group">
          <div className="timer-box" style={{ color: getTimerColor() }}>
            {gameState.timeLeft}
          </div>
          <div className="data-bar-bg" style={{ width: '100px' }}>
            <div 
              className="data-bar-fill time" 
              style={{ 
                width: `${timePercentage}%`,
                background: getTimerColor()
              }}
            ></div>
          </div>
        </div>
        
        {/* Right: Score + Exit */}
        <div className="right-group">
          <div className="data-item">
            <span className="data-label">Score</span>
            <span className="data-value score">{gameState.score}</span>
          </div>

          {/* Exit Icon */}
          <button 
            className="icon-btn exit-btn" 
            onClick={openExitMenu} 
            title="Exit / Pause"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Game Container */}
      <div className="game-container">
        
        <div className="canvas-area">
          <canvas ref={canvasRef} id="canvasMain"></canvas>
          {showMessage && (
            <div className="overlay-msg" id="gameMsg">
              {message}
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="panel-card tools-card">
            <div className="tools-row">
              <span className="tools-label">Color</span>
              <div className="color-grid">
                {['#2f3542', '#ff4757', '#2e86de', '#2ed573', '#ffa502'].map(color => (
                  <div 
                    key={color}
                    className={`color-btn ${gameState.color === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={(e) => setTool('color', color, e.target)}
                  ></div>
                ))}
              </div>
            </div>
            
            <div className="tools-row">
              <span className="tools-label">Size</span>
              <div className="brush-stack">
                {[3, 8, 15].map(size => (
                  <div 
                    key={size}
                    className={`brush-btn ${gameState.size === size ? 'active' : ''}`}
                    onClick={(e) => setTool('size', size, e.target)}
                  >
                    <div 
                      className="dot" 
                      style={{ 
                        width: size === 3 ? '3px' : size === 8 ? '6px' : '10px',
                        height: size === 3 ? '3px' : size === 8 ? '6px' : '10px'
                      }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tools-row">
              <span className="tools-label">Brush</span>
              <div className="brush-type-group">
                <button
                  className={`brush-type-btn ${gameState.brush === 'line' ? 'active' : ''}`}
                  onClick={() => setTool('brush', 'line')}
                >
                  Line
                </button>
                <button
                  className={`brush-type-btn ${gameState.brush === 'circle' ? 'active' : ''}`}
                  onClick={() => setTool('brush', 'circle')}
                >
                  Circle
                </button>
              </div>
            </div>
            
            <div className="tools-row" style={{ justifyContent: 'flex-end', marginTop: '5px' }}>
              <div className="action-group">
                <button 
                  className={`action-btn ${gameState.mode === 'erase' ? 'active-eraser' : ''}`}
                  onClick={useEraser}
                  title="Eraser"
                >
                  🧽
                </button>
                <button 
                  className="action-btn"
                  onClick={clearCanvas}
                  title="Clear"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div className="panel-card chat-card">
            <div className="chat-log-container" id="chatLog">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`msg ${msg.type === 'system' ? 'system' : ''}`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="input-area">
              <input 
                type="text" 
                className="guess-box" 
                placeholder="Type guess..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') sendMessage();
                  audioEngineRef.current?.playTyping();
                }}
              />
              <button className="send-btn" onClick={sendMessage}>SEND</button>
            </div>
          </div>
        </aside>
      </div>

      {/* ================= MODALS ================= */}

      {/* Exit / Pause Menu */}
      {showExitModal && (
        <div className="modal-overlay active" id="exitModal">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">GAME PAUSED</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Current Round Summary</p>
            </div>
            <div className="player-list-exit">
              {players.map((player) => (
                <div key={player.id} className="player-row">
                  <div 
                    className="p-avatar" 
                    style={player.color ? { background: player.color } : {}}
                  >
                    {player.avatar}
                  </div>
                  <div className="p-info">
                    <div className="p-name">{player.name}</div>
                    <div className="p-score">Score: {player.score}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-modal btn-resume" onClick={closeModal}>
                RESUME GAME
              </button>
              <button className="btn-modal btn-exit" onClick={exitToMenu}>
                EXIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      {showSettingsModal && (
        <div className="modal-overlay active" id="settingsModal">
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
              <button className="btn-modal btn-resume" onClick={closeModal}>
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleGame;
