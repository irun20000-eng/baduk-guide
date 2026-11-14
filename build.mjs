// src/ 의 조각들을 인터넷 없이 열리는 한 파일(index.html)로 합친다.
// 사용: node build.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(path.join(root, p), 'utf8');

// 합치는 순서. 뒤 파일이 앞 파일의 함수를 쓴다.
export const SCRIPTS = [
  'src/rules.mjs',
  'src/ai.mjs',
  'src/coach.mjs',
  'src/coach-explain.mjs',
  'src/lesson-engine.mjs',
  'src/lessons/tools.mjs',
  'src/lessons/unit2.mjs',
  'src/lessons/unit3.mjs',
  'src/lessons/unit4.mjs',
  'src/lessons/unit5.mjs',
  'src/lessons.mjs',
  'src/store.mjs',
  'src/settings.mjs',
  'src/glossary.mjs',
  'src/ui/sound.js',
  'src/ui/board.js',
  'src/ui/app.js',
];

// 모듈 문법(import/export)을 걷어 낸다. 테스트에서는 모듈로, 앱에서는 한 스크립트 안의 함수로 쓴다.
export function inlineModule(source) {
  return source
    .replace(/\r\n/g, '\n')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*\n/gm, '')
    .replace(/^export\s+/gm, '');
}

// 맨 바깥에서 선언한 이름. 파일끼리 이름이 겹치면 합쳤을 때 오류가 나므로 미리 찾는다.
export function topLevelNames(source) {
  const names = [];
  const re = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(source))) names.push(m[1]);
  return names;
}

export async function build() {
  const [template, css, ...sources] = await Promise.all([
    read('src/index.template.html'),
    read('src/style.css'),
    ...SCRIPTS.map(read),
  ]);

  const owner = new Map();
  sources.forEach((src, i) => {
    for (const name of topLevelNames(src)) {
      if (owner.has(name)) throw new Error('이름이 겹칩니다: ' + name + ' (' + owner.get(name) + ', ' + SCRIPTS[i] + ')');
      owner.set(name, SCRIPTS[i]);
    }
  });

  const body = sources.map((src, i) => '// ---- ' + SCRIPTS[i] + ' ----\n' + inlineModule(src)).join('\n');
  const js = "(function () {\n'use strict';\n" + body + '\n})();';
  if (/<\/script/i.test(js)) throw new Error('스크립트 안에 </script> 문자열이 있으면 안 됩니다.');

  const html = template
    .replace('/*__CSS__*/', () => css.trim())
    .replace('/*__JS__*/', () => js);

  const out = path.join(root, 'index.html');
  await writeFile(out, html, 'utf8');
  const sw = await buildServiceWorker(html);
  return { out, bytes: Buffer.byteLength(html), sw };
}

// 인터넷 없이 열기: 주소(https)로 열었을 때만 쓰는 서비스 워커. index.html 안에는 넣지 않는다.
// 캐시 이름에 판 번호와 index.html 지문을 넣어, 고쳐서 다시 올리면 새 캐시로 바뀌고 옛 캐시는 지운다.
export async function precacheList() {
  const icons = (await readdir(path.join(root, 'icons'))).filter((f) => /\.(png|svg)$/.test(f)).sort();
  return ['./', 'index.html', 'manifest.webmanifest', ...icons.map((f) => 'icons/' + f)];
}

export async function buildServiceWorker(html) {
  const pkg = JSON.parse(await read('package.json'));
  const hash = createHash('sha256').update(html).digest('hex').slice(0, 10);
  const cache = 'baduk-guide-' + pkg.version + '-' + hash;
  const files = await precacheList();
  const src = (await read('src/sw.template.js'))
    .replace('__CACHE__', cache)
    .replace('__FILES__', JSON.stringify(files));
  const out = path.join(root, 'sw.js');
  await writeFile(out, src, 'utf8');
  return { out, cache, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, bytes } = await build();
  console.log('만들었습니다: ' + out + ' (' + (bytes / 1024).toFixed(1) + ' KB)');
}
