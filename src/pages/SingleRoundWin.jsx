import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRoomWSContext } from "../ws/RoomWSContext";
import "../styles/BattleRoundWin.css";

const VOTE_PAYOUT_SLIDE_DELAY_MS = 450;
const VOTE_TOTALS_SHOW_DELAY_MS = 900;

const SingleRoundWin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { ws } = useRoomWSContext();

  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const game = snapshot.game || {};
  const roundConfig = snapshot.round_config || {};
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const myPid = ws.pid || localStorage.getItem("dg_pid") || "";

  const initialState = location.state || {};
  const [endWord, setEndWord] = useState(String(initialState.word || roundConfig.secret_word || ""));
  const [endReason, setEndReason] = useState(String(initialState.reason || game.end_reason || ""));
  const [voted, setVoted] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [voteStats, setVoteStats] = useState(null);
  const [voteRemaining, setVoteRemaining] = useState(null);
  const routedToFinalRef = useRef(false);
  const payoutOriginRef = useRef(null);
  const payoutChipsRef = useRef(null);
  const [payoutActive, setPayoutActive] = useState(false);
  const [payoutShowTotals, setPayoutShowTotals] = useState(false);
  const [payoutFromY, setPayoutFromY] = useState(-14);

  const roundNo = Number(room.round_no || initialState.round || 0);
  const roomCode = ws.roomCode || snapshot.room_code || localStorage.getItem("dg_room") || "";

  const winnerPid = String(game.winner_pid || initialState.winnerPid || "");
  const winnerPlayer = useMemo(
    () => players.find((p) => String(p?.pid || "") === winnerPid) || null,
    [players, winnerPid]
  );
  const gmPlayer = useMemo(() => {
    const gmPid = String(room.gm_pid || "");
    if (gmPid) {
      const byPid = players.find((p) => String(p?.pid || "") === gmPid) || null;
      if (byPid) return byPid;
    }
    return players.find((p) => String(p?.role || "") === "gm") || null;
  }, [players, room.gm_pid]);
  const winnerName = winnerPlayer?.name || initialState.winnerName || "";
  const winnerNewPoints = Number(winnerPlayer?.points ?? 1);
  const winnerOldPoints = Math.max(0, winnerNewPoints - 1);
  const noWinnerGetsGmPoint = !winnerPid && (endReason === "TIMEOUT" || endReason === "NO_WINNER");
  const payoutPlayer = winnerPid ? winnerPlayer : noWinnerGetsGmPoint ? gmPlayer : null;
  const payoutName =
    payoutPlayer?.name || (winnerPid ? winnerName || "Winner" : noWinnerGetsGmPoint ? "GameMaster" : "");
  const payoutNewPoints = Number(
    payoutPlayer?.points ?? (winnerPid ? winnerNewPoints : noWinnerGetsGmPoint ? 1 : 0)
  );
  const payoutOldPoints = Math.max(0, payoutNewPoints - 1);
  const hasPayout = Boolean(winnerPid || noWinnerGetsGmPoint);

  const canVote = room.state === "GAME_END" && game.phase === "VOTING";
  const votesNext = game.votes_next && typeof game.votes_next === "object" ? game.votes_next : {};
  const eligibleCount = useMemo(
    () => players.filter((p) => p?.connected !== false).length,
    [players]
  );
  const votedCount = useMemo(() => Object.keys(votesNext).length, [votesNext]);
  const yesCount = useMemo(
    () => Object.values(votesNext).filter((v) => v === "yes").length,
    [votesNext]
  );
  const effectiveEligible = voteStats?.eligible ?? eligibleCount;
  const effectiveVoted = voteStats?.voted_count ?? votedCount;
  const effectiveYes = voteStats?.yes_count ?? yesCount;

  const finalPayload = useMemo(() => {
    const connectedPlayers = players.filter((p) => p && p.connected !== false);
    const base = connectedPlayers.length ? connectedPlayers : players;
    const sorted = [...base].sort(
      (a, b) => Number(b?.points ?? b?.score ?? 0) - Number(a?.points ?? a?.score ?? 0)
    );
    const top = sorted[0] || null;
    return {
      roomCode: snapshot?.room_code || roomCode,
      roundNo,
      endReason: endReason || game.end_reason || "VOTE_NO",
      winnerPid: top?.pid || "",
      winnerName: top?.name || "Winner",
      players: base,
    };
  }, [players, snapshot?.room_code, roomCode, roundNo, endReason, game.end_reason]);

  const goToSingleWin = useCallback(() => {
    if (routedToFinalRef.current) return;
    routedToFinalRef.current = true;
    navigate("/single-win", { state: finalPayload });
  }, [navigate, finalPayload]);

  useEffect(() => {
    if (ws.status === "CONNECTED") ws.send({ type: "snapshot" });
  }, [ws.status, ws.send]);

  useEffect(() => {
    if (typeof roundConfig.secret_word === "string" && roundConfig.secret_word) {
      setEndWord(roundConfig.secret_word);
    }
  }, [roundConfig.secret_word]);

  useEffect(() => {
    if (typeof game.end_reason === "string" && game.end_reason) {
      setEndReason(game.end_reason);
    }
  }, [game.end_reason]);

  useEffect(() => {
    const m = ws.lastMsg;
    if (!m) return;

    if (m.type === "error") {
      setLastError(m);
    }

    if (m.type === "game_end") {
      if (typeof m.word === "string" && m.word) setEndWord(m.word);
      if (typeof m.reason === "string") setEndReason(m.reason);
      ws.send({ type: "snapshot" });
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

    if (m.type === "vote_resolved" && m.outcome === "NO") {
      goToSingleWin();
    }

    if (m.type === "room_state_changed") {
      if (m.state === "WAITING") navigate("/single-lobby");
      if (m.state === "ROLE_PICK") navigate("/role-pick");
      if (m.state === "CONFIG") navigate("/waiting-room");
    }
  }, [ws.lastMsg, ws.send, navigate, goToSingleWin]);

  useEffect(() => {
    if (room.state === "WAITING") {
      navigate("/single-lobby");
      return;
    }
    if (room.state === "ROLE_PICK") {
      navigate("/role-pick");
      return;
    }
    if (room.state === "CONFIG") {
      navigate("/waiting-room");
      return;
    }

    if (room.state === "GAME_END" && (game.phase === "FINAL" || game.vote_outcome === "NO")) {
      goToSingleWin();
      return;
    }

    if (room.state !== "GAME_END") {
      routedToFinalRef.current = false;
    }
  }, [room.state, game.phase, game.vote_outcome, navigate, goToSingleWin]);

  useEffect(() => {
    if (!myPid) {
      setVoted(false);
      return;
    }
    setVoted(Boolean(votesNext[myPid]));
  }, [votesNext, myPid]);

  useEffect(() => {
    if (!hasPayout || room.state !== "GAME_END") {
      setPayoutActive(false);
      setPayoutShowTotals(false);
      return;
    }

    setPayoutActive(false);
    setPayoutShowTotals(false);
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

    const t1 = setTimeout(() => setPayoutActive(true), VOTE_PAYOUT_SLIDE_DELAY_MS);
    const t2 = setTimeout(() => setPayoutShowTotals(true), VOTE_TOTALS_SHOW_DELAY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hasPayout, room.state]);

  useEffect(() => {
    if (!canVote) {
      setVoteRemaining(null);
      setVoteStats(null);
      return;
    }

    const voteEndAt = Number(game.vote_end_at || 0);
    if (!voteEndAt) {
      setVoteRemaining(null);
      return;
    }

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
    const ok = ws.send({ type: "vote_next", vote });
    if (!ok) {
      setLastError({ code: "WS_DISCONNECTED", message: "Connection issue. Reconnecting..." });
      return;
    }
    setVoted(true);
  };

  return (
    <div className="battle-round-win-body">
      <div className="result-modal">
        <div className="round-tag">Round {roundNo || "-"}</div>
        {hasPayout && <span ref={payoutOriginRef} className="payout__origin" />}

        <div id="single-round-end">
          <h2 className={`result-title ${winnerPid ? "color-win" : "color-lose"}`}>
            {winnerPid ? `${winnerName || "A player"} is correct!` : "Time's Up!"}
          </h2>

          <div className="word-reveal-box">
            <span className="word-label">The word was</span>
            <div className="the-word">{String(endWord || "").toUpperCase() || "-"}</div>
          </div>

          {winnerPid ? (
            <div className="winner-section">
              <div className="winner-avatar">{(winnerName || "?")[0]?.toUpperCase()}</div>
              <div className="winner-info">
                <span className="winner-name">{winnerName || "Player"}</span>
                <span className="points-gained">Round ended. Vote for next round.</span>
              </div>
            </div>
          ) : (
            <div className="winner-section no-winner-section">
              <div className="winner-avatar no-winner-avatar">?</div>
              <div className="winner-info">
                <span className="winner-name no-winner-name">
                  {endReason === "NO_WINNER" || endReason === "TIMEOUT" ? "No correct guess" : "Round ended"}
                </span>
                <span className="points-gained no-winner-points">
                  {noWinnerGetsGmPoint ? `${payoutName} +1 point` : "Vote to continue or stop."}
                </span>
              </div>
            </div>
          )}

          {hasPayout ? (
            <div className="payout">
              <div className="payout__team">
                <span className="payout__label">Points Awarded</span>
                <span className="payout__teamName">{payoutName || "Winner"}</span>
              </div>
              <div
                ref={payoutChipsRef}
                className={`payout__chips ${payoutActive ? "payout__chips--active" : ""}`}
                style={{ "--payout-from-y": `${payoutFromY}px` }}
              >
                <div className="payout__chip">
                  <div className="payout__chipTop">
                    <span className="payout__name">{payoutName || "Winner"}</span>
                    <span className="payout__delta">+1</span>
                  </div>
                  <div className="payout__chipBottom">
                    <span className="payout__totalLabel">Total</span>
                    <span className="payout__total">
                      <span className="payout__ptsOld">{payoutOldPoints}</span>
                      <span className="payout__arrow">{"->"}</span>
                      <span className={`payout__ptsNew ${payoutShowTotals ? "payout__ptsNew--on" : ""}`}>
                        {payoutNewPoints}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {canVote ? (
          <div className="result-vote">
            <div className="result-vote-title">Vote for next game</div>
            <div className="result-vote-meta">
              {voteRemaining === null
                ? "Syncing vote timer..."
                : voteRemaining > 0
                ? `Vote ends in: ${voteRemaining}s`
                : "Vote window ended. Resolving..."}
            </div>
            <div className="result-vote-meta result-vote-meta--stats">
              YES: {effectiveYes} / {effectiveEligible} - Voted: {effectiveVoted} / {effectiveEligible}
            </div>
            <div className="result-vote-actions">
              <button
                className="result-vote-btn result-vote-btn--yes"
                onClick={() => submitVote("yes")}
                disabled={voted || (voteRemaining !== null && voteRemaining <= 0)}
              >
                PLAY NEXT ROUND
              </button>
              <button
                className="result-vote-btn result-vote-btn--no"
                onClick={() => submitVote("no")}
                disabled={voted || (voteRemaining !== null && voteRemaining <= 0)}
              >
                STOP
              </button>
            </div>
            {voted && <div className="result-vote-status result-vote-status--ok">Vote sent. Waiting for others...</div>}
            {lastError && <div className="result-vote-status result-vote-status--error">{lastError.code}: {lastError.message}</div>}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SingleRoundWin;
