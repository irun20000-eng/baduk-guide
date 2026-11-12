// 수업 엔진: 차시 자료의 판 그림을 읽고, 문제의 정답을 규칙 엔진으로 계산한다.
// 화면 코드와 테스트(정답 자동 검산)가 같은 함수를 쓴다.
import { EMPTY, BLACK, WHITE, createGame, play, groupAt, groupsInAtari, opponent, starPoints, fromCoord } from './rules.mjs';

export const STEP_TYPES = ['explain', 'free', 'explore', 'move', 'count', 'choice', 'point'];

// 판 그림 글자
//  .  빈 곳          X  흑돌           O  백돌
//  x  표시한 흑돌     o  표시한 백돌     (문제의 대상이 되는 돌, 세모 표시)
//  *  정답 자리(빈 곳)
//  +  활로 표시(빈 곳, 초록 점)          !  아님 표시(빈 곳, 빨간 가위표)
export function parseBoard(spec) {
  const rows = spec.rows.map((r) => r.replace(/\s+/g, ''));
  const size = rows.length;
  const state = createGame(size);
  const answers = [];
  const targets = [];
  const dots = [];
  const crosses = [];
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
        default: throw new Error('판 그림에 쓸 수 없는 글자입니다: "' + ch + '"');
      }
    });
  });
  state.turn = spec.turn === 'W' ? WHITE : BLACK;
  const labels = (spec.labels || []).map((l) => {
    const at = fromCoord(size, l.at);
    if (at < 0) throw new Error('이름표 좌표가 잘못되었습니다: ' + l.at);
    return { at, text: l.text };
  });
  return { size, state, answers, targets, dots, crosses, labels };
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

// "한 수 문제"의 조건을 만족하는 수를 모두 찾는다. 자료에 적은 정답과 같은지 검산할 때 쓴다.
//  capture  상대 돌을 따낸다
//  atari    표시한 상대 돌이 단수가 된다 (내가 둔 돌은 바로 단수가 아니다)
//  escape   표시한 내 돌의 활로가 2개 이상이 된다
//  cut      상대가 두면 표시한 돌들이 이어지는 자리를 내가 차지한다 (내 돌은 바로 단수가 아니다)
//  connect  표시한 내 돌들이 한 덩어리가 된다
export function movesFor(check, state, targets) {
  const { size, board } = state;
  const me = state.turn;
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    const r = play(state, i);
    if (!r.ok) continue;
    const after = r.state.board;
    let ok = false;
    if (check === 'capture') {
      ok = r.captured.length > 0;
    } else if (check === 'atari') {
      const t = targets[0];
      ok = after[t] !== EMPTY && groupAt(after, size, t).liberties.length === 1 && groupAt(after, size, i).liberties.length >= 2;
    } else if (check === 'escape') {
      const t = targets[0];
      ok = after[t] === me && groupAt(after, size, t).liberties.length >= 2;
    } else if (check === 'cut') {
      const foe = play({ ...state, turn: opponent(me) }, i);
      ok = foe.ok && !sameGroup(board, size, targets) && sameGroup(foe.state.board, size, targets) &&
        groupAt(after, size, i).liberties.length >= 2;
    } else if (check === 'connect') {
      ok = !sameGroup(board, size, targets) && sameGroup(after, size, targets);
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
  switch (step.rule) {
    case 'corner':
    case 'side':
    case 'center':
      return [all.filter((i) => regionOf(size, i) === step.rule)];
    case 'star':
      return [starPoints(size).map(([x, y]) => y * size + x)];
    case 'atari':
      return groupsInAtari(state).map((g) => g.stones);
    default: {
      const stones = parsed.targets.map((t) => groupAt(state.board, size, t).stones);
      return [...stones, ...parsed.answers.map((a) => [a])];
    }
  }
}

// 수 세기 문제의 실제 값
export function countFor(step, parsed) {
  if (step.check === 'liberties') {
    return groupAt(parsed.state.board, parsed.size, parsed.targets[0]).liberties.length;
  }
  if (step.check === 'stones') {
    return groupAt(parsed.state.board, parsed.size, parsed.targets[0]).stones.length;
  }
  return null;
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
    // 판 위에 활로 없는 돌이 있으면 있을 수 없는 그림이다.
    const { size, state } = parsed;
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] !== EMPTY && groupAt(state.board, size, i).liberties.length === 0) {
        problems.push('활로가 없는 돌이 판 위에 있다');
        break;
      }
    }
  } else if (['free', 'explore', 'move', 'count', 'point'].includes(step.type)) {
    return [...problems, '판 그림이 필요하다'];
  }

  if (step.type === 'move') {
    if (parsed.answers.length === 0) problems.push('정답 자리(*)가 없다');
    for (const a of parsed.answers) {
      if (!play(parsed.state, a).ok) problems.push('정답 자리에 둘 수 없다');
    }
    if (!step.check) problems.push('검산 조건(check)이 없다');
    else {
      const real = movesFor(step.check, parsed.state, parsed.targets).sort((a, b) => a - b);
      const mine = [...parsed.answers].sort((a, b) => a - b);
      if (real.join(',') !== mine.join(',')) {
        problems.push('정답이 조건(' + step.check + ')과 다르다: 자료 [' + mine + '], 실제 [' + real + ']');
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
    if (step.check === 'connected') {
      const connected = sameGroup(parsed.state.board, parsed.size, parsed.targets);
      if ((step.answer === step.yes) !== connected) problems.push('이어짐 여부가 정답과 다르다');
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
  return problems;
}
