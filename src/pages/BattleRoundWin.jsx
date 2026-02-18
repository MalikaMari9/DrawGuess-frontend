
import { useEffect, useMemo, useRef, useState } from "react";
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
  const myPid = ws.pid || localStorage.getItem('dg_pid');
  const me = players.find((p) => p.pid === myPid) || {};
  const myTeam = me.team || null;
  const isGM = (me.role || "") === "gm" || (room.gm_pid && myPid && room.gm_pid === myPid);
  const canVote = room.state === 'GAME_END' && game.phase === 'VOTING';

  const initialState = location.state || {};
  const [endWord, setEndWord] = useState(initialState.word || "");
  const [endReason, setEndReason] = useState(initialState.reason || "");

  const round = initialState.round ?? room.round_no ?? 1;
  const totalRounds = initialState.totalRounds ?? snapshot.round_config?.max_rounds ?? 5;
  const winnerTeam = initialState.winner?.avatar || game.winner_team || "";
  const hasWinner = Boolean(winnerTeam);
  const word = ((endWord || snapshot.round_config?.secret_word || "") + "").toUpperCase();
  const winner = {
    name:
      initialState.winner?.name ||
      (winnerTeam === "A" ? "Red Team" : winnerTeam === "B" ? "Blue Team" : winnerTeam || ""),
    avatar: winnerTeam,
    pointsDelta: winnerTeam ? 1 : 0,
  };
  const [viewState, setViewState] = useState("neutral"); // win | lose | neutral
  const [voted, setVoted] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [payoutActive, setPayoutActive] = useState(false);
  const [payoutShowTotals, setPayoutShowTotals] = useState(false);
  const [payoutFromY, setPayoutFromY] = useState(-14);
  const payoutOriginRef = useRef(null);
  const payoutChipsRef = useRef(null);
  const [voteRemaining, setVoteRemaining] = useState(null);
  const [voteStats, setVoteStats] = useState(null); // from server vote_progress

  const eligibleCount = useMemo(
    () => (players || []).filter((p) => p?.connected !== false).length,
    [players],
  );
  const votesNext = game.votes_next || {};
  const votedCount = useMemo(() => Object.keys(votesNext || {}).length, [votesNext]);
  const yesCount = useMemo(
    () => Object.values(votesNext || {}).filter((v) => v === "yes").length,
    [votesNext],
  );
  const effectiveEligible = voteStats?.eligible ?? eligibleCount;
  const effectiveYes = voteStats?.yes_count ?? yesCount;
  const effectiveVoted = voteStats?.voted_count ?? votedCount;

  const winners = useMemo(() => {
    if (!winnerTeam) return [];
    return (players || [])
      .filter((p) => {
        if (p?.connected === false) return false;
        const team =
          p?.team ||
          (typeof p?.role === "string" && p.role.endsWith("A")
            ? "A"
            : typeof p?.role === "string" && p.role.endsWith("B")
            ? "B"
            : null);
        return team === winnerTeam;
      })
      .map((p) => ({
        pid: p.pid,
        name: p.name || "Unknown",
        newPoints: Number(p.points ?? 0),
      }));
  }, [players, winnerTeam]);

  useEffect(() => {
    if (!winnerTeam) {
      setPayoutActive(false);
      setPayoutShowTotals(false);
      return;
    }
    if (room.state !== "GAME_END") {
      setPayoutActive(false);
      setPayoutShowTotals(false);
      return;
    }
    // Let the main result animation settle, then run the payout.
    setPayoutActive(false);
    setPayoutShowTotals(false);

    // Compute slide distance so the chips appear to originate from the winner block.
    // Chips render in the bottom payout area; we offset them upward, then slide down to 0.
    setPayoutFromY(-14);
    const raf = requestAnimationFrame(() => {
      const originEl = payoutOriginRef.current;
      const chipsEl = payoutChipsRef.current;
      if (!originEl || !chipsEl) return;
      const o = originEl.getBoundingClientRect();
      const c = chipsEl.getBoundingClientRect();
      const dy = c.top - o.top;
      if (dy > 0) setPayoutFromY(-Math.round(dy));
    });

    const t1 = setTimeout(() => setPayoutActive(true), 650);
    const t2 = setTimeout(() => setPayoutShowTotals(true), 1150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [winnerTeam, room.state]);

  useEffect(() => {
    if (!hasWinner) {
      setViewState("lose");
      return;
    }
    if (isGM || !myTeam) {
      setViewState("neutral");
      return;
    }
    setViewState(myTeam === winnerTeam ? "win" : "lose");
  }, [hasWinner, isGM, myTeam, winnerTeam]);

  useEffect(() => {
    // Ensure we have a fresh snapshot so canVote/votes are consistent across clients.
    if (ws.status === "CONNECTED") ws.send({ type: "snapshot" });
  }, [ws.status, ws.send]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === 'error') setLastError(m);

    if (m.type === 'room_state_changed') {
      if (m.state === 'ROLE_PICK') navigate('/role-pick');
      if (m.state === 'CONFIG') navigate('/waiting-room');
      if (m.state === 'WAITING') navigate('/battle-lobby');
    }

    if (m.type === 'game_end') {
      const wt = m.winner || "";
      if (!wt) {
        setViewState("lose");
      } else if (isGM || !myTeam) {
        setViewState("neutral");
      } else {
        setViewState(myTeam === wt ? "win" : "lose");
      }
      setVoted(false);
      if (typeof m.word === 'string') setEndWord(m.word);
      if (typeof m.reason === 'string') setEndReason(m.reason);
      ws.send({ type: "snapshot" });
    }

    if (m.type === "vote_resolved") {
      if (m.outcome === "NO") navigate("/battle-win");
      // outcome YES: server will reset to WAITING shortly; we already handle state-change / snapshot nav.
    }

    if (m.type === "vote_progress") {
      setVoteStats({
        ts: Number(m.ts || 0),
        vote_end_at: Number(m.vote_end_at || 0),
        yes_count: Number(m.yes_count || 0),
        voted_count: Number(m.voted_count || 0),
        eligible: Number(m.eligible || 0),
      });
    }
  }, [ws.lastMsg, navigate, ws.send, isGM, myTeam]);

  useEffect(() => {
    // Snapshot-driven nav (in case state-change event is missed due to batching).
    if (room.state === 'WAITING') navigate('/battle-lobby');
    if (room.state === 'CONFIG') navigate('/waiting-room');
    if (room.state === 'ROLE_PICK') navigate('/role-pick');
  }, [room.state, navigate]);

  useEffect(() => {
    // Vote window resolved to NO-majority -> FINAL leaderboard (supports refresh).
    if (room.state === "GAME_END" && (game.phase === "FINAL" || game.vote_outcome === "NO")) {
      navigate("/battle-win");
    }
  }, [room.state, game.phase, game.vote_outcome, navigate]);

  useEffect(() => {
    if (!myPid) return;
    const votes = game.votes_next || {};
    setVoted(Boolean(votes && votes[myPid]));
  }, [game.votes_next, myPid]);

  useEffect(() => {
    if (!canVote) {
      setVoteRemaining(null);
      setVoteStats(null);
      return;
    }

    const voteEndAt = Number(game.vote_end_at || 0);
    const serverTs = Number(snapshot.server_ts || 0);
    const drift = serverTs ? Date.now() / 1000 - serverTs : 0;

    const update = () => {
      const serverNow = Math.floor(Date.now() / 1000 - drift);
      const rem = Math.max(0, voteEndAt - serverNow);
      setVoteRemaining(rem);
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [canVote, game.vote_end_at, snapshot.server_ts]);

  const submitVote = (vote) => {
    if (!canVote || voted) return;
    if (voteRemaining !== null && voteRemaining <= 0) return;
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

        {winnerTeam && <span ref={payoutOriginRef} className="payout__origin" />}

        <div id="state-win" className={viewState === 'win' ? '' : 'hidden'}>
          <div className="result-icon">WIN</div>
          <h2 className="result-title color-win">You Win!</h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{word}</div>
          </div>

          <div className="winner-section">
            <div className="winner-avatar">{winner.avatar}</div>
            <div className="winner-info">
              <span className="winner-name">{winner.name}</span>
              <span className="points-gained">+{winner.pointsDelta} point {winner.name}</span>
            </div>
          </div>
        </div>

        <div id="state-neutral" className={viewState === 'neutral' ? '' : 'hidden'}>
          <div className="result-icon">WIN</div>
          <h2 className="result-title color-win">{winner.name ? `${winner.name} Won!` : "Game Ended"}</h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{word}</div>
          </div>

          {winnerTeam ? (
            <div className="winner-section">
              <div className="winner-avatar">{winner.avatar}</div>
              <div className="winner-info">
                <span className="winner-name">{winner.name}</span>
                <span className="points-gained">+{winner.pointsDelta} point {winner.name}</span>
              </div>
            </div>
          ) : (
            <div className="winner-section no-winner-section">
              <div className="winner-avatar no-winner-avatar">?</div>
              <div className="winner-info">
                <span className="winner-name no-winner-name">{endReason === "NO_WINNER" ? "GM got the win!" : "No Winner"}</span>
                <span className="points-gained no-winner-points">+0 Points</span>
              </div>
            </div>
          )}
        </div>

        <div id="state-lose" className={viewState === 'lose' ? '' : 'hidden'}>
          <div className="result-icon">{winnerTeam ? "LOSE" : "TIME"}</div>
          <h2 className="result-title color-lose">{winnerTeam ? "You Lose!" : "Time's Up!"}</h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{word}</div>
          </div>

          <div className="winner-section no-winner-section">
            <div className="winner-avatar no-winner-avatar">?</div>
            <div className="winner-info">
              <span className="winner-name no-winner-name">
                {winnerTeam ? `${winner.name} Won` : endReason === "NO_WINNER" ? "GM got the win!" : "No Winner"}
              </span>
              <span className="points-gained no-winner-points">{winnerTeam ? `+${winner.pointsDelta} point ${winner.name}` : "+0 Points"}</span>
            </div>
          </div>
        </div>

        {winnerTeam && winners.length > 0 && (
          <div className="payout">
            <div className={`payout__team payout__team--${winnerTeam}`}>
              <span className="payout__label">Points Awarded</span>
              <span className="payout__teamName">{winner.name}</span>
            </div>
            <div
              ref={payoutChipsRef}
              className={`payout__chips ${payoutActive ? "payout__chips--active" : ""}`}
              style={{ "--payout-from-y": `${payoutFromY}px` }}
            >
              {winners.map((p) => {
                const oldPts = Math.max(0, Number(p.newPoints || 0) - 1);
                const newPts = Number(p.newPoints || 0);
                return (
                  <div key={p.pid} className="payout__chip">
                    <div className="payout__chipTop">
                      <span className="payout__name">{p.name}</span>
                      <span className="payout__delta">+1</span>
                    </div>
                    <div className="payout__chipBottom">
                      <span className="payout__totalLabel">Total</span>
                      <span className="payout__total">
                        <span className="payout__ptsOld">{oldPts}</span>
                        <span className="payout__arrow">{"->"}</span>
                        <span className={`payout__ptsNew ${payoutShowTotals ? "payout__ptsNew--on" : ""}`}>
                          {newPts}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {canVote ? (
          <div className="timer-container">
            <div className="timer-text" style={{ marginBottom: '10px' }}>Vote for next game</div>
            <div className="timer-text" style={{ marginBottom: '6px' }}>
              {voteRemaining === null
                ? "Syncing..."
                : voteRemaining > 0
                ? `Vote ends in: ${voteRemaining}s`
                : "Vote window ended. Resolving..."}
            </div>
            <div className="timer-text" style={{ marginBottom: '10px', opacity: 0.85 }}>
              YES: {effectiveYes} / {effectiveEligible} (missing votes count as NO) · Voted: {effectiveVoted} / {effectiveEligible}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => submitVote('yes')}
                disabled={voted || (voteRemaining !== null && voteRemaining <= 0)}
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
                disabled={voted || (voteRemaining !== null && voteRemaining <= 0)}
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
        ) : null}
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
            onClick={() => setViewState('win')}
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
            onClick={() => setViewState('lose')}
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
