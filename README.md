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
