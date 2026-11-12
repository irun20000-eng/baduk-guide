// 화면: 홈, 차시, 따내기 바둑, 연습판, 프로필.
// 규칙과 판정은 rules.mjs, lesson-engine.mjs, ai.mjs, store.mjs 의 함수를 쓴다 (빌드 때 한 스크립트로 합쳐진다).

const root = document.getElementById('app');
const PRACTICE_KEY = 'baduk-guide:v1:practice';

const REASON_TEXT = {
  occupied: '이미 돌이 있는 자리예요.',
  suicide: '여기는 둘 수 없는 곳(착수금지)이에요. 놓자마자 활로가 하나도 없어요.',
  ko: '패예요. 바로 되따낼 수 없어요. 다른 곳에 한 번 둔 뒤에 따낼 수 있어요.',
  ended: '대국이 끝났어요. 새 판을 눌러 다시 시작해 보세요.',
  out: '바둑판 안쪽 교차점을 눌러 주세요.',
};

const DOL_SVG =
  '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">' +
  '<circle cx="24" cy="25" r="20" fill="#1d1d1d"/>' +
  '<ellipse cx="16" cy="14" rx="7" ry="3.6" fill="#fff" opacity=".2" transform="rotate(-28 16 14)"/>' +
  '<circle cx="17" cy="24" r="3.4" fill="#fff"/><circle cx="31" cy="24" r="3.4" fill="#fff"/>' +
  '<circle cx="17.8" cy="24.6" r="1.6" fill="#1d1d1d"/><circle cx="31.8" cy="24.6" r="1.6" fill="#1d1d1d"/>' +
  '<path d="M18 32q6 5 12 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorName = (c) => (c === BLACK ? '흑' : '백');
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function safeStorage() {
  try {
    const k = 'baduk-guide:check';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch (err) {
    return memoryStorage();
  }
}

const storage = safeStorage();
const store = createStore(storage);
let leaveView = null; // 화면을 떠날 때 정리할 일 (타이머 등)

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function isUnlocked(lesson) {
  const i = LESSONS.indexOf(lesson);
  return i === 0 || store.isDone(LESSONS[i - 1].id);
}

function nextLessonFor() {
  return LESSONS.find((l) => !store.isDone(l.id)) || null;
}

function route() {
  if (leaveView) {
    leaveView();
    leaveView = null;
  }
  const open = document.querySelector('dialog[open]');
  if (open) open.close();
  const h = location.hash || '#/';
  window.scrollTo(0, 0);
  const m = /^#\/lesson\/(L\d+)$/.exec(h);
  if (m) {
    const lesson = lessonById(m[1]);
    if (lesson && store.current() && isUnlocked(lesson)) return viewLesson(lesson);
    return go('#/');
  }
  if (h === '#/capture') return viewCapture();
  if (h === '#/practice') return viewPractice();
  return viewHome();
}

function barHtml(eyebrow, title, right) {
  return '<header class="bar">' +
    '<a class="back" href="#/" aria-label="홈으로 돌아가기"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
    '<div class="bar-title"><span class="eyebrow">' + esc(eyebrow) + '</span><strong>' + esc(title) + '</strong></div>' +
    (right || '') + '</header>';
}

function say(text, kind) {
  const m = $('msg');
  if (!m) return;
  m.textContent = text || '';
  m.className = 'msg' + (kind ? ' ' + kind : '');
}

// ---------------------------------------------------------------- 홈

function viewHome() {
  const me = store.current();
  const next = me ? nextLessonFor() : null;
  const unit1 = lessonsOfUnit(1);
  const doneCount = unit1.filter((l) => store.isDone(l.id)).length;
  const mission = MISSIONS[0];

  let hero;
  if (!me) {
    hero =
      '<section class="card welcome">' +
      '<div class="welcome-head"><span class="dol">' + DOL_SVG + '</span><div><h2>반가워요! 이름을 알려 주세요</h2>' +
      '<p>이름마다 배운 내용을 따로 기억해요. 이 기기 안에만 저장돼요.</p></div></div>' +
      '<form id="firstForm" class="name-form"><input id="firstName" maxlength="' + MAX_NAME + '" placeholder="이름 (8글자까지)" autocomplete="off" aria-label="이름">' +
      '<button class="primary" type="submit">시작하기</button></form><p class="form-err" id="firstErr" role="alert"></p></section>';
  } else if (next) {
    const started = doneCount > 0;
    hero =
      '<section class="card continue"><div><p class="eyebrow">' + (started ? '이어서 하기' : '처음 시작하기') + '</p>' +
      '<h2>' + next.no + '차시 ' + esc(next.title) + '</h2><p class="goal">' + esc(next.goal) + '</p></div>' +
      '<a class="primary" href="#/lesson/' + next.id + '">' + (started ? '이어서' : '시작') + '</a></section>';
  } else {
    const missionDone = store.missionDone(mission.id);
    hero =
      '<section class="card continue"><div><p class="eyebrow">1단원 완료</p><h2>' + (missionDone ? '1단원을 모두 마쳤어요!' : '이제 따내기 바둑을 해 볼까요?') + '</h2>' +
      '<p class="goal">' + (missionDone ? '2단원은 준비하고 있어요. 그동안 연습판에서 마음껏 두어 보세요.' : esc(mission.text)) + '</p></div>' +
      '<a class="primary" href="' + (missionDone ? '#/practice' : mission.route) + '">' + (missionDone ? '연습판' : '도전') + '</a></section>';
  }

  const rows = unit1.map((l) => {
    const done = store.isDone(l.id);
    const open = Boolean(me) && isUnlocked(l);
    const isNext = next && next.id === l.id;
    const state = done ? 'done' : isNext ? 'next' : open ? 'open' : 'locked';
    const right = done
      ? '<span class="stars" aria-label="별 3개 중 ' + store.starsOf(l.id) + '개">' + starText(store.starsOf(l.id)) + '</span>'
      : isNext ? '<span class="tag go">시작</span>' : '<span class="tag">잠김</span>';
    const inner = '<span class="num">' + l.no + '</span><span class="lesson-title">' + esc(l.title) + '</span>' + right;
    return '<li>' + (open
      ? '<a class="lesson-row ' + state + '" href="#/lesson/' + l.id + '">' + inner + '</a>'
      : '<span class="lesson-row ' + state + '" aria-disabled="true">' + inner + '</span>') + '</li>';
  }).join('');

  const missionRow =
    '<a class="lesson-row mission' + (store.missionDone(mission.id) ? ' done' : '') + '" href="' + mission.route + '">' +
    '<span class="num flag">미션</span><span class="lesson-title">' + esc(mission.title) + '<small>' + esc(mission.text) + '</small></span>' +
    (store.missionDone(mission.id) ? '<span class="tag ok">완료</span>' : '<span class="tag go">도전</span>') + '</a>';

  const soon = UNITS.filter((u) => !u.ready).map((u) =>
    '<li class="soon-row"><span class="num">' + u.id + '</span><span class="lesson-title">' + esc(u.title) + '<small>' + esc(u.topics) + '</small></span><span class="tag">준비 중</span></li>'
  ).join('');

  const chip = me
    ? '<button type="button" class="profile-chip" id="profileBtn" aria-label="프로필 바꾸기"><span class="avatar c' + me.color + '">' + esc([...me.name][0]) + '</span><span>' + esc(me.name) + '</span></button>'
    : '';

  root.innerHTML =
    '<header class="top"><div><h1>바둑 첫걸음</h1><p class="sub">처음 배우는 바둑</p></div>' + chip + '</header>' +
    hero +
    '<section class="unit"><div class="unit-head"><h2>1단원 ' + esc(UNITS[0].title) + '</h2><span class="unit-progress">' + doneCount + ' / ' + unit1.length + '</span></div>' +
    '<ol class="lessons">' + rows + '<li>' + missionRow + '</li></ol></section>' +
    '<section class="unit"><div class="unit-head"><h2>다음 단원</h2></div><ol class="lessons">' + soon + '</ol></section>' +
    '<section class="unit"><div class="unit-head"><h2>자유롭게 두기</h2></div><div class="play-grid">' +
    '<a class="play-card" href="#/practice"><strong>연습판</strong><span>9줄, 13줄, 19줄 판에서 마음껏 두어 보기</span></a>' +
    '<a class="play-card" href="#/capture"><strong>따내기 바둑</strong><span>돌돌이와, 또는 둘이서 한 판</span></a></div></section>' +
    '<footer>v0.2 · 1단원 · 인터넷 없이도 열려요</footer>' +
    '<dialog id="profileDialog" aria-label="프로필"></dialog>';

  if (!me) {
    $('firstForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = store.addProfile($('firstName').value);
      if (r.error) $('firstErr').textContent = r.error === 'empty' ? '이름을 한 글자 이상 적어 주세요.' : '그 이름은 쓸 수 없어요.';
      else viewHome();
    });
  } else {
    $('profileBtn').addEventListener('click', openProfiles);
  }
}

function openProfiles() {
  const dialog = $('profileDialog');
  const draw = (err) => {
    const list = store.profiles();
    const me = store.current();
    const total = LESSONS.length;
    dialog.innerHTML =
      '<div class="dialog-head"><h2>누가 배울까요?</h2><button type="button" class="icon-btn" id="closeProfiles" aria-label="닫기">닫기</button></div>' +
      '<ul class="profile-list">' + list.map((p) =>
        '<li class="' + (me && me.id === p.id ? 'on' : '') + '"><button type="button" class="pick" data-id="' + p.id + '">' +
        '<span class="avatar c' + p.color + '">' + esc([...p.name][0]) + '</span><span class="pname">' + esc(p.name) +
        '<small>' + Object.keys(p.done).length + ' / ' + total + '차시</small></span></button>' +
        '<button type="button" class="del" data-del="' + p.id + '" aria-label="' + esc(p.name) + ' 지우기">지우기</button></li>'
      ).join('') + '</ul>' +
      (list.length < MAX_PROFILES
        ? '<form id="addForm" class="name-form"><input id="addName" maxlength="' + MAX_NAME + '" placeholder="새 이름 (8글자까지)" autocomplete="off" aria-label="새 이름"><button class="primary" type="submit">추가</button></form>'
        : '<p class="hint-text">프로필은 ' + MAX_PROFILES + '명까지 만들 수 있어요.</p>') +
      '<p class="form-err" role="alert">' + esc(err || '') + '</p>';

    $('closeProfiles').addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => {
      store.selectProfile(b.dataset.id);
      dialog.close();
      viewHome();
    }));
    dialog.querySelectorAll('.del').forEach((b) => b.addEventListener('click', () => {
      const p = store.profiles().find((x) => x.id === b.dataset.del);
      if (!p || !confirm(p.name + ' 프로필을 지울까요? 배운 기록도 함께 지워져요.')) return;
      store.removeProfile(p.id);
      if (!store.current()) {
        dialog.close();
        viewHome();
      } else draw();
    }));
    const form = $('addForm');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = store.addProfile($('addName').value);
      if (r.error) {
        draw(r.error === 'empty' ? '이름을 한 글자 이상 적어 주세요.' : r.error === 'duplicate' ? '같은 이름이 이미 있어요.' : '더 만들 수 없어요.');
      } else {
        dialog.close();
        viewHome();
      }
    });
  };
  draw();
  dialog.showModal();
}

// ---------------------------------------------------------------- 차시

function viewLesson(lesson) {
  const total = lesson.steps.length;
  let i = 0;
  let mistakes = 0;
  let hints = 0;
  let S = null; // 지금 걸음의 진행 상태

  root.innerHTML =
    '<div class="lesson-view">' +
    barHtml(lesson.no + '차시', lesson.title, '<span class="count" id="stepCount"></span>') +
    '<div class="progress" role="progressbar" aria-label="차시 진행" aria-valuemin="0" aria-valuemax="' + total + '" id="progress"><i id="progressFill"></i></div>' +
    '<div class="boardwrap" id="wrap"><svg id="board" role="img" aria-label="바둑판"></svg></div>' +
    '<div class="bubble"><span class="dol">' + DOL_SVG + '</span><p id="stepText" tabindex="-1"></p></div>' +
    '<div class="choices" id="choices"></div>' +
    '<p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="actions"><button type="button" id="hintBtn" class="ghost-btn">힌트</button><button type="button" id="nextBtn" class="primary">다음</button></div>' +
    '</div>';

  const view = createBoardView($('board'), onTap);
  $('nextBtn').addEventListener('click', onNext);
  $('hintBtn').addEventListener('click', onHint);

  function draw() {
    const p = S.parsed;
    $('wrap').hidden = !p;
    if (!p) return;
    const marks = [];
    for (const t of p.targets) if (S.state.board[t] !== EMPTY) marks.push({ at: t, shape: 'tri' });
    for (const d of p.dots) marks.push({ at: d, shape: 'dot' });
    for (const c of p.crosses) marks.push({ at: c, shape: 'cross' });
    view.draw({
      state: S.state,
      libs: S.libs,
      marks: marks.concat(S.marks),
      labels: p.labels,
      showLast: S.showLast,
      ghost: !S.done && (S.step.type === 'move' || S.step.type === 'free'),
    });
  }

  function complete(text) {
    S.done = true;
    say(text || '잘했어요!', 'ok');
    $('nextBtn').disabled = false;
    $('hintBtn').hidden = true;
    draw();
  }

  function miss(text) {
    mistakes++;
    say(text || '아쉬워요. 다시 해 볼까요?', 'warn');
  }

  function startStep() {
    const step = lesson.steps[i];
    const parsed = step.board ? parseBoard(step.board) : null;
    S = {
      step, parsed,
      state: parsed ? parsed.state : null,
      done: step.type === 'explain',
      hintLevel: 0,
      libs: [],
      marks: [],
      showLast: false,
      placed: 0,
      seen: new Set(),
      found: new Set(),
      groups: step.type === 'point' ? pointTargets(step, parsed) : null,
    };
    $('stepCount').textContent = (i + 1) + ' / ' + total;
    $('progressFill').style.width = (i / total) * 100 + '%';
    $('progress').setAttribute('aria-valuenow', String(i));
    $('stepText').textContent = step.text;
    $('nextBtn').disabled = !S.done;
    $('nextBtn').textContent = i === total - 1 ? '마치기' : '다음';
    $('hintBtn').hidden = !(['move', 'count', 'point'].includes(step.type) || (step.type === 'choice' && step.hint));
    say('');

    const box = $('choices');
    box.textContent = '';
    box.hidden = !(step.type === 'count' || step.type === 'choice');
    if (!box.hidden) {
      box.className = 'choices' + (step.type === 'count' ? ' numbers' : '');
      step.choices.forEach((c, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        b.textContent = step.type === 'count' ? c + (step.unit || '개') : c;
        b.addEventListener('click', () => onChoice(b, step.type === 'count' ? c === step.answer : n === step.answer));
        box.appendChild(b);
      });
    }
    draw();
  }

  function onChoice(button, correct) {
    if (S.done) return;
    if (correct) {
      button.classList.add('correct');
      $('choices').querySelectorAll('button').forEach((b) => { b.disabled = true; });
      if (S.step.type === 'count') S.libs = groupAt(S.state.board, S.parsed.size, S.parsed.targets[0]).liberties;
      complete(S.step.right);
    } else {
      button.classList.add('wrong');
      button.disabled = true;
      miss(S.step.wrong || (S.step.type === 'count' ? '다시 세어 볼까요? 힌트를 누르면 활로를 보여 줘요.' : '다시 생각해 볼까요?'));
    }
  }

  function onTap(idx) {
    const step = S.step;
    const { state } = S;
    const size = state.size;

    if (step.type === 'explore') {
      if (state.board[idx] === EMPTY) return say('돌을 눌러 보세요.');
      const g = groupAt(state.board, size, idx);
      S.libs = g.liberties;
      S.seen.add(Math.min(...g.stones));
      const left = step.need - S.seen.size;
      if (left <= 0 && !S.done) complete(step.right);
      else if (!S.done) say('이 돌의 활로는 ' + g.liberties.length + '개예요. 남은 돌 ' + left + '개도 눌러 보세요.');
      draw();
      return;
    }
    if (S.done) return;

    if (step.type === 'free') {
      const r = play(state, idx);
      if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
      S.state = r.state;
      S.showLast = true;
      S.placed++;
      if (S.placed >= step.count) complete(step.right);
      else {
        say(colorName(state.turn) + '돌을 놓았어요. 이번에는 ' + colorName(r.state.turn) + ' 차례예요. (' + S.placed + ' / ' + step.count + ')');
        draw();
      }
      return;
    }

    if (step.type === 'move') {
      const r = play(state, idx);
      if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
      if (S.parsed.answers.includes(idx)) {
        S.state = r.state;
        S.showLast = true;
        S.marks = [];
        complete(step.right);
      } else {
        S.marks = [{ at: idx, shape: 'miss' }];
        miss(step.wrong);
        draw();
      }
      return;
    }

    if (step.type === 'point') {
      const gi = S.groups.findIndex((g) => g.includes(idx));
      if (gi < 0) {
        S.marks = S.marks.filter((m) => m.shape !== 'miss').concat([{ at: idx, shape: 'miss' }]);
        miss(step.wrong);
        draw();
        return;
      }
      if (S.found.has(gi)) return;
      S.found.add(gi);
      const spots = state.board[idx] === EMPTY ? [idx] : S.groups[gi];
      S.marks = S.marks.filter((m) => m.shape !== 'miss' && m.shape !== 'ring').concat(spots.map((at) => ({ at, shape: 'found' })));
      const left = S.groups.length - S.found.size;
      if (step.need === 'one' || left === 0) complete(step.right);
      else {
        say('잘 찾았어요! ' + left + '군데 더 있어요.', 'ok');
        draw();
      }
    }
  }

  function onHint() {
    if (S.done) return;
    const step = S.step;
    if (S.hintLevel < 2) hints++;
    S.hintLevel++;
    if (step.type === 'count') {
      S.libs = groupAt(S.state.board, S.parsed.size, S.parsed.targets[0]).liberties;
      say('초록 점이 활로예요. 하나씩 세어 보세요.');
    } else if (step.type === 'move') {
      if (S.hintLevel === 1 && step.hint) say(step.hint);
      else {
        S.marks = S.parsed.answers.map((at) => ({ at, shape: 'ring' }));
        say('초록 동그라미 자리에 두어 보세요.');
      }
    } else if (step.type === 'point') {
      if (S.hintLevel === 1 && step.hint) say(step.hint);
      else {
        const rings = [];
        S.groups.forEach((g, gi) => { if (!S.found.has(gi)) for (const at of g) rings.push({ at, shape: 'ring' }); });
        S.marks = S.marks.filter((m) => m.shape === 'found').concat(rings);
        say('초록 동그라미가 있는 곳을 눌러 보세요.');
      }
    } else if (step.hint) {
      say(step.hint);
    }
    draw();
  }

  function onNext() {
    if (!S.done) return;
    i++;
    if (i >= total) return finish();
    startStep();
    $('stepText').focus({ preventScroll: true });
  }

  function finish() {
    const stars = starsFor(mistakes, hints);
    store.completeLesson(lesson.id, stars);
    const idx = LESSONS.indexOf(lesson);
    const next = LESSONS[idx + 1] && LESSONS[idx + 1].unit === lesson.unit ? LESSONS[idx + 1] : null;
    const mission = MISSIONS.find((m) => m.unit === lesson.unit);
    const nextBtn = next
      ? '<a class="primary" href="#/lesson/' + next.id + '">다음: ' + next.no + '차시 ' + esc(next.title) + '</a>'
      : mission ? '<a class="primary" href="' + mission.route + '">' + esc(mission.title) + ' 하러 가기</a>' : '';
    const praise = stars === 3 ? '한 번도 틀리지 않았어요!' : stars === 2 ? '아주 잘했어요!' : '끝까지 해냈어요!';
    root.innerHTML =
      '<div class="lesson-view">' + barHtml(lesson.no + '차시', lesson.title) +
      '<div class="progress"><i style="width:100%"></i></div>' +
      '<section class="card finish"><span class="dol big">' + DOL_SVG + '</span>' +
      '<div class="stars big" aria-label="별 3개 중 ' + stars + '개">' + starText(stars) + '</div>' +
      '<h2>' + lesson.no + '차시를 마쳤어요</h2><p class="praise">' + praise + '</p>' +
      '<p class="summary">' + esc(lesson.summary) + '</p>' +
      '<div class="finish-actions">' + nextBtn + '<a class="ghost-btn" href="#/">홈으로</a>' +
      '<button type="button" class="text-btn" id="again">이 차시 다시 하기</button></div></section></div>';
    $('again').addEventListener('click', () => viewLesson(lesson));
    window.scrollTo(0, 0);
  }

  startStep();
}

// ---------------------------------------------------------------- 따내기 바둑

function viewCapture() {
  const mission = MISSIONS[0];
  let mode = 'ai';
  let moves = [createGame(9)];
  let winner = EMPTY;
  let lastCaptured = [];
  let timer = null;

  root.innerHTML =
    barHtml('1단원 미션', '따내기 바둑') +
    '<div class="seg" role="group" aria-label="상대 고르기"><button type="button" data-mode="ai" aria-pressed="true">돌돌이와 두기</button><button type="button" data-mode="two" aria-pressed="false">둘이서 두기</button></div>' +
    '<section class="status"><div class="turn"><span id="turnStone" class="chip black"></span><strong id="turnText"></strong></div><span class="rule">한 점이라도 먼저 따내면 이겨요</span></section>' +
    '<div class="boardwrap"><svg id="board" role="img" aria-label="9줄 바둑판"></svg></div>' +
    '<p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="controls"><button type="button" id="undo">무르기</button><button type="button" id="reset">새 판</button></div>' +
    '<section class="card result" id="result" hidden></section>';

  const view = createBoardView($('board'), onTap);
  const cur = () => moves[moves.length - 1];
  const thinking = () => timer !== null;
  leaveView = () => { if (timer) clearTimeout(timer); timer = null; };

  function draw() {
    const state = cur();
    view.draw({
      state,
      atari: !winner,
      marks: lastCaptured.map((at) => ({ at, shape: 'ring' })),
      ghost: !winner && !thinking(),
    });
    $('turnStone').className = 'chip ' + (state.turn === BLACK ? 'black' : 'white');
    const who = mode === 'ai' ? (state.turn === BLACK ? '내 차례 (흑)' : '돌돌이 차례 (백)') : colorName(state.turn) + ' 차례';
    $('turnText').textContent = winner ? '대국 끝' : who;
    $('undo').disabled = moves.length <= 1 || thinking();
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  }

  function showResult() {
    const box = $('result');
    if (!winner) {
      box.hidden = true;
      return;
    }
    const iWon = mode === 'two' || winner === BLACK;
    if (iWon && store.current()) store.completeMission(mission.id);
    const title = mode === 'ai'
      ? (winner === BLACK ? '이겼어요! 먼저 따냈어요' : '돌돌이가 먼저 따냈어요')
      : colorName(winner) + '이 먼저 따냈어요';
    const text = mode === 'ai'
      ? (winner === BLACK ? '상대 돌의 활로를 모두 막았어요. 미션 완료!' : '내 돌이 단수(빨간 점선)인지 살피면서 다시 도전해 보세요.')
      : colorName(winner) + ' 승리! 한 판 더 두어 볼까요?';
    box.hidden = false;
    box.innerHTML = '<h2>' + title + '</h2><p>' + text + '</p><div class="finish-actions"><button type="button" class="primary" id="again">한 판 더</button><a class="ghost-btn" href="#/">홈으로</a></div>';
    $('again').addEventListener('click', newGame);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function apply(r, mover) {
    moves.push(r.state);
    lastCaptured = r.captured;
    if (r.captured.length > 0) {
      winner = mover;
      say(colorName(mover) + '이 ' + r.captured.length + '점을 따냈어요.', mode === 'ai' && mover === WHITE ? 'warn' : 'ok');
    }
  }

  function onTap(idx) {
    if (winner || thinking()) return;
    const state = cur();
    if (state.board[idx] !== EMPTY) return say('빈 자리를 눌러 주세요.');
    const r = play(state, idx);
    if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
    apply(r, state.turn);
    if (!winner) {
      const danger = groupsInAtari(r.state);
      const mineInDanger = danger.some((g) => g.color === state.turn);
      const foeInDanger = danger.some((g) => g.color === r.state.turn);
      say(mineInDanger
        ? '조심해요! ' + (mode === 'ai' ? '내 돌' : colorName(state.turn) + '돌') + '이 단수예요.'
        : foeInDanger ? '단수! ' + colorName(r.state.turn) + '돌의 활로가 하나 남았어요.' : '', mineInDanger ? 'warn' : '');
      if (mode === 'ai') {
        timer = setTimeout(aiMove, 550);
      }
    }
    draw();
    showResult();
  }

  function aiMove() {
    timer = null;
    const state = cur();
    const m = chooseMove(state, { missCapture: 0.2, missEscape: 0.45 });
    if (m < 0) {
      moves.push(pass(state));
      say('돌돌이가 둘 곳이 없어서 한 수 쉬었어요.');
    } else {
      const r = play(state, m);
      apply(r, state.turn);
      if (!winner) {
        const mine = groupsInAtari(r.state).some((g) => g.color === BLACK);
        say(mine ? '조심해요! 내 돌이 단수예요. 빨간 점선을 살펴보세요.' : '돌돌이가 두었어요. 내 차례예요.', mine ? 'warn' : '');
      }
    }
    draw();
    showResult();
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    timer = null;
    moves = [createGame(9)];
    winner = EMPTY;
    lastCaptured = [];
    say(mode === 'ai' ? '내가 흑이에요. 먼저 두어 보세요.' : '흑부터 번갈아 두어요.');
    draw();
    showResult();
  }

  $('undo').addEventListener('click', () => {
    if (moves.length <= 1 || thinking()) return;
    moves.pop();
    if (mode === 'ai') while (moves.length > 1 && cur().turn !== BLACK) moves.pop();
    winner = EMPTY;
    lastCaptured = [];
    say('물렀어요.');
    draw();
    showResult();
  });
  $('reset').addEventListener('click', newGame);
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    if (cur().moveNumber > 0 && !winner && !confirm('지금 두던 판을 지우고 새로 시작할까요?')) return;
    mode = b.dataset.mode;
    newGame();
  }));

  newGame();
}

// ---------------------------------------------------------------- 연습판

function viewPractice() {
  let moves = [createGame(9)];
  let shown = null;
  let showAtari = true;

  try {
    const data = JSON.parse(storage.getItem(PRACTICE_KEY) || 'null');
    const ok = data && Array.isArray(data.history) && data.history.length > 0 && data.history.every(
      (s) => s && Number.isInteger(s.size) && Array.isArray(s.board) && s.board.length === s.size * s.size && s.captures
    );
    if (ok) moves = data.history;
    if (data && typeof data.showAtari === 'boolean') showAtari = data.showAtari;
  } catch (err) {
    // 저장된 내용이 깨졌으면 새 판으로 시작한다.
  }

  root.innerHTML =
    barHtml('자유롭게 두기', '연습판',
      '<div class="sizes" role="group" aria-label="판 크기"><button type="button" data-size="9">9줄</button><button type="button" data-size="13">13줄</button><button type="button" data-size="19">19줄</button></div>') +
    '<section class="status"><div class="turn"><span id="turnStone" class="chip black"></span><strong id="turnText"></strong></div>' +
    '<div class="caps"><span><span class="chip black small"></span>따낸 돌 <b id="capB">0</b></span><span><span class="chip white small"></span>따낸 돌 <b id="capW">0</b></span></div></section>' +
    '<div class="boardwrap"><svg id="board" role="img" aria-label="바둑판"></svg></div>' +
    '<p class="msg" id="msg" role="status" aria-live="polite">교차점을 눌러 돌을 놓아 보세요. 놓인 돌을 누르면 활로를 보여 줘요.</p>' +
    '<div class="controls"><button type="button" id="undo">무르기</button><button type="button" id="passBtn">한 수 쉬기</button><button type="button" id="reset">새 판</button>' +
    '<label class="toggle"><input type="checkbox" id="atari"> 단수 알려주기</label></div>' +
    '<section class="card result" id="result" hidden></section>';

  const view = createBoardView($('board'), onTap);
  const cur = () => moves[moves.length - 1];

  function draw() {
    const state = cur();
    const over = isOver(state);
    const result = over ? score(state) : null;
    view.draw({
      state,
      coords: true,
      atari: showAtari && !over,
      libs: shown ? shown.liberties : [],
      owner: result ? result.owner : null,
      ghost: !over,
    });
    $('turnStone').className = 'chip ' + (state.turn === BLACK ? 'black' : 'white');
    $('turnText').textContent = over ? '대국 끝' : colorName(state.turn) + ' 차례';
    $('capB').textContent = state.captures[BLACK];
    $('capW').textContent = state.captures[WHITE];
    $('undo').disabled = moves.length <= 1;
    $('passBtn').disabled = over;
    document.querySelectorAll('.sizes button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.size)));

    const box = $('result');
    box.hidden = !result;
    if (result) {
      const win = result.winner === EMPTY ? '비겼어요.' : colorName(result.winner) + '이 ' + result.margin + '집 이겼어요.';
      box.innerHTML =
        '<h2>집 세어 보기</h2><table><thead><tr><th></th><th>집</th><th>따낸 돌</th><th>덤</th><th>합계</th></tr></thead><tbody>' +
        '<tr><td>흑</td><td>' + result.territory[BLACK] + '</td><td>' + result.captures[BLACK] + '</td><td>-</td><td><b>' + result.black + '</b></td></tr>' +
        '<tr><td>백</td><td>' + result.territory[WHITE] + '</td><td>' + result.captures[WHITE] + '</td><td>' + result.komi + '</td><td><b>' + result.white + '</b></td></tr>' +
        '</tbody></table><p class="win">' + win + '</p>' +
        '<p class="note">판 위의 돌이 모두 살아 있다고 보고 센 임시 결과예요. 죽은 돌 고르기는 2단원과 함께 넣을 예정이에요.</p>';
    }
    try {
      storage.setItem(PRACTICE_KEY, JSON.stringify({ history: moves.slice(-200), showAtari }));
    } catch (err) {
      // 저장이 막힌 환경에서는 그냥 넘어간다.
    }
  }

  function onTap(idx) {
    const state = cur();
    if (state.board[idx] !== EMPTY) {
      shown = groupAt(state.board, state.size, idx);
      draw();
      const n = shown.liberties.length;
      return say(colorName(shown.color) + '돌 ' + shown.stones.length + '점, 활로는 ' + n + '개예요.' + (n === 1 ? ' 단수예요!' : ''));
    }
    const r = play(state, idx);
    if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
    shown = null;
    moves.push(r.state);
    draw();
    const mover = colorName(state.turn);
    const where = toCoord(state.size, idx);
    if (r.captured.length > 0) {
      say(mover + '이 ' + where + '에 두어 ' + r.captured.length + '점을 따냈어요.' + (r.state.ko >= 0 ? ' 패 모양이에요. 네모 표시 자리는 바로 되따낼 수 없어요.' : ''));
    } else {
      const danger = groupsInAtari(r.state).some((g) => g.color === r.state.turn);
      say(mover + ' ' + where + '.' + (danger ? ' 단수! ' + colorName(r.state.turn) + '돌의 활로가 하나 남았어요.' : ''));
    }
  }

  function newGame(size) {
    moves = [createGame(size)];
    shown = null;
    draw();
    say(size + '줄 새 판이에요. 흑부터 두어요.');
  }

  $('atari').checked = showAtari;
  $('atari').addEventListener('change', (e) => {
    showAtari = e.target.checked;
    draw();
  });
  $('undo').addEventListener('click', () => {
    if (moves.length <= 1) return;
    moves.pop();
    shown = null;
    draw();
    say('한 수 물렀어요.');
  });
  $('passBtn').addEventListener('click', () => {
    const state = cur();
    if (isOver(state)) return;
    const next = pass(state);
    shown = null;
    moves.push(next);
    draw();
    say(isOver(next) ? '두 사람이 연달아 쉬어서 대국이 끝났어요. 아래에서 집을 세어 볼게요.' : colorName(state.turn) + '이 한 수 쉬었어요. 상대도 쉬면 대국이 끝나요.');
  });
  $('reset').addEventListener('click', () => newGame(cur().size));
  document.querySelectorAll('.sizes button').forEach((b) => b.addEventListener('click', () => {
    const size = Number(b.dataset.size);
    if (size === cur().size) return;
    if (cur().moveNumber > 0 && !confirm('지금 두던 판을 지우고 ' + size + '줄 새 판을 시작할까요?')) return;
    newGame(size);
  }));

  draw();
}

window.addEventListener('hashchange', route);
route();
