import React, { useEffect, useRef, useState } from "react";
import "../styles/landingpage.css";
import { useNavigate } from "react-router-dom";
import { useRoomWSContext } from "../ws/RoomWSContext";

const LandingPage = () => {
  const { ws, nickname, setNickname } = useRoomWSContext();
  const [roomCode, setRoomCode] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  
  const audioContextRef = useRef(null);
  const musicOscRef = useRef(null);
  const musicGainRef = useRef(null);
  
  const navigate = useNavigate(); // ✅ useNavigate ကို သုံးပါ

  // Audio Engine Functions
  const initAudio = async () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return false;
      }
    }
    setAudioUnlocked(true);
    return true;
  };

  const playTone = async (freq, type, duration, vol = 0.1) => {
    if (!audioUnlocked) return;
    const ok = await initAudio();
    if (!ok) return;
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
    playTone(600, "sine", 0.1, 0.05);
  };

  const playClick = () => {
    playTone(800, "triangle", 0.1, 0.1);
    setTimeout(() => playTone(1200, "sine", 0.2, 0.1), 50);
  };

  const playTyping = () => {
    playTone(200 + Math.random() * 100, "square", 0.05, 0.02);
  };

  const playError = () => {
    playTone(150, "sawtooth", 0.3, 0.1);
    setTimeout(() => playTone(100, "sawtooth", 0.3, 0.1), 100);
  };

  const toggleMusic = async () => {
    const ok = await initAudio();
    if (!ok) return;
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
      musicOscRef.current.type = "sine";
      musicOscRef.current.frequency.setValueAtTime(55, ctx.currentTime);
      
      // Add some modulation for "space" feel
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
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

  // Handle nickname input change
  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
    playTyping();
  };

  // Handle play button click
  const handlePlay = () => {
    if (!nickname.trim()) {
      playError();
      setShowToast(true);
      
      setTimeout(() => {
        setShowToast(false);
      }, 2000);
      return;
    }

    playClick();
    setIsLoading(true);
    
    // Save nickname to localStorage or context for later use
    localStorage.setItem('playerNickname', nickname);
    
    // Navigate to select mode after loading
    setTimeout(() => {
      setIsLoading(false);
      navigate('/select-mode'); // ✅ Navigate to select mode
    }, 1000);
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      playError();
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 2000);
      return;
    }
    if (!roomCode.trim()) return;

    playClick();
    setIsLoading(true);
    const code = roomCode.trim().toUpperCase();
    const ok = await ws.connectWaitOpen(code);
    if (!ok) {
      setIsLoading(false);
      return;
    }
    ws.send({ type: 'join', name: nickname.trim() });
    ws.send({ type: 'snapshot' });
    setJoinPending(true);
  };

  useEffect(() => {
    if (!joinPending) return;
    const m = ws.lastMsg;
    if (!m) return;
    if (m.type === 'room_snapshot') {
      const mode = m.room?.mode || 'SINGLE';
      setJoinPending(false);
      setIsLoading(false);
      navigate(mode === 'VS' ? '/battle-lobby' : '/single-lobby');
    }
    if (m.type === 'error') {
      setJoinPending(false);
      setIsLoading(false);
    }
  }, [joinPending, ws.lastMsg, navigate]);

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePlay();
    }
  };

  return (
    <div className="landing-page">
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

      {/* Welcome Section */}
      <section className="welcome">
        <div className="welcome-content">
          <h1 className="title-main">Draw n' Guess</h1>
          <h2 className="title-sub">Draw. Guess. Win — in real time.</h2>
          
          <input
            type="text"
            placeholder="Enter nickname"
            className="nickname"
            value={nickname}
            onChange={handleNicknameChange}
            onKeyPress={handleKeyPress}
          />

          <button
            className="play-btn"
            onClick={handlePlay}
            onMouseEnter={playHover}
            disabled={isLoading}
          >
            {isLoading ? "LOADING..." : "PLAY NOW"}
          </button>

          <div className="join-divider">
            <span>Have a room code?</span>
          </div>

          <div className="join-row">
            <input
              type="text"
              placeholder="Room code"
              className="room-code-input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button
              className="play-btn secondary-btn"
              onClick={handleJoin}
              onMouseEnter={playHover}
              disabled={isLoading || !roomCode.trim()}
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      </section>

      {/* Toast Notification */}
      <div className={`toast ${showToast ? 'show' : ''}`}>
        Please enter a nickname!
      </div>
    </div>
  );
};

export default LandingPage;
