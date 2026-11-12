import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from '../build.mjs';

// 홈 화면 설치용 link(manifest, 아이콘)만 허용한다. 앱이 돌아가는 데 필요한 바깥 파일은 여전히 없어야 한다.
const INSTALL_LINK = /<link rel="(?:manifest|icon|apple-touch-icon)" href="(?:manifest\.webmanifest|icons\/[\w.-]+)"[^>]*>\n?/g;
const withoutInstallLinks = (h) => h.replace(INSTALL_LINK, '');

test('빌드: 한 파일로 합쳐지고 외부 자원을 부르지 않는다 (오프라인 동작)', async () => {
  const { out } = await build();
  const html = await readFile(out, 'utf8');

  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(html.includes('/*__CSS__*/'), false, 'CSS 자리가 채워져야 한다');
  assert.equal(html.includes('/*__JS__*/'), false, 'JS 자리가 채워져야 한다');

  // 밖에서 불러오는 스크립트, 스타일, 글꼴, 이미지가 없어야 한다.
  assert.equal(/<script[^>]+src=/i.test(html), false);
  assert.equal(/<link[^>]+href=/i.test(withoutInstallLinks(html)), false);
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

test('설치: manifest와 아이콘 파일이 있고 head에서 가리킨다', async () => {
  const { readFile: rf, stat } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await rf(new URL('index.html', root), 'utf8');
  const mf = JSON.parse(await rf(new URL('manifest.webmanifest', root), 'utf8'));
  assert.ok(mf.name && mf.short_name && mf.start_url && mf.display === 'standalone');
  const purposes = mf.icons.map((i) => (i.purpose || 'any') + ':' + i.sizes);
  for (const p of ['any:192x192', 'any:512x512', 'maskable:512x512']) assert.ok(purposes.includes(p), p);
  const hrefs = [...html.matchAll(/<link rel="(?:manifest|icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.includes('manifest.webmanifest') && hrefs.includes('icons/apple-touch-icon.png'));
  for (const f of [...hrefs, ...mf.icons.map((i) => i.src)]) assert.ok((await stat(new URL(f, root))).size > 0, f);
});
