// 판 그림을 다루는 작은 도구. 같은 모양을 뒤집거나 색을 바꿔 다른 문제로 쓴다.
// 뒤집은 판도 테스트가 규칙 엔진으로 다시 검산하므로, 손으로 새로 그리는 것보다 틀릴 일이 적다.

// 위쪽 몇 줄만 적고 나머지는 빈 줄로 채운다. 예: fill(7, ['..X....', '.XO....'])
export function fill(size, top) {
  const rows = top.slice();
  while (rows.length < size) rows.push('.'.repeat(size));
  return rows;
}

// 좌우로 뒤집기
export function flipH(rows) {
  return rows.map((r) => [...r].reverse().join(''));
}

// 위아래로 뒤집기
export function flipV(rows) {
  return rows.slice().reverse();
}

// 흑과 백을 맞바꾸기
export function swapColors(rows) {
  const map = { X: 'O', O: 'X', x: 'o', o: 'x' };
  return rows.map((r) => [...r].map((ch) => map[ch] || ch).join(''));
}
