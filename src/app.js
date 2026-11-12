// 연습판 화면. 규칙은 모두 rules.mjs의 함수를 쓴다 (빌드 때 같은 스크립트 안에 합쳐진다).
// 여기서는 그리기, 입력, 안내 문구, 저장만 맡는다.

const CELL = 40;
const MARGIN = 34;
const STORAGE_KEY = 'baduk-guide:v1:practice';
const SVG_NS = 'http://www.w3.org/2000/svg';

const REASON_TEXT = {
  occupied: '이미 돌이 있는 자리예요.',
  suicide: '여기는 착수금지예요. 놓자마자 활로가 하나도 없어요.',
  ko: '패예요. 바로 되따낼 수 없어요. 다른 곳에 한 번 둔 뒤에 따낼 수 있어요.',
  ended: '대국이 끝났어요. 새 판을 눌러 다시 시작해 보세요.',
  out: '바둑판 안쪽 교차점을 눌러 주세요.',
};

const $ = (id) => document.getElementById(id);
const svg = $('board');
const colorName = (c) => (c === BLACK ? '흑' : '백');

let history = [createGame(9)];
let shown = null; // 활로를 보여 주고 있는 덩어리 { stones, liberties }
let showAtari = true;

const current = () => history[history.length - 1];

function starPoints(size) {
  if (size === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
  if (size === 13) return [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
  if (size === 19) {
    const out = [];
    for (const y of [3, 9, 15]) for (const x of [3, 9, 15]) out.push([x, y]);
    return out;
  }
  return [];
}

const px = (n) => MARGIN + n * CELL;

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function drawStone(parent, x, y, color, extraClass) {
  const g = el('g', extraClass ? { class: extraClass } : {});
  g.appendChild(el('circle', { class: 'stone-shadow', cx: px(x) + 1.2, cy: px(y) + 2, r: CELL * 0.47 }));
  g.appendChild(el('circle', {
    cx: px(x), cy: px(y), r: CELL * 0.47,
    fill: color === BLACK ? 'url(#gB)' : 'url(#gW)',
    stroke: color === BLACK ? '#000' : '#b3ad9f',
    'stroke-width': 0.8,
  }));
  parent.appendChild(g);
  return g;
}

function render() {
  const state = current();
  const size = state.size;
  const extent = MARGIN * 2 + (size - 1) * CELL;
  svg.setAttribute('viewBox', '0 0 ' + extent + ' ' + extent);
  svg.textContent = '';

  const defs = el('defs', {});
  defs.innerHTML =
    '<radialGradient id="gB" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#707070"/><stop offset="0.6" stop-color="#1b1b1b"/><stop offset="1" stop-color="#050505"/></radialGradient>' +
    '<radialGradient id="gW" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.75" stop-color="#ece8df"/><stop offset="1" stop-color="#cfc9bc"/></radialGradient>';
  svg.appendChild(defs);

  // 줄과 화점
  for (let i = 0; i < size; i++) {
    svg.appendChild(el('line', { class: 'grid', x1: px(0), y1: px(i), x2: px(size - 1), y2: px(i) }));
    svg.appendChild(el('line', { class: 'grid', x1: px(i), y1: px(0), x2: px(i), y2: px(size - 1) }));
  }
  for (const [x, y] of starPoints(size)) {
    svg.appendChild(el('circle', { class: 'star', cx: px(x), cy: px(y), r: 3.4 }));
  }

  // 좌표 (가로 A~, 세로는 아래에서부터 1)
  for (let i = 0; i < size; i++) {
    const col = el('text', { class: 'label', x: px(i), y: extent - 11 });
    col.textContent = toCoord(size, i)[0];
    svg.appendChild(col);
    const row = el('text', { class: 'label', x: 11, y: px(i) });
    row.textContent = String(size - i);
    svg.appendChild(row);
  }

  // 대국이 끝났으면 집 표시
  const over = isOver(state);
  const result = over ? score(state) : null;
  if (result) {
    result.owner.forEach((c, idx) => {
      if (c === EMPTY) return;
      const x = idx % size;
      const y = (idx - x) / size;
      svg.appendChild(el('rect', {
        class: 'terr', x: px(x) - 6, y: px(y) - 6, width: 12, height: 12, rx: 2,
        fill: c === BLACK ? '#1b1b1b' : '#fffdf5', stroke: c === BLACK ? 'none' : '#a59e8e',
      }));
    });
  }

  // 돌
  state.board.forEach((c, idx) => {
    if (c === EMPTY) return;
    const x = idx % size;
    drawStone(svg, x, (idx - x) / size, c);
  });

  // 마지막 수
  if (state.lastMove >= 0) {
    const x = state.lastMove % size;
    const y = (state.lastMove - x) / size;
    const c = state.board[state.lastMove];
    svg.appendChild(el('circle', { class: 'last', cx: px(x), cy: px(y), r: CELL * 0.2, stroke: c === BLACK ? '#fff' : '#222' }));
  }

  // 단수 표시
  if (showAtari && !over) {
    for (const g of groupsInAtari(state)) {
      for (const s of g.stones) {
        const x = s % size;
        svg.appendChild(el('circle', { class: 'atari', cx: px(x), cy: px((s - x) / size), r: CELL * 0.47 + 2.5 }));
      }
    }
  }

  // 패 자리
  if (state.ko >= 0) {
    const x = state.ko % size;
    const y = (state.ko - x) / size;
    svg.appendChild(el('rect', { class: 'ko', x: px(x) - 7, y: px(y) - 7, width: 14, height: 14 }));
  }

  // 선택한 덩어리의 활로
  if (shown) {
    for (const l of shown.liberties) {
      const x = l % size;
      svg.appendChild(el('circle', { class: 'lib', cx: px(x), cy: px((l - x) / size), r: 6 }));
    }
  }

  // 마우스로 가리키는 자리 미리보기
  const ghost = drawStone(svg, 0, 0, state.turn, 'ghost');
  ghost.id = 'ghost';
  ghost.setAttribute('visibility', 'hidden');

  // 상태 표시
  $('turnStone').className = 'chip ' + (state.turn === BLACK ? 'black' : 'white');
  $('turnText').textContent = over ? '대국 끝' : colorName(state.turn) + ' 차례';
  $('capB').textContent = state.captures[BLACK];
  $('capW').textContent = state.captures[WHITE];
  $('undo').disabled = history.length <= 1;
  $('pass').disabled = over;
  document.querySelectorAll('.sizes button').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size));
  });
  svg.setAttribute('aria-label', size + '줄 바둑판, ' + (over ? '대국 끝' : colorName(state.turn) + ' 차례'));

  renderResult(result);
  save();
}

function renderResult(result) {
  const box = $('result');
  if (!result) {
    box.hidden = true;
    box.textContent = '';
    return;
  }
  const win = result.winner === EMPTY
    ? '비겼어요.'
    : colorName(result.winner) + '이 ' + result.margin + '집 이겼어요.';
  box.hidden = false;
  box.innerHTML =
    '<h2>집 세어 보기</h2>' +
    '<table><thead><tr><th></th><th>집</th><th>따낸 돌</th><th>덤</th><th>합계</th></tr></thead><tbody>' +
    '<tr><td>흑</td><td>' + result.territory[BLACK] + '</td><td>' + result.captures[BLACK] + '</td><td>-</td><td><b>' + result.black + '</b></td></tr>' +
    '<tr><td>백</td><td>' + result.territory[WHITE] + '</td><td>' + result.captures[WHITE] + '</td><td>' + result.komi + '</td><td><b>' + result.white + '</b></td></tr>' +
    '</tbody></table>' +
    '<p class="win">' + win + '</p>' +
    '<p class="note">판 위의 돌이 모두 살아 있다고 보고 센 임시 결과예요. 죽은 돌 고르기는 다음 단계에서 넣을 예정이에요.</p>';
}

function say(text, warn) {
  const m = $('msg');
  m.textContent = text;
  m.classList.toggle('warn', Boolean(warn));
}

function pointFromEvent(e) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return -1;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  const size = current().size;
  const x = Math.round((p.x - MARGIN) / CELL);
  const y = Math.round((p.y - MARGIN) / CELL);
  if (x < 0 || y < 0 || x >= size || y >= size) return -1;
  return y * size + x;
}

function onBoardClick(e) {
  const state = current();
  const idx = pointFromEvent(e);
  if (idx < 0) return;

  // 놓인 돌을 누르면 그 덩어리의 활로를 보여 준다.
  if (state.board[idx] !== EMPTY) {
    const g = groupAt(state.board, state.size, idx);
    shown = g;
    render();
    const n = g.liberties.length;
    say(colorName(g.color) + '돌 ' + g.stones.length + '점, 활로는 ' + n + '개예요.' + (n === 1 ? ' 단수예요!' : ''));
    return;
  }

  const r = play(state, idx);
  if (!r.ok) {
    say(REASON_TEXT[r.reason] || '여기에는 둘 수 없어요.', true);
    return;
  }
  shown = null;
  history.push(r.state);
  render();

  const mover = colorName(state.turn);
  const where = toCoord(state.size, idx);
  if (r.captured.length > 0) {
    say(mover + '이 ' + where + '에 두어 ' + r.captured.length + '점을 따냈어요.' + (r.state.ko >= 0 ? ' 패 모양이에요. 네모 표시 자리는 바로 되따낼 수 없어요.' : ''));
  } else {
    const danger = groupsInAtari(r.state).filter((g) => g.color === r.state.turn);
    say(mover + ' ' + where + '.' + (danger.length ? ' 단수! ' + colorName(r.state.turn) + '돌의 활로가 하나 남았어요.' : ''));
  }
}

function onPass() {
  const state = current();
  if (isOver(state)) return;
  const next = pass(state);
  shown = null;
  history.push(next);
  render();
  say(isOver(next)
    ? '두 사람이 연달아 쉬어서 대국이 끝났어요. 아래에서 집을 세어 볼게요.'
    : colorName(state.turn) + '이 한 수 쉬었어요. 상대도 쉬면 대국이 끝나요.');
}

function onUndo() {
  if (history.length <= 1) return;
  history.pop();
  shown = null;
  render();
  say('한 수 물렀어요.');
}

function newGame(size) {
  history = [createGame(size)];
  shown = null;
  render();
  say(size + '줄 새 판이에요. 흑부터 두어요.');
}

function onPointerMove(e) {
  const ghost = $('ghost');
  if (!ghost) return;
  const state = current();
  const idx = e.pointerType === 'mouse' ? pointFromEvent(e) : -1;
  if (idx < 0 || state.board[idx] !== EMPTY || isOver(state)) {
    ghost.setAttribute('visibility', 'hidden');
    return;
  }
  const x = idx % state.size;
  const y = (idx - x) / state.size;
  ghost.setAttribute('transform', 'translate(' + x * CELL + ' ' + y * CELL + ')');
  ghost.setAttribute('visibility', 'visible');
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: history.slice(-200), showAtari }));
  } catch (err) {
    // 저장이 막힌 환경(비공개 창 등)에서는 그냥 넘어간다.
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const ok = Array.isArray(data.history) && data.history.length > 0 && data.history.every(
      (s) => s && Number.isInteger(s.size) && Array.isArray(s.board) && s.board.length === s.size * s.size && s.captures
    );
    if (ok) history = data.history;
    if (typeof data.showAtari === 'boolean') showAtari = data.showAtari;
  } catch (err) {
    // 저장된 내용이 깨졌으면 새 판으로 시작한다.
  }
}

svg.addEventListener('click', onBoardClick);
svg.addEventListener('pointermove', onPointerMove);
svg.addEventListener('pointerleave', () => {
  const ghost = $('ghost');
  if (ghost) ghost.setAttribute('visibility', 'hidden');
});
$('pass').addEventListener('click', onPass);
$('undo').addEventListener('click', onUndo);
$('reset').addEventListener('click', () => newGame(current().size));
$('atari').addEventListener('change', (e) => {
  showAtari = e.target.checked;
  render();
});
document.querySelectorAll('.sizes button').forEach((b) => {
  b.addEventListener('click', () => {
    const size = Number(b.dataset.size);
    if (size === current().size) return;
    if (current().moveNumber > 0 && !confirm('지금 두던 판을 지우고 ' + size + '줄 새 판을 시작할까요?')) return;
    newGame(size);
  });
});

load();
$('atari').checked = showAtari;
render();
