
# DrawGuess Frontend (TEMP Tester UI)

⚠️ This is **NOT the final game UI**.
This repo is a **temporary tester frontend** used to:
- create/join rooms
- verify WebSocket connectivity (LAN)
- view lobby snapshots (players/room state)
- debug message flow quickly

The real/pretty frontend (canvas + full game screens) will be built later after backend logic is stable.

---

## What this frontend does
- Uses **WebSocket** only (no REST API calls)
- Sends JSON messages like:
  - `create_room`
  - `join`
  - `snapshot`
- Displays the server responses (room snapshot + players list)

---

## Tech
- React (Vite)
- WebSocket client (native browser WS)

---

## Setup

### 1) Install
```bash
npm install

```

### 2) Run (LAN mode)

```
npm run dev -- --host 0.0.0.0 --port 5173

```

Open in browser:

-   Local: `http://localhost:5173`

-   LAN (other devices): `http://<YOUR_PC_IP>:5173`

* * * * *

Backend connection (WS_BASE)
----------------------------

This frontend connects to the backend WebSocket using:

```
const WS_BASE =
  import.meta.env.VITE_WS_BASE_URL?.trim() ||
  `ws://${window.location.hostname}:8000`;

```

### Recommended (LAN dev)

Leave `.env` empty so it auto-detects the host from the URL you opened:

-   If you open `http://192.168.0.101:5173` → it uses `ws://192.168.0.101:8000`

-   If you open `http://localhost:5173` → it uses `ws://localhost:8000`

### Optional (only if backend is on a different machine)

Create `.env` (DO NOT COMMIT):

```
VITE_WS_BASE_URL=ws://<BACKEND_HOST_IP>:8000

```

We commit only `.env.example`.

* * * * *

LAN checklist (for teammates)
-----------------------------

1.  Be on the same Wi-Fi

2.  Find host IP (on the PC running backend+frontend):

    -   Windows: `ipconfig` → Wi-Fi IPv4 (example: `192.168.0.101`)

3.  Start backend:

    ```
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

    ```

4.  Start frontend:

    ```
    npm run dev -- --host 0.0.0.0 --port 5173

    ```

5.  On phone/tablet, open:

    -   `http://<HOST_IP>:5173`

* * * * *

Notes
-----

-   If WebSocket connections are rejected (403/1008), check backend origin allowlist settings.

-   This UI is intentionally minimal. It's a debugging tool, not final UX.
