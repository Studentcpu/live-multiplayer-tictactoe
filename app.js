const socket = io();
let currentRoom = null;
let mySymbol = null;
let latest = null;

const $ = id => document.getElementById(id);
const lobby = $('lobby'), game = $('game'), board = $('board');

for (let i = 0; i < 9; i++) {
  const btn = document.createElement('button');
  btn.className = 'cell';
  btn.setAttribute('aria-label', `Square ${i + 1}`);
  btn.addEventListener('click', () => {
    if (!latest || latest.status !== 'playing' || latest.turn !== mySymbol || latest.board[i]) return;
    socket.emit('move', { code: currentRoom, index: i }, res => {
      if (!res?.ok) $('error').textContent = res?.error || 'Move failed.';
    });
  });
  board.appendChild(btn);
}

function playerName(symbol) {
  return latest?.players.find(p => p.symbol === symbol)?.name || symbol;
}

function render(state) {
  latest = state;
  $('code').textContent = state.code;
  const cells = [...board.children];
  state.board.forEach((v, i) => {
    cells[i].textContent = v || '';
    cells[i].className = 'cell' + (v ? ` ${v.toLowerCase()}` : '');
    cells[i].disabled = !!v || state.status !== 'playing' || state.turn !== mySymbol;
  });

  $('players').innerHTML = `<div class="players">${state.players.map(p => `<span class="pill">${escapeHtml(p.name)} = <b>${p.symbol}</b></span>`).join('')}</div>`;
  $('youAre').textContent = `You are ${mySymbol}`;
  $('rematch').classList.add('hidden');

  if (state.status === 'waiting') $('statusText').textContent = 'Waiting for another player…';
  if (state.status === 'playing') $('statusText').textContent = `${playerName(state.turn)}'s turn (${state.turn})`;
  if (state.status === 'finished') {
    $('statusText').textContent = state.winner === 'draw' ? 'Draw game!' : `${playerName(state.winner)} wins!`;
    $('rematch').classList.remove('hidden');
    const voted = state.rematchVotes.includes(socket.id);
    $('rematch').textContent = voted ? 'Rematch requested ✓' : 'Rematch';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function enterGame(code, symbol) {
  currentRoom = code;
  mySymbol = symbol;
  lobby.classList.add('hidden');
  game.classList.remove('hidden');
}

$('create').onclick = () => {
  $('error').textContent = '';
  socket.emit('createRoom', { name: $('name').value.trim() }, res => {
    if (!res?.ok) return $('error').textContent = res?.error || 'Could not create room.';
    enterGame(res.code, res.symbol);
  });
};

$('join').onclick = () => {
  $('error').textContent = '';
  const code = $('roomCode').value.trim().toUpperCase();
  if (!code) return $('error').textContent = 'Enter a room code.';
  socket.emit('joinRoom', { code, name: $('name').value.trim() }, res => {
    if (!res?.ok) return $('error').textContent = res?.error || 'Could not join room.';
    enterGame(res.code, res.symbol);
  });
};

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(currentRoom); $('copy').textContent = 'Copied!'; setTimeout(() => $('copy').textContent = 'Copy code', 1200); }
  catch { $('copy').textContent = currentRoom; }
};

$('rematch').onclick = () => socket.emit('rematch', { code: currentRoom });
socket.on('state', render);
socket.on('disconnect', () => { if (latest) $('statusText').textContent = 'Connection lost. Reconnecting…'; });
