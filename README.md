# Live Multiplayer Tic-Tac-Toe

A two-player real-time browser game using Node.js, Express and Socket.IO.

## Features
- Two players can join from separate devices using a 5-character room code.
- Real-time synchronized turns and board state.
- Server-enforced rules: turn order, valid moves, win and draw detection.
- Built-in visible rules.
- Rematch voting.
- Responsive mobile/desktop UI.

## Run locally
```bash
npm install
npm start
```
Open http://localhost:3000

## Deploy
Use any Node.js host (Replit, Railway, Render, Fly.io, etc.).
Start command: `npm start`
The host must support WebSockets.
