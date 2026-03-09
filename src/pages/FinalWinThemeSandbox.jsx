import { useMemo, useState } from "react";
import singleWinCss from "../styles/SingleWin.css?raw";
import "../styles/FinalWinThemeSandbox.css";

const SINGLE_SANDBOX_PLAYERS = [
  { pid: "p1", name: "Ava", points: 7, connected: true },
  { pid: "p2", name: "Milo", points: 4, connected: true },
  { pid: "p3", name: "Nora", points: 2, connected: true },
  { pid: "p4", name: "Zed", points: 1, connected: true },
];

const BATTLE_SANDBOX_PLAYERS = [
  { pid: "p1", name: "Ava", points: 6, connected: true },
  { pid: "p2", name: "Milo", points: 6, connected: true },
  { pid: "p3", name: "Nora", points: 4, connected: true },
  { pid: "p4", name: "Zed", points: 3, connected: false },
];
const CROWN_ICON = "\uD83D\uDC51";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const makeConfettiScript = ({ colors, stopAfterMs }) => `
<script>
(function () {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const palette = ${JSON.stringify(colors)};
  const stopAfter = ${Number(stopAfterMs) || 0};
  const particleCount = 90;
  let frame = null;
  let timeoutId = null;

  function Particle() {
    this.x = Math.random() * width;
    this.y = Math.random() * height - height;
    this.size = Math.random() * 6 + 3;
    this.speedY = Math.random() * 3 + 1.6;
    this.speedX = Math.random() * 2 - 1;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 8 - 4;
    this.color = palette[Math.floor(Math.random() * palette.length)] || "#ffffff";
  }

  Particle.prototype.update = function () {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;
    if (this.y > height) {
      this.y = -10;
      this.x = Math.random() * width;
    }
  };

  Particle.prototype.draw = function () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  };

  const particles = [];
  for (let i = 0; i < particleCount; i += 1) particles.push(new Particle());

  const tick = () => {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.update();
      p.draw();
    }
    frame = requestAnimationFrame(tick);
  };
  tick();

  if (stopAfter > 0) {
    timeoutId = setTimeout(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = null;
      ctx.clearRect(0, 0, width, height);
    }, stopAfter);
  }

  window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  });

  window.addEventListener("beforeunload", () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (frame) cancelAnimationFrame(frame);
  });
})();
</script>
`;

const normalizeAndSortPlayers = (players) => {
  const sorted = [...players]
    .map((p) => {
      const score = Number(p?.points ?? p?.score ?? 0);
      const name = p?.name || "Player";
      return {
        id: p?.pid || p?.id || name,
        pid: p?.pid || p?.id || name,
        name,
        score: Number.isFinite(score) ? score : 0,
        connected: p?.connected !== false,
        avatar: String(name).charAt(0).toUpperCase() || "?",
      };
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)));

  let rank = 0;
  let prevScore = null;
  return sorted.map((p, idx) => {
    if (prevScore === null || p.score < prevScore) {
      rank = idx + 1;
      prevScore = p.score;
    }
    return { ...p, rank };
  });
};

const formatWinnerNamesWithCrown = (winners) => {
  if (!winners.length) return "Winner";
  return winners.map((w) => `${w.name} ${CROWN_ICON}`).join(" \u00B7 ");
};

const buildSingleBaseHtml = ({
  players,
  subtitle,
  showPointsLine,
  pointsLineLabel,
  confettiStopAfterMs,
}) => {
  const sortedPlayers = normalizeAndSortPlayers(players);
  const topScore = sortedPlayers[0]?.score ?? 0;
  const winners = sortedPlayers.filter((p) => p.score === topScore);
  const winnerNameLine = formatWinnerNamesWithCrown(winners);
  const primaryWinner = winners[0] || { avatar: "W", name: "Winner", score: 0 };

  const rows = sortedPlayers
    .map(
      (player) => `
      <div class="score-row" style="opacity:${player.connected ? 1 : 0.62};">
        <div class="rank-num ${player.rank === 1 ? "rank-1" : player.rank === 2 ? "rank-2" : player.rank === 3 ? "rank-3" : ""}">
          ${player.rank}
        </div>
        <div class="row-avatar" style="background:#334155;box-shadow:none;">
          ${escapeHtml(player.avatar)}
        </div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(player.name)}</div>
        </div>
        <div class="row-score">${player.score.toLocaleString()}</div>
      </div>
    `
    )
    .join("");

  const pointsLine = showPointsLine
    ? `<div class="winner-points">${escapeHtml(pointsLineLabel || `${topScore.toLocaleString()} PTS`)}</div>`
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${singleWinCss}</style>
    <style>
      .winner-name {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .winner-name .crown-inline {
        font-size: 0.95em;
      }
    </style>
  </head>
  <body>
    <div class="win-wrapper">
      <canvas id="confetti-canvas" class="confetti-canvas"></canvas>
      <div class="main-layout">
        <div class="frame frame-winner">
          <h1 class="victory-title">VICTORY</h1>
          <div class="subtitle">${escapeHtml(subtitle || "Game Over")}</div>
          <div class="winner-card">
            <div class="trophy-icon">&#127942;</div>
            <div class="winner-avatar">${escapeHtml(primaryWinner.avatar)}</div>
            <div class="winner-name">${escapeHtml(winnerNameLine)}</div>
            ${pointsLine}
          </div>
          <div class="actions">
            <button class="btn">Main Menu</button>
          </div>
        </div>

        <div class="frame">
          <div class="frame-title">Final Standings</div>
          <div class="score-list">
            ${rows}
          </div>
        </div>
      </div>
    </div>
    ${makeConfettiScript({
      colors: ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#ffffff"],
      stopAfterMs: confettiStopAfterMs,
    })}
  </body>
</html>
`;
};

const FinalWinThemeSandbox = () => {
  const [viewMode, setViewMode] = useState("split"); // split | single | battle
  const [refreshSeed, setRefreshSeed] = useState(0);

  const singleDoc = useMemo(
    () =>
      buildSingleBaseHtml({
        players: SINGLE_SANDBOX_PLAYERS,
        showPointsLine: true,
        confettiStopAfterMs: 4000,
      }),
    []
  );

  const battleDoc = useMemo(
    () =>
      buildSingleBaseHtml({
        players: BATTLE_SANDBOX_PLAYERS,
        showPointsLine: false,
        pointsLineLabel: "",
        confettiStopAfterMs: 0,
      }),
    []
  );

  return (
    <div className="final-win-sbx">
      <div className="final-win-sbx__toolbar">
        <div className="final-win-sbx__group">
          <span className="final-win-sbx__label">View</span>
          <button
            type="button"
            className={`final-win-sbx__btn ${viewMode === "split" ? "is-active" : ""}`}
            onClick={() => setViewMode("split")}
          >
            Split
          </button>
          <button
            type="button"
            className={`final-win-sbx__btn ${viewMode === "single" ? "is-active" : ""}`}
            onClick={() => setViewMode("single")}
          >
            Single Only
          </button>
          <button
            type="button"
            className={`final-win-sbx__btn ${viewMode === "battle" ? "is-active" : ""}`}
            onClick={() => setViewMode("battle")}
          >
            VS Only
          </button>
        </div>

        <div className="final-win-sbx__group">
          <button
            type="button"
            className="final-win-sbx__btn"
            onClick={() => setRefreshSeed((s) => s + 1)}
          >
            Replay Confetti
          </button>
        </div>
      </div>

      <div className={`final-win-sbx__stage final-win-sbx__stage--${viewMode}`}>
        {viewMode !== "battle" ? (
          <section className="final-win-sbx__panel">
            <iframe
              key={`single-${refreshSeed}`}
              title="single-win-sandbox"
              className="final-win-sbx__frame"
              srcDoc={singleDoc}
            />
          </section>
        ) : null}

        {viewMode !== "single" ? (
          <section className="final-win-sbx__panel">
            <iframe
              key={`battle-${refreshSeed}`}
              title="battle-win-sandbox"
              className="final-win-sbx__frame"
              srcDoc={battleDoc}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default FinalWinThemeSandbox;
