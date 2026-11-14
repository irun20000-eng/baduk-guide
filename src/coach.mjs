// 지도 엔진: 몬테카를로 트리 탐색(MCTS + RAVE)으로 형세와 좋은 수를 어림한다.
// - 9줄 판에 맞춘 세기다. 프로 엔진이 아니라 "입문자의 큰 실수와 놓친 기회"를 잡아 주는 것이 목표다.
// - 판정은 이 파일, 말로 풀어 주는 일은 coach-explain.mjs 가 한다.
// - 빠르게 돌리려고 rules.mjs 와 따로 테두리 칸이 있는 판(가짜 활로 방식)을 쓴다. 규칙은 같다(따냄, 자충 금지, 패).
import { EMPTY, BLACK, WHITE } from './rules.mjs';

const EDGE = 3; // 판 바깥 칸
const PASS_MOVE = 0; // 빠른 판의 0번 칸은 늘 바깥이라 "쉬기"로 쓴다

// ---- 빠른 판 ----

function fbCreate(size, komi) {
  const W = size + 2;
  const cells = W * W;
  const fb = {
    size, W, cells, komi,
    color: new Uint8Array(cells).fill(EDGE),
    head: new Int16Array(cells),
    next: new Int16Array(cells),
    pl: new Int16Array(cells), // 덩어리 대표 칸에 둔 가짜 활로 수(맞닿은 빈 칸 쌍의 수)
    ls: new Int32Array(cells), // 가짜 활로 자리 번호의 합
    lq: new Int32Array(cells), // 가짜 활로 자리 번호 제곱의 합 (단수 판별용)
    gs: new Int16Array(cells), // 덩어리 돌 수
    empties: new Int16Array(cells),
    epos: new Int16Array(cells),
    ne: 0,
    ko: -1,
    turn: BLACK,
    passes: 0,
    moves: 0,
    last: -1,
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = (y + 1) * W + x + 1;
      fb.color[p] = EMPTY;
      fb.epos[p] = fb.ne;
      fb.empties[fb.ne++] = p;
    }
  }
  return fb;
}

function fbClone(fb) {
  return {
    ...fb,
    color: fb.color.slice(), head: fb.head.slice(), next: fb.next.slice(),
    pl: fb.pl.slice(), ls: fb.ls.slice(), lq: fb.lq.slice(), gs: fb.gs.slice(),
    empties: fb.empties.slice(), epos: fb.epos.slice(),
  };
}

const fbToIdx = (fb, p) => ((p / fb.W) | 0) * fb.size - fb.size + (p % fb.W) - 1;
const fbFromIdx = (fb, idx) => (((idx / fb.size) | 0) + 1) * fb.W + (idx % fb.size) + 1;

function fbAddEmpty(fb, p) { fb.epos[p] = fb.ne; fb.empties[fb.ne++] = p; }
function fbRemoveEmpty(fb, p) {
  const i = fb.epos[p];
  const last = fb.empties[--fb.ne];
  fb.empties[i] = last;
  fb.epos[last] = i;
}

function fbAtari(fb, h) {
  const n = fb.pl[h];
  return n > 0 && n * fb.lq[h] === fb.ls[h] * fb.ls[h];
}
function fbAtariLib(fb, h) { return fb.ls[h] / fb.pl[h]; }

function fbLegal(fb, p, c) {
  const { color, head, W } = fb;
  if (color[p] !== EMPTY || p === fb.ko) return false;
  const opp = 3 - c;
  const ns = [p - W, p - 1, p + 1, p + W];
  for (const n of ns) if (color[n] === EMPTY) return true;
  for (const n of ns) {
    const cn = color[n];
    if (cn === c && !fbAtari(fb, head[n])) return true; // 내 덩어리에 다른 활로가 있다
    if (cn === opp && fbAtari(fb, head[n])) return true; // 상대를 따낸다
  }
  return false;
}

// c 의 진짜 눈처럼 보이는 자리 (메우면 손해). 바깥 쪽 대각선까지 본다.
function fbEyeish(fb, p, c) {
  const { color, W } = fb;
  for (const n of [p - W, p - 1, p + 1, p + W]) {
    if (color[n] !== c && color[n] !== EDGE) return false;
  }
  let bad = 0;
  let edge = 0;
  for (const d of [p - W - 1, p - W + 1, p + W - 1, p + W + 1]) {
    const cd = color[d];
    if (cd === EDGE) edge = 1;
    else if (cd === 3 - c) bad++;
  }
  return bad + edge < 2;
}

const stampArr = { arr: new Int32Array(0), n: 0 };
function freshStamp(cells) {
  if (stampArr.arr.length < cells) stampArr.arr = new Int32Array(cells);
  stampArr.n++;
  if (stampArr.n > 2e9) { stampArr.arr.fill(0); stampArr.n = 1; }
  return stampArr.n;
}

// p 에 c 를 두면 만들어질 덩어리가 단수이고 따내는 것도 없으면 그 돌 수를, 아니면 0을 돌려준다.
function fbSelfAtari(fb, p, c) {
  const { color, head, next, W } = fb;
  const opp = 3 - c;
  const ns = [p - W, p - 1, p + 1, p + W];
  let empty = 0;
  for (const n of ns) {
    if (color[n] === EMPTY) empty++;
    else if (color[n] === opp && fbAtari(fb, head[n])) return 0; // 따낸다
  }
  if (empty >= 2) return 0;
  const st = freshStamp(fb.cells);
  const mark = stampArr.arr;
  mark[p] = st;
  let libs = 0;
  let size = 1;
  for (const n of ns) {
    if (color[n] === EMPTY && mark[n] !== st) { mark[n] = st; libs++; }
  }
  const seenHeads = [];
  for (const n of ns) {
    if (color[n] !== c) continue;
    const h = head[n];
    if (seenHeads.includes(h)) continue;
    seenHeads.push(h);
    size += fb.gs[h];
    let s = h;
    do {
      for (const m of [s - W, s - 1, s + 1, s + W]) {
        if (color[m] === EMPTY && mark[m] !== st) { mark[m] = st; libs++; if (libs >= 2) return 0; }
      }
      s = next[s];
    } while (s !== h);
  }
  return libs <= 1 ? size : 0;
}

function fbAddLib(fb, h, p) { fb.pl[h]++; fb.ls[h] += p; fb.lq[h] += p * p; }
function fbSubLib(fb, h, p) { fb.pl[h]--; fb.ls[h] -= p; fb.lq[h] -= p * p; }

function fbMerge(fb, a, b) {
  const { head, next, gs } = fb;
  if (gs[a] < gs[b]) { const t = a; a = b; b = t; }
  let s = b;
  do { head[s] = a; s = next[s]; } while (s !== b);
  const t = next[a];
  next[a] = next[b];
  next[b] = t;
  fb.pl[a] += fb.pl[b];
  fb.ls[a] += fb.ls[b];
  fb.lq[a] += fb.lq[b];
  gs[a] += gs[b];
  return a;
}

function fbRemoveGroup(fb, h) {
  const { color, head, next, W } = fb;
  const stones = [];
  let s = h;
  do { stones.push(s); s = next[s]; } while (s !== h);
  for (const st of stones) { color[st] = EMPTY; fbAddEmpty(fb, st); }
  for (const st of stones) {
    for (const n of [st - W, st - 1, st + 1, st + W]) {
      const cn = color[n];
      if (cn === BLACK || cn === WHITE) fbAddLib(fb, head[n], st);
    }
  }
  return stones;
}

// 둘 수 있는지 미리 확인했다고 보고 둔다. 따낸 돌 수를 돌려준다.
function fbPlay(fb, p) {
  const c = fb.turn;
  fb.moves++;
  if (p === PASS_MOVE) {
    fb.passes++;
    fb.ko = -1;
    fb.turn = 3 - c;
    fb.last = PASS_MOVE;
    return 0;
  }
  const { color, head, W } = fb;
  const opp = 3 - c;
  fbRemoveEmpty(fb, p);
  color[p] = c;
  head[p] = p;
  fb.next[p] = p;
  fb.pl[p] = 0; fb.ls[p] = 0; fb.lq[p] = 0; fb.gs[p] = 1;
  const ns = [p - W, p - 1, p + 1, p + W];
  for (const n of ns) {
    const cn = color[n];
    if (cn === EMPTY) fbAddLib(fb, p, n);
    else if (cn !== EDGE) fbSubLib(fb, head[n], p);
  }
  let h = p;
  for (const n of ns) {
    if (color[n] === c && head[n] !== h) h = fbMerge(fb, h, head[n]);
  }
  let captured = 0;
  let capAt = -1;
  for (const n of ns) {
    if (color[n] === opp && fb.pl[head[n]] === 0) {
      const gone = fbRemoveGroup(fb, head[n]);
      captured += gone.length;
      capAt = gone[0];
    }
  }
  h = head[p];
  fb.ko = captured === 1 && fb.gs[h] === 1 && fb.pl[h] === 1 ? capAt : -1;
  fb.passes = 0;
  fb.turn = opp;
  fb.last = p;
  return captured;
}

// 판이 다 찼을 때의 집 계산 (돌 + 둘러싼 빈 칸). 흑 기준 점수 차와 칸별 주인을 돌려준다.
function fbScore(fb, own) {
  const { color, W, size } = fb;
  let b = 0;
  let w = 0;
  for (let y = 1; y <= size; y++) {
    for (let x = 1; x <= size; x++) {
      const p = y * W + x;
      let c = color[p];
      if (c === EMPTY) {
        let seen = 0;
        for (const n of [p - W, p - 1, p + 1, p + W]) {
          const cn = color[n];
          if (cn === BLACK || cn === WHITE) seen |= cn;
        }
        c = seen === BLACK || seen === WHITE ? seen : EMPTY;
      }
      if (c === BLACK) b++;
      else if (c === WHITE) w++;
      if (own) own[p] = c === BLACK ? 1 : c === WHITE ? -1 : 0;
    }
  }
  return b - w - fb.komi;
}

// 끝까지 두어 보기 (빠른 규칙: 따내기·단수 피하기·눈 메우지 않기 + 무작위)
function fbPlayout(fb, rng, seq) {
  const limit = fb.size * fb.size * 3;
  const { W } = fb;
  while (fb.passes < 2 && fb.moves < limit) {
    const c = fb.turn;
    let move = -1;
    const last = fb.last;
    if (last > 0 && rng() < 0.9) {
      const { color, head } = fb;
      // 1) 방금 둔 돌 둘레에서 단수 된 상대 덩어리를 따낸다, 2) 단수 된 내 덩어리를 달아나게 한다
      for (const n of [last, last - W, last - 1, last + 1, last + W]) {
        const cn = color[n];
        if ((cn !== BLACK && cn !== WHITE) || !fbAtari(fb, head[n])) continue;
        const lib = fbAtariLib(fb, head[n]);
        if (!fbLegal(fb, lib, c)) continue;
        if (cn === 3 - c) { move = lib; break; }
        if (cn === c && fbSelfAtari(fb, lib, c) === 0) { move = lib; break; }
      }
    }
    if (move < 0) {
      let k = fb.ne;
      while (k > 0) {
        const r = (rng() * k) | 0;
        const p = fb.empties[r];
        if (fbLegal(fb, p, c) && !fbEyeish(fb, p, c)) {
          // 스스로 단수: 큰 덩어리는 두지 않고, 2~3점은 가끔만 둔다(옥집 안에 들어가 죽이는 수 때문에)
          const sa = fbSelfAtari(fb, p, c);
          if (sa < 2 || (sa <= 3 && rng() < 0.3)) { move = p; break; }
        }
        // 못 두는 자리는 뒤로 보낸다
        k--;
        const q = fb.empties[k];
        fb.empties[r] = q; fb.epos[q] = r;
        fb.empties[k] = p; fb.epos[p] = k;
      }
    }
    if (move < 0) move = PASS_MOVE;
    if (seq) { seq.push(move); seq.push(c); }
    fbPlay(fb, move);
  }
}

// ---- 탐색 나무 ----

const TUNE = { priorN: 8, raveK: 1000, explore: 0.1, winW: 0.25, scale: 12 };

function coachUtility(scoreBlack, color) {
  const win = scoreBlack > 0 ? 1 : 0;
  const u = TUNE.winW * win + (1 - TUNE.winW) * (0.5 + 0.5 * Math.tanh(scoreBlack / TUNE.scale));
  return color === BLACK ? u : 1 - u;
}

// 처음 펼칠 때 수마다 주는 "미리 짐작" (몇 판 두어 본 셈 치기)
function coachPrior(fb, p, c) {
  if (p === PASS_MOVE) return 0.2;
  const { color, head, W, size } = fb;
  const opp = 3 - c;
  let v = 0.5;
  let touch = 0;
  for (const n of [p - W, p - 1, p + 1, p + W]) {
    const cn = color[n];
    if (cn === opp) {
      touch++;
      if (fbAtari(fb, head[n])) v += 0.3 + Math.min(0.2, fb.gs[head[n]] * 0.05); // 따내기
      else if (fb.pl[head[n]] <= 3) v += 0.05;
    } else if (cn === c) {
      touch++;
      if (fbAtari(fb, head[n])) v += 0.25; // 달아나기
    }
  }
  const sa = fbSelfAtari(fb, p, c);
  if (sa >= 2) v -= 0.35;
  else if (sa === 1) v -= 0.1;
  const x = (p % W) - 1;
  const y = ((p / W) | 0) - 1;
  const line = Math.min(x, y, size - 1 - x, size - 1 - y) + 1;
  const stones = size * size - fb.ne;
  if (stones < size + 2) {
    if (line === 1) v -= 0.25;
    else if (line === 2) v -= 0.1;
    else if (line === 3 || line === 4) v += 0.1;
  } else if (line === 1 && touch === 0) v -= 0.15;
  return Math.max(0.02, Math.min(0.98, v));
}



function coachNode(move, color) {
  // color: 이 수를 둔 사람. 통계는 그 사람 입장의 값이다.
  return { move, color, n: 0, w: 0, an: 0, aw: 0, kids: null, score: 0, own: null, pn: 0, pw: 0 };
}

function coachExpand(node, fb) {
  const c = fb.turn;
  const kids = [];
  for (let i = 0; i < fb.ne; i++) {
    const p = fb.empties[i];
    if (!fbLegal(fb, p, c) || fbEyeish(fb, p, c)) continue;
    const k = coachNode(p, c);
    const v = coachPrior(fb, p, c);
    k.pn = TUNE.priorN; k.pw = TUNE.priorN * v;
    kids.push(k);
  }
  const ps = coachNode(PASS_MOVE, c);
  const v = kids.length === 0 ? 0.9 : fb.passes > 0 ? 0.35 : 0.1;
  ps.pn = TUNE.priorN; ps.pw = TUNE.priorN * v;
  kids.push(ps);
  node.kids = kids;
}

function coachPick(node, focus, focusShare, isRoot) {
  const kids = node.kids;
  if (isRoot && focus) {
    const fk = kids.find((k) => k.move === focus);
    if (fk && fk.n < focusShare * (node.n + 1)) return fk;
  }
  const logN = Math.log(node.n + 1);
  let best = null;
  let top = -Infinity;
  for (const k of kids) {
    const n = k.n + k.pn;
    const q = (k.w + k.pw) / n;
    let v = q;
    if (k.an > 0) {
      const beta = Math.sqrt(TUNE.raveK / (3 * n + TUNE.raveK));
      v = (1 - beta) * q + beta * (k.aw / k.an);
    }
    v += TUNE.explore * Math.sqrt(logN / (n + 1));
    if (v > top) { top = v; best = k; }
  }
  return best;
}

// 한 번 내려가 두어 보고 결과를 위로 올린다.
function coachSimulate(root, rootFb, ctx) {
  const fb = fbClone(rootFb);
  const path = [root];
  const seq = [];
  let node = root;
  while (node.kids && fb.passes < 2) {
    const k = coachPick(node, ctx.focus, ctx.focusShare, node === root);
    if (k.move !== PASS_MOVE && !fbLegal(fb, k.move, fb.turn)) {
      // 패 때문에 막힌 자리 같은 경우: 이 판에서는 쉬는 셈 친다
      k.n++; k.w += 0;
      break;
    }
    seq.push(k.move, fb.turn);
    fbPlay(fb, k.move);
    path.push(k);
    node = k;
    if (k.n + 1 >= ctx.expandAt && !k.kids && fb.passes < 2) { coachExpand(k, fb); break; }
  }
  const depth = path.length - 1;
  fbPlayout(fb, ctx.rng, seq);
  const own = ctx.own;
  const score = fbScore(fb, own);

  // 값 올리기
  for (let i = 1; i < path.length; i++) {
    const k = path[i];
    k.n++;
    k.w += coachUtility(score, k.color);
    k.score += score;
  }
  root.n++;
  root.score += score;
  root.score2 += score * score;
  // 첫째 수(뿌리의 자식)에는 칸별 주인도 쌓는다
  if (path.length > 1) {
    const first = path[1];
    if (!first.own) first.own = new Float32Array(fb.cells);
    for (let p = 0; p < fb.cells; p++) first.own[p] += own[p];
  }
  for (let p = 0; p < fb.cells; p++) ctx.rootOwn[p] += own[p];

  // RAVE: 이 판에서 나중에 그 사람이 처음 둔 자리를 같이 쳐 준다
  const first = ctx.firstColor;
  first.fill(0);
  for (let k = seq.length - 2; k >= 0; k -= 2) {
    const mv = seq[k];
    if (mv !== PASS_MOVE) first[mv] = seq[k + 1];
    const d = k / 2;
    if (d <= depth) {
      const nd = path[d];
      if (nd.kids) {
        for (const ch of nd.kids) {
          if (ch.move !== PASS_MOVE && first[ch.move] === ch.color) {
            ch.an++;
            ch.aw += coachUtility(score, ch.color);
          }
        }
      }
    }
  }
}

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function coachSetup(state, options) {
  const fb = fbCreate(state.size, state.komi ?? 6.5);
  // 돌을 하나씩 놓아 덩어리 정보를 만든다 (따냄은 없는 판이라고 본다)
  for (let i = 0; i < state.board.length; i++) {
    const c = state.board[i];
    if (c === EMPTY) continue;
    fb.turn = c;
    fbPlay(fb, fbFromIdx(fb, i));
  }
  fb.turn = state.turn;
  fb.ko = state.ko >= 0 ? fbFromIdx(fb, state.ko) : -1;
  fb.passes = state.passes || 0;
  fb.moves = 0;
  fb.last = state.lastMove >= 0 ? fbFromIdx(fb, state.lastMove) : -1;
  const root = coachNode(-1, 3 - state.turn);
  root.score2 = 0;
  coachExpand(root, fb);
  const focus = options.focus === undefined || options.focus === null ? null
    : options.focus < 0 ? PASS_MOVE : fbFromIdx(fb, options.focus);
  if (focus !== null && !root.kids.some((k) => k.move === focus) && (focus === PASS_MOVE || fbLegal(fb, focus, fb.turn))) {
    // 눈 메우기처럼 보통은 빼는 수라도, 사람이 둔 수라면 따로 평가한다
    const k = coachNode(focus, fb.turn);
    k.pn = TUNE.priorN; k.pw = TUNE.priorN * 0.3;
    root.kids.push(k);
  }
  return {
    fb, root,
    ctx: {
      rng: options.rng || makeRng(options.seed ?? (Date.now() & 0xffffff)),
      focus, focusShare: options.focusShare ?? 0.2,
      expandAt: options.expandAt ?? 3,
      own: new Int8Array(fb.cells),
      rootOwn: new Float64Array(fb.cells),
      firstColor: new Uint8Array(fb.cells),
    },
  };
}

function coachReport(state, run) {
  const { fb, root, ctx } = run;
  const me = state.turn;
  const sign = me === BLACK ? 1 : -1;
  const cells = state.size * state.size;
  const ownership = new Array(cells);
  for (let i = 0; i < cells; i++) ownership[i] = root.n ? ctx.rootOwn[fbFromIdx(fb, i)] / root.n : 0;
  const moves = root.kids
    .filter((k) => k.n > 0)
    .map((k) => {
      const own = new Array(cells);
      for (let i = 0; i < cells; i++) own[i] = k.own ? k.own[fbFromIdx(fb, i)] / k.n : 0;
      return {
        move: k.move === PASS_MOVE ? -1 : fbToIdx(fb, k.move),
        visits: k.n,
        value: k.w / k.n,
        lead: (sign * k.score) / k.n, // 이 수를 둔 쪽이 몇 집 앞서는지 (어림)
        ownership: own, // +1 흑 집, -1 백 집
      };
    })
    .sort((a, b) => b.visits - a.visits);
  return {
    toPlay: me,
    playouts: root.n,
    lead: root.n ? (sign * root.score) / root.n : 0,
    // 어림의 흔들림(표준오차). 두 수를 견줄 때 이보다 작은 차이는 믿지 않는다
    leadError: root.n > 1 ? Math.sqrt(Math.max(0, root.score2 / root.n - (root.score / root.n) ** 2) / root.n) : 99,
    value: moves.length ? moves[0].value : 0.5,
    ownership,
    moves,
  };
}

// 수 읽기 (한 번에 끝까지). 테스트와 작은 판에 쓴다.
// options: playouts(기본 3000), focus(꼭 평가할 자리, -1은 쉬기), seed
export function analyzePosition(state, options = {}) {
  const run = coachSetup(state, options);
  const total = options.playouts ?? 3000;
  for (let i = 0; i < total; i++) coachSimulate(run.root, run.fb, run.ctx);
  return coachReport(state, run);
}

// 화면이 멈추지 않게 조금씩 나눠서 읽는다. 끝나면 결과를 돌려준다.
// options: playouts, timeMs(최대 시간), onProgress(0~1), signal({ cancelled })
export async function analyzePositionAsync(state, options = {}) {
  const run = coachSetup(state, options);
  const total = options.playouts ?? 3000;
  const timeMs = options.timeMs ?? 4000;
  const sliceMs = options.sliceMs ?? 24;
  const start = Date.now();
  let done = 0;
  while (done < total && Date.now() - start < timeMs) {
    const t0 = Date.now();
    while (done < total && Date.now() - t0 < sliceMs) {
      coachSimulate(run.root, run.fb, run.ctx);
      done++;
    }
    if (options.onProgress) options.onProgress(done / total);
    if (options.signal && options.signal.cancelled) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  return coachReport(state, run);
}

// 결과에서 어떤 수의 정보를 찾는다 (없으면 null)
export function moveInfo(report, move) {
  return report.moves.find((m) => m.move === move) || null;
}

// 가장 좋은 수: 많이 읽은 수 중에서 고른다
export function bestMoves(report, count = 3) {
  const top = report.moves[0];
  if (!top) return [];
  const minVisits = Math.max(8, top.visits * 0.08);
  return report.moves.filter((m) => m.visits >= minVisits).slice(0, count);
}

// 테스트용 내부 공개
export const __coachInternals = { fbCreate, fbPlay, fbLegal, fbSelfAtari, fbEyeish, fbScore, fbPlayout, fbFromIdx, fbToIdx, makeRng, PASS_MOVE, TUNE };
