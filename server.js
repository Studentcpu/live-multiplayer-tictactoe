const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function getWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

function roomState(room) {
  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    status: room.status,
    winner: room.winner,
    players: room.players.map(p => ({ id: p.id, name: p.name, symbol: p.symbol })),
    rematchVotes: [...room.rematchVotes]
  };
}

function broadcast(room) {
  io.to(room.code).emit('state', roomState(room));
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }, cb) => {
    const code = makeCode();
    const room = {
      code,
      board: Array(9).fill(null),
      turn: 'X',
      status: 'waiting',
      winner: null,
      players: [{ id: socket.id, name: (name || 'Player 1').slice(0, 20), symbol: 'X' }],
      rematchVotes: new Set()
    };
    rooms.set(code, room);
    socket.join(code);
    cb?.({ ok: true, code, symbol: 'X' });
    broadcast(room);
  });

  socket.on('joinRoom', ({ code, name }, cb) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: 'Room not found.' });
    if (room.players.length >= 2) return cb?.({ ok: false, error: 'Room is full.' });

    room.players.push({ id: socket.id, name: (name || 'Player 2').slice(0, 20), symbol: 'O' });
    room.status = 'playing';
    socket.join(code);
    cb?.({ ok: true, code, symbol: 'O' });
    broadcast(room);
  });

  socket.on('move', ({ code, index }, cb) => {
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: 'Room not found.' });
    if (room.status !== 'playing') return cb?.({ ok: false, error: 'Game is not active.' });
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return cb?.({ ok: false, error: 'You are not a player in this room.' });
    if (player.symbol !== room.turn) return cb?.({ ok: false, error: 'Wait for your turn.' });
    if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index]) {
      return cb?.({ ok: false, error: 'Invalid move.' });
    }

    room.board[index] = player.symbol;
    const result = getWinner(room.board);
    if (result) {
      room.status = 'finished';
      room.winner = result;
    } else {
      room.turn = room.turn === 'X' ? 'O' : 'X';
    }
    room.rematchVotes.clear();
    cb?.({ ok: true });
    broadcast(room);
  });

  socket.on('rematch', ({ code }, cb) => {
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: 'Room not found.' });
    if (!room.players.some(p => p.id === socket.id)) return cb?.({ ok: false, error: 'Not in room.' });
    room.rematchVotes.add(socket.id);
    if (room.rematchVotes.size === 2 && room.players.length === 2) {
      room.board = Array(9).fill(null);
      room.turn = 'X';
      room.status = 'playing';
      room.winner = null;
      room.rematchVotes.clear();
    }
    cb?.({ ok: true });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    for (const [code, room] of rooms) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        room.status = 'waiting';
        room.winner = null;
        room.board = Array(9).fill(null);
        room.turn = 'X';
        room.rematchVotes.clear();
        room.players[0].symbol = 'X';
        broadcast(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game running on port ${PORT}`));
