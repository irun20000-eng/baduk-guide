// 바둑 규칙 엔진 (한국 바둑규칙 기준)
// - 따냄, 착수금지(자충수), 패, 한 수 쉬기, 집 계산
// - 화면과 무관한 순수 함수만 둔다. 상태는 바꾸지 않고 항상 새 상태를 돌려준다.
// 근거: 대한바둑협회 한국바둑규칙 제4조(활로·따냄), 제5조(착수금지), 제7조(패), 제8조(집과 공배), 제12조(계가)

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // 관례대로 I는 쓰지 않는다

export function opponent(color) {
  return color === BLACK ? WHITE : BLACK;
}

export function createGame(size = 9, options = {}) {
  if (!Number.isInteger(size) || size < 2 || size > 19) {
    throw new Error('판 크기는 2~19줄이어야 합니다: ' + size);
  }
  return {
    size,
    board: new Array(size * size).fill(EMPTY),
    turn: BLACK,
    captures: { 1: 0, 2: 0 }, // captures[색] = 그 색이 따낸 돌 수
    ko: -1, // 패 때문에 지금 당장 둘 수 없는 자리 (없으면 -1)
    passes: 0, // 연속으로 쉰 횟수 (2가 되면 대국 종료)
    moveNumber: 0,
    lastMove: -1,
    komi: options.komi ?? 6.5,
  };
}

export function neighbors(size, idx) {
  const x = idx % size;
  const y = (idx - x) / size;
  const out = [];
  if (y > 0) out.push(idx - size);
  if (x > 0) out.push(idx - 1);
  if (x < size - 1) out.push(idx + 1);
  if (y < size - 1) out.push(idx + size);
  return out;
}

// idx에 놓인 돌이 속한 덩어리(연결된 같은 색 돌)와 그 활로를 구한다.
export function groupAt(board, size, idx) {
  const color = board[idx];
  if (color === EMPTY) return { color: EMPTY, stones: [], liberties: [] };
  const seen = new Set([idx]);
  const libs = new Set();
  const stack = [idx];
  while (stack.length) {
    const cur = stack.pop();
    for (const n of neighbors(size, cur)) {
      const c = board[n];
      if (c === EMPTY) libs.add(n);
      else if (c === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { color, stones: [...seen], liberties: [...libs] };
}

// 한 수 두기. 성공하면 { ok: true, state, captured }, 실패하면 { ok: false, reason }.
// reason: 'ended' | 'out' | 'occupied' | 'ko' | 'suicide'
export function play(state, idx) {
  const { size, board, turn } = state;
  if (state.passes >= 2) return { ok: false, reason: 'ended' };
  if (!Number.isInteger(idx) || idx < 0 || idx >= size * size) return { ok: false, reason: 'out' };
  if (board[idx] !== EMPTY) return { ok: false, reason: 'occupied' };
  if (idx === state.ko) return { ok: false, reason: 'ko' };

  const next = board.slice();
  next[idx] = turn;
  const foe = opponent(turn);

  // 1) 상대 돌 중 활로가 모두 막힌 덩어리를 먼저 따낸다.
  const captured = [];
  for (const n of neighbors(size, idx)) {
    if (next[n] !== foe) continue;
    const g = groupAt(next, size, n);
    if (g.liberties.length === 0) {
      for (const s of g.stones) {
        next[s] = EMPTY;
        captured.push(s);
      }
    }
  }

  // 2) 따낸 돌이 없는데 내 돌의 활로도 없으면 착수금지.
  const own = groupAt(next, size, idx);
  if (own.liberties.length === 0) return { ok: false, reason: 'suicide' };

  // 3) 패: 한 점을 따냈고, 방금 둔 돌이 홀로 활로 하나(따낸 자리)만 가진 경우.
  const ko = captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1 ? captured[0] : -1;

  return {
    ok: true,
    captured,
    state: {
      ...state,
      board: next,
      turn: foe,
      captures: { ...state.captures, [turn]: state.captures[turn] + captured.length },
      ko,
      passes: 0,
      moveNumber: state.moveNumber + 1,
      lastMove: idx,
    },
  };
}

// 한 수 쉬기. 두 사람이 연달아 쉬면 대국이 끝난다.
export function pass(state) {
  if (state.passes >= 2) return state;
  return {
    ...state,
    turn: opponent(state.turn),
    ko: -1,
    passes: state.passes + 1,
    moveNumber: state.moveNumber + 1,
    lastMove: -1,
  };
}

export function isOver(state) {
  return state.passes >= 2;
}

export function isLegal(state, idx) {
  return play(state, idx).ok;
}

export function legalMoves(state) {
  const out = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === EMPTY && isLegal(state, i)) out.push(i);
  }
  return out;
}

// 활로가 하나만 남은(단수) 덩어리 목록.
export function groupsInAtari(state) {
  const { board, size } = state;
  const seen = new Set();
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY || seen.has(i)) continue;
    const g = groupAt(board, size, i);
    for (const s of g.stones) seen.add(s);
    if (g.liberties.length === 1) out.push(g);
  }
  return out;
}

// 집 계산 (한국식: 집 + 따낸 돌, 백에게 덤).
// dead: 대국이 끝난 뒤 죽은 돌로 합의한 자리들. 판에서 들어내 상대의 따낸 돌에 더한다.
export function score(state, dead = []) {
  const { size } = state;
  const board = state.board.slice();
  const captures = { 1: state.captures[1], 2: state.captures[2] };
  for (const d of dead) {
    const c = board[d];
    if (c === EMPTY) continue;
    board[d] = EMPTY;
    captures[opponent(c)] += 1;
  }

  const owner = new Array(board.length).fill(EMPTY); // 각 빈 점이 누구 집인지 (공배는 EMPTY)
  const territory = { 1: 0, 2: 0 };
  const neutral = [];
  const seen = new Set();
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY || seen.has(i)) continue;
    const region = [];
    const borders = new Set();
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const cur = stack.pop();
      region.push(cur);
      for (const n of neighbors(size, cur)) {
        if (board[n] === EMPTY) {
          if (!seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        } else {
          borders.add(board[n]);
        }
      }
    }
    if (borders.size === 1) {
      const c = [...borders][0];
      territory[c] += region.length;
      for (const r of region) owner[r] = c;
    } else {
      neutral.push(...region);
    }
  }

  const black = territory[1] + captures[1];
  const white = territory[2] + captures[2] + state.komi;
  return {
    territory,
    captures,
    komi: state.komi,
    owner,
    neutral,
    black,
    white,
    winner: black > white ? BLACK : white > black ? WHITE : EMPTY,
    margin: Math.abs(black - white),
  };
}

// 화점 자리 (x, y). 9줄, 13줄, 19줄만 있다.
export function starPoints(size) {
  if (size === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
  if (size === 13) return [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
  if (size === 19) {
    const out = [];
    for (const y of [3, 9, 15]) for (const x of [3, 9, 15]) out.push([x, y]);
    return out;
  }
  return [];
}

// ---- 좌표와 판 표기 ----
// 좌표: 가로 A~T(I 제외), 세로는 아래에서부터 1. 예: 9줄판 한가운데 = E5
export function toCoord(size, idx) {
  const x = idx % size;
  const y = (idx - x) / size;
  return COLUMN_LETTERS[x] + (size - y);
}

export function fromCoord(size, coord) {
  const m = /^([A-HJ-T])(\d{1,2})$/i.exec(String(coord).trim());
  if (!m) return -1;
  const x = COLUMN_LETTERS.indexOf(m[1].toUpperCase());
  const row = Number(m[2]);
  if (x < 0 || x >= size || row < 1 || row > size) return -1;
  return (size - row) * size + x;
}

// 줄 문자열 배열로 판을 만든다. 첫 줄이 맨 윗줄. '.' 빈 곳, 'X' 흑, 'O' 백. 공백은 무시.
export function gameFromRows(rows, options = {}) {
  const clean = rows.map((r) => r.replace(/\s+/g, ''));
  const size = clean.length;
  const state = createGame(size, options);
  clean.forEach((row, y) => {
    if (row.length !== size) throw new Error('줄 길이가 판 크기와 다릅니다: ' + row);
    [...row].forEach((ch, x) => {
      state.board[y * size + x] = ch === 'X' ? BLACK : ch === 'O' ? WHITE : EMPTY;
    });
  });
  if (options.turn) state.turn = options.turn;
  return state;
}

export function toRows(state) {
  const rows = [];
  for (let y = 0; y < state.size; y++) {
    let row = '';
    for (let x = 0; x < state.size; x++) {
      const c = state.board[y * state.size + x];
      row += c === BLACK ? 'X' : c === WHITE ? 'O' : '.';
    }
    rows.push(row);
  }
  return rows;
}
