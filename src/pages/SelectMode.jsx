import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from "react-router-dom";
import "../styles/SelectMode.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const SelectMode = () => {
  const { ws, nickname, createRoom } = useRoomWSContext();
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const navigate = useNavigate();
  
  const audioContextRef = useRef(null);
  const musicOscRef = useRef(null);
  const musicGainRef = useRef(null);

  // Initialize Audio Context on first user interaction
  useEffect(() => {
    const initializeAudio = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    };

    document.body.addEventListener('click', initializeAudio, { once: true });

    return () => {
      document.body.removeEventListener('click', initializeAudio);
    };
  }, []);

  // Audio Engine Functions
  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playTone = (freq, type, duration, vol = 0.1) => {
    initAudio();
    const ctx = audioContextRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playHover = () => {
    playTone(600, 'sine', 0.1, 0.05);
  };

  const playClick = () => {
    playTone(800, 'triangle', 0.1, 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.2, 0.1), 50);
  };

  const toggleMusic = () => {
    initAudio();
    const ctx = audioContextRef.current;
    
    if (isMusicPlaying) {
      // Stop Music
      if (musicGainRef.current) {
        musicGainRef.current.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + 0.5
        );
      }
      setTimeout(() => {
        if (musicOscRef.current) {
          musicOscRef.current.stop();
          musicOscRef.current = null;
        }
      }, 500);
      setIsMusicPlaying(false);
    } else {
      // Start Music (Ambient Drone)
      musicOscRef.current = ctx.createOscillator();
      musicGainRef.current = ctx.createGain();
      
      // Create a deep drone
      musicOscRef.current.type = 'sine';
      musicOscRef.current.frequency.setValueAtTime(55, ctx.currentTime);
      
      // Add some modulation for "space" feel
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 50;
      
      lfo.connect(lfoGain);
      lfoGain.connect(musicOscRef.current.frequency);
      lfo.start();

      musicOscRef.current.connect(musicGainRef.current);
      musicGainRef.current.connect(ctx.destination);
      
      musicGainRef.current.gain.setValueAtTime(0, ctx.currentTime);
      musicGainRef.current.gain.linearRampToValueAtTime(
        0.05,
        ctx.currentTime + 2
      );
      
      musicOscRef.current.start();
      setIsMusicPlaying(true);
    }
  };

  const startCreate = async (mode) => {
    if (!nickname || !nickname.trim()) {
      navigate("/");
      return;
    }
    playClick();
    setIsCreating(true);
    setPendingMode(mode);
    const code = await createRoom(mode, 8);
    if (!code) {
      setIsCreating(false);
      setPendingMode(null);
      return;
    }
    const ok = await ws.connectWaitOpen(code);
    if (!ok) {
      setIsCreating(false);
      setPendingMode(null);
      return;
    }
    ws.send({ type: 'join', name: nickname.trim() });
    ws.send({ type: 'snapshot' });
    setIsCreating(false);
    setPendingMode(null);
    navigate(mode === "VS" ? "/battle-lobby" : "/single-lobby");
  };

  // Mode selection functions
  const handleSingleMode = () => startCreate("SINGLE");
  const handleBattleMode = () => startCreate("VS");


  return (
    <div className="select-mode">
      {/* Sound Toggle Button */}
      <div 
        className={`sound-toggle ${isMusicPlaying ? '' : 'muted'}`}
        onClick={toggleMusic}
        title="Toggle Music"
      >
        <svg viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </div>

      {/* Back Button */}
      <Link 
        to="/" 
        className="back-btn"
        onMouseEnter={playHover}
        onClick={playClick}
      >
        ←
      </Link>

      {/* Main Content */}
      <div className="select-card">
        <h1>Select Game Mode</h1>
        
        {/* Single Mode Button */}
        <button 
          className="play-btn" 
          onClick={handleSingleMode}
          onMouseEnter={playHover}
          disabled={isCreating}
        >
           {isCreating && pendingMode === 'SINGLE' ? 'Creating...' : 'Single Mode'}
        </button>
        
        {/* Battle Mode Button */}
        <button 
          className="play-btn battle-btn" 
          onClick={handleBattleMode}
          onMouseEnter={playHover}
          disabled={isCreating}
        >
           {isCreating && pendingMode === 'VS' ? 'Creating...' : 'Battle Mode'}
        </button>
      </div>
    </div>
  );
};

export default SelectMode;
