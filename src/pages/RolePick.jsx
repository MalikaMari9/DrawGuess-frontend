import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/RolePickThemeSandbox.css";
import { useRoomWSContext } from "../ws/RoomWSContext";

const ROLE_PICK_FALLBACK_SEC = 10;
const ITEM_HEIGHT_FALLBACK = 73.33;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRolePickDebugEnabled = () => {
  if (typeof window === "undefined") return false;
  const explicit = window.localStorage.getItem("dg_rolepick_debug");
  if (explicit === "1") return true;
  const flowTrace = window.localStorage.getItem("dg_flow_trace");
  return flowTrace !== "0";
};

const rolePickDebug = (scope, payload) => {
  if (!isRolePickDebugEnabled()) return;
  console.log(`[FLOW][FE][role_pick][${scope}]`, payload);
};

const generateStripData = (items) => {
  const base = Array.from(new Set((items || []).filter(Boolean)));
  const seed = base.length ? base : ["-"];
  let out = [];
  for (let i = 0; i < 4; i += 1) out = out.concat(seed);
  return out;
};

const roleLabel = (player, gmPid) => {
  if (!player) return "PLAYER";
  if (player.pid === gmPid) return "GM";
  const raw = String(player.role || "").toLowerCase();
  if (raw === "drawer") return "DRAWER";
  if (raw === "guesser") return "GUESSER";
  if (raw === "drawera") return "DRAWER A";
  if (raw === "drawerb") return "DRAWER B";
  if (raw === "guessera") return "GUESSER A";
  if (raw === "guesserb") return "GUESSER B";
  return String(player.role || "PLAYER").toUpperCase();
};

const teamInfoForPlayer = (player, isVS) => {
  if (!isVS) return { team: "S", teamLabel: "SINGLE", teamColor: "single" };
  const role = String(player?.role || "").toLowerCase();
  if (player?.team === "A" || role.endsWith("a")) return { team: "A", teamLabel: "TEAM A", teamColor: "orange" };
  if (player?.team === "B" || role.endsWith("b")) return { team: "B", teamLabel: "TEAM B", teamColor: "blue" };
  return { team: "", teamLabel: "PENDING", teamColor: "pending" };
};

const RolePick = () => {
  const { ws } = useRoomWSContext();
  const navigate = useNavigate();
  const debugEnabled = useMemo(() => isRolePickDebugEnabled(), []);

  const snapshot = ws.snapshot || {};
  const room = snapshot.room || {};
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const roles = snapshot.roles || {};
  const isVS = String(room.mode || "").toUpperCase() === "VS";
  const myPid = ws.pid || sessionStorage.getItem("dg_pid") || localStorage.getItem("dg_pid");
  const myNameHint =
    (sessionStorage.getItem("dg_nickname") || localStorage.getItem("dg_nickname") || "").trim();
  const gmPid = useMemo(() => {
    const fromRoom = String(room.gm_pid || "").trim();
    if (fromRoom) return fromRoom;
    const fromRoles = String(roles.gm || roles.gm_pid || "").trim();
    if (fromRoles) return fromRoles;
    const fromPlayers = players.find((p) => String(p?.role || "").toLowerCase() === "gm");
    return fromPlayers?.pid || null;
  }, [room.gm_pid, roles.gm, roles.gm_pid, players]);
  const gmPlayer = useMemo(() => {
    if (!gmPid) return null;
    const found = players.find((p) => String(p?.pid || "") === String(gmPid));
    if (found) return found;
    return { pid: gmPid, name: `GM ${String(gmPid).slice(0, 4)}`, role: "gm", connected: false };
  }, [players, gmPid]);
  const myPlayer = useMemo(() => {
    if (myPid) {
      const byPid = players.find((p) => p?.pid === myPid);
      if (byPid) return byPid;
    }
    if (myNameHint) {
      const normalized = myNameHint.toLowerCase();
      const byName = players.find((p) => String(p?.name || "").trim().toLowerCase() === normalized);
      if (byName) return byName;
    }
    return null;
  }, [players, myPid, myNameHint]);

  const [statusText, setStatusText] = useState("ASSIGNING ROLES...");
  const [isSpinning, setIsSpinning] = useState(false);
  const [serverSync, setServerSync] = useState({ serverTs: 0, clientTs: 0 });
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [countdownText, setCountdownText] = useState("");

  const reel1Ref = useRef(null);
  const reel2Ref = useRef(null);
  const reel3Ref = useRef(null);
  const strip1Ref = useRef(null);
  const strip2Ref = useRef(null);
  const strip3Ref = useRef(null);
  const countdownFallbackEndAtRef = useRef(0);
  const lastSpinSignatureRef = useRef("");
  const navigatingRef = useRef(false);
  const spinUnmountedRef = useRef(false);

  const roleByPid = useMemo(() => {
    const map = {};
    const put = (pid, role) => {
      const key = String(pid || "").trim();
      if (!key) return;
      map[key] = role;
    };

    put(roles.gm || roles.gm_pid || gmPid, "gm");
    put(roles.drawer || roles.drawer_pid, "drawer");
    put(roles.drawerA, "drawerA");
    put(roles.drawerB, "drawerB");
    put(roles.guesserA, "guesserA");
    put(roles.guesserB, "guesserB");

    const singleGuessers = Array.isArray(roles.guesser_pids) ? roles.guesser_pids : [];
    singleGuessers.forEach((pid) => put(pid, "guesser"));

    return map;
  }, [roles, gmPid]);

  const resolvedMyPid = String(myPlayer?.pid || myPid || "");
  const isMe = (p) => Boolean(resolvedMyPid && p?.pid && String(p.pid) === resolvedMyPid);

  const inferRoleRaw = useMemo(() => {
    return (player) => {
      const pid = String(player?.pid || "").trim();
      if (!pid) return "";

      const direct = String(player?.role || "").trim();
      if (direct) return direct;

      const mapped = String(roleByPid[pid] || "").trim();
      if (mapped) return mapped;

      if (pid === String(gmPid || "")) return "gm";

      if (isVS) {
        if (player?.team === "A") return "guesserA";
        if (player?.team === "B") return "guesserB";
        return "";
      }

      const drawerPid = String(roles.drawer || roles.drawer_pid || "").trim();
      if (pid && drawerPid && pid === drawerPid) return "drawer";
      return "guesser";
    };
  }, [roleByPid, gmPid, isVS, roles]);

  const connectedPlayers = useMemo(
    () => players.filter((p) => p && p.connected !== false),
    [players]
  );

  const revealQueue = useMemo(() => {
    const base = connectedPlayers
      .filter((p) => !(gmPid && p.pid === gmPid))
      .map((p, idx) => {
        const inferredRoleRaw = inferRoleRaw(p);
        const merged = { ...p, role: inferredRoleRaw };
        const teamInfo = teamInfoForPlayer(merged, isVS);
        return {
          pid: p.pid,
          name: p.name || "Unknown",
          role: roleLabel(merged, gmPid),
          roleRaw: inferredRoleRaw,
          team: teamInfo.team,
          teamLabel: teamInfo.teamLabel,
          teamColor: teamInfo.teamColor,
          orderIndex: idx,
        };
      });

    if (isVS) {
      return base.sort((a, b) => {
        const ao = a.team === "A" ? 0 : a.team === "B" ? 1 : 2;
        const bo = b.team === "A" ? 0 : b.team === "B" ? 1 : 2;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
    }

    const withGm = gmPlayer
      ? [
          {
            pid: gmPlayer.pid,
            name: gmPlayer.name || "GM",
            role: "GM",
            roleRaw: "gm",
            team: "S",
            teamLabel: "SINGLE",
            teamColor: "single",
            orderIndex: -1,
          },
          ...base,
        ]
      : base;

    return withGm;
  }, [connectedPlayers, gmPid, gmPlayer, isVS, inferRoleRaw]);

  const viewerReelTarget = useMemo(() => {
    if (!resolvedMyPid) return null;

    const inQueue = revealQueue.find((r) => String(r.pid) === resolvedMyPid);
    if (inQueue) return inQueue;

    const fallbackName = myPlayer?.name || "YOU";
    const fallbackRoleRaw = inferRoleRaw({
      pid: resolvedMyPid,
      team: myPlayer?.team,
      role: myPlayer?.role,
    });
    if (!fallbackRoleRaw) return null;

    const merged = {
      pid: resolvedMyPid,
      name: fallbackName,
      role: fallbackRoleRaw,
      team: myPlayer?.team,
    };
    const ti = teamInfoForPlayer(merged, isVS);
    const role = roleLabel(merged, gmPid);
    const teamLabel = role === "GM" && isVS ? "GAME MASTER" : ti.teamLabel;

    return {
      pid: resolvedMyPid,
      name: fallbackName,
      role,
      roleRaw: fallbackRoleRaw,
      team: ti.team,
      teamLabel,
      teamColor: ti.teamColor,
      orderIndex: -1,
    };
  }, [resolvedMyPid, revealQueue, myPlayer, inferRoleRaw, gmPid, isVS]);

  useEffect(() => {
    if (!debugEnabled) return;
    rolePickDebug("identity", {
      state: room.state || "",
      mode: room.mode || "",
      wsPid: ws.pid || "",
      storedPid:
        sessionStorage.getItem("dg_pid") ||
        localStorage.getItem("dg_pid") ||
        "",
      resolvedMyPid,
      myPlayerPid: myPlayer?.pid || "",
      myPlayerName: myPlayer?.name || "",
      gmPid: gmPid || "",
      gmPlayerPid: gmPlayer?.pid || "",
      gmPlayerName: gmPlayer?.name || "",
      viewerTargetPid: viewerReelTarget?.pid || "",
      viewerTargetRole: viewerReelTarget?.role || "",
      viewerTargetTeam: viewerReelTarget?.teamLabel || "",
      playersCount: players.length,
      connectedCount: connectedPlayers.length,
    });

    if (isVS && !gmPlayer) {
      rolePickDebug("gm_missing_in_table", {
        gmPid: gmPid || "",
        roomGmPid: room.gm_pid || "",
        rolesGm: roles.gm || roles.gm_pid || "",
      });
    }

    if (viewerReelTarget?.role === "GM") {
      rolePickDebug("viewer_is_gm", {
        viewerPid: viewerReelTarget.pid || "",
        gmPid: gmPid || "",
        note: "Final reel lock will show GM for this client.",
      });
    }
  }, [
    debugEnabled,
    room.state,
    room.mode,
    room.gm_pid,
    ws.pid,
    resolvedMyPid,
    myPlayer?.pid,
    myPlayer?.name,
    gmPid,
    gmPlayer,
    gmPlayer?.pid,
    gmPlayer?.name,
    viewerReelTarget?.pid,
    viewerReelTarget?.role,
    viewerReelTarget?.teamLabel,
    players.length,
    connectedPlayers.length,
    isVS,
    roles.gm,
    roles.gm_pid,
  ]);

  const reelNamePool = useMemo(() => {
    const names = revealQueue.map((r) => r.name);
    if (viewerReelTarget?.name) names.push(viewerReelTarget.name);
    return generateStripData(names);
  }, [revealQueue, viewerReelTarget]);
  const reelRolePool = useMemo(() => {
    const rolesList = revealQueue.map((r) => r.role);
    if (viewerReelTarget?.role) rolesList.push(viewerReelTarget.role);
    return generateStripData(rolesList);
  }, [revealQueue, viewerReelTarget]);
  const reelTeamPool = useMemo(() => {
    const teams = isVS ? revealQueue.map((r) => r.teamLabel) : ["SINGLE"];
    if (viewerReelTarget?.teamLabel) teams.push(viewerReelTarget.teamLabel);
    return generateStripData(teams);
  }, [isVS, revealQueue, viewerReelTarget]);

  const { redPlayers, bluePlayers, singlePlayers, pendingPlayers } = useMemo(() => {
    if (isVS) {
      return {
        redPlayers: revealQueue.filter((p) => p.team === "A"),
        bluePlayers: revealQueue.filter((p) => p.team === "B"),
        singlePlayers: [],
        pendingPlayers: revealQueue.filter((p) => p.team !== "A" && p.team !== "B"),
      };
    }
    return {
      redPlayers: [],
      bluePlayers: [],
      singlePlayers: revealQueue,
      pendingPlayers: [],
    };
  }, [isVS, revealQueue]);

  const effectiveServerNow = serverSync.serverTs
    ? serverSync.serverTs + (nowSec - serverSync.clientTs)
    : nowSec;

  const rolePickEndAt = useMemo(() => {
    const fromServer = Number(room.countdown_end_at || 0);
    if (fromServer > 0) return fromServer;
    if (!countdownFallbackEndAtRef.current) {
      countdownFallbackEndAtRef.current = effectiveServerNow + ROLE_PICK_FALLBACK_SEC;
    }
    return countdownFallbackEndAtRef.current;
  }, [room.countdown_end_at, effectiveServerNow]);

  const secondsLeft = Math.max(0, Math.ceil(rolePickEndAt - effectiveServerNow));

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
    const targetIndex = matchingIndexes.reduce((closest, idx) =>
      Math.abs(idx - anchorIndex) < Math.abs(closest - anchorIndex) ? idx : closest
    , matchingIndexes[0]);

    const itemHeight = items[0]?.getBoundingClientRect?.().height || ITEM_HEIGHT_FALLBACK;
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

  useEffect(() => {
    spinUnmountedRef.current = false;
    return () => {
      spinUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (ws.status !== "CONNECTED") return;
    ws.send({ type: "snapshot" });
    const id = setInterval(() => ws.send({ type: "snapshot" }), 2000);
    return () => clearInterval(id);
  }, [ws.status, ws.send, room.state]);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const st = Number(snapshot.server_ts || 0);
    if (!st) return;
    setServerSync({ serverTs: st, clientTs: Math.floor(Date.now() / 1000) });
  }, [snapshot.server_ts]);

  useEffect(() => {
    const resetKey = `${room.mode || ""}:${room.state || ""}:${room.round_no || 0}:${room.game_no || 0}`;
    if (!resetKey) return;
    navigatingRef.current = false;
    countdownFallbackEndAtRef.current = 0;
  }, [room.mode, room.state, room.round_no, room.game_no]);

  useEffect(() => {
    if (room.state === "WAITING") {
      navigate(isVS ? "/battle-lobby" : "/single-lobby");
      return;
    }
    if (room.state === "IN_GAME") {
      navigate(isVS ? "/battle-game" : "/single-game");
      return;
    }
    if (room.state === "GAME_END") {
      navigate(isVS ? "/battle-round-win" : "/single-round-win");
      return;
    }
    if (secondsLeft <= 0 && !navigatingRef.current) {
      navigatingRef.current = true;
      navigate("/waiting-room");
    }
  }, [room.state, isVS, secondsLeft, navigate]);

  useEffect(() => {
    if (secondsLeft > 0) {
      setCountdownText(`Moving to waiting room in ${secondsLeft}s..`);
    } else {
      setCountdownText("Moving to waiting room...");
    }
  }, [secondsLeft]);

  useEffect(() => {
    const spinQueue = revealQueue.length ? revealQueue : viewerReelTarget ? [viewerReelTarget] : [];
    if (!spinQueue.length) return;

    const sig = `${room.mode || ""}|${room.round_no || 0}|${room.state || ""}|${spinQueue
      .map((r) => `${r.pid}:${r.roleRaw}:${r.team}`)
      .join(",")}|viewer:${viewerReelTarget?.pid || ""}:${viewerReelTarget?.roleRaw || ""}:${viewerReelTarget?.teamLabel || ""}`;
    if (sig === lastSpinSignatureRef.current) return;
    lastSpinSignatureRef.current = sig;

    if (debugEnabled) {
      rolePickDebug("spin_start", {
        sig,
        queueCount: spinQueue.length,
        viewerPid: viewerReelTarget?.pid || "",
      });
    }

    let cancelled = false;
    const run = async () => {
      setIsSpinning(true);
      setStatusText("GOOD LUCK!");

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

      for (let i = 0; i < spinQueue.length; i += 1) {
        if (cancelled || spinUnmountedRef.current) return;
        const result = spinQueue[i];
        setStatusText("CHECKING...");
        await wait(500);
        stopReel(strip1Ref, reel1Ref, result.name);
        await wait(280);
        stopReel(strip2Ref, reel2Ref, result.role);
        await wait(280);
        stopReel(strip3Ref, reel3Ref, result.teamLabel);
        await wait(140);
      }

      if (!cancelled && !spinUnmountedRef.current) {
        if (viewerReelTarget) {
          if (debugEnabled) {
            rolePickDebug("final_lock_target", {
              pid: viewerReelTarget.pid || "",
              name: viewerReelTarget.name || "",
              role: viewerReelTarget.role || "",
              team: viewerReelTarget.teamLabel || "",
            });
          }
          setStatusText("LOCKING YOUR ROLE...");
          await wait(180);
          stopReel(strip1Ref, reel1Ref, viewerReelTarget.name);
          await wait(120);
          stopReel(strip2Ref, reel2Ref, viewerReelTarget.role);
          await wait(120);
          stopReel(strip3Ref, reel3Ref, viewerReelTarget.teamLabel);
          await wait(120);
        }
        setStatusText("JACKPOT! DEAL COMPLETE");
        setIsSpinning(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [revealQueue, viewerReelTarget, room.mode, room.round_no, room.state, isVS, debugEnabled]);

  return (
    <div className="rolepick-theme-sandbox">
      <div className="rolepick-theme-shell">
        <div className="left-column">
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
            <div className={`redirect-msg ${countdownText ? "visible" : ""}`}>{countdownText}</div>
            {isSpinning && <div className="redirect-msg visible">Synchronizing assignments...</div>}
          </div>
        </div>

        <div className="right-column">
          <div className="gm-bar">
            <div className="gm-badge">
              <span>*</span>
              <span>
                Game Master: {gmPlayer?.name || "Unknown"}
                {isMe(gmPlayer) ? " (YOU)" : ""}
              </span>
            </div>
          </div>
          {isVS ? (
            <div className="teams-container">
              <div className="team-column team-gm">
                <div className="team-header">
                  <span>Game Master</span>
                  <span className="count-badge">{gmPlayer ? 1 : 0}</span>
                </div>
                <div className="player-list">
                  {gmPlayer && (
                    <div className={`player-card ${isMe(gmPlayer) ? "player-card-you" : ""}`}>
                      <div className="avatar" style={{ background: "var(--gm-yellow)" }}>
                        {(gmPlayer.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {gmPlayer.name || "Unknown"}
                          {isMe(gmPlayer) && <span className="role-tag">YOU</span>}
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
                  <span className="count-badge">{redPlayers.length}</span>
                </div>
                <div className="player-list">
                  {redPlayers.map((player, index) => (
                    <div
                      key={`${player.pid}-${index}`}
                      className={`player-card ${isMe(player) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-orange)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isMe(player) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: player.role.startsWith("DRAWER") ? "var(--gm-yellow)" : "var(--text-muted)",
                            background:
                              player.role.startsWith("DRAWER")
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                            borderColor:
                              player.role.startsWith("DRAWER")
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
                  <span className="count-badge">{bluePlayers.length}</span>
                </div>
                <div className="player-list">
                  {bluePlayers.map((player, index) => (
                    <div
                      key={`${player.pid}-${index}`}
                      className={`player-card ${isMe(player) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-blue)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isMe(player) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: player.role.startsWith("DRAWER") ? "var(--gm-yellow)" : "var(--text-muted)",
                            background:
                              player.role.startsWith("DRAWER")
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                            borderColor:
                              player.role.startsWith("DRAWER")
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
                  <span className="count-badge">{singlePlayers.length}</span>
                </div>
                <div className="player-list">
                  {singlePlayers.map((player, index) => (
                    <div
                      key={`${player.pid}-${index}`}
                      className={`player-card ${isMe(player) ? "player-card-you" : ""}`}
                    >
                      <div className="avatar" style={{ background: "var(--team-orange)" }}>
                        {(player.name || "?")[0]}
                      </div>
                      <div className="p-info">
                        <div className="p-name">
                          {player.name}
                          {isMe(player) && <span className="role-tag">YOU</span>}
                        </div>
                        <div
                          className="p-role"
                          style={{
                            color: player.role.startsWith("DRAWER") || player.role === "GM" ? "var(--gm-yellow)" : "var(--text-muted)",
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

          {isVS && pendingPlayers.length > 0 && (
            <div className="redirect-msg visible">{pendingPlayers.length} player(s) pending team assignment...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolePick;
