import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/gmSetup.css';

const GmSetup = () => {
  const [keyword, setKeyword] = useState('');
  const [strokeLimit, setStrokeLimit] = useState(30);
  const [timeLimit, setTimeLimit] = useState(60);
  const [toast, setToast] = useState({ active: false, message: '' });
  const [isMuted, setIsMuted] = useState(false);
  const [keywordError, setKeywordError] = useState(false);
  
  const audioEngineRef = useRef(null);
  const inputRefs = useRef([]);

  // Initialize AudioEngine
  useEffect(() => {
    class AudioEngine {
      constructor() {
        this.ctx = null;
        this.musicOsc = null;
        this.musicGain = null;
        this.isMusicPlaying = false;
      }

      init() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      }

      playTone(freq, type, duration, vol = 0.1) {
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

      playHover() { 
        this.playTone(600, 'sine', 0.1, 0.05); 
      }
      
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

      toggleMusic() {
        if (!this.ctx) this.init();
        if (this.isMusicPlaying) {
          if (this.musicGain) {
            this.musicGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
          }
          setTimeout(() => { 
            if (this.musicOsc) { 
              this.musicOsc.stop(); 
              this.musicOsc = null; 
            } 
          }, 500);
          this.isMusicPlaying = false;
          return false;
        } else {
          this.musicOsc = this.ctx.createOscillator();
          this.musicGain = this.ctx.createGain();
          this.musicOsc.type = 'sine';
          this.musicOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
          
          const lfo = this.ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = 0.2;
          
          const lfoGain = this.ctx.createGain();
          lfoGain.gain.value = 50;
          
          lfo.connect(lfoGain);
          lfoGain.connect(this.musicOsc.frequency);
          lfo.start();
          
          this.musicOsc.connect(this.musicGain);
          this.musicGain.connect(this.ctx.destination);
          this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
          this.musicGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
          this.musicOsc.start();
          
          this.isMusicPlaying = true;
          return true;
        }
      }
    }

    audioEngineRef.current = new AudioEngine();

    // Initialize audio context on first user interaction
    const initAudio = () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.init();
      }
      document.body.removeEventListener('click', initAudio);
    };

    document.body.addEventListener('click', initAudio, { once: true });

    return () => {
      document.body.removeEventListener('click', initAudio);
    };
  }, []);

  const showToast = useCallback((message) => {
    setToast({ active: true, message });
    setTimeout(() => {
      setToast({ active: false, message: '' });
    }, 3000);
  }, []);

  const handleKeywordChange = (e) => {
    setKeyword(e.target.value);
    setKeywordError(false);
    if (audioEngineRef.current) {
      audioEngineRef.current.playTyping();
    }
  };

  const handleStrokeChange = (e) => {
    setStrokeLimit(parseInt(e.target.value) || 30);
    if (audioEngineRef.current) {
      audioEngineRef.current.playTyping();
    }
  };

  const handleTimeChange = (e) => {
    setTimeLimit(parseInt(e.target.value) || 60);
    if (audioEngineRef.current) {
      audioEngineRef.current.playTyping();
    }
  };

  const handleToggleMusic = () => {
    if (audioEngineRef.current) {
      const isPlaying = audioEngineRef.current.toggleMusic();
      setIsMuted(!isPlaying);
    }
  };

  const handleMouseEnter = () => {
    if (audioEngineRef.current) {
      audioEngineRef.current.playHover();
    }
  };

  const handleStartGame = () => {
    if (!keyword.trim()) {
      if (audioEngineRef.current) {
        audioEngineRef.current.playError();
      }
      setKeywordError(true);
      showToast("⚠️ Please enter a keyword first!");
      
      // Focus the keyword input
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      
      // Reset error state after 1 second
      setTimeout(() => {
        setKeywordError(false);
      }, 1000);
      
      return;
    }

    if (audioEngineRef.current) {
      audioEngineRef.current.playClick();
    }

    const gameData = { keyword, stroke: strokeLimit, time: timeLimit };
    console.log("GAME CONFIG:", gameData);
    
    showToast("✔️ Setup Complete! Starting...");
    
    setTimeout(() => {
      // window.location.href = 'game.html'; // Implement actual redirect
      console.log("Redirecting...");
    }, 1500);
  };

  return (
    <div className="gm-setup-container">
      {/* Sound Toggle */}
      <div 
        className={`sound-toggle ${isMuted ? 'muted' : ''}`} 
        id="soundToggle" 
        title="Toggle Music"
        onClick={handleToggleMusic}
      >
        <svg viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </div>

      <a href="/index.html" className="back-btn">←</a>

      <section className="card">
        <div className="card-header">
          <h2>GAME SETUP</h2>
        </div>

        <div className="form-row">
          <label htmlFor="keyword">Keyword</label>
          <input 
            type="text" 
            id="keyword" 
            placeholder="e.g. Apple, Tiger" 
            autoComplete="off"
            value={keyword}
            onChange={handleKeywordChange}
            onMouseEnter={handleMouseEnter}
            ref={el => inputRefs.current[0] = el}
            className={keywordError ? 'error' : ''}
          />
        </div>

        <div className="form-row">
          <label htmlFor="strokeLimit">Stroke Limit</label>
          <input 
            type="number" 
            id="strokeLimit" 
            value={strokeLimit}
            onChange={handleStrokeChange}
            onMouseEnter={handleMouseEnter}
            ref={el => inputRefs.current[1] = el}
          />
        </div>

        <div className="form-row">
          <label htmlFor="timeLimit">Time (s)</label>
          <input 
            type="number" 
            id="timeLimit" 
            value={timeLimit}
            onChange={handleTimeChange}
            onMouseEnter={handleMouseEnter}
            ref={el => inputRefs.current[2] = el}
          />
        </div>

        <button 
          className="start-btn" 
          onClick={handleStartGame}
          onMouseEnter={handleMouseEnter}
        >
          START GAME
        </button>
      </section>

      {/* Custom Toast Notification */}
      <div className={`toast-container ${toast.active ? 'active' : ''}`}>
        <span className="toast-icon">★</span>
        <span id="toast-message">{toast.message}</span>
      </div>
    </div>
  );
};

export default GmSetup;
