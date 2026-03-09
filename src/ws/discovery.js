const DEFAULT_BACKEND_PORTS = [8000, 8001];
const CACHE_KEY = "dg_ws_base";

function trimBase(raw) {
  return `${raw || ""}`.trim().replace(/\/+$/, "");
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = trimBase(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function getCachedWsBase() {
  return trimBase(localStorage.getItem(CACHE_KEY) || "");
}

export function setCachedWsBase(base) {
  const clean = trimBase(base);
  if (!clean) return;
  localStorage.setItem(CACHE_KEY, clean);
}

export function buildWsCandidates({ preferredBase = "", envBase = "" } = {}) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "127.0.0.1";
  const cached = getCachedWsBase();

  const hostDefaults = DEFAULT_BACKEND_PORTS.map((port) => `${proto}://${host}:${port}`);
  const loopbackDefaults =
    host === "localhost" || host === "127.0.0.1"
      ? []
      : DEFAULT_BACKEND_PORTS.map((port) => `${proto}://localhost:${port}`);

  return dedupe([preferredBase, cached, envBase, ...hostDefaults, ...loopbackDefaults]);
}

export function probeWsBase(base, timeoutMs = 1500) {
  const cleanBase = trimBase(base);
  if (!cleanBase) return Promise.resolve(false);

  return new Promise((resolve) => {
    const probeRoom = `PROBE_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const url = `${cleanBase}/ws/${probeRoom}`;
    let done = false;
    let opened = false;
    let timer = null;
    let ws = null;

    const finish = (ok) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000);
      } catch {
        // Ignore close failures.
      }
      resolve(ok);
    };

    try {
      ws = new WebSocket(url);
    } catch {
      finish(false);
      return;
    }

    timer = setTimeout(() => finish(false), timeoutMs);
    ws.onopen = () => {
      opened = true;
      finish(true);
    };
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(opened);
  });
}

export async function discoverWorkingWsBase({
  preferredBase = "",
  envBase = "",
  timeoutMs = 1500,
} = {}) {
  const candidates = buildWsCandidates({ preferredBase, envBase });
  for (const base of candidates) {
    const ok = await probeWsBase(base, timeoutMs);
    if (ok) return base;
  }
  return "";
}
