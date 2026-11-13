// 바둑판 그리기 (SVG). 규칙은 모르고, 받은 상태와 표시만 그린다.
// 빌드할 때 rules.mjs 등과 한 스크립트로 합쳐지므로 EMPTY, BLACK, toCoord 같은 이름을 그대로 쓴다.

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL = 40;

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

// 판 크기에 따라 화면에서 차지할 최대 너비. 작은 판이 너무 커지지 않게 한다.
function boardMaxWidth(size) {
  if (size <= 5) return 360;
  if (size <= 7) return 440;
  return 560;
}

// model: {
//   state,            규칙 엔진의 대국 상태 (필수)
//   coords,           좌표 글자를 보일지
//   showLast,         마지막 수 표시
//   atari,            단수 된 돌에 점선 테두리
//   libs: [idx],      활로 표시(초록 점)
//   marks: [{ at, shape }],  shape: tri | dot | cross | ring | found | miss
//   labels: [{ at, text }],  이름표
//   owner: [색],      집 표시 (계가 때)
//   ghost,            마우스로 가리킨 자리에 반투명 돌
// }
function createBoardView(svg, onTap) {
  let model = null;
  let margin = 30;
  let cursor = -1; // 키보드로 고르는 자리
  let kbd = false; // 키보드를 쓰는 중이면 커서를 보인다
  let prevBoard = null;
  let prevSize = 0;
  let live = null;
  const px = (n) => margin + n * CELL;

  function pointFromEvent(e) {
    const ctm = svg.getScreenCTM();
    if (!ctm || !model) return -1;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const size = model.state.size;
    const x = Math.round((p.x - margin) / CELL);
    const y = Math.round((p.y - margin) / CELL);
    if (x < 0 || y < 0 || x >= size || y >= size) return -1;
    return y * size + x;
  }

  function stone(x, y, color, cls) {
    const g = svgEl('g', cls ? { class: cls } : {});
    g.appendChild(svgEl('circle', { class: 'stone-shadow', cx: px(x) + 1.2, cy: px(y) + 2, r: CELL * 0.47 }));
    g.appendChild(svgEl('circle', {
      cx: px(x), cy: px(y), r: CELL * 0.47,
      fill: color === BLACK ? 'url(#gB)' : 'url(#gW)',
      stroke: color === BLACK ? '#000' : '#5e5545',
      'stroke-width': color === BLACK ? 0.8 : 1.2,
    }));
    return g;
  }

  function drawMark(mark, state) {
    const size = state.size;
    const x = mark.at % size;
    const y = (mark.at - x) / size;
    const cx = px(x);
    const cy = px(y);
    const on = state.board[mark.at];
    if (mark.shape === 'tri') {
      const r = CELL * 0.26;
      const pts = [[cx, cy - r], [cx - r * 0.92, cy + r * 0.62], [cx + r * 0.92, cy + r * 0.62]].map((p) => p.join(',')).join(' ');
      svg.appendChild(svgEl('polygon', { class: 'mark-tri', points: pts, stroke: on === BLACK ? '#fff' : '#1b1b1b' }));
    } else if (mark.shape === 'dot') {
      svg.appendChild(svgEl('circle', { class: 'lib', cx, cy, r: 6.5 }));
    } else if (mark.shape === 'cross') {
      const d = 6;
      svg.appendChild(svgEl('path', { class: 'mark-cross', d: 'M' + (cx - d) + ' ' + (cy - d) + 'L' + (cx + d) + ' ' + (cy + d) + 'M' + (cx + d) + ' ' + (cy - d) + 'L' + (cx - d) + ' ' + (cy + d) }));
    } else if (mark.shape === 'ring') {
      svg.appendChild(svgEl('circle', { class: 'mark-ring', cx, cy, r: CELL * 0.36 }));
    } else if (mark.shape === 'found') {
      svg.appendChild(svgEl('circle', { class: 'mark-found', cx, cy, r: 10 }));
      svg.appendChild(svgEl('path', { class: 'mark-glyph', d: 'M' + (cx - 5) + ' ' + cy + 'l3.6 3.8l6.4 -7.4' }));
    } else if (mark.shape === 'miss') {
      const d = 4;
      svg.appendChild(svgEl('circle', { class: 'mark-miss', cx, cy, r: 10 }));
      svg.appendChild(svgEl('path', { class: 'mark-glyph', d: 'M' + (cx - d) + ' ' + (cy - d) + 'L' + (cx + d) + ' ' + (cy + d) + 'M' + (cx + d) + ' ' + (cy - d) + 'L' + (cx - d) + ' ' + (cy + d) }));
    }
  }

  function draw(next) {
    model = next;
    const state = model.state;
    const size = state.size;
    margin = model.coords ? 34 : 30;
    const extent = margin * 2 + (size - 1) * CELL;
    svg.setAttribute('viewBox', '0 0 ' + extent + ' ' + extent);
    svg.textContent = '';
    if (svg.parentElement) svg.parentElement.style.maxWidth = boardMaxWidth(size) + 'px';

    const defs = svgEl('defs', {});
    defs.innerHTML =
      '<radialGradient id="gB" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#707070"/><stop offset="0.6" stop-color="#1b1b1b"/><stop offset="1" stop-color="#050505"/></radialGradient>' +
      '<radialGradient id="gW" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.75" stop-color="#ece8df"/><stop offset="1" stop-color="#cfc9bc"/></radialGradient>';
    svg.appendChild(defs);

    for (let i = 0; i < size; i++) {
      svg.appendChild(svgEl('line', { class: 'grid', x1: px(0), y1: px(i), x2: px(size - 1), y2: px(i) }));
      svg.appendChild(svgEl('line', { class: 'grid', x1: px(i), y1: px(0), x2: px(i), y2: px(size - 1) }));
    }
    for (const [x, y] of starPoints(size)) {
      svg.appendChild(svgEl('circle', { class: 'star', cx: px(x), cy: px(y), r: 3.6 }));
    }

    if (model.coords) {
      for (let i = 0; i < size; i++) {
        const col = svgEl('text', { class: 'label', x: px(i), y: extent - 11 });
        col.textContent = toCoord(size, i)[0];
        svg.appendChild(col);
        const row = svgEl('text', { class: 'label', x: 11, y: px(i) });
        row.textContent = String(size - i);
        svg.appendChild(row);
      }
    }

    if (model.owner) {
      model.owner.forEach((c, idx) => {
        if (c === EMPTY) return;
        const x = idx % size;
        svg.appendChild(svgEl('rect', {
          class: 'terr', x: px(x) - 6, y: px((idx - x) / size) - 6, width: 12, height: 12, rx: 2,
          fill: c === BLACK ? '#1b1b1b' : '#fffdf5', stroke: c === BLACK ? 'none' : '#a59e8e',
        }));
      });
    }

    state.board.forEach((c, idx) => {
      if (c === EMPTY) return;
      const x = idx % size;
      svg.appendChild(stone(x, (idx - x) / size, c));
    });

    if (model.showLast !== false && state.lastMove >= 0 && state.board[state.lastMove] !== EMPTY) {
      const x = state.lastMove % size;
      const c = state.board[state.lastMove];
      svg.appendChild(svgEl('circle', { class: 'last', cx: px(x), cy: px((state.lastMove - x) / size), r: CELL * 0.2, stroke: c === BLACK ? '#fff' : '#222' }));
    }

    if (model.atari) {
      for (const g of groupsInAtari(state)) {
        for (const s of g.stones) {
          const x = s % size;
          svg.appendChild(svgEl('circle', { class: 'atari', cx: px(x), cy: px((s - x) / size), r: CELL * 0.47 + 2.5 }));
        }
      }
    }

    if (state.ko >= 0) {
      const x = state.ko % size;
      svg.appendChild(svgEl('rect', { class: 'ko', x: px(x) - 7, y: px((state.ko - x) / size) - 7, width: 14, height: 14 }));
    }

    for (const l of model.libs || []) drawMark({ at: l, shape: 'dot' }, state);
    for (const m of model.marks || []) drawMark(m, state);

    for (const l of model.labels || []) {
      const x = l.at % size;
      const cx = px(x);
      const cy = px((l.at - x) / size);
      const w = 16 + l.text.length * 15;
      svg.appendChild(svgEl('rect', { class: 'tag-bg', x: cx - w / 2, y: cy - 13, width: w, height: 26, rx: 13 }));
      const t = svgEl('text', { class: 'tag-text', x: cx, y: cy + 1 });
      t.textContent = l.text;
      svg.appendChild(t);
    }

    const ghost = stone(0, 0, state.turn, 'ghost');
    ghost.setAttribute('visibility', 'hidden');
    svg.appendChild(ghost);
    svg._ghost = ghost;
    svg.classList.toggle('tappable', Boolean(onTap));

    // 키보드 커서
    if (cursor >= size * size) cursor = -1;
    if (onTap && kbd && cursor >= 0) {
      const x = cursor % size;
      const y = (cursor - x) / size;
      svg.appendChild(svgEl('rect', { class: 'kbd-cursor', x: px(x) - CELL / 2 + 1, y: px(y) - CELL / 2 + 1, width: CELL - 2, height: CELL - 2, rx: 8 }));
      if (model.ghost && state.board[cursor] === EMPTY) {
        ghost.setAttribute('transform', 'translate(' + x * CELL + ' ' + y * CELL + ')');
        ghost.setAttribute('visibility', 'visible');
      }
    }

    // 소리: 빈 자리에 돌 하나가 새로 놓였을 때만(새 문제로 판이 통째로 바뀐 때는 소리 없음)
    const b = state.board;
    if (prevBoard && prevSize === size && state.lastMove >= 0 && prevBoard[state.lastMove] === EMPTY && b[state.lastMove] !== EMPTY) {
      let added = 0;
      let removed = 0;
      for (let k = 0; k < b.length; k++) {
        if (prevBoard[k] === EMPTY && b[k] !== EMPTY) added++;
        else if (prevBoard[k] !== EMPTY && b[k] === EMPTY) removed++;
      }
      if (added === 1) playCue(removed > 0 ? 'capture' : 'place');
    }
    prevBoard = b.slice();
    prevSize = size;
  }

  function describe(idx) {
    const c = model.state.board[idx];
    return toCoord(model.state.size, idx) + (c === BLACK ? ', 흑돌' : c === WHITE ? ', 백돌' : ', 빈 자리');
  }

  if (onTap) {
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', 'application');
    svg.setAttribute('aria-roledescription', '바둑판');
    svg.setAttribute('aria-label', '바둑판. 화살표로 자리를 옮기고 Enter나 스페이스로 돌을 놓아요. P는 한 수 쉬기');
    live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    if (svg.parentElement) svg.parentElement.appendChild(live);
    svg.addEventListener('keydown', (e) => {
      if (!model) return;
      const size = model.state.size;
      if (cursor < 0) cursor = Math.floor(size / 2) * (size + 1);
      let x = cursor % size;
      let y = (cursor - x) / size;
      const k = e.key;
      if (k === 'ArrowLeft') x = Math.max(0, x - 1);
      else if (k === 'ArrowRight') x = Math.min(size - 1, x + 1);
      else if (k === 'ArrowUp') y = Math.max(0, y - 1);
      else if (k === 'ArrowDown') y = Math.min(size - 1, y + 1);
      else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        kbd = true;
        onTap(cursor);
        return;
      } else if (k === 'p' || k === 'P' || k === 'ㅔ') {
        const pb = document.getElementById('passBtn');
        if (pb && !pb.disabled && !pb.hidden && pb.offsetParent !== null) {
          e.preventDefault();
          pb.click();
        }
        return;
      } else return;
      e.preventDefault();
      kbd = true;
      cursor = y * size + x;
      draw(model);
      if (live) live.textContent = describe(cursor);
    });
    svg.addEventListener('focus', () => {
      if (!model || !svg.matches(':focus-visible')) return;
      kbd = true;
      if (cursor < 0) cursor = Math.floor(model.state.size / 2) * (model.state.size + 1);
      draw(model);
    });
    svg.addEventListener('blur', () => {
      if (!kbd || !model) return;
      kbd = false;
      draw(model);
    });
    svg.addEventListener('pointerdown', () => { kbd = false; });
  }

  svg.addEventListener('click', (e) => {
    const idx = pointFromEvent(e);
    if (idx >= 0 && onTap) onTap(idx);
  });
  svg.addEventListener('pointermove', (e) => {
    const ghost = svg._ghost;
    if (!ghost || !model) return;
    const idx = model.ghost && e.pointerType === 'mouse' ? pointFromEvent(e) : -1;
    if (idx < 0 || model.state.board[idx] !== EMPTY) {
      ghost.setAttribute('visibility', 'hidden');
      return;
    }
    const size = model.state.size;
    const x = idx % size;
    ghost.setAttribute('transform', 'translate(' + x * CELL + ' ' + ((idx - x) / size) * CELL + ')');
    ghost.setAttribute('visibility', 'visible');
  });
  svg.addEventListener('pointerleave', () => {
    if (svg._ghost) svg._ghost.setAttribute('visibility', 'hidden');
  });

  return { draw };
}
