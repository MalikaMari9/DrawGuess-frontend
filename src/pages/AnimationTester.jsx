import { useEffect, useRef, useState } from "react";
import "../styles/AnimationTester.css";

const SANDBOX_PLAYERS = [
  { pid: "p1", name: "Ava", points: 0 },
  { pid: "p2", name: "Milo", points: 1 },
  { pid: "p3", name: "Nora", points: 2 },
  { pid: "p4", name: "Zed", points: 0 },
];

const AnimationTester = () => {
  const [drawFlipKey, setDrawFlipKey] = useState(0);
  const [guessFlipKey, setGuessFlipKey] = useState(0);
  const [winFlipKey, setWinFlipKey] = useState(0);
  const [drawFlipped, setDrawFlipped] = useState(true);
  const [guessFlipped, setGuessFlipped] = useState(true);
  const [winFlipped, setWinFlipped] = useState(true);
  const [drawStarted, setDrawStarted] = useState(false);
  const [guessStarted, setGuessStarted] = useState(false);
  const [winStarted, setWinStarted] = useState(false);
  const [drawExit, setDrawExit] = useState(false);
  const [guessExit, setGuessExit] = useState(false);
  const [winExit, setWinExit] = useState(false);
  const drawStartRef = useRef(null);
  const guessStartRef = useRef(null);
  const winStartRef = useRef(null);
  const drawTimerRef = useRef(null);
  const drawExitRef = useRef(null);
  const guessTimerRef = useRef(null);
  const guessExitRef = useRef(null);
  const winTimerRef = useRef(null);
  const winExitRef = useRef(null);
  const drawPreviewRef = useRef(null);
  const guessPreviewRef = useRef(null);
  const winPreviewRef = useRef(null);
  const [roundOutcome, setRoundOutcome] = useState("winner"); // winner | timeup
  const [winnerName, setWinnerName] = useState("Ava");
  const [revealedWord, setRevealedWord] = useState("TIGER");
  const [winnerTeam, setWinnerTeam] = useState("A"); // A | B
  const [myTeam, setMyTeam] = useState("A"); // A | B | NONE
  const [winnerPid, setWinnerPid] = useState("p1");
  const [pointsDelta, setPointsDelta] = useState(1);
  const [voteRemaining, setVoteRemaining] = useState(18);
  const [yesCount, setYesCount] = useState(2);
  const [votedCount, setVotedCount] = useState(3);
  const [eligibleCount, setEligibleCount] = useState(4);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteEnded, setVoteEnded] = useState(false);
  const [showVoteError, setShowVoteError] = useState(false);
  const [voteChoice, setVoteChoice] = useState("");
  const [voteAnimKey, setVoteAnimKey] = useState(0);
  const [payoutActive, setPayoutActive] = useState(false);
  const [payoutShowTotals, setPayoutShowTotals] = useState(false);

  const DELAY_MS = 1500;
  const TIME_UP_MS = 900;
  const PHASE_SHOW_MS = 1300;
  const PHASE_OUT_MS = 700;
  const VOTE_PAYOUT_SLIDE_DELAY_MS = 450;
  const VOTE_TOTALS_SHOW_DELAY_MS = 900;

  const triggerAll = () => {
    triggerDrawFlip();
    triggerGuessFlip();
    triggerWinFlip();
  };

  const winnerTeamLabel = winnerTeam === "A" ? "Red Team (A)" : "Blue Team (B)";
  const myTeamLabel =
    myTeam === "A" ? "Red Team (A)" : myTeam === "B" ? "Blue Team (B)" : "Observer";
  const winnerTone = winnerTeam === "A" ? "red" : "blue";
  const selectedWinnerPlayer = SANDBOX_PLAYERS.find((p) => p.pid === winnerPid) || SANDBOX_PLAYERS[0];
  const winnerDisplayName = selectedWinnerPlayer?.name || winnerName;
  const scoreRows = SANDBOX_PLAYERS.map((p) => {
    const isWinner = roundOutcome === "winner" && p.pid === winnerPid;
    const oldPoints = Number(p.points || 0);
    const delta = isWinner ? Math.max(0, Number(pointsDelta) || 0) : 0;
    return {
      ...p,
      isWinner,
      oldPoints,
      newPoints: oldPoints + delta,
    };
  });

  const normalizeVoteStats = () => {
    const safeEligible = Math.max(1, Number(eligibleCount) || 1);
    const safeYes = Math.max(0, Math.min(safeEligible, Number(yesCount) || 0));
    const safeVoted = Math.max(safeYes, Math.min(safeEligible, Number(votedCount) || 0));
    setEligibleCount(safeEligible);
    setYesCount(safeYes);
    setVotedCount(safeVoted);
  };

  const resetVoteSandbox = () => {
    setRoundOutcome("winner");
    setWinnerName("Ava");
    setRevealedWord("TIGER");
    setWinnerTeam("A");
    setMyTeam("A");
    setWinnerPid("p1");
    setPointsDelta(1);
    setVoteRemaining(18);
    setYesCount(2);
    setVotedCount(3);
    setEligibleCount(4);
    setHasVoted(false);
    setVoteEnded(false);
    setShowVoteError(false);
    setVoteChoice("");
    setVoteAnimKey((k) => k + 1);
  };

  const triggerVoteAnimation = () => {
    setVoteAnimKey((k) => k + 1);
  };

  const triggerDrawFlip = () => {
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    if (drawExitRef.current) clearTimeout(drawExitRef.current);
    if (drawStartRef.current) clearTimeout(drawStartRef.current);
    setDrawFlipped(false);
    setDrawExit(false);
    setDrawStarted(false);
    drawStartRef.current = setTimeout(() => {
      setDrawStarted(true);
      setDrawFlipKey((k) => k + 1);
    }, DELAY_MS);
    drawTimerRef.current = setTimeout(() => setDrawFlipped(true), DELAY_MS + TIME_UP_MS);
    drawExitRef.current = setTimeout(() => setDrawExit(true), DELAY_MS + TIME_UP_MS + PHASE_SHOW_MS);
  };

  const triggerGuessFlip = () => {
    if (guessTimerRef.current) clearTimeout(guessTimerRef.current);
    if (guessExitRef.current) clearTimeout(guessExitRef.current);
    if (guessStartRef.current) clearTimeout(guessStartRef.current);
    setGuessFlipped(false);
    setGuessExit(false);
    setGuessStarted(false);
    guessStartRef.current = setTimeout(() => {
      setGuessStarted(true);
      setGuessFlipKey((k) => k + 1);
    }, DELAY_MS);
    guessTimerRef.current = setTimeout(() => setGuessFlipped(true), DELAY_MS + TIME_UP_MS);
    guessExitRef.current = setTimeout(() => setGuessExit(true), DELAY_MS + TIME_UP_MS + PHASE_SHOW_MS);
  };

  const triggerWinFlip = () => {
    if (winTimerRef.current) clearTimeout(winTimerRef.current);
    if (winExitRef.current) clearTimeout(winExitRef.current);
    if (winStartRef.current) clearTimeout(winStartRef.current);
    setWinFlipped(false);
    setWinExit(false);
    setWinStarted(false);
    winStartRef.current = setTimeout(() => {
      setWinStarted(true);
      setWinFlipKey((k) => k + 1);
    }, DELAY_MS);
    winTimerRef.current = setTimeout(() => setWinFlipped(true), DELAY_MS + TIME_UP_MS);
    winExitRef.current = setTimeout(() => setWinExit(true), DELAY_MS + TIME_UP_MS + PHASE_SHOW_MS);
  };

  useEffect(() => {
    normalizeVoteStats();
  }, [eligibleCount, yesCount, votedCount]);

  useEffect(() => {
    if (voteEnded) setVoteRemaining(0);
  }, [voteEnded]);

  useEffect(() => {
    if (!hasVoted) setVoteChoice("");
  }, [hasVoted]);

  useEffect(() => {
    setVoteAnimKey((k) => k + 1);
  }, [roundOutcome, winnerPid, pointsDelta]);

  useEffect(() => {
    setPayoutActive(false);
    setPayoutShowTotals(false);
    const t1 = setTimeout(() => setPayoutActive(true), VOTE_PAYOUT_SLIDE_DELAY_MS);
    const t2 = setTimeout(() => setPayoutShowTotals(true), VOTE_TOTALS_SHOW_DELAY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [voteAnimKey]);

  useEffect(() => {
    return () => {
      if (drawStartRef.current) clearTimeout(drawStartRef.current);
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
      if (drawExitRef.current) clearTimeout(drawExitRef.current);
      if (guessStartRef.current) clearTimeout(guessStartRef.current);
      if (guessTimerRef.current) clearTimeout(guessTimerRef.current);
      if (guessExitRef.current) clearTimeout(guessExitRef.current);
      if (winStartRef.current) clearTimeout(winStartRef.current);
      if (winTimerRef.current) clearTimeout(winTimerRef.current);
      if (winExitRef.current) clearTimeout(winExitRef.current);
    };
  }, []);

  return (
    <div className="anim-tester">
      <div className="anim-card">
        <div className="anim-header">
          <div>
            <div className="anim-title">Animation Tester</div>
            <div className="anim-subtitle">Pop-up / pop-in previews for battle UI</div>
          </div>
          <div className="anim-header-actions">
            <button className="anim-btn anim-btn-primary" onClick={triggerAll}>
              Trigger All
            </button>
          </div>
        </div>

        <div className="anim-vote-controls">
          <div className="anim-vote-controls-title">Vote UI Sandbox Controls</div>
          <div className="anim-vote-control-grid">
            <label className="anim-vote-field">
              <span>Outcome</span>
              <select value={roundOutcome} onChange={(e) => setRoundOutcome(e.target.value)}>
                <option value="winner">Winner Found</option>
                <option value="timeup">Time Up / No Winner</option>
              </select>
            </label>

            <label className="anim-vote-field">
              <span>Winner Name</span>
              <input
                type="text"
                value={winnerName}
                onChange={(e) => setWinnerName(e.target.value)}
                placeholder="Team / Player"
              />
            </label>

            <label className="anim-vote-field">
              <span>Winner Player</span>
              <select
                value={winnerPid}
                onChange={(e) => {
                  const next = e.target.value;
                  setWinnerPid(next);
                  const winner = SANDBOX_PLAYERS.find((p) => p.pid === next);
                  if (winner) setWinnerName(winner.name);
                }}
              >
                {SANDBOX_PLAYERS.map((p) => (
                  <option key={p.pid} value={p.pid}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="anim-vote-field">
              <span>Points Delta</span>
              <input
                type="number"
                min="0"
                max="9"
                value={pointsDelta}
                onChange={(e) => setPointsDelta(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <label className="anim-vote-field">
              <span>Winner Team</span>
              <select value={winnerTeam} onChange={(e) => setWinnerTeam(e.target.value === "B" ? "B" : "A")}>
                <option value="A">Red Team (A)</option>
                <option value="B">Blue Team (B)</option>
              </select>
            </label>

            <label className="anim-vote-field">
              <span>Your Team</span>
              <select value={myTeam} onChange={(e) => setMyTeam(e.target.value)}>
                <option value="A">Red Team (A)</option>
                <option value="B">Blue Team (B)</option>
                <option value="NONE">Observer</option>
              </select>
            </label>

            <label className="anim-vote-field">
              <span>Revealed Word</span>
              <input
                type="text"
                value={revealedWord}
                onChange={(e) => setRevealedWord(e.target.value.toUpperCase())}
                placeholder="WORD"
              />
            </label>

            <label className="anim-vote-field">
              <span>Timer (s)</span>
              <input
                type="number"
                min="0"
                max="99"
                value={voteRemaining}
                onChange={(e) => {
                  setVoteEnded(false);
                  setVoteRemaining(Math.max(0, Number(e.target.value) || 0));
                }}
              />
            </label>

            <label className="anim-vote-field">
              <span>Eligible</span>
              <input
                type="number"
                min="1"
                max="12"
                value={eligibleCount}
                onChange={(e) => setEligibleCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>

            <label className="anim-vote-field">
              <span>Yes Count</span>
              <input
                type="number"
                min="0"
                max={eligibleCount}
                value={yesCount}
                onChange={(e) => setYesCount(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <label className="anim-vote-field">
              <span>Voted Count</span>
              <input
                type="number"
                min="0"
                max={eligibleCount}
                value={votedCount}
                onChange={(e) => setVotedCount(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <div className="anim-vote-toggles">
              <button
                className={`anim-btn ${hasVoted ? "anim-btn-primary" : ""}`}
                onClick={() => {
                  const next = !hasVoted;
                  setHasVoted(next);
                  if (next) setVoteChoice("yes");
                }}
              >
                {hasVoted ? "Voted" : "Not Voted"}
              </button>
              <button
                className={`anim-btn ${voteEnded ? "anim-btn-primary" : ""}`}
                onClick={() => setVoteEnded((v) => !v)}
              >
                {voteEnded ? "Window Ended" : "Window Active"}
              </button>
              <button
                className={`anim-btn ${showVoteError ? "anim-btn-primary" : ""}`}
                onClick={() => setShowVoteError((v) => !v)}
              >
                {showVoteError ? "Error On" : "Error Off"}
              </button>
              <button className="anim-btn" onClick={resetVoteSandbox}>
                Reset
              </button>
              <button className="anim-btn" onClick={triggerVoteAnimation}>
                Replay Anim
              </button>
            </div>
          </div>
        </div>

        <div className="anim-vote-grid">
          <div className="anim-panel anim-vote-panel">
            <div className="anim-label">Single Theme Vote Modal</div>
            <div className="vote-sbx-surface">
              <div
                key={`single-vote-${voteAnimKey}`}
                className="vote-sbx-modal-card vote-sbx-modal-card--single vote-sbx-card--pop"
              >
                <div className="vote-sbx-modal-header">
                  <h3 className="vote-sbx-title">
                    {roundOutcome === "winner" ? `${winnerDisplayName} is correct!` : "TIME'S UP!"}
                  </h3>
                  <p className="vote-sbx-subtitle">Play next round or stop?</p>
                  <p className="vote-sbx-meta">
                    {voteEnded
                      ? "Vote window ended. Resolving..."
                      : `Vote ends in: ${Math.max(0, voteRemaining)}s`}
                  </p>
                  <p className="vote-sbx-meta vote-sbx-meta--stats">
                    YES: {yesCount} / {eligibleCount} - Voted: {votedCount} / {eligibleCount}
                  </p>
                </div>

                <div className="vote-sbx-payout">
                  <div className="vote-sbx-payout-title">Round Points Preview</div>
                  <div className={`vote-sbx-payout-chips ${payoutActive ? "vote-sbx-payout-chips--active" : ""}`}>
                    {scoreRows.map((p, idx) => (
                      <div
                        key={p.pid}
                        className={`vote-sbx-payout-chip ${p.isWinner ? "vote-sbx-payout-chip--winner" : ""}`}
                        style={{ "--vote-sbx-chip-delay": `${idx * 70}ms` }}
                      >
                        <div className="vote-sbx-payout-name">{p.name}</div>
                        <div className="vote-sbx-payout-total">
                          <span className="vote-sbx-payout-old">{p.oldPoints}</span>
                          <span className="vote-sbx-payout-arrow">{"->"}</span>
                          <span
                            className={`vote-sbx-payout-new ${
                              p.isWinner && payoutShowTotals ? "vote-sbx-payout-new--on" : ""
                            }`}
                          >
                            {p.newPoints}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="vote-sbx-actions">
                  <button
                    className="vote-sbx-btn vote-sbx-btn--yes"
                    disabled={hasVoted || voteEnded}
                    onClick={() => {
                      setHasVoted(true);
                      setVoteChoice("yes");
                    }}
                  >
                    Play Next Round
                  </button>
                  <button
                    className="vote-sbx-btn vote-sbx-btn--no"
                    disabled={hasVoted || voteEnded}
                    onClick={() => {
                      setHasVoted(true);
                      setVoteChoice("no");
                    }}
                  >
                    Stop
                  </button>
                </div>

                {hasVoted && (
                  <p className="vote-sbx-status vote-sbx-status--ok">
                    Vote submitted ({voteChoice || "yes"}). Waiting for other players...
                  </p>
                )}
                {showVoteError && (
                  <p className="vote-sbx-status vote-sbx-status--error">
                    BAD_PHASE: Vote rejected by server.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="anim-panel anim-vote-panel">
            <div className="anim-label">VS Structure + Single Theme Vote</div>
            <div className="vote-sbx-surface">
              <div
                key={`vs-vote-${voteAnimKey}`}
                className="vote-sbx-vs-card vote-sbx-card--pop"
              >
                <div className="vote-sbx-round-tag">Round 3 / 5</div>
                <div className="vote-sbx-team-row vote-sbx-team-row--compact">
                  {roundOutcome === "winner" ? (
                    <span className={`vote-sbx-team-badge vote-sbx-team-badge--${winnerTone}`}>
                      Winner: {winnerTeamLabel}
                    </span>
                  ) : (
                    <span className="vote-sbx-team-badge vote-sbx-team-badge--neutral">
                      No Winner
                    </span>
                  )}
                  <span className="vote-sbx-team-badge vote-sbx-team-badge--self">
                    You: {myTeamLabel}
                  </span>
                </div>
                <div
                  className={`vote-sbx-outcome vote-sbx-outcome--${
                    roundOutcome === "winner" ? winnerTone : "timeup"
                  }`}
                >
                  <div className="vote-sbx-outcome-icon">
                    {roundOutcome === "winner" ? "WIN" : "TIME"}
                  </div>
                  <div className="vote-sbx-outcome-title">
                    {roundOutcome === "winner" ? `${winnerDisplayName} Won` : "No Winner"}
                  </div>
                  <div className="vote-sbx-word">Word: {revealedWord || "TIGER"}</div>
                </div>

                <div className="vote-sbx-divider" />

                <div className="vote-sbx-payout vote-sbx-payout--compact">
                  <div className="vote-sbx-payout-title">Points Awarded</div>
                  <div className={`vote-sbx-payout-chips ${payoutActive ? "vote-sbx-payout-chips--active" : ""}`}>
                    {scoreRows.map((p, idx) => (
                      <div
                        key={`vs-${p.pid}`}
                        className={`vote-sbx-payout-chip ${p.isWinner ? "vote-sbx-payout-chip--winner" : ""}`}
                        style={{ "--vote-sbx-chip-delay": `${idx * 70}ms` }}
                      >
                        <div className="vote-sbx-payout-name">{p.name}</div>
                        <div className="vote-sbx-payout-total">
                          <span className="vote-sbx-payout-old">{p.oldPoints}</span>
                          <span className="vote-sbx-payout-arrow">{"->"}</span>
                          <span
                            className={`vote-sbx-payout-new ${
                              p.isWinner && payoutShowTotals ? "vote-sbx-payout-new--on" : ""
                            }`}
                          >
                            {p.newPoints}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="vote-sbx-vote-block">
                  <p className="vote-sbx-meta">
                    {voteEnded
                      ? "Vote window ended. Resolving..."
                      : `Vote ends in: ${Math.max(0, voteRemaining)}s`}
                  </p>
                  <p className="vote-sbx-meta vote-sbx-meta--stats">
                    YES: {yesCount} / {eligibleCount} - Voted: {votedCount} / {eligibleCount}
                  </p>

                  <div className="vote-sbx-actions">
                    <button
                      className="vote-sbx-btn vote-sbx-btn--yes"
                      disabled={hasVoted || voteEnded}
                      onClick={() => {
                        setHasVoted(true);
                        setVoteChoice("yes");
                      }}
                    >
                      Play Next Round
                    </button>
                    <button
                      className="vote-sbx-btn vote-sbx-btn--no"
                      disabled={hasVoted || voteEnded}
                      onClick={() => {
                        setHasVoted(true);
                        setVoteChoice("no");
                      }}
                    >
                      End Match
                    </button>
                  </div>
                </div>

                {hasVoted && (
                  <p className="vote-sbx-status vote-sbx-status--ok">
                    Vote submitted ({voteChoice || "yes"}). Waiting for others...
                  </p>
                )}
                {showVoteError && (
                  <p className="vote-sbx-status vote-sbx-status--error">
                    BAD_STATE: Vote window closed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="anim-grid">
          <div className="anim-panel">
            <div className="anim-label">Draw Phase Transition</div>
            <div className="anim-preview" ref={drawPreviewRef}>
              {drawStarted && (
                <div className="flip-card">
                  <div
                    key={drawFlipKey}
                    className={`flip-inner ${drawFlipped ? "is-flipped" : ""}`}
                  >
                    <div className="flip-face flip-front">
                      <div className="anim-banner anim-banner-timeup pop-in">DRAW TIME UP!</div>
                    </div>
                    <div className="flip-face flip-back">
                      <div className={`anim-chip anim-chip-draw ${drawFlipped ? "pop-in" : ""} ${drawExit ? "pop-out" : ""}`}>
                        DRAW PHASE
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button className="anim-btn" onClick={triggerDrawFlip}>
              Trigger
            </button>
          </div>

          <div className="anim-panel">
            <div className="anim-label">Guess Phase Transition</div>
            <div className="anim-preview" ref={guessPreviewRef}>
              {guessStarted && (
                <div className="flip-card">
                  <div
                    key={guessFlipKey}
                    className={`flip-inner ${guessFlipped ? "is-flipped" : ""}`}
                  >
                    <div className="flip-face flip-front">
                      <div className="anim-banner anim-banner-timeup pop-in">GUESS TIME UP!</div>
                    </div>
                    <div className="flip-face flip-back">
                      <div className={`anim-chip anim-chip-guess ${guessFlipped ? "pop-in" : ""} ${guessExit ? "pop-out" : ""}`}>
                        GUESS PHASE
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button className="anim-btn" onClick={triggerGuessFlip}>
              Trigger
            </button>
          </div>

          <div className="anim-panel">
            <div className="anim-label">Correct Guess Transition</div>
            <div className="anim-preview" ref={winPreviewRef}>
              {winStarted && (
                <div className="flip-card">
                  <div
                    key={winFlipKey}
                    className={`flip-inner ${winFlipped ? "is-flipped" : ""}`}
                  >
                    <div className="flip-face flip-front">
                      <div className="anim-banner anim-banner-winner pop-in">WE FOUND A WINNER!!</div>
                    </div>
                    <div className="flip-face flip-back">
                      <div className={`anim-banner anim-banner-correct ${winFlipped ? "pop-in" : ""} ${winExit ? "pop-out" : ""}`}>
                        Correct guess is TIGER
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button className="anim-btn" onClick={triggerWinFlip}>
              Trigger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimationTester;
