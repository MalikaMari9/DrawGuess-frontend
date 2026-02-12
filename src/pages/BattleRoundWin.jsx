import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/BattleRoundWin.css';

const BattleRoundWin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State ကို props ကနေလက်ခံမယ်
  const {
    round = 2,
    totalRounds = 5,
    isWin = true,
    word = isWin ? 'PIZZA' : 'QUANTUM PHYSICS',
    winner = {
      name: 'Alex',
      avatar: 'A',
      points: 150
    },
    nextRoundDelay = 5
  } = location.state || {};

  const [countdown, setCountdown] = useState(nextRoundDelay);
  const [timerWidth, setTimerWidth] = useState(100);
  const [viewState, setViewState] = useState(isWin ? 'win' : 'lose');

  // Countdown Timer Effect
  useEffect(() => {
    setCountdown(nextRoundDelay);
    setTimerWidth(100);

    const timerInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          // Countdown ပြီးရင် နောက် round ကိုသွားမယ်
          handleNextRound();
          return 0;
        }
        return prev - 1;
      });
      
      // Timer bar width ကို update လုပ်မယ်
      setTimerWidth((prev) => {
        const newWidth = prev - (100 / nextRoundDelay);
        return newWidth < 0 ? 0 : newWidth;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [nextRoundDelay, viewState]);

  // နောက် Round ကိုသွားမယ်
  const handleNextRound = () => {
    // TODO: နောက် round အတွက် navigation logic
    console.log('Starting next round...');
    // navigate('/battle-game', { 
    //   state: { 
    //     round: round + 1,
    //     totalRounds 
    //   } 
    // });
  };

  // View State ကိုပြောင်းမယ် (Win/Lose)
  const switchView = (state) => {
    setViewState(state);
    // Reset timer
    setCountdown(nextRoundDelay);
    setTimerWidth(100);
  };

  // Continue Button Handler
  const handleContinue = () => {
    handleNextRound();
  };

  return (
    <div className="battle-round-win-body">
      {/* Main Modal */}
      <div className="result-modal">
        {/* Round Tag */}
        <div className="round-tag">
          Round {round} / {totalRounds}
        </div>

        {/* State 1: WIN */}
        <div id="state-win" className={viewState === 'win' ? '' : 'hidden'}>
          <div className="result-icon">🎉</div>
          <h2 className="result-title color-win">Round Won!</h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{word}</div>
          </div>

          <div className="winner-section">
            <div className="winner-avatar">{winner.avatar}</div>
            <div className="winner-info">
              <span className="winner-name">{winner.name}</span>
              <span className="points-gained">+{winner.points} Points</span>
            </div>
          </div>
        </div>

        {/* State 2: NO WINNER / LOSE */}
        <div id="state-lose" className={viewState === 'lose' ? '' : 'hidden'}>
          <div className="result-icon">⏰</div>
          <h2 className="result-title color-lose">Time's Up!</h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{word}</div>
          </div>

          <div className="winner-section no-winner-section">
            <div className="winner-avatar no-winner-avatar">?</div>
            <div className="winner-info">
              <span className="winner-name no-winner-name">No Winner</span>
              <span className="points-gained no-winner-points">+0 Points</span>
            </div>
          </div>
        </div>

        {/* Timer for Next Round */}
        <div className="timer-container">
          <div className="timer-bar">
            <div 
              className="timer-fill" 
              style={{ 
                width: `${timerWidth}%`,
                transition: 'width 1s linear'
              }}
            ></div>
          </div>
          <div className="timer-text">
            Next round starts in: <span id="countdown">{countdown}</span>s
          </div>
        </div>

        {/* Manual Continue Button (Optional) */}
        <button 
          onClick={handleContinue}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '50px',
            fontFamily: 'Bitcount Single, monospace',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '10px',
            border: '2px solid white',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Continue →
        </button>
      </div>

      {/* Demo Controls - Development အတွက်သာ */}
      {process.env.NODE_ENV === 'development' && (
        <div className="demo-controls" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 100,
          display: 'flex',
          gap: '10px'
        }}>
          <button
            className="demo-btn"
            onClick={() => switchView('win')}
            style={{
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'sans-serif',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Show: Win
          </button>
          <button
            className="demo-btn"
            onClick={() => switchView('lose')}
            style={{
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'sans-serif',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Show: No Winner
          </button>
        </div>
      )}
    </div>
  );
};

export default BattleRoundWin;
