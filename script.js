const CONFIG = {
  easy: { cols: 9, rows: 9, mines: 10 },
  medium: { cols: 16, rows: 16, mines: 40 },
  hard: { cols: 24, rows: 20, mines: 99 },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const difficultyEl = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGame');

let state = null;

function buildBoard(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      neighborMines: 0,
    }))
  );
}

function neighborsOf(x, y, cols, rows) {
  const out = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push([nx, ny]);
    }
  }
  return out;
}

function placeMines(board, cols, rows, mineCount, safeX, safeY) {
  let placed = 0;
  while (placed < mineCount) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    const safeZone = Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1;
    if (safeZone || board[y][x].mine) continue;
    board[y][x].mine = true;
    placed += 1;
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      board[y][x].neighborMines = neighborsOf(x, y, cols, rows)
        .reduce((sum, [nx, ny]) => sum + (board[ny][nx].mine ? 1 : 0), 0);
    }
  }
}

function reset() {
  const settings = CONFIG[difficultyEl.value];
  const size = Math.floor(Math.min(720 / settings.cols, 720 / settings.rows));

  canvas.width = settings.cols * size;
  canvas.height = settings.rows * size;

  state = {
    ...settings,
    board: buildBoard(settings.cols, settings.rows),
    started: false,
    gameOver: false,
    won: false,
    cellSize: size,
    revealedCount: 0,
  };

  statusEl.textContent = 'Left click to reveal, right click to flag.';
  draw();
}

function reveal(x, y) {
  if (state.gameOver) return;
  const cell = state.board[y][x];
  if (cell.revealed || cell.flagged) return;

  if (!state.started) {
    placeMines(state.board, state.cols, state.rows, state.mines, x, y);
    state.started = true;
  }

  cell.revealed = true;
  state.revealedCount += 1;

  if (cell.mine) {
    state.gameOver = true;
    state.won = false;
    revealAllMines();
    statusEl.textContent = '💥 Boom! You hit a mine.';
    draw();
    return;
  }

  if (cell.neighborMines === 0) {
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      for (const [nx, ny] of neighborsOf(cx, cy, state.cols, state.rows)) {
        const n = state.board[ny][nx];
        if (n.revealed || n.flagged || n.mine) continue;
        n.revealed = true;
        state.revealedCount += 1;
        if (n.neighborMines === 0) stack.push([nx, ny]);
      }
    }
  }

  checkWin();
  draw();
}

function toggleFlag(x, y) {
  if (state.gameOver) return;
  const cell = state.board[y][x];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  draw();
}

function revealAllMines() {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.mine) cell.revealed = true;
    }
  }
}

function checkWin() {
  const safeCells = state.cols * state.rows - state.mines;
  if (state.revealedCount >= safeCells) {
    state.gameOver = true;
    state.won = true;
    statusEl.textContent = '🎉 You cleared the board!';
    revealAllMines();
  }
}

function getCellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.cols);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.rows);
  if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return null;
  return { x, y };
}

function drawCell(x, y, cell) {
  const s = state.cellSize;
  const px = x * s;
  const py = y * s;

  const hidden = '#334155';
  const shown = '#94a3b8';

  ctx.fillStyle = cell.revealed ? shown : hidden;
  ctx.fillRect(px, py, s, s);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);

  if (cell.flagged && !cell.revealed) {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(px + s * 0.28, py + s * 0.75);
    ctx.lineTo(px + s * 0.28, py + s * 0.25);
    ctx.lineTo(px + s * 0.7, py + s * 0.4);
    ctx.lineTo(px + s * 0.28, py + s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(px + s * 0.24, py + s * 0.74, s * 0.14, s * 0.08);
    return;
  }

  if (!cell.revealed) return;

  if (cell.mine) {
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(px + s / 2, py + s / 2, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (cell.neighborMines > 0) {
    const colors = ['#000', '#1d4ed8', '#16a34a', '#dc2626', '#7c3aed', '#be123c', '#0f766e', '#111827', '#525252'];
    ctx.fillStyle = colors[cell.neighborMines] || '#111';
    ctx.font = `${Math.max(12, Math.floor(s * 0.58))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(cell.neighborMines), px + s / 2, py + s / 2 + 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      drawCell(x, y, state.board[y][x]);
    }
  }
}

canvas.addEventListener('click', (event) => {
  const cell = getCellFromEvent(event);
  if (!cell) return;
  reveal(cell.x, cell.y);
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const cell = getCellFromEvent(event);
  if (!cell) return;
  toggleFlag(cell.x, cell.y);
});

newGameBtn.addEventListener('click', reset);
difficultyEl.addEventListener('change', reset);

reset();
