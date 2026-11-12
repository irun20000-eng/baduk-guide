import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, UNITS, MISSIONS, QUIZZES, COUNT_BOARD, lessonById, quizById, lessonsOfUnit, missionOfUnit } from '../src/lessons.mjs';
import { parseBoard, validateStep, movesFor, pointTargets, regionOf, starsFor, sameGroup } from '../src/lesson-engine.mjs';
import { toCoord, score, BLACK, WHITE } from '../src/rules.mjs';

test('차시 자료: 번호와 단원이 순서대로이고 빠진 항목이 없다', () => {
  const ids = new Set();
  LESSONS.forEach((l, i) => {
    assert.equal(l.id, 'L' + String(i + 1).padStart(2, '0'));
    assert.equal(l.no, i + 1);
    assert.ok(UNITS.some((u) => u.id === l.unit), l.id + ' 단원');
    assert.ok(l.title && l.goal && l.summary, l.id + ' 제목, 목표, 정리');
    assert.ok(l.steps.length >= 5 && l.steps.length <= 9, l.id + ' 걸음 수 5~9');
    assert.equal(ids.has(l.id), false);
    ids.add(l.id);
    assert.equal(lessonById(l.id), l);
  });
  assert.equal(LESSONS.length, 24);
  assert.deepEqual(UNITS.map((u) => lessonsOfUnit(u.id).length), [7, 4, 4, 6, 3]);
  // 차시는 단원 순서대로 이어진다
  for (let i = 1; i < LESSONS.length; i++) assert.ok(LESSONS[i].unit >= LESSONS[i - 1].unit);
  assert.equal(lessonById('없음'), null);
  // 단원마다 미션이 하나씩 있다
  for (const u of UNITS) assert.ok(missionOfUnit(u.id), u.id + '단원 미션');
  assert.equal(MISSIONS.length, UNITS.length);
  for (const q of QUIZZES) {
    assert.equal(quizById(q.id), q);
    assert.ok(MISSIONS.some((m) => m.id === q.id && m.route === '#/quiz/' + q.id));
    assert.equal(q.steps.length, 10);
    assert.ok(q.steps.every((s) => s.type !== 'explain'), q.id + ' 는 문제만 있다');
  }
});

test('차시 자료: 설명만 읽고 끝나는 차시가 없다 (직접 해 보는 걸음이 절반 이상)', () => {
  for (const l of LESSONS) {
    const active = l.steps.filter((s) => s.type !== 'explain').length;
    assert.ok(active * 2 >= l.steps.length, l.id + ': 활동 ' + active + ' / ' + l.steps.length);
    assert.notEqual(l.steps[l.steps.length - 1].type, 'explain', l.id + ' 마지막 걸음은 활동');
  }
});

// 모든 걸음의 정답을 규칙 엔진으로 검산한다. 걸음마다 테스트 하나.
for (const lesson of [...LESSONS, ...QUIZZES]) {
  lesson.steps.forEach((step, i) => {
    test('검산 ' + lesson.id + ' ' + lesson.title + ' ' + (i + 1) + '번째 걸음 (' + step.type + ')', () => {
      assert.deepEqual(validateStep(step), []);
    });
  });
}

test('검산기가 틀린 자료를 잡아낸다', () => {
  // 정답 자리가 실제로는 따내지 못하는 자리
  const wrongMove = { type: 'move', check: 'capture', text: '따내 보세요.', board: { rows: ['.....', '..X..', '.XO..', '..X*.', '.....'] } };
  assert.ok(validateStep(wrongMove).some((p) => p.includes('조건')));
  // 정답이 하나 빠짐 (단수 치는 자리는 두 곳)
  const missing = { type: 'move', check: 'atari', text: '단수로 만들어 보세요.', board: { rows: ['.....', '..X..', '.Xo*.', '.....', '.....'] } };
  assert.ok(validateStep(missing).some((p) => p.includes('조건')));
  // 활로 수가 틀림
  const wrongCount = { type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 3, text: '몇 개일까요?', board: { rows: ['x....', '.....', '.....', '.....', '.....'] } };
  assert.ok(validateStep(wrongCount).some((p) => p.includes('실제 값')));
  // 이어짐 여부가 틀림
  const wrongChoice = { type: 'choice', check: 'connected', yes: 0, choices: ['예', '아니요'], answer: 0, text: '이어졌을까요?', board: { rows: ['x....', '.x...', '.....', '.....', '.....'] } };
  assert.ok(validateStep(wrongChoice).length > 0);
  // 있을 수 없는 판 (활로 없는 돌)
  const dead = { type: 'explain', text: '설명.', board: { rows: ['OX...', 'X....', '.....', '.....', '.....'] } };
  assert.ok(validateStep(dead).some((p) => p.includes('활로가 없는')));
  // 글이 너무 김
  const long = { type: 'explain', text: '하나예요. 둘이에요. 셋이에요. 넷이에요.' };
  assert.ok(validateStep(long).some((p) => p.includes('세 문장')));
  // 모르는 글자, 줄 길이
  assert.ok(validateStep({ type: 'explain', text: '설명.', board: { rows: ['..?..', '.....', '.....', '.....', '.....'] } }).length > 0);
  assert.ok(validateStep({ type: 'explain', text: '설명.', board: { rows: ['....', '.....', '.....', '.....', '.....'] } }).length > 0);
});

test('판 그림 읽기: 표시한 돌, 정답 자리, 활로 표시, 이름표', () => {
  const p = parseBoard({ rows: ['x.O..', '.*+!.', '.....', '.....', '....o'], turn: 'W', labels: [{ at: 'C3', text: '중앙' }] });
  assert.equal(p.size, 5);
  assert.equal(p.state.board[0], BLACK);
  assert.equal(p.state.board[2], WHITE);
  assert.equal(p.state.board[24], WHITE);
  assert.deepEqual(p.targets, [0, 24]);
  assert.deepEqual(p.answers, [6]);
  assert.deepEqual(p.dots, [7]);
  assert.deepEqual(p.crosses, [8]);
  assert.equal(p.state.turn, WHITE);
  assert.deepEqual(p.labels, [{ at: 12, text: '중앙' }]);
  assert.throws(() => parseBoard({ rows: ['...', '...', '...'], labels: [{ at: 'Z9', text: 'x' }] }));
});

test('한 수 문제 조건: 달아나기는 뻗기와 따내기를 모두 인정한다', () => {
  const p = parseBoard({ rows: ['.....', '..OX.', '.OxOX', '.....', '.....'] });
  const moves = movesFor('escape', p.state, p.targets).map((i) => toCoord(5, i)).sort();
  assert.deepEqual(moves, ['C2', 'D2']);
});

test('한 수 문제 조건: 이미 이어진 돌은 끊거나 이을 수 없다', () => {
  const p = parseBoard({ rows: ['.....', '.oo..', '.....', '.....', '.....'] });
  assert.deepEqual(movesFor('cut', p.state, p.targets), []);
  const q = parseBoard({ rows: ['.....', '.xx..', '.....', '.....', '.....'] });
  assert.deepEqual(movesFor('connect', q.state, q.targets), []);
  assert.equal(sameGroup(q.state.board, 5, q.targets), true);
});

test('귀, 변, 중앙: 9줄 판의 구역', () => {
  const at = (x, y) => y * 9 + x;
  assert.equal(regionOf(9, at(0, 0)), 'corner');
  assert.equal(regionOf(9, at(2, 2)), 'corner');
  assert.equal(regionOf(9, at(6, 6)), 'corner');
  assert.equal(regionOf(9, at(4, 1)), 'side');
  assert.equal(regionOf(9, at(1, 4)), 'side');
  assert.equal(regionOf(9, at(4, 4)), 'center');
  assert.equal(regionOf(9, at(3, 5)), 'center');
  let corner = 0, side = 0, center = 0;
  for (let i = 0; i < 81; i++) {
    const r = regionOf(9, i);
    if (r === 'corner') corner++; else if (r === 'side') side++; else center++;
  }
  assert.deepEqual([corner, side, center], [36, 36, 9]);
});

test('짚기 문제: 단수 된 덩어리는 어느 돌을 눌러도 찾은 것으로 본다', () => {
  const step = { type: 'point', rule: 'atari', need: 'all' };
  const p = parseBoard({ rows: ['XO.....', '.......', '.......', '..XX...', '.XOO...', '..XX...', '.......'] });
  const groups = pointTargets(step, p);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.length).sort(), [1, 2]);
  const star = pointTargets({ rule: 'star' }, parseBoard({ rows: Array(9).fill('.........') }));
  assert.equal(star[0].length, 5);
});

test('별: 실수와 힌트가 없으면 3개, 두 번까지 2개, 그 이상 1개', () => {
  assert.equal(starsFor(0, 0), 3);
  assert.equal(starsFor(1, 0), 2);
  assert.equal(starsFor(1, 1), 2);
  assert.equal(starsFor(2, 1), 1);
  assert.equal(starsFor(0, 5), 1);
});

test('집 세기 미션: 죽은 돌을 들어내면 흑 37집, 백 34집 반', () => {
  const p = parseBoard({ rows: COUNT_BOARD.rows, komi: COUNT_BOARD.komi });
  assert.equal(p.targets.length, 2, '죽은 돌은 두 점');
  const before = score(p.state);
  assert.ok(before.territory[BLACK] < 36 && before.territory[WHITE] < 27, '죽은 돌을 들어내기 전에는 집이 덜 세어진다');
  const after = score(p.state, p.targets);
  assert.equal(after.territory[BLACK], 36);
  assert.equal(after.territory[WHITE], 27);
  assert.equal(after.black, 37);
  assert.equal(after.white, 34.5);
  assert.equal(after.winner, BLACK);
});
