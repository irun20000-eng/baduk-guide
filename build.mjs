// src/ 의 조각들을 인터넷 없이 열리는 한 파일(index.html)로 합친다.
// 사용: node build.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(path.join(root, p), 'utf8');

export async function build() {
  const [template, css, rules, app] = await Promise.all([
    read('src/index.template.html'),
    read('src/style.css'),
    read('src/rules.mjs'),
    read('src/app.js'),
  ]);

  // 규칙 엔진은 테스트에서는 모듈로, 앱에서는 같은 스크립트 안의 함수로 쓴다.
  const rulesInline = rules.replace(/^export\s+/gm, '');
  const js = "(function () {\n'use strict';\n" + rulesInline + '\n' + app + '\n})();';

  if (/<\/script/i.test(js)) throw new Error('스크립트 안에 </script> 문자열이 있으면 안 됩니다.');

  const html = template
    .replace('/*__CSS__*/', () => css.trim())
    .replace('/*__JS__*/', () => js);

  const out = path.join(root, 'index.html');
  await writeFile(out, html, 'utf8');
  return { out, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, bytes } = await build();
  console.log('만들었습니다: ' + out + ' (' + (bytes / 1024).toFixed(1) + ' KB)');
}
