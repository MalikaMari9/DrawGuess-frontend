import { useMemo, useState } from "react";
import "../styles/BattleRoundWin.css";
import "../styles/RoundWinThemeSandbox.css";

const MOCK_PLAYERS = [
  { pid: "p1", name: "Ava", team: "A", points: 4, connected: true },
  { pid: "p2", name: "Milo", team: "A", points: 2, connected: true },
  { pid: "p3", name: "Nora", team: "B", points: 5, connected: true },
  { pid: "p4", name: "Zed", team: "B", points: 1, connected: true },
];

const RoundWinThemeSandbox = () => {
  const [mode, setMode] = useState("single");
  const [styleMode, setStyleMode] = useState("current"); // current | room

  // Shared controls
  const [word, setWord] = useState("TIGER");
  const [canVote, setCanVote] = useState(true);
  const [voted, setVoted] = useState(false);
  const [voteEnded, setVoteEnded] = useState(false);
  const [yesCount, setYesCount] = useState(2);
  const [votedCount, setVotedCount] = useState(3);
  const [eligibleCount, setEligibleCount] = useState(4);

  // Single controls
  const [singleHasWinner, setSingleHasWinner] = useState(true);
  const [singleWinnerName, setSingleWinnerName] = useState("Ava");
  const [singleRound, setSingleRound] = useState(3);
  const [singleEndReason, setSingleEndReason] = useState("NO_WINNER");

  // VS controls
  const [vsViewState, setVsViewState] = useState("neutral"); // win | neutral | lose
  const [vsWinnerTeam, setVsWinnerTeam] = useState("A"); // A | B | ""
  const [vsRound, setVsRound] = useState(3);
  const [vsTotalRounds, setVsTotalRounds] = useState(5);
  const [showPayout, setShowPayout] = useState(true);
  const [vsEndReason, setVsEndReason] = useState("NO_WINNER");

  const voteRemaining = voteEnded ? 0 : 14;
  const winnerTeam = vsWinnerTeam;
  const winner = {
    name: winnerTeam === "A" ? "Red Team" : winnerTeam === "B" ? "Blue Team" : "",
    avatar: winnerTeam,
    pointsDelta: winnerTeam ? 1 : 0,
  };

  const winners = useMemo(() => {
    if (!winnerTeam) return [];
    return MOCK_PLAYERS.filter((p) => p.connected !== false && p.team === winnerTeam).map((p) => ({
      pid: p.pid,
      name: p.name,
      newPoints: Number(p.points || 0),
    }));
  }, [winnerTeam]);

  const singleWinnerPlayer = useMemo(() => {
    const key = String(singleWinnerName || "").trim().toLowerCase();
    if (!key) return null;
    return MOCK_PLAYERS.find((p) => String(p.name || "").toLowerCase() === key) || null;
  }, [singleWinnerName]);
  const singleOldPoints = Number(singleWinnerPlayer?.points || 0);
  const singleNewPoints = singleOldPoints + 1;

  return (
    <div className="rw-base-shell">
      <div className="rw-base-toolbar">
        <div className="rw-base-toolbar__row">
          <span className="rw-base-toolbar__label">Mode</span>
          <button
            type="button"
            className={`rw-base-btn ${mode === "single" ? "is-active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single Current
          </button>
          <button
            type="button"
            className={`rw-base-btn ${mode === "vs" ? "is-active" : ""}`}
            onClick={() => setMode("vs")}
          >
            VS Current
          </button>
        </div>

        <div className="rw-base-toolbar__row">
          <span className="rw-base-toolbar__label">Style</span>
          <button
            type="button"
            className={`rw-base-btn ${styleMode === "current" ? "is-active" : ""}`}
            onClick={() => setStyleMode("current")}
          >
            Current
          </button>
          <button
            type="button"
            className={`rw-base-btn ${styleMode === "room" ? "is-active" : ""}`}
            onClick={() => setStyleMode("room")}
          >
            Room-Consistent
          </button>
        </div>

        <div className="rw-base-toolbar__row">
          <span className="rw-base-toolbar__label">Word</span>
          <input
            className="rw-base-input"
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value.toUpperCase())}
          />

          <span className="rw-base-toolbar__label">Vote</span>
          <button
            type="button"
            className={`rw-base-btn ${canVote ? "is-active" : ""}`}
            onClick={() => setCanVote((x) => !x)}
          >
            {canVote ? "Visible" : "Hidden"}
          </button>
          <button
            type="button"
            className={`rw-base-btn ${voted ? "is-active" : ""}`}
            onClick={() => setVoted((x) => !x)}
          >
            {voted ? "Voted" : "Not Voted"}
          </button>
          <button
            type="button"
            className={`rw-base-btn ${voteEnded ? "is-active" : ""}`}
            onClick={() => setVoteEnded((x) => !x)}
          >
            {voteEnded ? "Window Ended" : "Window Active"}
          </button>
        </div>

        <div className="rw-base-toolbar__row">
          <span className="rw-base-toolbar__label">Stats</span>
          <label className="rw-base-small">
            YES
            <input
              className="rw-base-number"
              type="number"
              min="0"
              max="12"
              value={yesCount}
              onChange={(e) => setYesCount(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className="rw-base-small">
            Voted
            <input
              className="rw-base-number"
              type="number"
              min="0"
              max="12"
              value={votedCount}
              onChange={(e) => setVotedCount(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className="rw-base-small">
            Eligible
            <input
              className="rw-base-number"
              type="number"
              min="1"
              max="12"
              value={eligibleCount}
              onChange={(e) => setEligibleCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        {mode === "single" ? (
          <div className="rw-base-toolbar__row">
            <span className="rw-base-toolbar__label">Single State</span>
            <button
              type="button"
              className={`rw-base-btn ${singleHasWinner ? "is-active" : ""}`}
              onClick={() => setSingleHasWinner((x) => !x)}
            >
              {singleHasWinner ? "Winner" : "No Winner"}
            </button>
            <input
              className="rw-base-input"
              type="text"
              value={singleWinnerName}
              onChange={(e) => setSingleWinnerName(e.target.value)}
              placeholder="Winner Name"
            />
            <label className="rw-base-small">
              Round
              <input
                className="rw-base-number"
                type="number"
                min="0"
                max="99"
                value={singleRound}
                onChange={(e) => setSingleRound(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <button
              type="button"
              className={`rw-base-btn ${showPayout ? "is-active" : ""}`}
              onClick={() => setShowPayout((x) => !x)}
            >
              {showPayout ? "Score Token On" : "Score Token Off"}
            </button>
            <input
              className="rw-base-input"
              type="text"
              value={singleEndReason}
              onChange={(e) => setSingleEndReason(e.target.value)}
              placeholder="End reason"
            />
          </div>
        ) : (
          <div className="rw-base-toolbar__row">
            <span className="rw-base-toolbar__label">VS State</span>
            <button
              type="button"
              className={`rw-base-btn ${vsViewState === "win" ? "is-active" : ""}`}
              onClick={() => setVsViewState("win")}
            >
              Win
            </button>
            <button
              type="button"
              className={`rw-base-btn ${vsViewState === "neutral" ? "is-active" : ""}`}
              onClick={() => setVsViewState("neutral")}
            >
              Neutral
            </button>
            <button
              type="button"
              className={`rw-base-btn ${vsViewState === "lose" ? "is-active" : ""}`}
              onClick={() => setVsViewState("lose")}
            >
              Lose
            </button>
            <button
              type="button"
              className={`rw-base-btn ${vsWinnerTeam === "A" ? "is-active" : ""}`}
              onClick={() => setVsWinnerTeam("A")}
            >
              Team A
            </button>
            <button
              type="button"
              className={`rw-base-btn ${vsWinnerTeam === "B" ? "is-active" : ""}`}
              onClick={() => setVsWinnerTeam("B")}
            >
              Team B
            </button>
            <button
              type="button"
              className={`rw-base-btn ${vsWinnerTeam === "" ? "is-active" : ""}`}
              onClick={() => setVsWinnerTeam("")}
            >
              No Winner
            </button>
            <button
              type="button"
              className={`rw-base-btn ${showPayout ? "is-active" : ""}`}
              onClick={() => setShowPayout((x) => !x)}
            >
              {showPayout ? "Payout On" : "Payout Off"}
            </button>
            <label className="rw-base-small">
              Round
              <input
                className="rw-base-number"
                type="number"
                min="1"
                max="99"
                value={vsRound}
                onChange={(e) => setVsRound(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="rw-base-small">
              Total
              <input
                className="rw-base-number"
                type="number"
                min="1"
                max="99"
                value={vsTotalRounds}
                onChange={(e) => setVsTotalRounds(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <input
              className="rw-base-input"
              type="text"
              value={vsEndReason}
              onChange={(e) => setVsEndReason(e.target.value)}
              placeholder="End reason"
            />
          </div>
        )}
      </div>

      <div className={`rw-base-stage ${styleMode === "room" ? "rw-base-stage--room" : ""}`}>
        {mode === "single" ? (
          <div className="battle-round-win-body">
            <div className="result-modal">
              <div className="round-tag">Round {singleRound || "-"}</div>

              <div id="single-round-end">
                <h2 className={`result-title ${singleHasWinner ? "color-win" : "color-lose"}`}>
                  {singleHasWinner ? `${singleWinnerName || "A player"} is correct!` : "Time's Up!"}
                </h2>

                <div className="word-reveal-box">
                  <span className="word-label">The word was</span>
                  <div className="the-word">{String(word || "").toUpperCase() || "-"}</div>
                </div>

                {singleHasWinner ? (
                  <div className="winner-section">
                    <div className="winner-avatar">{(singleWinnerName || "?")[0]?.toUpperCase()}</div>
                    <div className="winner-info">
                      <span className="winner-name">{singleWinnerName || "Player"}</span>
                      <span className="points-gained">Round ended. Vote for next round.</span>
                    </div>
                  </div>
                ) : (
                  <div className="winner-section no-winner-section">
                    <div className="winner-avatar no-winner-avatar">?</div>
                    <div className="winner-info">
                      <span className="winner-name no-winner-name">
                        {singleEndReason === "NO_WINNER" ? "No correct guess" : "Round ended"}
                      </span>
                      <span className="points-gained no-winner-points">Vote to continue or stop.</span>
                    </div>
                  </div>
                )}

                {singleHasWinner && showPayout && (
                  <div className="payout">
                    <div className="payout__team">
                      <span className="payout__label">Points Awarded</span>
                      <span className="payout__teamName">{singleWinnerName || "Winner"}</span>
                    </div>
                    <div className="payout__chips payout__chips--active" style={{ "--payout-from-y": "-14px" }}>
                      <div className="payout__chip">
                        <div className="payout__chipTop">
                          <span className="payout__name">{singleWinnerName || "Winner"}</span>
                          <span className="payout__delta">+1</span>
                        </div>
                        <div className="payout__chipBottom">
                          <span className="payout__totalLabel">Total</span>
                          <span className="payout__total">
                            <span className="payout__ptsOld">{singleOldPoints}</span>
                            <span className="payout__arrow">{"->"}</span>
                            <span className="payout__ptsNew payout__ptsNew--on">{singleNewPoints}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {canVote ? (
                <div className="result-vote">
                  <div className="result-vote-title">Vote for next game</div>
                  <div className="result-vote-meta">
                    {voteEnded
                      ? "Vote window ended. Resolving..."
                      : voteRemaining > 0
                      ? `Vote ends in: ${voteRemaining}s`
                      : "Vote window ended. Resolving..."}
                  </div>
                  <div className="result-vote-meta result-vote-meta--stats">
                    YES: {yesCount} / {eligibleCount} - Voted: {votedCount} / {eligibleCount}
                  </div>
                  <div className="result-vote-actions">
                    <button
                      className="result-vote-btn result-vote-btn--yes"
                      disabled={voted || voteEnded}
                    >
                      PLAY NEXT ROUND
                    </button>
                    <button
                      className="result-vote-btn result-vote-btn--no"
                      disabled={voted || voteEnded}
                    >
                      STOP
                    </button>
                  </div>
                  {voted && (
                    <div className="result-vote-status result-vote-status--ok">
                      Vote sent. Waiting for others...
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="battle-round-win-body">
            <div className="result-modal">
              <div className="round-tag">
                Round {vsRound} / {vsTotalRounds}
              </div>

              {winnerTeam && <span className="payout__origin" />}

              <div id="state-win" className={vsViewState === "win" ? "" : "hidden"}>
                <div className="result-icon">WIN</div>
                <h2 className="result-title color-win">You Win!</h2>

                <div className="word-reveal-box">
                  <span className="word-label">The word was</span>
                  <div className="the-word">{String(word || "").toUpperCase() || "-"}</div>
                </div>

                <div className="winner-section">
                  <div className="winner-avatar">{winner.avatar || "?"}</div>
                  <div className="winner-info">
                    <span className="winner-name">{winner.name || "Winner"}</span>
                    <span className="points-gained">+{winner.pointsDelta} point {winner.name || "Winner"}</span>
                  </div>
                </div>
              </div>

              <div id="state-neutral" className={vsViewState === "neutral" ? "" : "hidden"}>
                <h2 className="result-title color-win">{winner.name ? `${winner.name} Won!` : "Game Ended"}</h2>

                <div className="word-reveal-box">
                  <span className="word-label">The word was</span>
                  <div className="the-word">{String(word || "").toUpperCase() || "-"}</div>
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
                      <span className="winner-name no-winner-name">
                        {vsEndReason === "NO_WINNER" ? "GM got the win!" : "No Winner"}
                      </span>
                      <span className="points-gained no-winner-points">+0 Points</span>
                    </div>
                  </div>
                )}
              </div>

              <div id="state-lose" className={vsViewState === "lose" ? "" : "hidden"}>
                <div className="result-icon">{winnerTeam ? "LOSE" : "TIME"}</div>
                <h2 className="result-title color-lose">{winnerTeam ? "You Lose!" : "Time's Up!"}</h2>

                <div className="word-reveal-box">
                  <span className="word-label">The word was</span>
                  <div className="the-word">{String(word || "").toUpperCase() || "-"}</div>
                </div>

                <div className="winner-section no-winner-section">
                  <div className="winner-avatar no-winner-avatar">?</div>
                  <div className="winner-info">
                    <span className="winner-name no-winner-name">
                      {winnerTeam ? `${winner.name} Won` : vsEndReason === "NO_WINNER" ? "GM got the win!" : "No Winner"}
                    </span>
                    <span className="points-gained no-winner-points">
                      {winnerTeam ? `+${winner.pointsDelta} point ${winner.name}` : "+0 Points"}
                    </span>
                  </div>
                </div>
              </div>

              {winnerTeam && showPayout && winners.length > 0 && (
                <div className="payout">
                  <div className={`payout__team payout__team--${winnerTeam}`}>
                    <span className="payout__label">Points Awarded</span>
                    <span className="payout__teamName">{winner.name}</span>
                  </div>
                  <div className="payout__chips payout__chips--active" style={{ "--payout-from-y": "-14px" }}>
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
                              <span className="payout__ptsNew payout__ptsNew--on">{newPts}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {canVote ? (
                <div className="result-vote">
                  <div className="result-vote-title">Vote for next game</div>
                  <div className="result-vote-meta">
                    {voteEnded
                      ? "Vote window ended. Resolving..."
                      : voteRemaining > 0
                      ? `Vote ends in: ${voteRemaining}s`
                      : "Vote window ended. Resolving..."}
                  </div>
                  <div className="result-vote-meta result-vote-meta--stats">
                    YES: {yesCount} / {eligibleCount} - Voted: {votedCount} / {eligibleCount}
                  </div>
                  <div className="result-vote-actions">
                    <button
                      className="result-vote-btn result-vote-btn--yes"
                      disabled={voted || voteEnded}
                    >
                      PLAY NEXT ROUND
                    </button>
                    <button
                      className="result-vote-btn result-vote-btn--no"
                      disabled={voted || voteEnded}
                    >
                      STOP
                    </button>
                  </div>
                  {voted && (
                    <div className="result-vote-status result-vote-status--ok">
                      Vote sent. Waiting for others...
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundWinThemeSandbox;
