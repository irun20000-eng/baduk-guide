// 수업 엔진: 차시 자료의 판 그림을 읽고, 문제의 정답을 규칙 엔진으로 계산한다.
// 화면 코드와 테스트(정답 자동 검산)가 같은 함수를 쓴다.
import { EMPTY, BLACK, WHITE, createGame, play, pass, groupAt, groupsInAtari, neighbors, opponent, starPoints, fromCoord, score } from './rules.mjs';

export const STEP_TYPES = ['explain', 'free', 'explore', 'move', 'count', 'choice', 'point', 'forbidden', 'sequence', 'chase'];

// 판 그림 글자
//  .  빈 곳          X  흑돌           O  백돌
//  x  표시한 흑돌     o  표시한 백돌     (문제의 대상이 되는 돌, 세모 표시)
//  *  정답 자리(빈 곳)
//  +  활로 표시(빈 곳, 초록 점)          !  아님 표시(빈 곳, 빨간 가위표)
//  #  패 때문에 지금 둘 수 없는 자리
// 그 밖에: turn 'B' | 'W', labels [{ at, text }], captures { B, W }, komi
export function parseBoard(spec) {
  const rows = spec.rows.map((r) => r.replace(/\s+/g, ''));
  const size = rows.length;
  const state = createGame(size);
  const answers = [];
  const targets = [];
  const dots = [];
  const crosses = [];
  let ko = -1;
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error('줄 길이가 판 크기와 다릅니다: "' + row + '"');
    [...row].forEach((ch, x) => {
      const i = y * size + x;
      switch (ch) {
        case '.': break;
        case 'X': state.board[i] = BLACK; break;
        case 'O': state.board[i] = WHITE; break;
        case 'x': state.board[i] = BLACK; targets.push(i); break;
        case 'o': state.board[i] = WHITE; targets.push(i); break;
        case '*': answers.push(i); break;
        case '+': dots.push(i); break;
        case '!': crosses.push(i); break;
        case '#': ko = i; break;
        default: throw new Error('판 그림에 쓸 수 없는 글자입니다: "' + ch + '"');
      }
    });
  });
  state.turn = spec.turn === 'W' ? WHITE : BLACK;
  state.ko = ko;
  if (spec.captures) state.captures = { 1: spec.captures.B || 0, 2: spec.captures.W || 0 };
  if (typeof spec.komi === 'number') state.komi = spec.komi;
  const labels = (spec.labels || []).map((l) => {
    const at = fromCoord(size, l.at);
    if (at < 0) throw new Error('이름표 좌표가 잘못되었습니다: ' + l.at);
    return { at, text: l.text };
  });
  return { size, state, answers, targets, dots, crosses, labels, ko };
}

// 귀, 변, 중앙 구분 (입문 설명용의 넉넉한 기준)
export function regionOf(size, idx) {
  const band = size >= 13 ? 4 : size >= 9 ? 3 : 2;
  const x = idx % size;
  const y = (idx - x) / size;
  const nearX = x < band || x >= size - band;
  const nearY = y < band || y >= size - band;
  if (nearX && nearY) return 'corner';
  if (!nearX && !nearY) return 'center';
  return 'side';
}

export function sameGroup(board, size, points) {
  if (points.length < 2) return true;
  const g = groupAt(board, size, points[0]).stones;
  return points.every((p) => g.includes(p));
}

// 한 점짜리 집이 진짜 집인지 옥집인지. 'none' | 'real' | 'false'
// 대각선 자리를 상대가 차지한 수로 판단한다 (가운데는 2곳 이상, 변과 귀는 1곳 이상이면 옥집).
export function eyeKind(board, size, idx) {
  if (board[idx] !== EMPTY) return 'none';
  const near = neighbors(size, idx);
  const c = board[near[0]];
  if (c === EMPTY || !near.every((n) => board[n] === c)) return 'none';
  const x = idx % size;
  const y = (idx - x) / size;
  let bad = 0;
  let off = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) { off++; continue; }
    const d = board[ny * size + nx];
    if (d !== EMPTY && d !== c) bad++;
  }
  return (off > 0 ? bad >= 1 : bad >= 2) ? 'false' : 'real';
}

// ---- 몰아 잡기 (축, 환격, 촉촉수): 단수를 계속 쳐서 잡을 수 있는지 ----

// 쫓기는 쪽이 둘 만한 수: 자기 활로 자리, 그리고 단수 된 둘레의 상대 돌을 따내는 자리
function defenderMoves(state, target) {
  const { board, size } = state;
  const g = groupAt(board, size, target);
  const out = new Set(g.liberties);
  for (const s of g.stones) {
    for (const n of neighbors(size, s)) {
      if (board[n] !== EMPTY && board[n] !== g.color) {
        const a = groupAt(board, size, n);
        if (a.liberties.length === 1) out.add(a.liberties[0]);
      }
    }
  }
  return [...out];
}

// 이 수를 두면 끝까지 몰아서 잡을 수 있는가 (둘 차례 = 잡는 쪽)
export function chaseMoveWins(state, target, move, depth = 30) {
  const r = play(state, move);
  if (!r.ok) return false;
  const after = r.state;
  if (after.board[target] === EMPTY) return true;
  if (groupAt(after.board, after.size, target).liberties.length !== 1) return false;
  if (depth <= 0) return false;
  for (const d of defenderMoves(after, target)) {
    const rr = play(after, d);
    if (!rr.ok) continue;
    if (!chaseWins(rr.state, target, depth - 1)) return false;
  }
  return true;
}

export function chaseWinningMoves(state, target, depth = 30) {
  const g = groupAt(state.board, state.size, target);
  if (g.color === EMPTY || g.liberties.length > 2) return [];
  return g.liberties.filter((m) => chaseMoveWins(state, target, m, depth));
}

export function chaseWins(state, target, depth = 30) {
  if (state.board[target] === EMPTY) return true;
  return chaseWinningMoves(state, target, depth).length > 0;
}

// 쫓기는 쪽의 응수 (화면에서 상대가 두는 수). 따낼 수 있으면 따내고, 아니면 활로가 가장 늘어나는 쪽으로 달아난다. 없으면 -1.
export function chaseReply(state, target) {
  let best = -1;
  let top = -1;
  for (const d of defenderMoves(state, target)) {
    const r = play(state, d);
    if (!r.ok) continue;
    const v = groupAt(r.state.board, state.size, target).liberties.length + (r.captured.length ? 0.5 : 0);
    if (v > top) { top = v; best = d; }
  }
  return best;
}

// 정답 수와 응수를 번갈아 두어 끝까지 가 본다.
export function chasePlayout(state, target) {
  let s = state;
  let myMoves = 0;
  while (myMoves < 40) {
    const wins = chaseWinningMoves(s, target);
    if (wins.length === 0) return { captured: false, myMoves };
    s = play(s, wins[0]).state;
    myMoves++;
    if (s.board[target] === EMPTY) return { captured: true, myMoves };
    const reply = chaseReply(s, target);
    s = reply >= 0 ? play(s, reply).state : pass(s);
  }
  return { captured: false, myMoves };
}

// ---- 사활: 둘러싸인 돌이 살 수 있는지 작은 범위에서 끝까지 읽는다 ----

// 대상 돌에서 빈 점과 같은 색 돌을 따라 닿는 범위 (집 모양의 안쪽)
export function insideRegion(state, target) {
  const { board, size } = state;
  const color = board[target];
  const seen = new Set([target]);
  const stack = [target];
  while (stack.length) {
    const cur = stack.pop();
    for (const n of neighbors(size, cur)) {
      if (!seen.has(n) && (board[n] === EMPTY || board[n] === color)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

// 둘 차례(state.turn)부터 서로 가장 좋은 수를 둘 때 대상 돌이 잡히지 않으면 true.
// 수는 안쪽 범위에만 둔다. 둘 다 쉬면 산 것으로 본다.
export function survives(state, target, maxDepth = 24) {
  const defender = state.board[target];
  if (defender === EMPTY) return false;
  const memo = new Map();
  const go = (s, region, depth) => {
    if (s.board[target] === EMPTY) return false;
    if (s.passes >= 2 || depth <= 0) return true;
    const key = s.board.join('') + '|' + s.turn + '|' + s.ko + '|' + s.passes + '|' + region.size;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, true); // 같은 모양이 되풀이되면 잡지 못한 것으로 본다
    const isDef = s.turn === defender;
    let result = !isDef;
    const kids = [];
    for (const p of region) {
      if (s.board[p] !== EMPTY) continue;
      const r = play(s, p);
      if (r.ok) kids.push([r.state, r.captured.length ? new Set([...region, ...r.captured]) : region]);
    }
    kids.push([pass(s), region]);
    for (const [k, reg] of kids) {
      const alive = go(k, reg, depth - 1);
      if (isDef && alive) { result = true; break; }
      if (!isDef && !alive) { result = false; break; }
    }
    memo.set(key, result);
    return result;
  };
  return go({ ...state, passes: 0 }, new Set(insideRegion(state, target)), maxDepth);
}

// ---- 한 수 문제 ----
// 조건을 만족하는 수를 모두 찾는다. 자료에 적은 정답과 같은지 검산할 때 쓴다.
//  capture       상대 돌을 따낸다
//  atari         표시한 상대 돌이 단수가 된다 (내가 둔 돌은 바로 단수가 아니다)
//  double-atari  상대 덩어리 둘 이상이 한꺼번에 단수가 된다
//  escape        표시한 내 돌의 활로가 2개 이상이 된다
//  cut           상대가 두면 표시한 돌들이 이어지는 자리를 내가 차지한다
//  connect       표시한 내 돌들이 한 덩어리가 된다
//  chase         단수를 계속 쳐서 표시한 상대 돌을 끝내 잡는 첫 수 (축, 환격, 촉촉수)
//  net           표시한 상대 돌이 어디로 달아나도 잡히게 가두는 수 (장문)
//  race          수상전: 상대 돌의 바깥 활로를 메운다 (서로 같이 쓰는 활로는 아니다)
//  close         집의 빈틈을 막아 내 집이 가장 많아지는 수
//  live          표시한 내 돌을 살리는 수 (상대가 어떻게 두어도 잡히지 않는다)
//  kill          표시한 상대 돌을 잡는 수 (상대가 어떻게 두어도 살지 못한다)
export function movesFor(check, state, targets) {
  const { size, board } = state;
  const me = state.turn;
  const foe = opponent(me);
  const mine = targets.filter((t) => board[t] === me);
  const theirs = targets.filter((t) => board[t] === foe);
  let inside = null;
  if (check === 'live') inside = new Set(insideRegion(state, mine[0]));
  if (check === 'kill') inside = new Set(insideRegion(state, theirs[0]));
  if (check === 'close') {
    // 집의 빈틈 막기: 두고 나서 내 집이 가장 많아지는 수 (지금보다 늘어야 한다)
    const now = score(state).territory[me];
    let top = now;
    let best = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) continue;
      const r = play(state, i);
      if (!r.ok) continue;
      const v = score(r.state).territory[me];
      if (v > top) { top = v; best = [i]; } else if (v === top && v > now) best.push(i);
    }
    return best;
  }
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    if (inside && !inside.has(i)) continue;
    const r = play(state, i);
    if (!r.ok) continue;
    const after = r.state.board;
    const ownLibs = groupAt(after, size, i).liberties.length;
    let ok = false;
    if (check === 'capture') {
      ok = r.captured.length > 0;
    } else if (check === 'atari') {
      const t = targets[0];
      ok = after[t] !== EMPTY && groupAt(after, size, t).liberties.length === 1 && ownLibs >= 2;
    } else if (check === 'double-atari') {
      ok = ownLibs >= 2 && groupsInAtari(r.state).filter((g) => g.color === foe).length >= 2;
    } else if (check === 'escape') {
      const t = targets[0];
      ok = after[t] === me && groupAt(after, size, t).liberties.length >= 2;
    } else if (check === 'cut') {
      const f = play({ ...state, turn: foe }, i);
      ok = f.ok && !sameGroup(board, size, targets) && sameGroup(f.state.board, size, targets) && ownLibs >= 2;
    } else if (check === 'connect') {
      ok = !sameGroup(board, size, targets) && sameGroup(after, size, targets);
    } else if (check === 'chase') {
      ok = chaseMoveWins(state, theirs[0], i);
    } else if (check === 'net') {
      const t = theirs[0];
      ok = after[t] !== EMPTY && groupAt(after, size, t).liberties.length >= 2 &&
        !groupAt(board, size, t).liberties.includes(i) &&
        [...defenderMoves(r.state, t), -1].every((d) => {
          if (d < 0) return chaseWins(pass(r.state), t);
          const rr = play(r.state, d);
          return !rr.ok || chaseWins(rr.state, t);
        });
    } else if (check === 'race') {
      ok = groupAt(board, size, theirs[0]).liberties.includes(i) && !groupAt(board, size, mine[0]).liberties.includes(i) &&
        (ownLibs >= 2 || r.captured.length > 0);
    } else if (check === 'live') {
      ok = survives(r.state, mine[0]);
    } else if (check === 'kill') {
      ok = after[theirs[0]] === EMPTY || !survives(r.state, theirs[0]);
    } else {
      throw new Error('모르는 조건입니다: ' + check);
    }
    if (ok) out.push(i);
  }
  return out;
}

// "짚기 문제"의 정답 묶음. 묶음 하나는 점들의 배열이고, 그 안의 아무 점이나 누르면 그 묶음을 찾은 것이다.
export function pointTargets(step, parsed) {
  const { size, state } = parsed;
  const all = [...state.board.keys()];
  const empties = all.filter((i) => state.board[i] === EMPTY);
  switch (step.rule) {
    case 'corner':
    case 'side':
    case 'center':
      return [all.filter((i) => regionOf(size, i) === step.rule)];
    case 'star':
      return [starPoints(size).map(([x, y]) => y * size + x)];
    case 'atari':
      return groupsInAtari(state).map((g) => g.stones);
    case 'illegal':
      return empties.filter((i) => play(state, i).reason === 'suicide').map((i) => [i]);
    case 'false-eye':
      return empties.filter((i) => eyeKind(state.board, size, i) === 'false').map((i) => [i]);
    case 'real-eye':
      return empties.filter((i) => eyeKind(state.board, size, i) === 'real').map((i) => [i]);
    case 'neutral':
      return score(state).neutral.map((i) => [i]);
    default: {
      const stones = parsed.targets.map((t) => groupAt(state.board, size, t).stones);
      return [...stones, ...parsed.answers.map((a) => [a])];
    }
  }
}

// 수 세기 문제의 실제 값
export function countFor(step, parsed) {
  if (step.check === 'liberties') return groupAt(parsed.state.board, parsed.size, parsed.targets[0]).liberties.length;
  if (step.check === 'stones') return groupAt(parsed.state.board, parsed.size, parsed.targets[0]).stones.length;
  if (step.check === 'territory') return score(parsed.state).territory[step.color === 'W' ? WHITE : BLACK];
  if (step.check === 'stonesB') return parsed.state.board.filter((c) => c === BLACK).length;
  if (step.check === 'total') {
    const s = score(parsed.state);
    return step.color === 'W' ? s.white : s.black;
  }
  return null;
}

// 고르기 문제 가운데 규칙으로 답을 계산할 수 있는 것. 계산할 수 없으면 null, 있으면 정답 번호.
export function choiceFor(step, parsed) {
  const { state, size } = parsed;
  const yes = step.yes ?? 0;
  const no = yes === 0 ? 1 : 0;
  if (step.check === 'connected') return sameGroup(state.board, size, parsed.targets) ? yes : no;
  if (step.check === 'legal') return play(state, parsed.answers[0]).ok ? yes : no;
  if (step.check === 'eye') return eyeKind(state.board, size, parsed.answers[0]) === 'real' ? yes : no;
  if (step.check === 'chase') return chaseWins(state, foeTarget(parsed)) ? yes : no;
  if (step.check === 'alive') {
    const t = parsed.targets[0];
    return survives({ ...state, turn: opponent(state.board[t]) }, t) ? yes : no;
  }
  if (step.check === 'winner') {
    const s = score(state);
    return s.winner === BLACK ? 0 : s.winner === WHITE ? 1 : -1;
  }
  if (step.check === 'owner') {
    const o = score(state).owner[parsed.dots[0]];
    return o === BLACK ? 0 : o === WHITE ? 1 : 2;
  }
  return null;
}

// 수순 문제의 수 (좌표 → 자리 번호)
export function sequenceLine(step, parsed) {
  return (step.line || []).map((c) => fromCoord(parsed.size, c));
}

// 문제에서 "잡을 대상"이 되는 상대 돌 (둘 차례의 반대 색으로 표시한 돌)
export function foeTarget(parsed) {
  const { state } = parsed;
  return parsed.targets.find((t) => state.board[t] === opponent(state.turn));
}

// 틀린 횟수와 힌트 사용 횟수로 별을 정한다.
export function starsFor(mistakes, hints) {
  const n = mistakes + hints;
  if (n === 0) return 3;
  if (n <= 2) return 2;
  return 1;
}

// 차시 자료 한 걸음을 검사해 문제점 목록을 돌려준다 (없으면 빈 배열). 빌드와 테스트에서 쓴다.
export function validateStep(step) {
  const problems = [];
  if (!STEP_TYPES.includes(step.type)) return ['모르는 걸음 종류: ' + step.type];
  if (!step.text || typeof step.text !== 'string') problems.push('설명 글이 없다');
  else if ((step.text.match(/[.!?]+(\s|$)/g) || []).length > 3) problems.push('글이 세 문장을 넘는다');

  let parsed = null;
  if (step.board) {
    try {
      parsed = parseBoard(step.board);
    } catch (err) {
      return [...problems, String(err.message)];
    }
    const { size, state } = parsed;
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] !== EMPTY && groupAt(state.board, size, i).liberties.length === 0) {
        problems.push('활로가 없는 돌이 판 위에 있다');
        break;
      }
    }
  } else if (step.type !== 'explain' && step.type !== 'choice') {
    return [...problems, '판 그림이 필요하다'];
  }
  const sorted = (list) => [...list].sort((a, b) => a - b).join(',');

  if (step.type === 'move') {
    if (parsed.answers.length === 0) problems.push('정답 자리(*)가 없다');
    for (const a of parsed.answers) if (!play(parsed.state, a).ok) problems.push('정답 자리에 둘 수 없다');
    if (!step.check) problems.push('검산 조건(check)이 없다');
    else if (problems.length === 0) {
      const real = movesFor(step.check, parsed.state, parsed.targets);
      if (sorted(real) !== sorted(parsed.answers)) {
        problems.push('정답이 조건(' + step.check + ')과 다르다: 자료 [' + sorted(parsed.answers) + '], 실제 [' + sorted(real) + ']');
      }
      // 사활 문제는 그 수를 두지 않으면 결과가 반대여야 문제가 된다.
      if (step.check === 'live') {
        const t = parsed.targets.find((p) => parsed.state.board[p] === parsed.state.turn);
        if (survives(pass(parsed.state), t)) problems.push('두지 않아도 이미 살아 있다');
        if (insideRegion(parsed.state, t).filter((p) => parsed.state.board[p] === EMPTY).length > 9) problems.push('안쪽 범위가 너무 넓다(돌이 둘러싸여 있지 않다)');
      }
      if (step.check === 'kill') {
        const t = foeTarget(parsed);
        if (!survives(pass(parsed.state), t)) problems.push('두지 않아도 이미 죽어 있다');
        if (insideRegion(parsed.state, t).filter((p) => parsed.state.board[p] === EMPTY).length > 9) problems.push('안쪽 범위가 너무 넓다(돌이 둘러싸여 있지 않다)');
      }
    }
  }
  if (step.type === 'count') {
    if (!Array.isArray(step.choices) || !step.choices.includes(step.answer)) problems.push('보기에 정답이 없다');
    const real = countFor(step, parsed);
    if (real === null) problems.push('검산 조건(check)이 없다');
    else if (real !== step.answer) problems.push('정답 ' + step.answer + ' 이(가) 실제 값 ' + real + ' 과 다르다');
  }
  if (step.type === 'choice') {
    if (!Array.isArray(step.choices) || !(step.answer >= 0 && step.answer < step.choices.length)) problems.push('정답 번호가 보기 범위를 벗어났다');
    if (step.check) {
      if (!parsed) problems.push('판 그림이 필요하다');
      else {
        const real = choiceFor(step, parsed);
        if (real === null) problems.push('모르는 조건: ' + step.check);
        else if (real !== step.answer) problems.push('정답 번호 ' + step.answer + ' 이(가) 실제 ' + real + ' 과 다르다');
      }
    }
  }
  if (step.type === 'point') {
    const groups = pointTargets(step, parsed);
    if (groups.length === 0 || groups.some((g) => g.length === 0)) problems.push('짚을 정답이 없다');
    if (step.need !== 'one' && step.need !== 'all') problems.push('need 는 one 또는 all 이어야 한다');
  }
  if (step.type === 'explore') {
    const groups = new Set();
    parsed.state.board.forEach((c, i) => {
      if (c !== EMPTY) groups.add(Math.min(...groupAt(parsed.state.board, parsed.size, i).stones));
    });
    if (!(step.need >= 1 && step.need <= groups.size)) problems.push('눌러 볼 돌 수(need)가 판 위 덩어리 수와 맞지 않는다');
  }
  if (step.type === 'free' && !(step.count >= 1)) problems.push('놓을 돌 수(count)가 없다');
  if (step.type === 'forbidden') {
    const spots = parsed.answers.concat(parsed.ko >= 0 ? [parsed.ko] : []);
    if (spots.length !== 1) problems.push('두어 볼 자리는 한 곳이어야 한다');
    for (const a of spots) {
      const r = play(parsed.state, a);
      if (r.ok || r.reason !== step.reason) problems.push('그 자리는 "' + step.reason + '" 때문에 못 두는 곳이 아니다 (실제: ' + (r.ok ? '둘 수 있음' : r.reason) + ')');
    }
  }
  if (step.type === 'sequence') {
    const line = sequenceLine(step, parsed);
    if (line.length === 0 || line.length % 2 === 0) problems.push('수순은 내 수로 끝나야 한다(홀수 개)');
    let s = parsed.state;
    let last = null;
    for (const m of line) {
      const r = m >= 0 ? play(s, m) : { ok: false };
      if (!r.ok) { problems.push('수순 가운데 둘 수 없는 수가 있다'); last = null; break; }
      s = r.state;
      last = r;
    }
    if (last && step.check === 'capture' && last.captured.length === 0) problems.push('마지막 수가 돌을 따내지 못한다');
  }
  if (step.type === 'chase') {
    const t = foeTarget(parsed);
    if (t === undefined) problems.push('잡을 대상(표시한 상대 돌)이 없다');
    else {
      const wins = chaseWinningMoves(parsed.state, t);
      if (wins.length === 0) problems.push('몰아서 잡을 수 없는 모양이다');
      else {
        if (sorted(wins) !== sorted(parsed.answers)) problems.push('첫 수가 다르다: 자료 [' + sorted(parsed.answers) + '], 실제 [' + sorted(wins) + ']');
        const run = chasePlayout(parsed.state, t);
        if (!run.captured) problems.push('끝까지 두어도 잡히지 않는다');
        if (step.moves && run.myMoves !== step.moves) problems.push('내 수의 개수가 다르다: 자료 ' + step.moves + ', 실제 ' + run.myMoves);
      }
    }
  }
  return problems;
}
