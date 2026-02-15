import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRoomWSContext } from "../ws/RoomWSContext";
import '../styles/BattleRoundWin.css';

const BattleRoundWin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { ws } = useRoomWSContext();
  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const game = snapshot.game || {};
  const players = snapshot.players || [];
  const myPid = ws.pid || sessionStorage.getItem('dg_pid');
  const me = players.find((p) => p.pid === myPid) || {};
  const canVote = room.state === 'ROUND_END' && game.phase === 'VOTING' && !!me.team;

  const {
    round = room.round_no || 1,
    totalRounds = 5,
    isWin = !!game.winner_team,
    word = (snapshot.round_config?.secret_word || '').toUpperCase(),
    winner = {
      name: players.find((p) => p.pid === (game.winner_pid || ''))?.name || (game.winner_team || ''),
      avatar: game.winner_team || '',
      points: 0,
    },
    nextRoundDelay = 5,
  } = location.state || {};

  const [countdown, setCountdown] = useState(nextRoundDelay);
  const [timerWidth, setTimerWidth] = useState(100);
  const [viewState, setViewState] = useState(isWin ? 'win' : 'lose');
  const [voted, setVoted] = useState(false);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (canVote) return;
    setCountdown(nextRoundDelay);
    setTimerWidth(100);

    const timerInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          handleNextRound();
          return 0;
        }
        return prev - 1;
      });

      setTimerWidth((prev) => {
        const newWidth = prev - (100 / nextRoundDelay);
        return newWidth < 0 ? 0 : newWidth;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [nextRoundDelay, viewState, canVote]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === 'error') setLastError(m);

    if (m.type === 'room_state_changed') {
      if (m.state === 'ROLE_PICK') navigate('/role-pick');
      if (m.state === 'CONFIG') navigate('/waiting-room');
    }

    if (m.type === 'round_end') {
      const hasWinner = !!m.winner;
      setViewState(hasWinner ? 'win' : 'lose');
      setVoted(false);
    }
  }, [ws.lastMsg, navigate]);

  useEffect(() => {
    if (canVote) {
      setVoted(false);
      setLastError(null);
    }
  }, [canVote]);

  const handleNextRound = () => {
    if (room.state === 'ROLE_PICK') {
      navigate('/role-pick');
      return;
    }
    navigate('/waiting-room');
  };

  const switchView = (state) => {
    setViewState(state);
    setCountdown(nextRoundDelay);
    setTimerWidth(100);
  };

  const handleContinue = () => {
    handleNextRound();
  };

  const submitVote = (vote) => {
    if (!canVote || voted) return;
    setLastError(null);
    ws.send({ type: 'vote_next', vote });
    setVoted(true);
  };

  return (
    <div className="battle-round-win-body">
      <div className="result-modal">
        <div className="round-tag">
          Round {round} / {totalRounds}
        </div>

        <div id="state-win" className={viewState === 'win' ? '' : 'hidden'}>
          <div className="result-icon">WIN</div>
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

        <div id="state-lose" className={viewState === 'lose' ? '' : 'hidden'}>
          <div className="result-icon">TIME</div>
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

        {canVote ? (
          <div className="timer-container">
            <div className="timer-text" style={{ marginBottom: '10px' }}>Vote for next round</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => submitVote('yes')}
                disabled={voted}
                style={{
                  background: '#2ed573',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '50px',
                  fontFamily: 'Bitcount Single, monospace',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: voted ? 'default' : 'pointer',
                  border: '2px solid white',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Vote YES
              </button>
              <button
                onClick={() => submitVote('no')}
                disabled={voted}
                style={{
                  background: '#ff4757',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '50px',
                  fontFamily: 'Bitcount Single, monospace',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: voted ? 'default' : 'pointer',
                  border: '2px solid white',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Vote NO
              </button>
            </div>
            {voted && <div className="timer-text" style={{ marginTop: '10px' }}>Vote sent. Waiting for others...</div>}
            {lastError && <div className="timer-text" style={{ marginTop: '8px', color: '#ff6b81' }}>{lastError.code}: {lastError.message}</div>}
          </div>
        ) : (
          <>
            <div className="timer-container">
              <div className="timer-bar">
                <div
                  className="timer-fill"
                  style={{
                    width: `${timerWidth}%`,
                    transition: 'width 1s linear',
                  }}
                ></div>
              </div>
              <div className="timer-text">
                Next round starts in: <span id="countdown">{countdown}</span>s
              </div>
            </div>

            <button
              onClick={handleContinue}
              style={{
                background: 'var(--primary)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '50px',
                fontFamily: 'Bitcount Single, monospace',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '10px',
                border: '2px solid white',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Continue {'->'}
            </button>
          </>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div
          className="demo-controls"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 100,
            display: 'flex',
            gap: '10px',
          }}
        >
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
              cursor: 'pointer',
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
              cursor: 'pointer',
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
