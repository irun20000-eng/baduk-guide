import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY } from '../src/glossary.mjs';
import { parseBoard } from '../src/lesson-engine.mjs';
import { groupAt, EMPTY } from '../src/rules.mjs';

test('용어 사전: 낱말이 겹치지 않고, 설명은 두 문장까지, 판 그림은 있을 수 있는 모양', () => {
  const seen = new Set();
  for (const g of GLOSSARY) {
    assert.ok(g.term && g.text, '낱말과 설명');
    assert.equal(seen.has(g.term), false, g.term + ' 겹침');
    seen.add(g.term);
    assert.ok((g.text.match(/[.!?]+(\s|$)/g) || []).length <= 2, g.term + ' 설명이 길다');
    if (!g.rows) continue;
    const p = parseBoard({ rows: g.rows });
    for (let i = 0; i < p.state.board.length; i++) {
      if (p.state.board[i] !== EMPTY) assert.ok(groupAt(p.state.board, p.size, i).liberties.length > 0, g.term + ': 활로 없는 돌');
    }
  }
  assert.ok(GLOSSARY.length >= 20);
});
