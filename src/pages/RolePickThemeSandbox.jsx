import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/RolePickThemeSandbox.css";

const NAME_POOL = [
  "DragonSlayer",
  "NeonRider",
  "CyberPunk",
  "PixelArt",
  "ShadowNinja",
  "GhostShell",
  "Vortex",
  "IronFist",
  "Nova",
  "Blaze",
  "Comet",
  "Echo",
  "Falcon",
  "Glitch",
  "Helix",
  "Jade",
];

const ITEM_HEIGHT = 73.33;
const MIN_SINGLE = 3;
const MIN_VS = 5;
const MAX_PLAYERS = 12;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createRng = (seed) => {
  let x = (seed >>> 0) || 1;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 4294967296;
  };
};

const shuffle = (arr, rand) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const generateStripData = (items) => {
  const base = Array.from(new Set((items || []).filter(Boolean)));
  const seed = base.length ? base : ["-"];
  let out = [];
  for (let i = 0; i < 4; i += 1) out = out.concat(seed);
  return out;
};

const clampPlayerCount = (mode, count) => {
  const n = Number(count) || 0;
  const min = mode === "VS" ? MIN_VS : MIN_SINGLE;
  return Math.max(min, Math.min(MAX_PLAYERS, n));
};

const buildScenario = (mode, count, seed) => {
  const safeCount = clampPlayerCount(mode, count);
  const rand = createRng(seed);
  const names = shuffle(NAME_POOL, rand).slice(0, safeCount);
  const players = names.map((name, idx) => ({
    pid: `p${idx + 1}`,
    name,
  }));
  const ordered = shuffle(players, rand);
  const gm = ordered[0] || null;
  const nonGm = ordered.slice(1);

  if (!gm) {
    return {
      mode,
      count: 0,
      gmPid: "",
      assignments: [],
      reelQueue: [],
      teams: { A: [], B: [] },
    };
  }

  if (mode === "SINGLE") {
    const drawer = nonGm[0] || null;
    const assignments = [
      { pid: gm.pid, name: gm.name, role: "GM", team: "S", teamLabel: "SINGLE" },
      ...nonGm.map((p) => ({
        pid: p.pid,
        name: p.name,
        role: drawer && p.pid === drawer.pid ? "DRAWER" : "GUESSER",
        team: "S",
        teamLabel: "SINGLE",
      })),
    ];

    return {
      mode,
      count: safeCount,
      gmPid: gm.pid,
      assignments,
      reelQueue: assignments,
      teams: { A: [], B: [] },
    };
  }

  const split = Math.ceil(nonGm.length / 2);
  const teamA = nonGm.slice(0, split);
  const teamB = nonGm.slice(split);
  const drawerA = teamA[0] || null;
  const drawerB = teamB[0] || null;

  const aAssignments = teamA.map((p) => ({
    pid: p.pid,
    name: p.name,
    role: drawerA && p.pid === drawerA.pid ? "DRAWER A" : "GUESSER A",
    team: "A",
    teamLabel: "TEAM A",
  }));
  const bAssignments = teamB.map((p) => ({
    pid: p.pid,
    name: p.name,
    role: drawerB && p.pid === drawerB.pid ? "DRAWER B" : "GUESSER B",
    team: "B",
    teamLabel: "TEAM B",
  }));

  const assignments = [
    { pid: gm.pid, name: gm.name, role: "GM", team: "GM", teamLabel: "GAME MASTER" },
    ...aAssignments,
    ...bAssignments,
  ];

  return {
    mode,
    count: safeCount,
    gmPid: gm.pid,
    assignments,
    reelQueue: [...aAssignments, ...bAssignments],
    teams: { A: aAssignments, B: bAssignments },
  };
};

const RolePickThemeSandbox = () => {
  const [mode, setMode] = useState("VS");
  const [playerCount, setPlayerCount] = useState(8);
  const [seed, setSeed] = useState(() => Date.now() & 0xfffffff);
  const [viewerPid, setViewerPid] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [statusText, setStatusText] = useState("CONFIGURE SCENARIO");

  const reel1Ref = useRef(null);
  const reel2Ref = useRef(null);
  const reel3Ref = useRef(null);
  const strip1Ref = useRef(null);
  const strip2Ref = useRef(null);
  const strip3Ref = useRef(null);

  const scenario = useMemo(
    () => buildScenario(mode, playerCount, seed),
    [mode, playerCount, seed]
  );

  useEffect(() => {
    setPlayerCount((prev) => clampPlayerCount(mode, prev));
  }, [mode]);

  useEffect(() => {
    if (!scenario.assignments.length) {
      setViewerPid("");
      return;
    }
    if (!viewerPid || !scenario.assignments.some((p) => p.pid === viewerPid)) {
      setViewerPid(scenario.assignments[0].pid);
    }
  }, [scenario, viewerPid]);

  const viewer = useMemo(
    () => scenario.assignments.find((p) => p.pid === viewerPid) || null,
    [scenario, viewerPid]
  );

  const reelNamePool = useMemo(
    () => generateStripData(scenario.reelQueue.map((r) => r.name)),
    [scenario]
  );
  const reelRolePool = useMemo(
    () => generateStripData(scenario.reelQueue.map((r) => r.role)),
    [scenario]
  );
  const reelTeamPool = useMemo(() => {
    if (mode === "VS") {
      return generateStripData(scenario.reelQueue.map((r) => r.teamLabel));
    }
    return generateStripData(["SINGLE"]);
  }, [mode, scenario]);

  const stopReel = (stripRef, reelRef, targetText) => {
    const stripElement = stripRef.current;
    const reelElement = reelRef.current;
    if (!stripElement || !reelElement) return;

    reelElement.classList.remove("spinning");
    const items = Array.from(stripElement.querySelectorAll(".reel-item"));
    const normalizedTarget = String(targetText || "").trim();
    const matchingIndexes = items.reduce((acc, el, index) => {
      if (String(el.textContent || "").trim() === normalizedTarget) acc.push(index);
      return acc;
    }, []);
    if (!matchingIndexes.length) return;

    const anchorIndex = Math.floor(items.length / 2);
    const targetIndex = matchingIndexes.reduce(
      (closest, idx) =>
        Math.abs(idx - anchorIndex) < Math.abs(closest - anchorIndex) ? idx : closest,
      matchingIndexes[0]
    );

    const itemHeight = items[0]?.getBoundingClientRect?.().height || ITEM_HEIGHT;
    const paylineY = (reelElement.clientHeight || itemHeight * 3) / 2;
    const scrollY = paylineY - (targetIndex * itemHeight + itemHeight / 2);
    reelElement.style.setProperty("--target-y", `${scrollY}px`);
    stripElement.style.transition = "transform 0.5s cubic-bezier(0.1, 0.7, 0.1, 1)";
    stripElement.style.transform = `translateY(${scrollY}px)`;

    items.forEach((el) => el.classList.remove("winning"));
    items[targetIndex].classList.add("winning");

    reelElement.classList.remove("bouncing");
    void reelElement.offsetWidth;
    reelElement.classList.add("bouncing");
  };

  const spinSlots = async () => {
    if (isSpinning || !scenario.reelQueue.length) return;
    setIsSpinning(true);
    setStatusText("CHECKING...");

    [reel1Ref, reel2Ref, reel3Ref].forEach((ref) => {
      if (!ref.current) return;
      const strip = ref.current.querySelector(".reel-strip");
      ref.current.classList.add("spinning");
      ref.current.classList.remove("bouncing");
      if (strip) {
        strip.style.transition = "transform 0s linear";
        strip.style.transform = "translateY(0)";
      }
    });

    for (let i = 0; i < scenario.reelQueue.length; i += 1) {
      const result = scenario.reelQueue[i];
      await wait(420);
      stopReel(strip1Ref, reel1Ref, result.name);
      await wait(220);
      stopReel(strip2Ref, reel2Ref, result.role);
      await wait(220);
      stopReel(strip3Ref, reel3Ref, result.teamLabel);
      await wait(120);
    }

    setStatusText("JACKPOT! VIEW READY");
    setIsSpinning(false);
  };

  const regenerateScenario = () => {
    if (isSpinning) return;
    setSeed((s) => (s + 1013904223) >>> 0);
    setStatusText("SCENARIO UPDATED");
  };

  const gmCard = useMemo(
    () => scenario.assignments.find((p) => p.role === "GM") || null,
    [scenario]
  );

  const singleCards = useMemo(
    () =>
      scenario.assignments.slice().sort((a, b) => {
        const ra = a.role === "GM" ? 0 : a.role === "DRAWER" ? 1 : 2;
        const rb = b.role === "GM" ? 0 : b.role === "DRAWER" ? 1 : 2;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      }),
    [scenario]
  );

  const isViewer = (pid) => Boolean(viewerPid && pid === viewerPid);
  const minPlayers = mode === "VS" ? MIN_VS : MIN_SINGLE;

  return (
    <div className="rolepick-theme-sandbox">
      <div className="rolepick-theme-shell">
        <div className="left-column">
          <div className="sandbox-config">
            <div className="sandbox-config-row">
              <div className="sandbox-field">
                <label htmlFor="rp-mode">Mode</label>
                <select
                  id="rp-mode"
                  value={mode}
                  onChange={(e) => setMode(String(e.target.value || "VS").toUpperCase())}
                >
                  <option value="VS">VS</option>
                  <option value="SINGLE">SINGLE</option>
                </select>
              </div>

              <div className="sandbox-field">
                <label htmlFor="rp-count">Players</label>
                <input
                  id="rp-count"
                  type="number"
                  min={minPlayers}
                  max={MAX_PLAYERS}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(clampPlayerCount(mode, Number(e.target.value)))}
                />
              </div>

              <div className="sandbox-field sandbox-field-wide">
                <label htmlFor="rp-viewer">View As Player</label>
                <select
                  id="rp-viewer"
                  value={viewerPid}
                  onChange={(e) => setViewerPid(e.target.value)}
                >
                  {scenario.assignments.map((p) => (
                    <option key={p.pid} value={p.pid}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sandbox-config-actions">
              <button className="spin-btn" onClick={regenerateScenario} disabled={isSpinning}>
                Regenerate Setup
              </button>
              <button className="spin-btn" onClick={spinSlots} disabled={isSpinning}>
                {isSpinning ? "SPINNING..." : "Spin Preview"}
              </button>
            </div>

            <div className="sandbox-summary">
              <span>Total: {scenario.count}</span>
              {viewer && (
                <span>
                  Viewing: {viewer.name} ({viewer.role})
                </span>
              )}
              {mode === "VS" && (
                <span>
                  A: {scenario.teams.A.length} | B: {scenario.teams.B.length}
                </span>
              )}
            </div>
          </div>

          <div className="machine-container">
            <div className="slot-machine">
              <div className="machine-header">JACKPOT SLOTS</div>

              <div className="light red" />
              <div className="light blue" />
              <div className="light green" />
              <div className="light yellow" />

              <div className="reels-window">
                <div className="payline" />

                <div className="reel" ref={reel1Ref}>
                  <div className="reel-strip" ref={strip1Ref}>
                    {reelNamePool.map((item, index) => (
                      <div key={`name-${item}-${index}`} className="reel-item">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="reel" ref={reel2Ref}>
                  <div className="reel-strip" ref={strip2Ref}>
                    {reelRolePool.map((item, index) => (
                      <div key={`role-${item}-${index}`} className="reel-item">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="reel" ref={reel3Ref}>
                  <div className="reel-strip" ref={strip3Ref}>
                    {reelTeamPool.map((item, index) => (
                      <div key={`team-${item}-${index}`} className="reel-item">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="spacer" />

          <div className="bottom-controls">
            <div className="status-text">{statusText}</div>
          </div>
        </div>

        <div className="right-column">
          <div className="gm-bar">
            <div className="gm-badge">
              <span>*</span>
              <span>
                Game Master: {gmCard?.name || "Unknown"}
                {isViewer(gmCard?.pid) ? " (YOU)" : ""}
              </span>
            </div>
          </div>

          {mode === "VS" ? (
            <div className="teams-container">
              <div className="team-column team-gm">
                <div className="team-header">
                  <span>Game Master</span>
                  <span className="count-badge">{gmCard ? 1 : 0}</span>
                </div>
                <div className="player-list">
                  {gmCard && (
                    <div className={`player-card ${isViewer(gmCard.pid) ? "player-card-you" : ""}`}>
                      <div className="avatar" style={{ background: "var(--gm-yellow)" }}>
                        {(gmCard.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {gmCard.name}
                          {isViewer(gmCard.pid) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: "var(--gm-yellow)",
                            background: "rgba(234, 179, 8, 0.15)",
                            borderColor: "rgba(250, 204, 21, 0.4)",
                          }}
                        >
                          GM
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="team-column team-orange">
                <div className="team-header">
                  <span>Team A</span>
                  <span className="count-badge">{scenario.teams.A.length}</span>
                </div>
                <div className="player-list">
                  {scenario.teams.A.map((player) => (
                    <div
                      key={player.pid}
                      className={`player-card ${isViewer(player.pid) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-orange)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isViewer(player.pid) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: player.role.startsWith("DRAWER")
                              ? "var(--gm-yellow)"
                              : "var(--text-muted)",
                            background: player.role.startsWith("DRAWER")
                              ? "rgba(234, 179, 8, 0.15)"
                              : "rgba(255, 255, 255, 0.05)",
                            borderColor: player.role.startsWith("DRAWER")
                              ? "rgba(250, 204, 21, 0.4)"
                              : "rgba(255,255,255,0.1)",
                          }}
                        >
                          {player.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="team-column team-blue">
                <div className="team-header">
                  <span>Team B</span>
                  <span className="count-badge">{scenario.teams.B.length}</span>
                </div>
                <div className="player-list">
                  {scenario.teams.B.map((player) => (
                    <div
                      key={player.pid}
                      className={`player-card ${isViewer(player.pid) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-blue)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isViewer(player.pid) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: player.role.startsWith("DRAWER")
                              ? "var(--gm-yellow)"
                              : "var(--text-muted)",
                            background: player.role.startsWith("DRAWER")
                              ? "rgba(234, 179, 8, 0.15)"
                              : "rgba(255, 255, 255, 0.05)",
                            borderColor: player.role.startsWith("DRAWER")
                              ? "rgba(250, 204, 21, 0.4)"
                              : "rgba(255,255,255,0.1)",
                          }}
                        >
                          {player.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="teams-container">
              <div className="team-column team-orange">
                <div className="team-header">
                  <span>Single Roles</span>
                  <span className="count-badge">{singleCards.length}</span>
                </div>
                <div className="player-list">
                  {singleCards.map((player) => (
                    <div
                      key={player.pid}
                      className={`player-card ${isViewer(player.pid) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-orange)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isViewer(player.pid) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color:
                              player.role.startsWith("DRAWER") || player.role === "GM"
                                ? "var(--gm-yellow)"
                                : "var(--text-muted)",
                            background:
                              player.role.startsWith("DRAWER") || player.role === "GM"
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                            borderColor:
                              player.role.startsWith("DRAWER") || player.role === "GM"
                                ? "rgba(250, 204, 21, 0.4)"
                                : "rgba(255,255,255,0.1)",
                          }}
                        >
                          {player.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolePickThemeSandbox;
