// 지도 엔진과 지도 말풀이 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, gameFromRows, play, pass, legalMoves, fromCoord, toCoord, BLACK, WHITE, EMPTY } from '../src/rules.mjs';
import { analyzePosition, analyzePositionAsync, bestMoves, __coachInternals as I } from '../src/coach.mjs';
import { coachMove, coachEvaluate, coachHints, moveFacts, ladderWorks, reviewGame, summarizeReview, COACH_TOPICS, COACH_PRIORITY } from '../src/coach-explain.mjs';

const at = (c) => fromCoord(9, c);

// 빠른 판을 규칙 엔진의 판에서 다시 만든다
function fastFrom(state) {
  const fb = I.fbCreate(state.size, state.komi);
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === EMPTY) continue;
    fb.turn = state.board[i];
    I.fbPlay(fb, I.fbFromIdx(fb, i));
  }
  fb.turn = state.turn;
  fb.ko = state.ko >= 0 ? I.fbFromIdx(fb, state.ko) : -1;
  return fb;
}

test('빠른 판은 규칙 엔진과 똑같이 따내고, 같은 자리만 둘 수 있게 한다 (무작위 대국 30판)', () => {
  const rng = I.makeRng(12345);
  for (let g = 0; g < 30; g++) {
    let s = createGame(g % 3 === 0 ? 5 : 9);
    const fb = fastFrom(s);
    for (let k = 0; k < 140; k++) {
      const legal = legalMoves(s);
      // 둘 수 있는 자리 목록이 같아야 한다
      const fastLegal = [];
      for (let i = 0; i < s.board.length; i++) if (I.fbLegal(fb, I.fbFromIdx(fb, i), fb.turn)) fastLegal.push(i);
      assert.deepEqual(fastLegal, legal, '판 ' + g + ', ' + k + '수째 둘 수 있는 자리');
      if (legal.length === 0) break;
      const m = legal[Math.floor(rng() * legal.length)];
      const r = play(s, m);
      const cap = I.fbPlay(fb, I.fbFromIdx(fb, m));
      assert.equal(cap, r.captured.length);
      s = r.state;
      for (let i = 0; i < s.board.length; i++) assert.equal(fb.color[I.fbFromIdx(fb, i)], s.board[i]);
      assert.equal(fb.ko, s.ko >= 0 ? I.fbFromIdx(fb, s.ko) : -1, '패 자리');
    }
  }
});

test('스스로 단수 판별: 들어가자마자 단수인 자리', () => {
  const s = gameFromRows([
    '.O.......',
    'O.O......',
    '.O.......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
  ], { turn: BLACK });
  const fb = fastFrom(s);
  // B8 은 백에 둘러싸여 착수금지, A9 는 흑이 두면 활로 0 → 착수금지
  assert.equal(I.fbLegal(fb, I.fbFromIdx(fb, at('B8')), BLACK), false);
  // C9 에 흑을 두면 활로 하나(D9) → 스스로 단수 1점
  assert.equal(I.fbSelfAtari(fb, I.fbFromIdx(fb, at('D8')), BLACK), 0);
  assert.equal(I.fbSelfAtari(fb, I.fbFromIdx(fb, at('C9')), BLACK), 1);
});

const EYE_ROWS = [
  '.........',
  '.........',
  '.........',
  '.........',
  '.........',
  'OOOOOO...',
  'XXXXXOO..',
  'X...XXO..',
  'XXXXXXO..',
];

test('삶과 죽음의 급소를 찾는다: 흑은 C2로 살고, 백은 C2로 잡는다', () => {
  const live = analyzePosition(gameFromRows(EYE_ROWS, { turn: BLACK }), { playouts: 5000, seed: 3 });
  assert.equal(toCoord(9, live.moves[0].move), 'C2');
  const kill = analyzePosition(gameFromRows(EYE_ROWS, { turn: WHITE }), { playouts: 5000, seed: 4 });
  assert.equal(toCoord(9, kill.moves[0].move), 'C2');
});

test('큰 덩어리가 단수면 따내는 수를 가장 좋게 본다', () => {
  const s = gameFromRows([
    '.........',
    '..XXX....',
    '.XOOOX...',
    '..XXOX...',
    '...X.....',
    '.........',
    '.........',
    '.........',
    '.........',
  ], { turn: BLACK });
  // 백 4점(C7,D7,E7,E6)의 활로는 E5 하나
  const r = analyzePosition(s, { playouts: 3000, seed: 9 });
  assert.equal(toCoord(9, r.moves[0].move), 'E5');
  const hints = coachHints(s, r, 3);
  assert.equal(hints[0].coord, 'E5');
  assert.match(hints[0].label, /따내기 4점/);
});

test('수 읽기 결과의 모양: 집 어림, 칸별 주인, 흔들림', async () => {
  const s = createGame(9);
  const r = await analyzePositionAsync(s, { playouts: 600, seed: 1, timeMs: 5000 });
  assert.equal(r.toPlay, BLACK);
  assert.equal(r.playouts, 600);
  assert.equal(r.ownership.length, 81);
  assert.ok(r.leadError > 0 && r.leadError < 5);
  assert.ok(bestMoves(r, 3).length >= 1);
  for (const m of r.moves) assert.equal(m.ownership.length, 81);
});

test('수가 하는 일: 따내기, 달아나기, 스스로 단수, 잇기, 끊기, 줄 수', () => {
  const s = gameFromRows([
    '.........',
    '..X......',
    '.XOX.....',
    '.........',
    '......O..',
    '.....X.X.',
    '......O..',
    '.........',
    '.........',
  ], { turn: BLACK });
  const cap = moveFacts(s, at('C6'));
  assert.equal(cap.captured, 1);
  const cut = moveFacts(s, at('G4'));
  assert.equal(cut.connects, true); // 흑 F4 와 H4 사이
  const low = moveFacts(s, at('A1'));
  assert.equal(low.line, 1);
  assert.equal(low.lonely, true);
  const selfA = moveFacts(gameFromRows(['.O.......', 'O........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], { turn: BLACK }), at('A9'));
  assert.equal(selfA.illegal, 'suicide');
});

test('축: 달아나도 잡히는 돌을 알아본다', () => {
  const s = gameFromRows([
    '.........',
    '.........',
    '..O......',
    '.OXO.....',
    '...O.....',
    '.........',
    '.........',
    '.........',
    '.........',
  ], { turn: BLACK });
  const f = moveFacts(s, at('C5'));
  assert.equal(f.saved, 1);
  assert.equal(f.ladderDead, 2);
  // 활로가 셋이 되는 곳으로 나가면 축이 아니다
  const open = gameFromRows(['.........', '.........', '..O......', '.OXO.....', '.........', '.........', '.........', '.........', '.........'], { turn: BLACK });
  assert.equal(moveFacts(open, at('C5')).ladderDead, 0);
  assert.equal(ladderWorks(play(open, at('C5')).state, at('C5')), false);
});

test('지도: 급소를 놓친 수는 큰 실수로, 이유와 원칙과 차시를 붙인다', async () => {
  const s = gameFromRows(EYE_ROWS, { turn: BLACK });
  const { note } = await coachEvaluate(s, at('G7'), { playouts: 4000, subPlayouts: 3000, timeMs: 20000, subTimeMs: 20000, seed: 5 });
  assert.equal(note.grade, 'mistake');
  assert.ok(note.loss >= 10, '손해 ' + note.loss);
  assert.equal(note.better.coord, 'C2');
  assert.ok(note.tags.includes('weak'));
  assert.equal(note.lesson.id, 'L12');
  assert.ok(note.tip.length > 10);
  assert.match(note.headline, /큰 실수/);
});

test('지도: 엔진과 같은 수는 최선의 수로 칭찬한다', async () => {
  const s = gameFromRows(EYE_ROWS, { turn: BLACK });
  const { note } = await coachEvaluate(s, at('C2'), { playouts: 4000, timeMs: 20000, seed: 6 });
  assert.equal(note.grade, 'best');
  assert.equal(note.loss, 0);
  assert.ok(note.good.length >= 1);
});

test('지도: 따낼 돌을 두고 1선에 두면 "따낼 기회"를 먼저 말한다', async () => {
  const s = gameFromRows([
    '.........',
    '..XXX....',
    '.XOOOX...',
    '..XXOX...',
    '...X.....',
    '.........',
    '.........',
    '.........',
    '.........',
  ], { turn: BLACK });
  const { note } = await coachEvaluate(s, at('A1'), { playouts: 3000, timeMs: 20000, subTimeMs: 20000, seed: 7 });
  assert.ok(['inacc', 'mistake'].includes(note.grade));
  assert.equal(note.better.coord, 'E5');
  assert.equal(note.tags[0] === 'capture' || note.tags.includes('capture'), true);
  assert.equal(note.lesson.id, 'L04');
});

test('원칙 목록: 우선순위의 모든 항목에 원칙, 차시, 이름이 있다', () => {
  for (const t of COACH_PRIORITY) {
    assert.ok(COACH_TOPICS[t], t);
    assert.match(COACH_TOPICS[t].lesson, /^L\d\d$/);
    assert.ok(COACH_TOPICS[t].tip && COACH_TOPICS[t].name);
  }
});

test('복기 요약: 큰 실수 순서, 습관, 다음 판 목표', () => {
  const mk = (grade, loss, tags, good = []) => ({ moveNumber: 1, color: BLACK, move: 0, note: { grade, loss, tags, good } });
  const sum = summarizeReview([
    mk('best', 0, [], ['좋아요']),
    mk('mistake', 12, ['capture']),
    mk('inacc', 5, ['capture', 'opening']),
    mk('inacc', 6, ['weak']),
    mk('good', 1, []),
  ]);
  assert.equal(sum.moves, 5);
  assert.equal(sum.goodRate, 40);
  assert.equal(sum.totalLoss, 24);
  assert.deepEqual(sum.worst.map((w) => w.note.loss), [12, 6, 5]);
  assert.equal(sum.habits[0].tag, 'capture');
  assert.equal(sum.habits[0].count, 2);
  assert.match(sum.goal, /^다음 판 목표: /);
  assert.equal(sum.praise.length, 1);
});

test('한 판 복기: 고른 색의 수만 읽고, 마지막 두 번 쉬기는 빼고 진행을 알린다', async () => {
  let s = createGame(9);
  const states = [s];
  for (const c of ['E5', 'C3', 'G7', 'C7', 'G3']) { s = play(s, at(c)).state; states.push(s); }
  s = pass(s); states.push(s);
  s = pass(s); states.push(s);
  const seen = [];
  const rev = await reviewGame(states, { colors: [BLACK], playouts: 300, timeMs: 5000, subTimeMs: 5000, seed: 1, onProgress: (d, t) => seen.push(d + '/' + t) });
  assert.deepEqual(rev.items.map((i) => i.moveNumber), [1, 3, 5]);
  assert.ok(rev.items.every((i) => i.color === BLACK));
  assert.deepEqual(seen, ['1/3', '2/3', '3/3']);
  assert.equal(rev.summary.moves, 3);
});

test('지도: 둘 곳이 많은데 쉬면 쉰 것을 말하고, 1·2선 탓으로 돌리지 않는다', async () => {
  let s = createGame(9);
  for (const c of ['E5', 'C3', 'G7']) s = play(s, at(c)).state;
  const { note } = await coachEvaluate(s, -1, { playouts: 2000, timeMs: 20000, subTimeMs: 20000, seed: 2 });
  assert.ok(['inacc', 'mistake', 'ok'].includes(note.grade), note.grade);
  assert.equal(note.tags.includes('opening'), false);
  assert.ok(note.why.some((t) => /쉬었어요/.test(t)));
});

test('큰 판(13줄, 19줄)에서도 읽고 지도한다', async () => {
  for (const size of [13, 19]) {
    let s = createGame(size);
    const mid = Math.floor(size / 2);
    s = play(s, mid * size + mid).state;
    const r = analyzePosition(s, { playouts: 400, seed: size });
    assert.equal(r.ownership.length, size * size);
    assert.ok(r.moves.length > 10);
    const { note } = await coachEvaluate(s, 0, { playouts: 600, timeMs: 20000, subTimeMs: 20000, seed: 1 });
    assert.ok(note.grade in { best: 1, good: 1, ok: 1, inacc: 1, mistake: 1 });
    assert.equal(moveFacts(s, 0).line, 1);
    assert.equal(typeof note.headline, 'string');
  }
});
