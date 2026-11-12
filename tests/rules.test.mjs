import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY, BLACK, WHITE,
  createGame, gameFromRows, toRows, groupAt, play, pass, isOver,
  legalMoves, groupsInAtari, score, toCoord, fromCoord,
} from '../src/rules.mjs';

const at = (size, x, y) => y * size + x;

test('활로: 가운데 4, 변 3, 귀 2', () => {
  const g = gameFromRows([
    'X...X',
    '.....',
    '..X..',
    '.....',
    '.....',
  ]);
  assert.equal(groupAt(g.board, 5, at(5, 2, 2)).liberties.length, 4);
  assert.equal(groupAt(g.board, 5, at(5, 0, 0)).liberties.length, 2);
  const edge = gameFromRows(['..X..', '.....', '.....', '.....', '.....']);
  assert.equal(groupAt(edge.board, 5, at(5, 2, 0)).liberties.length, 3);
});

test('활로: 이어진 돌은 활로를 함께 쓴다 (두 점 6, 세 점 8)', () => {
  const g = gameFromRows([
    '.....',
    '.XX..',
    '.....',
    '.....',
    '.....',
  ]);
  const two = groupAt(g.board, 5, at(5, 1, 1));
  assert.equal(two.stones.length, 2);
  assert.equal(two.liberties.length, 6);
  const g3 = gameFromRows(['.......', '.......', '..XXX..', '.......', '.......', '.......', '.......']);
  assert.equal(groupAt(g3.board, 7, at(7, 3, 2)).liberties.length, 8);
});

test('활로: 대각선은 이어진 것이 아니다', () => {
  const g = gameFromRows(['X....', '.X...', '.....', '.....', '.....']);
  assert.equal(groupAt(g.board, 5, 0).stones.length, 1);
});

test('따내기: 활로를 모두 막으면 판에서 들어낸다', () => {
  const g = gameFromRows([
    '.....',
    '..X..',
    '.XO..',
    '..X..',
    '.....',
  ]);
  const r = play(g, at(5, 3, 2));
  assert.equal(r.ok, true);
  assert.deepEqual(r.captured, [at(5, 2, 2)]);
  assert.equal(r.state.board[at(5, 2, 2)], EMPTY);
  assert.equal(r.state.captures[BLACK], 1);
  assert.equal(r.state.turn, WHITE);
});

test('따내기: 귀의 돌은 두 수면 잡힌다', () => {
  const g = gameFromRows(['OX...', '.....', '.....', '.....', '.....']);
  const r = play(g, at(5, 0, 1));
  assert.equal(r.ok, true);
  assert.equal(r.state.board[0], EMPTY);
});

test('따내기: 여러 점을 한꺼번에, 여러 덩어리도 한꺼번에', () => {
  const g = gameFromRows([
    '.XO..',
    'XO...',
    'O....',
    '.....',
    '.....',
  ], { turn: WHITE });
  const r = play(g, 0); // 백이 귀에 두어 흑 두 덩어리를 동시에 따낸다
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 2);
  assert.equal(r.state.captures[WHITE], 2);
  assert.equal(r.state.ko, -1);
});

test('착수금지: 놓자마자 활로가 없는 곳에는 둘 수 없다', () => {
  const g = gameFromRows(['.X...', 'X....', '.....', '.....', '.....'], { turn: WHITE });
  const r = play(g, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'suicide');
  // 같은 자리라도 흑은 둘 수 있다 (자기 돌과 이어져 활로가 생긴다)
  assert.equal(play({ ...g, turn: BLACK }, 0).ok, true);
});

test('착수금지: 여러 점이 함께 활로가 없어지는 수도 둘 수 없다', () => {
  const g = gameFromRows([
    'O.X..',
    'XX...',
    '.....',
    '.....',
    '.....',
  ], { turn: WHITE });
  const r = play(g, at(5, 1, 0));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'suicide');
});

test('착수금지 예외: 상대 돌을 따낼 수 있으면 둘 수 있다', () => {
  const g = gameFromRows([
    '.XO..',
    'XO...',
    'O....',
    '.....',
    '.....',
  ], { turn: WHITE });
  assert.equal(play(g, 0).ok, true);
});

test('이미 돌이 있는 곳, 판 밖에는 둘 수 없다', () => {
  const g = gameFromRows(['X....', '.....', '.....', '.....', '.....']);
  assert.equal(play(g, 0).reason, 'occupied');
  assert.equal(play(g, -1).reason, 'out');
  assert.equal(play(g, 25).reason, 'out');
});

test('패: 바로 되따낼 수 없고, 다른 곳에 한 번 둔 뒤에는 따낼 수 있다', () => {
  const g = gameFromRows([
    '.XO..',
    'XO.O.',
    '.XO..',
    '.....',
    '.....',
  ]);
  const koPoint = at(5, 1, 1);
  const r1 = play(g, at(5, 2, 1)); // 흑이 백 한 점을 따낸다
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.captured, [koPoint]);
  assert.equal(r1.state.ko, koPoint);

  const retake = play(r1.state, koPoint); // 백이 바로 되따내려 한다
  assert.equal(retake.ok, false);
  assert.equal(retake.reason, 'ko');

  const r2 = play(r1.state, at(5, 4, 4)); // 백이 다른 곳에 둔다 (팻감)
  const r3 = play(r2.state, at(5, 0, 4)); // 흑이 받는다
  const r4 = play(r3.state, koPoint); // 이제 백이 패를 따낼 수 있다
  assert.equal(r4.ok, true);
  assert.deepEqual(r4.captured, [at(5, 2, 1)]);
  assert.equal(r4.state.ko, at(5, 2, 1));
});

test('패가 아닌 경우: 한 점을 따내도 활로가 여럿이면 패가 아니다', () => {
  const g = gameFromRows([
    '.....',
    '..X..',
    '.XO..',
    '..X..',
    '.....',
  ]);
  const r = play(g, at(5, 3, 2));
  assert.equal(r.state.ko, -1);
});

test('한 수 쉬기: 두 사람이 연달아 쉬면 대국이 끝난다', () => {
  let g = createGame(9);
  g = pass(g);
  assert.equal(g.turn, WHITE);
  assert.equal(isOver(g), false);
  g = pass(g);
  assert.equal(isOver(g), true);
  assert.equal(play(g, 0).reason, 'ended');
});

test('한 수 쉬면 패 금지가 풀린다', () => {
  const g = gameFromRows(['.XO..', 'XO.O.', '.XO..', '.....', '.....']);
  const r1 = play(g, at(5, 2, 1));
  const afterPass = pass(pass(r1.state));
  assert.equal(afterPass.ko, -1);
});

test('상태는 바뀌지 않는다 (새 상태를 돌려준다)', () => {
  const g = createGame(9);
  const before = JSON.stringify(g);
  play(g, 40);
  pass(g);
  assert.equal(JSON.stringify(g), before);
});

test('둘 수 있는 곳 목록: 빈 판은 모든 점, 착수금지 자리는 빠진다', () => {
  assert.equal(legalMoves(createGame(9)).length, 81);
  const g = gameFromRows(['.X...', 'X....', '.....', '.....', '.....'], { turn: WHITE });
  assert.equal(legalMoves(g).includes(0), false);
});

test('단수: 활로가 하나 남은 덩어리를 찾는다', () => {
  const g = gameFromRows([
    '.....',
    '..X..',
    '.XO..',
    '..X..',
    '.....',
  ]);
  const atari = groupsInAtari(g);
  assert.equal(atari.length, 1);
  assert.equal(atari[0].color, WHITE);
  assert.deepEqual(atari[0].liberties, [at(5, 3, 2)]);
});

test('집 계산: 집 + 따낸 돌, 백에게 덤', () => {
  const g = gameFromRows([
    '.XO..',
    '.XO..',
    '.XO..',
    '.XO..',
    '.XO..',
  ]);
  const s = score(g);
  assert.equal(s.territory[BLACK], 5);
  assert.equal(s.territory[WHITE], 10);
  assert.equal(s.black, 5);
  assert.equal(s.white, 16.5);
  assert.equal(s.winner, WHITE);
  assert.equal(s.margin, 11.5);
});

test('집 계산: 양쪽 돌에 모두 닿은 빈 곳은 공배', () => {
  const g = gameFromRows([
    '.X.O.',
    '.X.O.',
    '.X.O.',
    '.X.O.',
    '.X.O.',
  ], { komi: 0 });
  const s = score(g);
  assert.equal(s.territory[BLACK], 5);
  assert.equal(s.territory[WHITE], 5);
  assert.equal(s.neutral.length, 5);
  assert.equal(s.winner, EMPTY);
});

test('집 계산: 죽은 돌은 들어내 상대의 따낸 돌에 더한다', () => {
  const g = gameFromRows([
    '.XO..',
    '.XO..',
    '.XO..',
    '.XO..',
    '.XO.X',
  ]);
  const s = score(g, [at(5, 4, 4)]);
  assert.equal(s.territory[WHITE], 10);
  assert.equal(s.captures[WHITE], 1);
  assert.equal(s.white, 17.5);
});

test('좌표: 9줄판 한가운데는 E5, I는 쓰지 않는다', () => {
  assert.equal(toCoord(9, 40), 'E5');
  assert.equal(fromCoord(9, 'E5'), 40);
  assert.equal(toCoord(9, 0), 'A9');
  assert.equal(toCoord(9, 80), 'J1');
  assert.equal(fromCoord(9, 'J1'), 80);
  assert.equal(fromCoord(9, 'I1'), -1);
  assert.equal(fromCoord(9, 'K1'), -1);
});

test('판 표기: 줄 문자열로 만들고 되돌릴 수 있다', () => {
  const rows = ['.XO..', 'XO.O.', '.XO..', '.....', '.....'];
  assert.deepEqual(toRows(gameFromRows(rows)), rows);
});
