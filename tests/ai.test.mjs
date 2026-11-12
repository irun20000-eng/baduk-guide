import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove } from '../src/ai.mjs';
import { createGame, gameFromRows, play, pass, isLegal, groupAt, BLACK, WHITE } from '../src/rules.mjs';

// 테스트용 난수 (항상 같은 순서)
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const never = { missCapture: 0, missEscape: 0 };
const at = (size, x, y) => y * size + x;

test('돌돌이: 따낼 수 있으면 따낸다', () => {
  const g = gameFromRows(['.....', '..O..', '.OX..', '..O..', '.....'], { turn: WHITE });
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(chooseMove(g, { ...never, rng: seeded(seed) }), at(5, 3, 2));
  }
});

test('돌돌이: 여러 곳을 따낼 수 있으면 더 많이 따내는 쪽을 고른다', () => {
  const g = gameFromRows([
    '.......',
    '.O.....',
    'OX.OO..',
    '.O.XXO.',
    '...OO..',
    '.......',
    '.......',
  ], { turn: WHITE });
  // 흑 한 점은 C5(2,2)에서, 흑 두 점은 C4(2,3)에서 따낼 수 있다
  assert.equal(chooseMove(g, { ...never, rng: seeded(7) }), at(7, 2, 3));
});

test('돌돌이: 단수가 된 내 돌을 살린다', () => {
  const g = gameFromRows(['.....', '..X..', '.XO..', '..X..', '.....'], { turn: WHITE });
  for (let seed = 1; seed <= 20; seed++) {
    const m = chooseMove(g, { ...never, rng: seeded(seed) });
    const r = play(g, m);
    assert.ok(groupAt(r.state.board, 5, at(5, 2, 2)).liberties.length >= 2, 'seed ' + seed);
  }
});

test('돌돌이: 가끔은 못 보고 지나친다 (입문자가 이길 수 있게)', () => {
  const g = gameFromRows(['.....', '..O..', '.OX..', '..O..', '.....'], { turn: WHITE });
  let missed = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (chooseMove(g, { missCapture: 0.5, rng: seeded(seed) }) !== at(5, 3, 2)) missed++;
  }
  assert.ok(missed > 20 && missed < 180, '놓친 횟수 ' + missed);
});

test('돌돌이: 스스로 단수가 되는 자리는 다른 곳이 있으면 피한다', () => {
  const g = gameFromRows(['.....', '..X..', '.X.X.', '.....', '.....'], { turn: WHITE });
  for (let seed = 1; seed <= 50; seed++) {
    assert.notEqual(chooseMove(g, { ...never, rng: seeded(seed) }), at(5, 2, 2));
  }
});

test('돌돌이: 빈 판에서는 가운데 쪽에 둔다 (가장자리 첫 줄은 피한다)', () => {
  const g = createGame(9);
  for (let seed = 1; seed <= 50; seed++) {
    const m = chooseMove(g, { rng: seeded(seed) });
    const x = m % 9;
    const y = (m - x) / 9;
    assert.ok(x > 0 && x < 8 && y > 0 && y < 8, 'seed ' + seed + ' -> ' + x + ',' + y);
  }
});

test('돌돌이: 언제나 둘 수 있는 자리만 고르고, 둘 곳이 없으면 -1', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const rng = seeded(seed);
    let g = createGame(7);
    for (let n = 0; n < 150; n++) {
      const m = chooseMove(g, { rng });
      if (m < 0) {
        g = pass(g);
        if (g.passes >= 2) break;
        continue;
      }
      assert.equal(isLegal(g, m), true, 'seed ' + seed + ' move ' + n);
      g = play(g, m).state;
    }
  }
  const full = gameFromRows(['.X', 'X.'], { turn: WHITE });
  assert.equal(chooseMove(full, { rng: seeded(1) }), -1);
});

test('돌돌이: 흑으로도 둘 수 있다', () => {
  const g = gameFromRows(['.....', '..X..', '.XO..', '..X..', '.....'], { turn: BLACK });
  assert.equal(chooseMove(g, { ...never, rng: seeded(3) }), at(5, 3, 2));
});
