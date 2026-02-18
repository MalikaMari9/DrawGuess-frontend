import { useEffect, useRef, useState } from "react";
import "../styles/AnimationTester.css";

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

  const DELAY_MS = 1500;
  const TIME_UP_MS = 900;
  const PHASE_SHOW_MS = 1300;
  const PHASE_OUT_MS = 700;

  const triggerAll = () => {
    triggerDrawFlip();
    triggerGuessFlip();
    triggerWinFlip();
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
