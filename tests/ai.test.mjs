import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove, chooseGameMove } from '../src/ai.mjs';
import { createGame, gameFromRows, play, pass, isLegal, isOver, groupAt, score, suggestDead, BLACK, WHITE } from '../src/rules.mjs';

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

test('대국용 돌돌이: 내 집과 좁은 상대 집에는 두지 않고, 둘 곳이 없으면 쉰다', () => {
  // 흑 집(왼쪽), 백 집(오른쪽), 가운데 공배 한 줄
  const g = gameFromRows(['.X.O.', '.X.O.', '.X.O.', '.X.O.', '.X.O.'], { turn: WHITE });
  for (let seed = 1; seed <= 20; seed++) {
    const m = chooseGameMove(g, { ...never, rng: seeded(seed) });
    assert.equal(m % 5, 2, '공배(가운데 줄)에만 둔다: ' + m);
  }
  const done = gameFromRows(['.XXO.', '.XXO.', '.XOO.', '.XXO.', '.XXO.'], { turn: WHITE });
  assert.equal(chooseGameMove(done, { ...never, rng: seeded(1) }), -1);
});

test('대국용 돌돌이끼리 두면 한 판이 끝난다', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seeded(seed);
    let g = createGame(9);
    let n = 0;
    while (!isOver(g) && n < 400) {
      const m = chooseGameMove(g, { rng });
      if (m < 0) g = pass(g);
      else {
        assert.equal(isLegal(g, m), true);
        g = play(g, m).state;
      }
      n++;
    }
    assert.equal(isOver(g), true, 'seed ' + seed + ' 가 ' + n + '수 안에 끝나지 않았다');
    assert.ok(n < 300, 'seed ' + seed + ': ' + n + '수');
    const s = score(g, suggestDead(g));
    assert.ok(s.winner === BLACK || s.winner === WHITE);
  }
});

test('죽은 돌 추천: 상대 집 안에 홀로 있는 돌만 고른다', () => {
  const rows = ['....XO...', '....XO...', '..O.XO...', '....XO...', '....XO.X.', '....XO...', '....XO...', '....XO...', '....XO...'];
  const g = gameFromRows(rows);
  assert.deepEqual(suggestDead(g).sort((a, b) => a - b), [2 * 9 + 2, 4 * 9 + 7]);
  // 집을 가진 돌은 고르지 않는다
  const clean = gameFromRows(['..XO.', '..XO.', '..XO.', '..XO.', '..XO.']);
  assert.deepEqual(suggestDead(clean), []);
  // 아직 집이 나뉘지 않은 판에서는 아무것도 고르지 않는다
  const open = gameFromRows(['.....', '.X...', '.....', '...O.', '.....']);
  assert.deepEqual(suggestDead(open), []);
});
