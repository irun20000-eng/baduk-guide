// 지도 말풀이: 지도 엔진(coach.mjs)의 결과와 규칙 엔진으로 "왜 이 수가 좋고 나쁜지"를 쉬운 말로 만든다.
// - 손해 집 수는 엔진의 어림이다. 숫자보다 이유와 원칙을 먼저 보여 준다.
import { EMPTY, BLACK, play, pass, groupAt, groupsInAtari, neighbors, opponent, toCoord } from './rules.mjs';
import { moveInfo, bestMoves, analyzePositionAsync } from './coach.mjs';

export const COACH_GRADES = {
  best: { text: '최선의 수', short: '최선' },
  good: { text: '좋은 수', short: '좋음' },
  ok: { text: '괜찮은 수', short: '보통' },
  inacc: { text: '아쉬운 수', short: '아쉬움' },
  mistake: { text: '큰 실수', short: '실수' },
};

// 여러 이유가 겹치면 앞의 것을 먼저 말한다
export const COACH_PRIORITY = ['capture', 'save', 'kill', 'weak', 'selfAtari', 'ladder', 'fillOwn', 'cut', 'connect', 'opening', 'big', 'settled', 'pass', 'general'];

// 원칙(전문가는 이렇게 생각해요)과 다시 볼 차시
export const COACH_TOPICS = {
  capture: { tip: '따낼 수 있는 돌은 먼저 따내요. 특히 내 돌을 끊고 있는 돌은 가치가 커요.', lesson: 'L04', name: '따낼 기회 놓침' },
  save: { tip: '상대가 단수를 치면 먼저 "살릴 수 있나, 버려도 되나"를 따져 봐요.', lesson: 'L06', name: '단수 된 돌 못 살림' },
  ladder: { tip: '축에 걸린 돌은 달아날수록 더 많이 잡혀요. 축인지 먼저 읽고, 안 되면 버리고 다른 큰 곳에 두어요.', lesson: 'L17', name: '축으로 달아나기' },
  selfAtari: { tip: '두기 전에 "두고 나면 내 돌 활로가 몇 개?"를 세어 봐요. 하나면 바로 잡혀요.', lesson: 'L05', name: '스스로 단수' },
  weak: { tip: '약한 돌부터 돌봐요. 돌이 살려면 두 집이 필요해요. 상대가 노리기 전에 먼저 지켜요.', lesson: 'L12', name: '약한 돌 못 지킴' },
  kill: { tip: '상대의 약한 돌은 눈을 만들 급소를 먼저 차지하면 잡을 수 있어요.', lesson: 'L14', name: '잡을 기회 놓침' },
  fillOwn: { tip: '내 집 안은 비워 두어요. 내 집에 두면 내 집이 줄어들어요.', lesson: 'L10', name: '내 집 메우기' },
  settled: { tip: '이미 주인이 정해진 곳보다 아직 주인이 없는 곳이 커요.', lesson: 'L23', name: '정해진 곳에 두기' },
  opening: { tip: '초반에는 귀 → 변 → 중앙 순서로, 3선과 4선에 두어요. 1·2선은 집이 작아요.', lesson: 'L22', name: '초반에 너무 낮게' },
  big: { tip: '급한 싸움이 없으면 가장 넓게 비어 있는 곳을 먼저 차지해요.', lesson: 'L23', name: '큰 자리 놓침' },
  cut: { tip: '상대 돌이 끊어지는 자리는 나에게 기회예요. 끊긴 돌은 따로따로 살아야 해서 약해져요.', lesson: 'L07', name: '끊을 기회 놓침' },
  connect: { tip: '끊길 것 같은 내 돌은 이어 두면 하나로 튼튼해져요.', lesson: 'L06', name: '잇기 놓침' },
  pass: { tip: '더 둘 곳이 없으면 한 수 쉬어도 돼요. 내 집 안에 두면 오히려 손해예요.', lesson: 'L11', name: '둘 곳 없음' },
  general: { tip: '두기 전에 ① 내 돌이 단수인가 ② 상대 돌을 따낼 수 있나 ③ 가장 넓은 곳은 어디인가를 차례로 살펴봐요.', lesson: 'L23', name: '형세 판단' },
};

function explainStonesAround(board, size, idx, dist) {
  const x0 = idx % size;
  const y0 = (idx - x0) / size;
  for (let y = Math.max(0, y0 - dist); y <= Math.min(size - 1, y0 + dist); y++) {
    for (let x = Math.max(0, x0 - dist); x <= Math.min(size - 1, x0 + dist); x++) {
      if (Math.abs(x - x0) + Math.abs(y - y0) > dist) continue;
      const i = y * size + x;
      if (i !== idx && board[i] !== EMPTY) return true;
    }
  }
  return false;
}

// 축 읽기: 단수 다음에 늘 2활로로 달아나는 덩어리를, 공격하는 쪽(state.turn)이 끝내 잡는지 본다.
export function ladderWorks(state, stone, depth = 0) {
  if (depth > 40) return false;
  const g = groupAt(state.board, state.size, stone);
  if (g.color === EMPTY) return true;
  if (g.liberties.length === 1) return true; // 지금 따낼 수 있다
  if (g.liberties.length > 2) return false;
  for (const lib of g.liberties) {
    const a = play(state, lib); // 공격: 단수 치기
    if (!a.ok) continue;
    const g2 = groupAt(a.state.board, state.size, stone);
    if (g2.color === EMPTY) return true;
    if (g2.liberties.length !== 1) continue;
    // 수비: 단수 된 공격 돌을 따내거나 달아난다
    let escaped = false;
    const tries = [g2.liberties[0]];
    for (const s of g2.stones) {
      for (const n of neighbors(state.size, s)) {
        if (a.state.board[n] === a.state.turn || a.state.board[n] === EMPTY) continue;
        const ag = groupAt(a.state.board, state.size, n);
        if (ag.liberties.length === 1 && !tries.includes(ag.liberties[0])) tries.push(ag.liberties[0]);
      }
    }
    for (const t of tries) {
      const d = play(a.state, t);
      if (!d.ok) continue;
      const g3 = groupAt(d.state.board, state.size, stone);
      if (g3.color === EMPTY) continue;
      if (g3.liberties.length >= 3) { escaped = true; break; }
      if (g3.liberties.length === 2 && !ladderWorks(d.state, stone, depth + 1)) { escaped = true; break; }
    }
    if (!escaped) return true;
  }
  return false;
}

// 한 수가 판에서 하는 일 (규칙만 보고 안다)
export function moveFacts(state, move) {
  const { size, board } = state;
  const me = state.turn;
  const foe = opponent(me);
  const facts = { move, pass: move < 0, captured: 0, saved: 0, ataris: 0, selfAtari: 0, connects: false, cuts: false, line: 0, lonely: false, ladderDead: 0 };
  if (move < 0) return facts;
  const r = play(state, move);
  if (!r.ok) return { ...facts, illegal: r.reason };
  const after = r.state.board;
  facts.captured = r.captured.length;
  const x = move % size;
  const y = (move - x) / size;
  facts.line = Math.min(x, y, size - 1 - x, size - 1 - y) + 1;
  facts.lonely = !explainStonesAround(board, size, move, 2);

  const before = groupsInAtari(state);
  for (const g of before) {
    if (g.color !== me) continue;
    const s = g.stones[0];
    if (after[s] === me && groupAt(after, size, s).liberties.length >= 2) facts.saved += g.stones.length;
  }
  const own = groupAt(after, size, move);
  if (own.liberties.length === 1 && facts.captured === 0) facts.selfAtari = own.stones.length;
  // 달아났는데 축이라 결국 잡히는지
  if (facts.saved > 0 && own.liberties.length === 2 && ladderWorks(r.state, move)) facts.ladderDead = own.stones.length;

  const myHeads = new Set();
  const foeHeads = new Set();
  for (const n of neighbors(size, move)) {
    if (board[n] === me) myHeads.add(groupAt(board, size, n).stones.sort((a, b) => a - b)[0]);
    else if (board[n] === foe) {
      const g = groupAt(board, size, n);
      foeHeads.add(g.stones.sort((a, b) => a - b)[0]);
      if (after[n] === foe && g.liberties.length > 1 && groupAt(after, size, n).liberties.length === 1) facts.ataris += g.stones.length;
    }
  }
  facts.connects = myHeads.size >= 2;
  facts.cuts = foeHeads.size >= 2 && facts.captured === 0;
  return facts;
}

// 덩어리마다 "그 색이 살아 있을 정도"(+1 산다, -1 죽는다)를 어림으로 계산
function explainGroupLife(state, ownership) {
  const { size, board } = state;
  const seen = new Set();
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY || seen.has(i)) continue;
    const g = groupAt(board, size, i);
    for (const s of g.stones) seen.add(s);
    const sign = g.color === BLACK ? 1 : -1;
    let sum = 0;
    for (const s of g.stones) sum += ownership[s] * sign;
    out.push({ color: g.color, stones: g.stones, life: sum / g.stones.length });
  }
  return out;
}

// 두 수를 비교했을 때 살고 죽는 것이 크게 바뀌는 덩어리 (가장 큰 것)
function explainLifeSwing(state, mine, better) {
  const me = state.turn;
  const a = explainGroupLife(state, mine.ownership);
  const b = explainGroupLife(state, better.ownership);
  let myLoss = null;
  let foeKill = null;
  a.forEach((ga, k) => {
    const gb = b[k];
    if (ga.color === me && gb.life > 0.25 && ga.life < -0.25 && (!myLoss || ga.stones.length > myLoss.stones.length)) myLoss = ga;
    if (ga.color !== me && gb.life < -0.25 && ga.life > 0.25 && (!foeKill || ga.stones.length > foeKill.stones.length)) foeKill = ga;
  });
  return { myLoss, foeKill };
}

// 초반: 판에 돌이 아직 적다 (9줄에서 12개 미만)
function explainEarly(state) {
  let n = 0;
  for (const c of state.board) if (c !== EMPTY) n++;
  return n < Math.round(state.size * state.size * 0.15);
}

function explainGrade(loss, isBest) {
  if (isBest || loss < 1.5) return isBest ? 'best' : 'good';
  if (loss < 4) return 'ok';
  if (loss < 10) return 'inacc';
  return 'mistake';
}

const lessonName = (id) => ({ L04: '따내기', L05: '단수', L06: '달아나기와 잇기', L07: '끊기', L10: '집', L11: '한 판의 끝', L12: '두 집이면 산다', L14: '급소', L17: '축', L22: '어디부터 둘까', L23: '한 판의 흐름' }[id] || '');

// 짧은 이름 붙이기 (힌트에서 쓴다)
export function moveLabel(state, move, report) {
  if (move < 0) return '한 수 쉬기';
  const f = moveFacts(state, move);
  if (f.captured) return '따내기 ' + f.captured + '점';
  if (f.saved && !f.ladderDead) return '달아나기';
  if (f.ataris) return '단수 치기';
  if (f.cuts) return '끊기';
  if (f.connects) return '잇기';
  const info = report && moveInfo(report, move);
  const alt = report && report.moves.find((m) => m.move !== move);
  if (info && alt) {
    // 다른 좋은 수와 비교해 살고 죽는 것이 바뀌면 그 이름을 붙인다
    const sw = explainLifeSwing(state, alt, info);
    if (sw.foeKill) return '상대 돌 잡기';
    if (sw.myLoss) return '내 돌 살리기(급소)';
  }
  // 활로가 적은 덩어리 곁이면: 내 돌이면 지키기, 상대 돌이면 공격
  let weakMine = 0;
  let weakFoe = 0;
  for (const n of neighbors(state.size, move)) {
    const c = state.board[n];
    if (c === EMPTY) continue;
    const g = groupAt(state.board, state.size, n);
    if (g.liberties.length <= 3) {
      if (c === state.turn) weakMine = Math.max(weakMine, g.stones.length);
      else weakFoe = Math.max(weakFoe, g.stones.length);
    }
  }
  if (weakMine >= 2) return '내 돌 지키기';
  if (weakFoe >= 2) return '상대 돌 공격';
  if (explainEarly(state) && (f.line === 3 || f.line === 4)) return '큰 자리(' + f.line + '선)';
  if (explainEarly(state) && move === (state.size * state.size - 1) / 2) return '가운데(천원)';
  if (f.lonely) return '넓은 곳';
  return '형세상 좋은 곳';
}

// 지도 한 마디: 내가 둔 수(move)를 엔진 결과(report, move 를 꼭 평가해 둔 것)와 비교한다.
export function coachMove(state, move, report, cmp) {
  const size = state.size;
  const coord = (m) => (m < 0 ? '쉬기' : toCoord(size, m));
  // cmp 가 있으면(coachEvaluate) 두 수를 같은 만큼 따로 읽은 값으로 견준다. 없으면 한 나무 안의 값으로 견준다.
  let best;
  let mine;
  let noise = 0;
  if (cmp) {
    best = cmp.bestMove === move ? null : { move: cmp.bestMove, lead: cmp.bestLead, value: 1, ownership: cmp.bestOwn };
    mine = { move, lead: cmp.mineLead, value: 1, ownership: cmp.mineOwn };
    noise = cmp.error || 0;
  } else {
    // 엔진이 고른 수: 내가 둔 수를 뺀 것 중 가장 많이 읽은 수 (내 수는 일부러 더 읽게 했으므로 따로 비교한다)
    const others = report.moves.filter((m) => m.move !== move);
    best = others[0] || null;
    mine = moveInfo(report, move);
  }
  const out = {
    move, coord: coord(move), grade: 'ok', gradeText: '', loss: 0, headline: '', why: [], better: null, tip: '', lesson: null, tags: [], good: [],
  };
  if (!mine) {
    out.grade = 'ok';
    out.gradeText = COACH_GRADES.ok.text;
    out.headline = '이 수는 따로 읽어 보지 못했어요.';
    return out;
  }
  const isBest = cmp ? cmp.bestMove === move : !best || (mine.value >= best.value && mine.lead >= best.lead - 0.5);
  const loss = !best ? 0 : Math.max(0, best.lead - mine.lead - 1.5 * noise);
  out.loss = Math.round(loss * 10) / 10;
  out.grade = explainGrade(loss, isBest);
  out.gradeText = COACH_GRADES[out.grade].text;

  const f = moveFacts(state, move);
  const swingVsBest = isBest ? { myLoss: null, foeKill: null } : explainLifeSwing(state, mine, best);

  // 잘한 점
  if (f.captured) out.good.push('상대 돌 ' + f.captured + '점을 따냈어요.');
  if (f.saved && !f.ladderDead) out.good.push('단수 된 내 돌 ' + f.saved + '점을 살렸어요.');
  if (f.ataris && !f.selfAtari) out.good.push('상대 돌을 단수로 몰았어요.');
  if (f.cuts && !f.selfAtari) out.good.push('상대 돌을 끊었어요.');
  if (f.connects && !f.selfAtari) out.good.push('내 돌을 이었어요.');

  const tags = [];
  if (out.grade === 'best' || out.grade === 'good') {
    out.headline = out.grade === 'best' ? '최선의 수예요!' : '좋은 수예요!';
    if (!out.good.length) {
      if (explainEarly(state) && (f.line === 3 || f.line === 4)) out.good.push('초반에 ' + f.line + '선의 큰 자리를 차지했어요.');
      else out.good.push('지금 판에서 가장 좋은 곳 가운데 하나예요.');
    }
    if (!isBest && best) out.better = { move: best.move, coord: coord(best.move), reasons: [], equal: true };
    return out;
  }

  // 무엇이 아쉬운가 (내 수)
  if (f.selfAtari) { tags.push('selfAtari'); out.why.push('두고 나니 내 돌 ' + f.selfAtari + '점이 스스로 단수가 됐어요. 상대가 바로 따낼 수 있어요.'); }
  if (f.ladderDead) { tags.push('ladder'); out.why.push('이 돌은 축에 걸려 있어요. 달아나도 끝내 잡히고 잡히는 돌만 늘어나요.'); }
  if (swingVsBest.myLoss) { tags.push('weak'); out.why.push('이대로면 내 돌 ' + swingVsBest.myLoss.stones.length + '점이 잡힐 가능성이 커요.'); }
  const mineOwn = mine.ownership[move] * (state.turn === BLACK ? 1 : -1);
  const beforeOwn = report.ownership[move] * (state.turn === BLACK ? 1 : -1);
  if (!f.pass && !f.captured && !f.saved && beforeOwn > 0.8 && neighbors(size, move).every((n) => state.board[n] !== opponent(state.turn))) {
    tags.push('fillOwn'); out.why.push('이미 내 집인 곳에 두었어요. 내 집이 한 집 줄어요.');
  } else if (!f.pass && !f.captured && !f.saved && !f.ataris && Math.abs(beforeOwn) > 0.85 && !swingVsBest.myLoss) {
    tags.push('settled'); out.why.push('이미 주인이 거의 정해진 곳이라 이 수의 효과가 작아요.');
  }
  if (!f.pass && mineOwn < -0.6 && !f.selfAtari && !tags.includes('fillOwn')) out.why.push('둔 돌이 상대 세력 안이라 살기 어려워요.');
  if (f.pass) out.why.push('아직 둘 곳이 남았는데 한 수 쉬었어요. 쉬면 상대만 한 수 더 두는 셈이에요.');
  if (!f.pass && explainEarly(state) && f.line <= 2 && !f.captured && !f.saved) { tags.push('opening'); out.why.push('초반에 ' + f.line + '선은 너무 낮아서 집이 작아요.'); }

  // 더 나은 수
  const bf = moveFacts(state, best.move);
  const reasons = [];
  if (best.move < 0) { tags.push('pass'); reasons.push('더 둘 곳이 거의 없어요. 이럴 땐 한 수 쉬는 게 나아요.'); }
  if (bf.captured && !f.captured) { tags.push('capture'); reasons.push('상대 돌 ' + bf.captured + '점을 바로 따낼 수 있었어요.'); }
  if (bf.saved && !f.saved && !bf.ladderDead) { tags.push('save'); reasons.push('단수 된 내 돌 ' + bf.saved + '점을 살릴 수 있었어요.'); }
  if (swingVsBest.myLoss && !bf.saved) reasons.push('약한 내 돌 ' + swingVsBest.myLoss.stones.length + '점을 지킬 수 있었어요.');
  if (swingVsBest.foeKill) { tags.push('kill'); reasons.push('상대 돌 ' + swingVsBest.foeKill.stones.length + '점을 잡을 수 있었어요.'); }
  if (bf.cuts && !f.cuts && !reasons.length) { tags.push('cut'); reasons.push('상대 돌을 끊어서 약하게 만드는 자리예요.'); }
  if (bf.connects && !f.connects && !reasons.length) { tags.push('connect'); reasons.push('내 돌을 이어서 튼튼하게 만드는 자리예요.'); }
  if (bf.ataris && !reasons.length) reasons.push('단수를 쳐서 상대가 받게 만드는 자리예요(선수).');
  if (!reasons.length && explainEarly(state) && (bf.line === 3 || bf.line === 4)) { tags.push(!f.pass && f.line <= 2 ? 'opening' : 'big'); reasons.push('초반의 큰 자리(' + bf.line + '선)예요.'); }
  if (!reasons.length && bf.lonely) { tags.push('big'); reasons.push('아직 넓게 비어 있는 큰 자리예요.'); }
  if (!reasons.length) { tags.push('general'); reasons.push('형세를 읽어 보면 이쪽이 약 ' + Math.max(1, Math.round(loss)) + '집 더 좋아요.'); }
  out.better = { move: best.move, coord: coord(best.move), reasons };

  out.tags = [...new Set(tags)];
  const main = COACH_PRIORITY.find((t) => out.tags.includes(t)) || 'general';
  out.tip = COACH_TOPICS[main].tip;
  out.lesson = { id: COACH_TOPICS[main].lesson, title: lessonName(COACH_TOPICS[main].lesson) };
  const lossText = out.loss >= 1 ? ' 약 ' + Math.round(out.loss) + '집 손해예요.' : '';
  out.headline = out.gradeText + '예요.' + lossText;
  return out;
}

// 내가 둔 수를 지도한다: ① 지금 판을 읽어 엔진의 수를 찾고 ② 내 수와 엔진의 수를 둔 뒤의 판을 같은 만큼 따로 읽어 견준다.
// 같은 만큼 읽어야 "많이 읽은 수가 더 좋아 보이는" 치우침이 줄어든다.
export async function coachEvaluate(state, move, options = {}) {
  const playouts = options.playouts ?? 2500;
  // 내 수를 일부러 더 읽지 않는다(그러면 내 수가 가장 많이 읽은 수처럼 보인다). 엔진이 스스로 고른 수와 견준다.
  const report = options.report || await analyzePositionAsync(state, {
    playouts, timeMs: options.timeMs ?? 1500, seed: options.seed,
  });
  const engineTop = report.moves[0];
  const mineInfo = moveInfo(report, move);
  const engine = engineTop && engineTop.move !== move ? engineTop : null;
  // 내 수가 엔진이 가장 많이 읽은 수면 따로 견주지 않는다
  if (!engine) {
    const lead = mineInfo ? mineInfo.lead : report.lead;
    const note = coachMove(state, move, report, { bestMove: move, mineLead: lead, bestLead: lead, mineOwn: mineInfo ? mineInfo.ownership : report.ownership, bestOwn: report.ownership, error: 0 });
    note.leadAfter = lead;
    return { report, note };
  }
  const after = (m) => (m < 0 ? pass(state) : play(state, m).state);
  const sub = { playouts: options.subPlayouts ?? Math.round(playouts * 0.6), timeMs: options.subTimeMs ?? 900, seed: options.seed };
  const rm = await analyzePositionAsync(after(move), sub);
  const rb = await analyzePositionAsync(after(engine.move), sub);
  const cmp = {
    bestMove: engine.move,
    mineLead: -rm.lead,
    bestLead: -rb.lead,
    mineOwn: rm.ownership,
    bestOwn: rb.ownership,
    error: Math.sqrt(rm.leadError ** 2 + rb.leadError ** 2),
  };
  const note = coachMove(state, move, report, cmp);
  note.leadAfter = cmp.mineLead;
  if (options.debug) note.debug = { raw: cmp.bestLead - cmp.mineLead, error: cmp.error };
  return { report, note, cmp };
}

// 힌트: 지금 둘 만한 곳 몇 개와 짧은 이름
export function coachHints(state, report, count = 3) {
  return bestMoves(report, count).map((m, i) => ({
    move: m.move,
    letter: 'ABC'[i] || String(i + 1),
    coord: m.move < 0 ? '쉬기' : toCoord(state.size, m.move),
    label: moveLabel(state, m.move, report),
    lead: Math.round(m.lead * 10) / 10,
  }));
}

// 복기 요약: 수마다 만든 coachMove 결과 목록으로 잘한 점, 고칠 점, 다시 볼 차시를 정리한다.
// items: [{ moveNumber, color, note: coachMove(...) }]
export function summarizeReview(items) {
  const counts = {};
  let total = 0;
  const grades = { best: 0, good: 0, ok: 0, inacc: 0, mistake: 0 };
  for (const it of items) {
    grades[it.note.grade]++;
    total += it.note.loss;
    if (it.note.grade === 'inacc' || it.note.grade === 'mistake') {
      for (const t of it.note.tags) if (t !== 'general') counts[t] = (counts[t] || 0) + 1;
    }
  }
  const worst = items
    .filter((it) => it.note.grade === 'inacc' || it.note.grade === 'mistake')
    .sort((a, b) => b.note.loss - a.note.loss)
    .slice(0, 3);
  const habits = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([tag, n]) => ({ tag, count: n, name: COACH_TOPICS[tag].name, tip: COACH_TOPICS[tag].tip, lesson: { id: COACH_TOPICS[tag].lesson, title: lessonName(COACH_TOPICS[tag].lesson) } }));
  const goodCount = grades.best + grades.good;
  const praise = items.filter((it) => it.note.good.length && (it.note.grade === 'best' || it.note.grade === 'good')).slice(0, 3);
  const n = items.length || 1;
  const goal = habits.length
    ? '다음 판 목표: ' + habits[0].tip
    : '다음 판 목표: 지금처럼 두되, 두기 전에 단수와 따낼 돌을 한 번 더 살펴봐요.';
  return {
    moves: items.length,
    grades,
    goodRate: Math.round((goodCount / n) * 100),
    totalLoss: Math.round(total),
    worst,
    habits,
    praise,
    goal,
  };
}

// 한 판 복기: 수순(states: 처음 판부터 매 수 뒤의 판)에서 colors 쪽이 둔 수를 하나씩 읽는다.
// options: colors([BLACK] 등), playouts(수마다), timeMs(수마다 최대), onProgress(done, total), signal({ cancelled })
export async function reviewGame(states, options = {}) {
  const colors = options.colors || [BLACK, opponent(BLACK)];
  const jobs = [];
  for (let i = 0; i + 1 < states.length; i++) {
    const s = states[i];
    const n = states[i + 1];
    if (!colors.includes(s.turn) || s.passes >= 2) continue;
    const passed = n.passes > s.passes;
    const move = passed ? -1 : n.lastMove;
    // 끝내기에서 둘 다 쉬는 수는 복기하지 않는다
    if (passed && n.passes >= 2) continue;
    jobs.push({ index: i, move, state: s });
  }
  const items = [];
  for (let k = 0; k < jobs.length; k++) {
    if (options.signal && options.signal.cancelled) break;
    const job = jobs[k];
    const { report, note } = await coachEvaluate(job.state, job.move, {
      playouts: options.playouts ?? 2500,
      timeMs: options.timeMs ?? 1200,
      subTimeMs: options.subTimeMs,
      debug: options.debug,
      seed: options.seed !== undefined ? options.seed + k : undefined,
    });
    items.push({ index: job.index, moveNumber: job.state.moveNumber + 1, color: job.state.turn, move: job.move, note, lead: report.lead });
    if (options.onProgress) options.onProgress(k + 1, jobs.length);
  }
  return { items, summary: summarizeReview(items) };
}