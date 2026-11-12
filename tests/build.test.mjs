import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from '../build.mjs';

test('빌드: 한 파일로 합쳐지고 외부 자원을 부르지 않는다 (오프라인 동작)', async () => {
  const { out } = await build();
  const html = await readFile(out, 'utf8');

  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(html.includes('/*__CSS__*/'), false, 'CSS 자리가 채워져야 한다');
  assert.equal(html.includes('/*__JS__*/'), false, 'JS 자리가 채워져야 한다');

  // 밖에서 불러오는 스크립트, 스타일, 글꼴, 이미지가 없어야 한다.
  assert.equal(/<script[^>]+src=/i.test(html), false);
  assert.equal(/<link[^>]+href=/i.test(html), false);
  assert.equal(/@import|url\(\s*['"]?https?:/i.test(html), false);
  assert.equal(/<img[^>]+src=['"]https?:/i.test(html), false);
  assert.equal(/\bfetch\(|XMLHttpRequest|WebSocket/.test(html), false);

  // 모듈 문법이 남아 있으면 file:// 로 열 때 동작하지 않는다.
  assert.equal(/^\s*(export|import)\s/m.test(html), false);
});

test('빌드: 합쳐진 스크립트가 문법 오류 없이 읽힌다', async () => {
  const { out } = await build();
  const html = await readFile(out, 'utf8');
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, '스크립트가 들어 있어야 한다');
  assert.doesNotThrow(() => new Function(m[1]));
});
