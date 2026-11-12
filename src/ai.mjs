// 쉬운 상대 "돌돌이". 규칙 몇 가지와 무작위로만 둔다. 입문자가 이길 수 있는 세기가 목표다.
//  1) 따낼 수 있으면 따낸다 (가끔 못 본다)
//  2) 내 돌이 단수면 살린다 (가끔 못 본다)
//  3) 나머지는 점수를 매겨 고른다: 스스로 단수가 되는 수는 피하고, 상대를 단수 치는 수와 돌 근처를 좋아한다
import { EMPTY, play, groupAt, groupsInAtari, neighbors, opponent, score } from './rules.mjs';

export function chooseMove(state, options = {}) {
  const rng = options.rng || Math.random;
  const missCapture = options.missCapture ?? 0.1;
  const missEscape = options.missEscape ?? 0.3;
  const { size, board } = state;
  const me = state.turn;
  const foe = opponent(me);

  const cands = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    const r = play(state, i);
    if (!r.ok) continue;
    cands.push({ idx: i, after: r.state.board, captured: r.captured.length, libs: groupAt(r.state.board, size, i).liberties.length });
  }
  if (cands.length === 0) return -1;

  const pickBest = (list, value) => {
    let best = [];
    let top = -Infinity;
    for (const c of list) {
      const v = value(c);
      if (v > top) { top = v; best = [c]; } else if (v === top) best.push(c);
    }
    return best[Math.floor(rng() * best.length) % best.length].idx;
  };

  // 1) 따내기
  const caps = cands.filter((c) => c.captured > 0);
  if (caps.length && rng() >= missCapture) return pickBest(caps, (c) => c.captured);

  // 2) 단수 된 내 돌 살리기
  const mine = groupsInAtari(state).filter((g) => g.color === me).sort((a, b) => b.stones.length - a.stones.length);
  if (mine.length && rng() >= missEscape) {
    const anchor = mine[0].stones[0];
    const saves = cands.filter((c) => c.after[anchor] === me && groupAt(c.after, size, anchor).liberties.length >= 2);
    if (saves.length) return pickBest(saves, (c) => groupAt(c.after, size, anchor).liberties.length);
  }

  // 3) 점수 매기기 (대국에서는 둘 필요가 없는 자리를 걸러 낸다. 남는 자리가 없으면 쉰다)
  const rest = cands.filter((c) => (!options.allow || options.allow(c.idx)) && !(options.noSelfAtari && c.libs === 1 && c.captured === 0));
  if (rest.length === 0) return -1;
  const mid = (size - 1) / 2;
  return pickBest(rest, (c) => {
    const x = c.idx % size;
    const y = (c.idx - x) / size;
    const near = neighbors(size, c.idx);
    let v = rng();
    if (c.libs === 1) v -= 5; // 놓자마자 단수
    if (near.every((n) => board[n] === me)) v -= 3; // 내 집 메우기
    if (near.some((n) => board[n] === foe)) v += 0.5;
    if (near.some((n) => board[n] === me)) v += 0.25;
    if (c.libs >= 2 && near.some((n) => c.after[n] === foe && groupAt(c.after, size, n).liberties.length === 1)) v += 1.5;
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) v -= 0.6;
    v += 0.4 * (1 - (Math.abs(x - mid) + Math.abs(y - mid)) / (2 * mid));
    return v;
  });
}

// 한 판을 끝까지 두는 대국용. 둘 곳이 없으면 -1(한 수 쉬기)을 돌려준다.
//  - 내 집 안에는 두지 않는다 (집이 줄어든다)
//  - 상대 집이 좁으면(8집 이하) 들어가지 않는다. 판이 어느 정도 차면 넓은 상대 집에도 들어가지 않는다
//  - 스스로 단수가 되는 수는 두지 않는다
export function chooseGameMove(state, options = {}) {
  const { size, board } = state;
  const me = state.turn;
  const cells = size * size;
  if (state.moveNumber >= cells * 2) return -1;
  const owner = score(state).owner;
  // 빈 구역마다 크기를 센다
  const regionSize = new Array(cells).fill(0);
  const seen = new Set();
  for (let i = 0; i < cells; i++) {
    if (board[i] !== EMPTY || seen.has(i)) continue;
    const region = [i];
    seen.add(i);
    for (let k = 0; k < region.length; k++) {
      for (const n of neighbors(size, region[k])) {
        if (board[n] === EMPTY && !seen.has(n)) { seen.add(n); region.push(n); }
      }
    }
    for (const r of region) regionSize[r] = region.length;
  }
  const late = state.moveNumber >= cells * 0.6;
  const allow = (i) => {
    if (owner[i] === me) return false;
    if (owner[i] === opponent(me)) return !late && regionSize[i] > 8;
    return true;
  };
  return chooseMove(state, { ...options, allow, noSelfAtari: true });
}
