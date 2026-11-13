// 화면: 홈(학습 지도), 차시, 문제 묶음, 따내기 바둑, 집 세기, 9줄 대국, 연습판, 용어 사전, 프로필.
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

// ---- 그림 (인라인 SVG) ----
const ICON = {
  back: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 21V4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 5h11l-2.5 3.5L17 12H6z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="15" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="9" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// 안내 캐릭터 돌돌이 (흰 돌). mood: smile | cheer | oops
function dolSvg(mood) {
  const eyes = mood === 'cheer'
    ? '<path d="M13.5 24q3.2-4.2 6.4 0M28.1 24q3.2-4.2 6.4 0" stroke="#1d1d1d" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    : '<circle cx="16.8" cy="23" r="2.7" fill="#1d1d1d"/><circle cx="31.2" cy="23" r="2.7" fill="#1d1d1d"/>';
  const mouth = mood === 'oops'
    ? '<ellipse cx="24" cy="32.5" rx="3" ry="3.4" fill="#1d1d1d"/>'
    : mood === 'cheer'
      ? '<path d="M17 29.5q7 9 14 0z" fill="#1d1d1d"/>'
      : '<path d="M18 30.5q6 5 12 0" stroke="#1d1d1d" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="dolG" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#fff"/><stop offset=".72" stop-color="#ece7dc"/><stop offset="1" stop-color="#c9c2b3"/></radialGradient></defs>' +
    '<ellipse cx="24" cy="43.5" rx="13" ry="2.6" fill="rgba(0,0,0,.28)"/><circle cx="24" cy="24" r="20" fill="url(#dolG)"/>' +
    '<circle cx="11.5" cy="28.5" r="2.6" fill="#f2a79b" opacity=".75"/><circle cx="36.5" cy="28.5" r="2.6" fill="#f2a79b" opacity=".75"/>' + eyes + mouth + '</svg>';
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorName = (c) => (c === BLACK ? '흑' : '백');
const starsHtml = (n, cls) => '<span class="stars ' + (cls || '') + '" role="img" aria-label="별 3개 중 ' + n + '개">' +
  [1, 2, 3].map((k) => '<i class="' + (k <= n ? 'on' : 'off') + '">' + ICON.star + '</i>').join('') + '</span>';

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
let settings = loadSettings(storage);
let leaveView = null; // 화면을 떠날 때 정리할 일 (타이머 등)

// ---------------------------------------------------------------- 설정: 화면 밝기, 소리, 인터넷 없이 열기

const lightQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

function applyTheme() {
  const theme = resolveTheme(settings.theme, Boolean(lightQuery && lightQuery.matches));
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3eee2' : '#101a1f');
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', theme);
}

function updateSettings(patch) {
  settings = saveSettings(storage, { ...settings, ...patch });
  setSoundPrefs(settings);
  applyTheme();
}

setSoundPrefs(settings);
applyTheme();
if (lightQuery && lightQuery.addEventListener) lightQuery.addEventListener('change', applyTheme);

// 주소(http, https)로 열었을 때만 서비스 워커를 올린다. 파일로 열면 원래부터 인터넷이 필요 없다.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

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
  let m = /^#\/lesson\/(L\d+)$/.exec(h);
  if (m) {
    const lesson = lessonById(m[1]);
    if (lesson && store.current() && isUnlocked(lesson)) return viewLesson(lesson);
    return go('#/');
  }
  m = /^#\/quiz\/(Q\d+)$/.exec(h);
  if (m && quizById(m[1])) return viewLesson(quizById(m[1]));
  if (h === '#/capture') return viewCapture();
  if (h === '#/count') return viewCount();
  if (h === '#/game') return viewGame();
  if (h === '#/practice') return viewPractice();
  if (h === '#/terms') return viewTerms();
  if (h === '#/review') {
    const lesson = store.current() ? reviewLesson() : null;
    if (lesson) return viewLesson(lesson);
    return go('#/');
  }
  return viewHome();
}

function barHtml(eyebrow, title, right) {
  return '<header class="bar"><a class="back" href="#/" aria-label="홈으로 돌아가기">' + ICON.back + '</a>' +
    '<div class="bar-title"><span class="eyebrow">' + esc(eyebrow) + '</span><strong>' + esc(title) + '</strong></div>' + (right || '') + '</header>';
}

function say(text, kind) {
  const m = $('msg');
  if (!m) return;
  m.textContent = text || '';
  m.className = 'msg' + (kind ? ' ' + kind : '');
  const dock = $('dock');
  if (dock) dock.className = 'dock' + (dock.dataset.plain ? ' plain' : '') + (kind ? ' ' + kind : '');
  if (kind === 'ok') playCue('ok');
  else if (kind === 'warn') playCue('bad');
}

// 복습 문제 묶음. 열쇠는 '차시 id:걸음 번호'. 자료가 바뀌어 찾을 수 없는 것은 목록에서 뺀다.
function reviewLesson() {
  const keys = [];
  const steps = [];
  for (const key of store.reviewList()) {
    const [lid, n] = key.split(':');
    const src = lessonById(lid) || quizById(lid);
    const step = src && src.steps[Number(n)];
    if (!step || step.type === 'explain') {
      store.resolveReview(key);
      continue;
    }
    keys.push(key);
    steps.push(step);
  }
  if (!steps.length) return null;
  return { id: 'REVIEW', review: true, title: '틀린 문제 다시 풀기', steps, keys, summary: '' };
}

// 판 그림(줄 문자열)을 그대로 그린다. 설명용 작은 판에 쓴다.
function parsedMarks(p, board) {
  const marks = [];
  for (const t of p.targets) if (board[t] !== EMPTY) marks.push({ at: t, shape: 'tri' });
  for (const d of p.dots) marks.push({ at: d, shape: 'dot' });
  for (const c of p.crosses) marks.push({ at: c, shape: 'cross' });
  return marks;
}

// ---- 계가 도우미 (대국, 연습판, 집 세기 미션이 함께 쓴다) ----
function scoreTable(result) {
  const win = result.winner === EMPTY ? '비겼어요.' : colorName(result.winner) + '이 ' + result.margin + '집 이겼어요.';
  return '<table><thead><tr><th></th><th>집</th><th>따낸 돌</th><th>덤</th><th>합계</th></tr></thead><tbody>' +
    '<tr><td><span class="chip black small"></span> 흑</td><td>' + result.territory[BLACK] + '</td><td>' + result.captures[BLACK] + '</td><td>-</td><td><b>' + result.black + '</b></td></tr>' +
    '<tr><td><span class="chip white small"></span> 백</td><td>' + result.territory[WHITE] + '</td><td>' + result.captures[WHITE] + '</td><td>' + result.komi + '</td><td><b>' + result.white + '</b></td></tr>' +
    '</tbody></table><p class="win">' + win + '</p>';
}

function toggleDead(dead, state, idx) {
  if (state.board[idx] === EMPTY) return false;
  const stones = groupAt(state.board, state.size, idx).stones;
  const all = stones.every((s) => dead.has(s));
  for (const s of stones) {
    if (all) dead.delete(s);
    else dead.add(s);
  }
  return true;
}

const deadMarks = (dead) => [...dead].map((at) => ({ at, shape: 'cross' }));

// ---------------------------------------------------------------- 홈

const PATH_STEP = 92;
const PATH_OFFSETS = [0, 40, 56, 40, 0, -40, -56, -40];

function drawPathLines() {
  document.querySelectorAll('.path').forEach((el) => {
    const svg = el.querySelector('.path-line');
    const nodes = [...el.querySelectorAll('.node')];
    const w = el.clientWidth;
    if (!svg || w === 0 || nodes.length === 0) return;
    const pts = nodes.map((n, i) => [w / 2 + PATH_OFFSETS[i % PATH_OFFSETS.length], 32 + i * PATH_STEP]);
    const d = (upto) => pts.slice(0, upto + 1).map((p, i) => {
      if (i === 0) return 'M' + p[0] + ' ' + p[1];
      const q = pts[i - 1];
      return 'C' + q[0] + ' ' + (q[1] + PATH_STEP / 2) + ' ' + p[0] + ' ' + (p[1] - PATH_STEP / 2) + ' ' + p[0] + ' ' + p[1];
    }).join('');
    let reached = -1;
    nodes.forEach((n, i) => { if (n.classList.contains('done') || n.classList.contains('next')) reached = Math.max(reached, i); });
    svg.setAttribute('width', w);
    svg.setAttribute('height', nodes.length * PATH_STEP);
    svg.innerHTML = '<path class="line-base" d="' + d(pts.length - 1) + '"/>' + (reached > 0 ? '<path class="line-done" d="' + d(reached) + '"/>' : '');
  });
}

function viewHome() {
  const me = store.current();
  const next = me ? nextLessonFor() : null;
  const doneCount = LESSONS.filter((l) => store.isDone(l.id)).length;
  const starSum = LESSONS.reduce((a, l) => a + store.starsOf(l.id), 0);
  const missionCount = MISSIONS.filter((m) => store.missionDone(m.id)).length;
  const openMission = MISSIONS.find((m) => !store.missionDone(m.id) && lessonsOfUnit(m.unit).every((l) => store.isDone(l.id)));

  let hero;
  if (!me) {
    hero =
      '<section class="glass hero welcome"><span class="dol">' + dolSvg('smile') + '</span><div class="hero-body"><h2>반가워요. 이름을 알려 주세요</h2>' +
      '<p>이름마다 배운 내용을 따로 기억해요. 이 기기 안에만 저장돼요.</p>' +
      '<form id="firstForm" class="name-form"><input id="firstName" maxlength="' + MAX_NAME + '" placeholder="이름" autocomplete="off" aria-label="이름 (8글자까지)">' +
      '<button class="primary" type="submit">시작하기</button></form><p class="form-err" id="firstErr" role="alert"></p></div></section>';
  } else if (next) {
    const started = doneCount > 0;
    hero =
      '<section class="glass hero"><span class="dol">' + dolSvg('smile') + '</span><div class="hero-body"><p class="eyebrow">' + (started ? '이어서 하기' : '처음 시작하기') + '</p>' +
      '<h2>' + next.no + '차시 ' + esc(next.title) + '</h2><p>' + esc(next.goal) + '</p>' +
      '<a class="primary" href="#/lesson/' + next.id + '">' + (started ? '이어서 하기' : '시작하기') + '</a></div></section>';
  } else if (openMission) {
    hero =
      '<section class="glass hero"><span class="dol">' + dolSvg('cheer') + '</span><div class="hero-body"><p class="eyebrow">차시를 모두 마쳤어요</p>' +
      '<h2>남은 미션: ' + esc(openMission.title) + '</h2><p>' + esc(openMission.text) + '</p>' +
      '<a class="primary" href="' + openMission.route + '">도전하기</a></div></section>';
  } else {
    hero =
      '<section class="glass hero"><span class="dol">' + dolSvg('cheer') + '</span><div class="hero-body"><p class="eyebrow">수료</p>' +
      '<h2>24차시와 미션을 모두 마쳤어요</h2><p>이제 9줄 판에서 마음껏 두어 보세요. 익숙해지면 13줄 판에도 도전해 보세요.</p>' +
      '<a class="primary" href="#/game">한 판 두기</a></div></section>';
  }

  const stats = me
    ? '<div class="stats"><span class="stat"><b>' + doneCount + '</b> / ' + LESSONS.length + ' 차시</span>' +
      '<span class="stat gold"><i class="mini-star">' + ICON.star + '</i><b>' + starSum + '</b> 별</span>' +
      '<span class="stat"><b>' + missionCount + '</b> / ' + MISSIONS.length + ' 미션</span></div>'
    : '';

  const unitHtml = UNITS.map((u) => {
    const lessons = lessonsOfUnit(u.id);
    const mission = missionOfUnit(u.id);
    const done = lessons.filter((l) => store.isDone(l.id)).length;
    const hasNext = next ? next.unit === u.id : false;
    const isOpen = hasNext || (!next && openMission && openMission.unit === u.id) || (!me && u.id === 1);
    const nodes = lessons.map((l, i) => {
      const isDone = store.isDone(l.id);
      const open = Boolean(me) && isUnlocked(l);
      const isNext = next && next.id === l.id;
      const cls = isDone ? 'done' : isNext ? 'next' : 'locked';
      const off = PATH_OFFSETS[i % PATH_OFFSETS.length];
      const label = '<span class="node-label ' + (off > 0 ? 'left' : 'right') + '"><strong>' + esc(l.title) + '</strong>' +
        (isDone ? starsHtml(store.starsOf(l.id)) : isNext ? '<em class="tag go">시작</em>' : '<em class="tag">잠김</em>') + '</span>';
      const dot = '<span class="node-dot">' + (isDone || isNext ? l.no : ICON.lock) + '</span>';
      const style = ' style="--i:' + i + ';--off:' + off + 'px"';
      const name = l.no + '차시 ' + l.title + (isDone ? ', 완료' : isNext ? ', 지금 할 차례' : ', 잠김');
      return open
        ? '<a class="node ' + cls + '" href="#/lesson/' + l.id + '"' + style + ' aria-label="' + esc(name) + '">' + dot + label + '</a>'
        : '<span class="node ' + cls + '"' + style + ' aria-label="' + esc(name) + '">' + dot + label + '</span>';
    });
    const mi = lessons.length;
    const mOff = PATH_OFFSETS[mi % PATH_OFFSETS.length];
    const mDone = store.missionDone(mission.id);
    nodes.push(
      '<a class="node mission ' + (mDone ? 'done' : '') + '" href="' + mission.route + '" style="--i:' + mi + ';--off:' + mOff + 'px" aria-label="미션 ' + esc(mission.title) + (mDone ? ', 완료' : '') + '">' +
      '<span class="node-dot">' + (mDone ? ICON.check : ICON.flag) + '</span>' +
      '<span class="node-label ' + (mOff > 0 ? 'left' : 'right') + '"><strong>' + esc(mission.title) + '</strong><em class="tag ' + (mDone ? 'ok' : 'gold') + '">' + (mDone ? '완료' : '미션') + '</em></span></a>'
    );
    return '<details class="unit"' + (isOpen ? ' open' : '') + '><summary><span class="unit-no">' + u.id + '단원</span>' +
      '<span class="unit-title"><strong>' + esc(u.title) + '</strong><small>' + esc(u.topics) + '</small></span>' +
      '<span class="unit-progress">' + done + ' / ' + lessons.length + '</span></summary>' +
      '<div class="path" style="height:' + nodes.length * PATH_STEP + 'px"><svg class="path-line" aria-hidden="true"></svg>' + nodes.join('') + '</div></details>';
  }).join('');

  const chip = me
    ? '<button type="button" class="profile-chip" id="profileBtn" aria-label="프로필 바꾸기"><span class="avatar c' + me.color + '">' + esc([...me.name][0]) + '</span><span>' + esc(me.name) + '</span></button>'
    : '';
  const gear = '<button type="button" class="icon-btn" id="settingsBtn" aria-label="설정">' + ICON.gear + '</button>';
  const reviewCount = me ? store.reviewList().length : 0;
  const review = reviewCount
    ? '<a class="glass review-card" href="#/review"><span class="review-num" aria-hidden="true">' + reviewCount + '</span>' +
      '<span class="review-body"><strong>틀린 문제 다시 풀기</strong><small>틀렸거나 힌트를 본 문제 ' + reviewCount + '개. 한 번에 맞히면 빠져요</small></span>' +
      '<span class="review-go" aria-hidden="true">' + ICON.next + '</span></a>'
    : '';

  root.innerHTML =
    '<header class="top"><div><h1>바둑 첫걸음</h1><p class="sub">처음 배우는 바둑, 한 걸음씩</p></div><div class="top-actions">' + chip + gear + '</div></header>' +
    hero + stats + review +
    '<h2 class="section-title">학습 지도</h2>' + unitHtml +
    '<h2 class="section-title">자유롭게 두기</h2><div class="play-grid">' +
    '<a class="glass play-card" href="#/game"><strong>9줄 대국</strong><span>돌돌이와, 또는 둘이서 한 판 두고 집 세기</span></a>' +
    '<a class="glass play-card" href="#/capture"><strong>따내기 바둑</strong><span>먼저 한 점 따내면 이기는 짧은 놀이</span></a>' +
    '<a class="glass play-card" href="#/practice"><strong>연습판</strong><span>9줄, 13줄, 19줄 판에서 마음껏 두기</span></a>' +
    '<a class="glass play-card" href="#/terms"><strong>용어 사전</strong><span>배운 바둑 말을 그림으로 다시 보기</span></a></div>' +
    '<footer>v' + APP_VERSION + ' · 24차시 · 인터넷 없이도 열려요</footer>' +
    '<dialog id="profileDialog" aria-label="프로필"></dialog>' +
    '<dialog id="settingsDialog" aria-label="설정"></dialog>' +
    '<dialog id="newsDialog" aria-labelledby="newsTitle"></dialog>';

  drawPathLines();
  const onResize = () => drawPathLines();
  window.addEventListener('resize', onResize);
  leaveView = () => window.removeEventListener('resize', onResize);
  document.querySelectorAll('details.unit').forEach((d) => d.addEventListener('toggle', drawPathLines));

  if (!me) {
    $('firstForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = store.addProfile($('firstName').value);
      if (r.error) $('firstErr').textContent = r.error === 'empty' ? '이름을 한 글자 이상 적어 주세요.' : '그 이름은 쓸 수 없어요.';
      else route();
    });
  } else {
    $('profileBtn').addEventListener('click', openProfiles);
  }
  $('settingsBtn').addEventListener('click', openSettings);

  if (shouldShowNews(settings, store.profiles().length > 0)) openNews();
  else if (settings.seen !== APP_VERSION && !store.profiles().length) updateSettings({ seen: APP_VERSION });
}

function openNews() {
  const dialog = $('newsDialog');
  dialog.innerHTML =
    '<div class="dialog-head"><h2 id="newsTitle">새로 생긴 것 · v' + APP_VERSION + '</h2></div>' +
    '<ul class="news-list">' + WHATS_NEW.map((n) => '<li><strong>' + esc(n.title) + '</strong><span>' + esc(n.text) + '</span></li>').join('') + '</ul>' +
    '<div class="dialog-actions"><button type="button" class="primary" id="newsOk">알겠어요</button></div>';
  const close = () => { updateSettings({ seen: APP_VERSION }); if (dialog.open) dialog.close(); };
  $('newsOk').addEventListener('click', close);
  dialog.addEventListener('cancel', () => updateSettings({ seen: APP_VERSION }), { once: true });
  dialog.showModal();
}

const BACKUP_ERROR = {
  format: '기록 파일이 아니거나 파일이 깨졌어요.',
  app: '바둑 첫걸음에서 내보낸 파일이 아니에요.',
  profiles: '파일 안의 프로필 자료가 올바르지 않아요.',
  'too-many': '프로필이 ' + MAX_PROFILES + '명보다 많아서 가져올 수 없어요.',
};

function downloadBackup() {
  const data = store.exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  a.href = url;
  a.download = '바둑첫걸음_기록_' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return data;
}

function openSettings() {
  const dialog = $('settingsDialog');
  const draw = (note, noteKind) => {
    const themeBtn = (v, label) => '<button type="button" data-theme="' + v + '" aria-pressed="' + (settings.theme === v) + '">' + label + '</button>';
    const vib = canVibrate();
    dialog.innerHTML =
      '<div class="dialog-head"><h2>설정</h2><button type="button" class="text-btn" id="closeSettings">닫기</button></div>' +
      '<section class="set-group"><h3>소리와 진동</h3>' +
      '<label class="toggle set-row"><span>돌 소리와 알림 소리</span><input type="checkbox" id="setSound"' + (settings.sound ? ' checked' : '') + '></label>' +
      '<label class="toggle set-row"><span>진동' + (vib ? '' : ' <small>(이 기기는 진동을 지원하지 않아요)</small>') + '</span><input type="checkbox" id="setVibrate"' + (settings.vibrate ? ' checked' : '') + (vib ? '' : ' disabled') + '></label></section>' +
      '<section class="set-group"><h3>화면</h3><div class="seg theme-seg" role="group" aria-label="화면 밝기">' +
      themeBtn('auto', '기기 설정') + themeBtn('dark', '어둡게') + themeBtn('light', '밝게') + '</div></section>' +
      '<section class="set-group"><h3>기록 옮기기</h3><p class="hint-text">모든 프로필의 배운 기록을 파일 하나로 저장하고, 다른 기기에서 가져올 수 있어요.</p>' +
      '<div class="set-actions"><button type="button" class="ghost-btn" id="exportBtn">기록 내보내기</button>' +
      '<label class="ghost-btn file-btn">기록 가져오기<input type="file" id="importFile" accept="application/json,.json"></label></div>' +
      '<p class="form-msg ' + (noteKind || '') + '" id="setNote" role="status">' + esc(note || '') + '</p></section>' +
      '<p class="set-foot">바둑 첫걸음 v' + APP_VERSION + ' · <button type="button" class="text-btn" id="newsAgain">새로 생긴 것</button></p>';

    $('closeSettings').addEventListener('click', () => dialog.close());
    $('setSound').addEventListener('change', (e) => updateSettings({ sound: e.target.checked }));
    $('setVibrate').addEventListener('change', (e) => updateSettings({ vibrate: e.target.checked }));
    dialog.querySelectorAll('.theme-seg button').forEach((b) => b.addEventListener('click', () => {
      updateSettings({ theme: b.dataset.theme });
      dialog.querySelectorAll('.theme-seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('exportBtn').addEventListener('click', () => {
      const data = downloadBackup();
      draw('프로필 ' + data.data.profiles.length + '명의 기록을 파일로 내보냈어요.', 'ok');
    });
    $('importFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      let text = '';
      try { text = await file.text(); } catch (err) { return draw(BACKUP_ERROR.format, 'warn'); }
      const check = validateBackup(text);
      if (!check.ok) return draw(BACKUP_ERROR[check.error] || BACKUP_ERROR.format, 'warn');
      const names = check.data.profiles.map((p) => p.name).join(', ') || '없음';
      if (!confirm('지금 기기의 기록(프로필 ' + store.profiles().length + '명)을 가져온 기록(프로필 ' + check.data.profiles.length + '명: ' + names + ')으로 바꿀까요? 지금 기록은 사라져요.')) return draw('가져오기를 취소했어요.');
      const r = store.importBackup(check.data ? { app: BACKUP_APP, kind: 'backup', data: check.data } : text);
      if (!r.ok) return draw(BACKUP_ERROR[r.error] || BACKUP_ERROR.format, 'warn');
      dialog.close();
      route();
    });
    $('newsAgain').addEventListener('click', () => { dialog.close(); openNews(); });
  };
  draw();
  dialog.showModal();
}

function openProfiles() {
  const dialog = $('profileDialog');
  const draw = (err) => {
    const list = store.profiles();
    const me = store.current();
    dialog.innerHTML =
      '<div class="dialog-head"><h2>누가 배울까요?</h2><button type="button" class="text-btn" id="closeProfiles">닫기</button></div>' +
      '<ul class="profile-list">' + list.map((p) =>
        '<li class="' + (me && me.id === p.id ? 'on' : '') + '"><button type="button" class="pick" data-id="' + p.id + '">' +
        '<span class="avatar c' + p.color + '">' + esc([...p.name][0]) + '</span><span class="pname">' + esc(p.name) +
        '<small>' + Object.keys(p.done).length + ' / ' + LESSONS.length + '차시</small></span></button>' +
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
      route();
    }));
    dialog.querySelectorAll('.del').forEach((b) => b.addEventListener('click', () => {
      const p = store.profiles().find((x) => x.id === b.dataset.del);
      if (!p || !confirm(p.name + ' 프로필을 지울까요? 배운 기록도 함께 지워져요.')) return;
      store.removeProfile(p.id);
      if (!store.current()) {
        dialog.close();
        route();
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
        route();
      }
    });
  };
  draw();
  dialog.showModal();
}

// ---------------------------------------------------------------- 차시와 문제 묶음

function viewLesson(lesson) {
  const total = lesson.steps.length;
  const eyebrow = lesson.review ? '복습' : lesson.quiz ? lesson.unit + '단원 미션' : lesson.no + '차시';
  let i = 0;
  let mistakes = 0;
  let hints = 0;
  let cleared = 0; // 복습에서 한 번에 맞힌 문제 수
  let S = null; // 지금 걸음의 진행 상태
  let timer = null;
  leaveView = () => { if (timer) clearTimeout(timer); timer = null; };

  root.innerHTML =
    '<div class="lesson-view">' +
    barHtml(eyebrow, lesson.title, '<span class="count" id="stepCount"></span>') +
    '<div class="segs" id="segs" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="' + total + '">' + '<i></i>'.repeat(total) + '</div>' +
    '<div class="boardwrap" id="wrap"><svg class="board" id="board" role="img" aria-label="바둑판"></svg></div>' +
    '<div class="bubble"><span class="dol" id="dol">' + dolSvg('smile') + '</span><p id="stepText" tabindex="-1"></p></div>' +
    '<div class="choices" id="choices"></div>' +
    '<div class="dock" id="dock"><p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="actions"><button type="button" id="hintBtn" class="ghost-btn">힌트</button><button type="button" id="nextBtn" class="primary">다음</button></div></div>' +
    '</div>';

  const view = createBoardView($('board'), onTap);
  $('nextBtn').addEventListener('click', onNext);
  $('hintBtn').addEventListener('click', onHint);

  function draw() {
    const p = S.parsed;
    $('wrap').hidden = !p;
    if (!p) return;
    const type = S.step.type;
    const canPlace = !S.done && !S.busy && ['move', 'free', 'forbidden', 'sequence', 'chase'].includes(type);
    view.draw({
      state: S.state,
      libs: S.libs,
      owner: S.owner,
      marks: parsedMarks(p, S.state.board).concat(S.marks),
      labels: p.labels,
      showLast: S.showLast,
      ghost: canPlace,
    });
  }

  function mood(kind) {
    $('dol').innerHTML = dolSvg(kind);
    $('dol').className = 'dol ' + kind;
  }

  function complete(text) {
    S.done = true;
    S.busy = false;
    say(text || '잘했어요.', 'ok');
    mood('cheer');
    $('nextBtn').disabled = false;
    $('hintBtn').hidden = true;
    draw();
  }

  function miss(text) {
    mistakes++;
    S.flag = true;
    say(text || '아쉬워요. 다시 해 볼까요?', 'warn');
    mood('oops');
  }

  // 지금 두어야 할 자리를 동그라미로 알려 주는 걸음
  function guideMarks() {
    const type = S.step.type;
    if (S.done) return [];
    if (type === 'forbidden') return S.spots.filter((at) => at !== S.parsed.ko).map((at) => ({ at, shape: 'ring' }));
    if (type === 'sequence' && !S.busy) return [{ at: S.line[S.pos], shape: 'ring' }];
    if (type === 'choice' && S.parsed) return S.parsed.answers.map((at) => ({ at, shape: 'ring' }));
    return [];
  }

  function startStep() {
    const step = lesson.steps[i];
    const parsed = step.board ? parseBoard(step.board) : null;
    S = {
      step, parsed,
      state: parsed ? parsed.state : null,
      done: step.type === 'explain',
      busy: false,
      hintLevel: 0,
      libs: [],
      owner: null,
      marks: [],
      showLast: false,
      placed: 0,
      seen: new Set(),
      found: new Set(),
      groups: step.type === 'point' ? pointTargets(step, parsed) : null,
      spots: step.type === 'forbidden' ? parsed.answers.concat(parsed.ko >= 0 ? [parsed.ko] : []) : null,
      line: step.type === 'sequence' ? sequenceLine(step, parsed) : null,
      pos: 0,
      target: step.type === 'chase' ? foeTarget(parsed) : -1,
    };
    S.marks = guideMarks();
    $('stepCount').textContent = (i + 1) + ' / ' + total;
    $('segs').setAttribute('aria-valuenow', String(i));
    [...$('segs').children].forEach((seg, k) => { seg.className = k < i ? 'done' : k === i ? 'now' : ''; });
    $('stepText').textContent = step.text;
    $('nextBtn').disabled = !S.done;
    $('nextBtn').textContent = i === total - 1 ? '마치기' : '다음';
    $('hintBtn').hidden = !(['move', 'count', 'point', 'chase'].includes(step.type) || (step.type === 'choice' && step.hint));
    say('');
    mood('smile');

    const box = $('choices');
    box.textContent = '';
    box.hidden = !(step.type === 'count' || step.type === 'choice');
    if (!box.hidden) {
      box.className = 'choices' + (step.type === 'count' || step.choices.every((c) => String(c).length <= 4) ? ' numbers n' + step.choices.length : '');
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
      if (S.step.check === 'liberties') S.libs = groupAt(S.state.board, S.parsed.size, S.parsed.targets[0]).liberties;
      if (S.step.check === 'territory' || S.step.check === 'owner') S.owner = score(S.state).owner;
      S.marks = [];
      complete(S.step.right);
    } else {
      button.classList.add('wrong');
      button.disabled = true;
      miss(S.step.wrong || (S.step.check === 'liberties' ? '다시 세어 볼까요? 힌트를 누르면 활로를 보여 줘요.' : '다시 생각해 볼까요?'));
    }
  }

  // 상대가 받는 수를 조금 뒤에 둔다
  function later(fn) {
    S.busy = true;
    S.marks = [];
    draw();
    timer = setTimeout(() => {
      timer = null;
      S.busy = false;
      fn();
    }, 520);
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
    if (S.done || S.busy) return;

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

    if (step.type === 'forbidden') {
      if (!S.spots.includes(idx)) return say('표시한 자리에 두어 보세요.');
      const r = play(state, idx);
      if (!r.ok) {
        S.marks = [{ at: idx, shape: 'miss' }];
        complete(step.right);
      }
      return;
    }

    if (step.type === 'sequence') {
      if (idx !== S.line[S.pos]) return say('동그라미 자리에 두어 보세요.');
      S.state = play(state, idx).state;
      S.showLast = true;
      S.pos++;
      if (S.pos >= S.line.length) {
        S.marks = [];
        return complete(step.right);
      }
      say('상대가 받는 수를 기다려요.');
      later(() => {
        S.state = play(S.state, S.line[S.pos]).state;
        S.pos++;
        S.marks = guideMarks();
        say('이제 다음 동그라미 자리에 두어 보세요.');
        draw();
      });
      return;
    }

    if (step.type === 'chase') {
      if (state.board[idx] !== EMPTY) return say('빈 자리를 눌러 주세요.');
      const r = play(state, idx);
      if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
      if (!chaseMoveWins(state, S.target, idx)) {
        S.marks = [{ at: idx, shape: 'miss' }];
        miss(step.wrong);
        draw();
        return;
      }
      S.state = r.state;
      S.showLast = true;
      S.marks = [];
      if (S.state.board[S.target] === EMPTY) return complete(step.right);
      say('좋아요. 상대가 어떻게 받는지 볼까요?', 'ok');
      later(() => {
        const reply = chaseReply(S.state, S.target);
        if (reply >= 0) S.state = play(S.state, reply).state;
        else S.state = pass(S.state);
        say(reply >= 0 ? '상대가 받았어요. 계속 몰아 보세요.' : '상대가 달아날 곳이 없어요. 이제 따내 보세요.');
        draw();
      });
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
        say('잘 찾았어요. ' + left + '군데 더 있어요.', 'ok');
        draw();
      }
    }
  }

  function onHint() {
    if (S.done || S.busy) return;
    const step = S.step;
    if (S.hintLevel < 2) hints++;
    S.hintLevel++;
    S.flag = true;
    if (step.type === 'count') {
      if (step.check === 'liberties') {
        S.libs = groupAt(S.state.board, S.parsed.size, S.parsed.targets[0]).liberties;
        say('초록 점이 활로예요. 하나씩 세어 보세요.');
      } else if (step.check === 'territory') {
        S.owner = score(S.state).owner;
        say('작은 네모가 집이에요. 검은 네모는 흑 집, 흰 네모는 백 집이에요.');
      } else say(step.wrong || '천천히 하나씩 세어 보세요.');
    } else if (step.type === 'move') {
      if (S.hintLevel === 1 && step.hint) say(step.hint);
      else {
        S.marks = S.parsed.answers.map((at) => ({ at, shape: 'ring' }));
        say('초록 동그라미 자리에 두어 보세요.');
      }
    } else if (step.type === 'chase') {
      if (S.hintLevel === 1 && step.hint) say(step.hint);
      else {
        S.marks = chaseWinningMoves(S.state, S.target).slice(0, 1).map((at) => ({ at, shape: 'ring' }));
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

  // 걸음을 떠날 때 복습 목록을 고친다. 틀렸거나 힌트를 보면 넣고, 한 번에 맞히면 뺀다.
  function recordStep() {
    if (!store.current() || S.step.type === 'explain') return;
    const key = lesson.review ? lesson.keys[i] : lesson.id + ':' + i;
    if (S.flag) store.addReview(key);
    else if (store.resolveReview(key) && lesson.review) cleared++;
  }

  function onNext() {
    if (!S.done) return;
    recordStep();
    i++;
    if (i >= total) return finish();
    startStep();
    $('stepText').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function finish() {
    if (lesson.review) return finishReview();
    const stars = starsFor(mistakes, hints);
    let nextBtn;
    if (lesson.quiz) {
      store.completeMission(lesson.id);
      nextBtn = '<a class="primary" href="#/">학습 지도로</a>';
    } else {
      store.completeLesson(lesson.id, stars);
      const idx = LESSONS.indexOf(lesson);
      const next = LESSONS[idx + 1] && LESSONS[idx + 1].unit === lesson.unit ? LESSONS[idx + 1] : null;
      const mission = missionOfUnit(lesson.unit);
      nextBtn = next
        ? '<a class="primary" href="#/lesson/' + next.id + '">다음: ' + next.no + '차시 ' + esc(next.title) + '</a>'
        : '<a class="primary" href="' + mission.route + '">미션: ' + esc(mission.title) + '</a>';
    }
    const praise = stars === 3 ? '한 번도 틀리지 않았어요' : stars === 2 ? '아주 잘했어요' : '끝까지 해냈어요';
    root.innerHTML =
      '<div class="lesson-view">' + barHtml(eyebrow, lesson.title) +
      '<div class="segs">' + '<i class="done"></i>'.repeat(total) + '</div>' +
      '<section class="glass finish"><span class="dol big cheer">' + dolSvg('cheer') + '</span>' + starsHtml(stars, 'big') +
      '<h2>' + (lesson.quiz ? '미션을 마쳤어요' : lesson.no + '차시를 마쳤어요') + '</h2><p class="praise">' + praise + '</p>' +
      '<p class="summary">' + esc(lesson.summary) + '</p>' +
      '<div class="finish-actions">' + nextBtn + (lesson.quiz ? '' : '<a class="ghost-btn" href="#/">학습 지도로</a>') +
      '<button type="button" class="text-btn" id="again">다시 하기</button></div></section></div>';
    $('again').addEventListener('click', () => viewLesson(lesson));
    window.scrollTo(0, 0);
  }

  function finishReview() {
    const left = store.reviewList().length;
    root.innerHTML =
      '<div class="lesson-view">' + barHtml(eyebrow, lesson.title) +
      '<div class="segs">' + '<i class="done"></i>'.repeat(total) + '</div>' +
      '<section class="glass finish"><span class="dol big cheer">' + dolSvg('cheer') + '</span>' +
      '<h2>복습을 마쳤어요</h2><p class="praise">' + total + '문제 가운데 ' + cleared + '문제를 한 번에 맞혔어요</p>' +
      '<p class="summary">' + (left ? '아직 ' + left + '문제가 남아 있어요. 내일 다시 풀어 봐도 좋아요.' : '틀린 문제를 모두 풀었어요. 복습 목록이 비었어요.') + '</p>' +
      '<div class="finish-actions"><a class="primary" href="#/">학습 지도로</a>' +
      (left ? '<button type="button" class="text-btn" id="again">남은 문제 다시 풀기</button>' : '') + '</div></section></div>';
    if (left) $('again').addEventListener('click', () => { const l = reviewLesson(); if (l) viewLesson(l); else go('#/'); });
    window.scrollTo(0, 0);
  }

  startStep();
}

// ---------------------------------------------------------------- 따내기 바둑 (1단원 미션)

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
    '<section class="glass status"><div class="turn"><span id="turnStone" class="chip black"></span><strong id="turnText"></strong></div><span class="rule">한 점이라도 먼저 따내면 이겨요</span></section>' +
    '<div class="boardwrap"><svg class="board" id="board" role="img" aria-label="9줄 바둑판"></svg></div>' +
    '<div class="dock plain" id="dock" data-plain="1"><p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="controls"><button type="button" id="undo">무르기</button><button type="button" id="reset">새 판</button></div></div>' +
    '<section class="glass result" id="result" hidden></section>';

  const view = createBoardView($('board'), onTap);
  const cur = () => moves[moves.length - 1];
  const thinking = () => timer !== null;
  leaveView = () => { if (timer) clearTimeout(timer); timer = null; };

  function draw() {
    const state = cur();
    view.draw({ state, atari: !winner, marks: lastCaptured.map((at) => ({ at, shape: 'ring' })), ghost: !winner && !thinking() });
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
    const title = mode === 'ai' ? (winner === BLACK ? '이겼어요. 먼저 따냈어요' : '돌돌이가 먼저 따냈어요') : colorName(winner) + '이 먼저 따냈어요';
    const text = mode === 'ai'
      ? (winner === BLACK ? '상대 돌의 활로를 모두 막았어요. 미션을 마쳤어요.' : '내 돌이 단수(빨간 점선)인지 살피면서 다시 도전해 보세요.')
      : colorName(winner) + ' 승리. 한 판 더 두어 볼까요?';
    box.hidden = false;
    box.innerHTML = '<h2>' + title + '</h2><p>' + text + '</p><div class="finish-actions"><button type="button" class="primary" id="again">한 판 더</button><a class="ghost-btn" href="#/">학습 지도로</a></div>';
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
        ? '조심해요. ' + (mode === 'ai' ? '내 돌' : colorName(state.turn) + '돌') + '이 단수예요.'
        : foeInDanger ? '단수. ' + colorName(r.state.turn) + '돌의 활로가 하나 남았어요.' : '', mineInDanger ? 'warn' : '');
      if (mode === 'ai') timer = setTimeout(aiMove, 550);
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
        say(mine ? '조심해요. 내 돌이 단수예요. 빨간 점선을 살펴보세요.' : '돌돌이가 두었어요. 내 차례예요.', mine ? 'warn' : '');
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

// ---------------------------------------------------------------- 집 세기 (2단원 미션)

function viewCount() {
  const mission = missionOfUnit(2);
  const parsed = parseBoard({ rows: COUNT_BOARD.rows, komi: COUNT_BOARD.komi });
  const state = parsed.state;
  const expected = new Set(parsed.targets);
  const dead = new Set();
  let finished = false;
  let hinted = false;

  root.innerHTML =
    barHtml('2단원 미션', '집 세기') +
    '<div class="bubble"><span class="dol">' + dolSvg('smile') + '</span><p>대국이 끝난 판이에요. 상대 집 안에 갇혀서 살 수 없는 돌(죽은 돌)을 눌러서 골라내 보세요. 다 골랐으면 집 세기를 눌러요.</p></div>' +
    '<div class="boardwrap"><svg class="board" id="board" role="img" aria-label="끝난 9줄 판"></svg></div>' +
    '<section class="glass result" id="result"></section>' +
    '<div class="dock" id="dock"><p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="actions"><button type="button" id="hintBtn" class="ghost-btn">힌트</button><button type="button" id="doneBtn" class="primary">집 세기</button></div></div>';

  const view = createBoardView($('board'), (idx) => {
    if (finished) return;
    if (!toggleDead(dead, state, idx)) return say('돌을 눌러 주세요.');
    hinted = false;
    draw();
    say(dead.size ? '가위표가 붙은 돌은 죽은 돌로 세요. 다시 누르면 취소돼요.' : '');
  });

  function draw() {
    const result = score(state, [...dead]);
    const rings = hinted ? [...expected].filter((at) => !dead.has(at)).map((at) => ({ at, shape: 'ring' })) : [];
    view.draw({ state, owner: result.owner, marks: deadMarks(dead).concat(rings), showLast: false });
    $('result').innerHTML = '<h2>' + (finished ? '결과' : '지금까지 센 집') + '</h2>' + scoreTable(result) +
      (finished ? '<div class="finish-actions"><a class="primary" href="#/">학습 지도로</a></div>' : '<p class="note">작은 네모가 집이에요. 죽은 돌을 골라내면 집이 늘어나요.</p>');
  }

  $('hintBtn').addEventListener('click', () => {
    hinted = true;
    draw();
    say('초록 동그라미가 있는 돌을 살펴보세요. 둘레가 모두 상대 돌이에요.');
  });
  $('doneBtn').addEventListener('click', () => {
    const same = dead.size === expected.size && [...expected].every((at) => dead.has(at));
    if (!same) {
      return say(dead.size < expected.size
        ? '아직 죽은 돌이 남아 있어요. 상대 집 안에 홀로 있는 돌을 찾아보세요.'
        : '살아 있는 돌을 고른 것 같아요. 집을 둘러싼 돌은 살아 있는 돌이에요.', 'warn');
    }
    finished = true;
    if (store.current()) store.completeMission(mission.id);
    $('hintBtn').hidden = true;
    $('doneBtn').hidden = true;
    draw();
    say('맞게 세었어요. 죽은 돌은 따낸 돌에 더하고, 그 자리는 집이 돼요.', 'ok');
    $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  draw();
}

// ---------------------------------------------------------------- 9줄 대국 (5단원 미션)

function viewGame() {
  const mission = missionOfUnit(5);
  let mode = 'ai';
  let moves = [createGame(9)];
  let phase = 'play'; // play | score | done
  let dead = new Set();
  let timer = null;

  root.innerHTML =
    barHtml('5단원 미션', '9줄 대국') +
    '<div class="seg" role="group" aria-label="상대 고르기"><button type="button" data-mode="ai" aria-pressed="true">돌돌이와 두기</button><button type="button" data-mode="two" aria-pressed="false">둘이서 두기</button></div>' +
    '<section class="glass status"><div class="turn"><span id="turnStone" class="chip black"></span><strong id="turnText"></strong></div>' +
    '<div class="caps"><span><span class="chip black small"></span>따낸 돌 <b id="capB">0</b></span><span><span class="chip white small"></span>따낸 돌 <b id="capW">0</b></span></div></section>' +
    '<div class="boardwrap"><svg class="board" id="board" role="img" aria-label="9줄 바둑판"></svg></div>' +
    '<div class="dock plain" id="dock" data-plain="1"><p class="msg" id="msg" role="status" aria-live="polite"></p>' +
    '<div class="controls"><button type="button" id="undo">무르기</button><button type="button" id="passBtn">한 수 쉬기</button><button type="button" id="reset">새 판</button></div></div>' +
    '<section class="glass result" id="result" hidden></section>';

  const view = createBoardView($('board'), onTap);
  const cur = () => moves[moves.length - 1];
  const thinking = () => timer !== null;
  leaveView = () => { if (timer) clearTimeout(timer); timer = null; };

  function draw() {
    const state = cur();
    const playing = phase === 'play';
    const result = playing ? null : score(state, [...dead]);
    view.draw({
      state,
      atari: playing,
      owner: result ? result.owner : null,
      marks: playing ? [] : deadMarks(dead),
      ghost: playing && !thinking(),
    });
    $('turnStone').className = 'chip ' + (state.turn === BLACK ? 'black' : 'white');
    const who = mode === 'ai' ? (state.turn === BLACK ? '내 차례 (흑)' : '돌돌이 차례 (백)') : colorName(state.turn) + ' 차례';
    $('turnText').textContent = playing ? who : phase === 'score' ? '집 세는 중' : '대국 끝';
    $('capB').textContent = state.captures[BLACK];
    $('capW').textContent = state.captures[WHITE];
    $('undo').disabled = !playing || moves.length <= 1 || thinking();
    $('passBtn').disabled = !playing || thinking();
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

    const box = $('result');
    box.hidden = playing;
    if (!playing) {
      box.innerHTML = '<h2>' + (phase === 'done' ? '결과' : '집 세기') + '</h2>' + scoreTable(result) +
        (phase === 'score'
          ? '<p class="note">가위표가 붙은 돌은 죽은 돌로 골라 본 거예요. 다르면 돌을 눌러서 고쳐요.</p><div class="finish-actions"><button type="button" class="primary" id="confirmScore">이대로 집 세기 끝</button></div>'
          : '<div class="finish-actions"><button type="button" class="primary" id="again">한 판 더</button><a class="ghost-btn" href="#/">학습 지도로</a></div>');
      const c = $('confirmScore');
      if (c) c.addEventListener('click', () => {
        phase = 'done';
        if (store.current()) store.completeMission(mission.id);
        const win = result.winner;
        say(mode === 'ai'
          ? (win === BLACK ? '이겼어요. 한 판을 끝까지 두고 집까지 세었어요.' : '아쉽게 졌어요. 그래도 한 판을 끝까지 두고 집까지 세었어요.')
          : colorName(win) + '이 이겼어요. 한 판을 끝까지 두었어요.', 'ok');
        draw();
      });
      const a = $('again');
      if (a) a.addEventListener('click', newGame);
    }
  }

  function enterScore() {
    phase = 'score';
    dead = new Set(suggestDead(cur()));
    say('두 사람이 연달아 쉬어서 대국이 끝났어요. 이제 집을 세요.', 'ok');
    draw();
    $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function afterMove() {
    if (isOver(cur())) return enterScore();
    if (mode === 'ai' && cur().turn === WHITE) {
      timer = setTimeout(aiMove, 550);
    }
    draw();
  }

  function onTap(idx) {
    const state = cur();
    if (phase === 'score') {
      if (toggleDead(dead, state, idx)) draw();
      return;
    }
    if (phase !== 'play' || thinking()) return;
    if (state.board[idx] !== EMPTY) return say('빈 자리를 눌러 주세요.');
    const r = play(state, idx);
    if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
    moves.push(r.state);
    const mine = groupsInAtari(r.state).some((g) => g.color === state.turn);
    say(r.captured.length ? colorName(state.turn) + '이 ' + r.captured.length + '점을 따냈어요.' : mine ? '조심해요. ' + (mode === 'ai' ? '내 돌' : colorName(state.turn) + '돌') + '이 단수예요.' : '', r.captured.length ? 'ok' : mine ? 'warn' : '');
    afterMove();
  }

  function aiMove() {
    timer = null;
    const state = cur();
    const m = chooseGameMove(state, { missCapture: 0.15, missEscape: 0.3 });
    if (m < 0) {
      moves.push(pass(state));
      if (!isOver(cur())) say('돌돌이가 한 수 쉬었어요. 더 둘 곳이 없으면 나도 쉬어요.');
    } else {
      const r = play(state, m);
      moves.push(r.state);
      const mine = groupsInAtari(r.state).some((g) => g.color === BLACK);
      say(r.captured.length ? '돌돌이가 ' + r.captured.length + '점을 따냈어요.' : mine ? '조심해요. 내 돌이 단수예요.' : '돌돌이가 두었어요. 내 차례예요.', r.captured.length || mine ? 'warn' : '');
    }
    afterMove();
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    timer = null;
    moves = [createGame(9)];
    phase = 'play';
    dead = new Set();
    say(mode === 'ai' ? '내가 흑이에요. 귀부터 차지해 보세요. 백에게는 덤 6집 반이 있어요.' : '흑부터 번갈아 두어요. 백에게는 덤 6집 반이 있어요.');
    draw();
  }

  $('undo').addEventListener('click', () => {
    if (phase !== 'play' || moves.length <= 1 || thinking()) return;
    moves.pop();
    if (mode === 'ai') while (moves.length > 1 && cur().turn !== BLACK) moves.pop();
    say('물렀어요.');
    draw();
  });
  $('passBtn').addEventListener('click', () => {
    if (phase !== 'play' || thinking()) return;
    const state = cur();
    moves.push(pass(state));
    say(colorName(state.turn) + '이 한 수 쉬었어요.');
    afterMove();
  });
  $('reset').addEventListener('click', () => {
    if (phase === 'play' && cur().moveNumber > 0 && !confirm('지금 두던 판을 지우고 새로 시작할까요?')) return;
    newGame();
  });
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    if (phase === 'play' && cur().moveNumber > 0 && !confirm('지금 두던 판을 지우고 새로 시작할까요?')) return;
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
  let dead = new Set();

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
    '<section class="glass status"><div class="turn"><span id="turnStone" class="chip black"></span><strong id="turnText"></strong></div>' +
    '<div class="caps"><span><span class="chip black small"></span>따낸 돌 <b id="capB">0</b></span><span><span class="chip white small"></span>따낸 돌 <b id="capW">0</b></span></div></section>' +
    '<div class="boardwrap"><svg class="board" id="board" role="img" aria-label="바둑판"></svg></div>' +
    '<div class="dock plain" id="dock" data-plain="1"><p class="msg" id="msg" role="status" aria-live="polite">교차점을 눌러 돌을 놓아 보세요. 놓인 돌을 누르면 활로를 보여 줘요.</p>' +
    '<div class="controls"><button type="button" id="undo">무르기</button><button type="button" id="passBtn">한 수 쉬기</button><button type="button" id="reset">새 판</button>' +
    '<label class="toggle"><input type="checkbox" id="atari"> 단수 알려주기</label></div></div>' +
    '<section class="glass result" id="result" hidden></section>';

  const view = createBoardView($('board'), onTap);
  const cur = () => moves[moves.length - 1];

  function draw() {
    const state = cur();
    const over = isOver(state);
    const result = over ? score(state, [...dead]) : null;
    view.draw({
      state,
      coords: true,
      atari: showAtari && !over,
      libs: shown ? shown.liberties : [],
      owner: result ? result.owner : null,
      marks: over ? deadMarks(dead) : [],
      ghost: !over,
    });
    $('turnStone').className = 'chip ' + (state.turn === BLACK ? 'black' : 'white');
    $('turnText').textContent = over ? '집 세는 중' : colorName(state.turn) + ' 차례';
    $('capB').textContent = state.captures[BLACK];
    $('capW').textContent = state.captures[WHITE];
    $('undo').disabled = moves.length <= 1;
    $('passBtn').disabled = over;
    document.querySelectorAll('.sizes button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.size)));

    const box = $('result');
    box.hidden = !result;
    if (result) {
      box.innerHTML = '<h2>집 세어 보기</h2>' + scoreTable(result) +
        '<p class="note">가위표가 붙은 돌은 죽은 돌로 골라 본 거예요. 다르면 돌을 눌러서 고쳐요.</p>';
    }
    try {
      storage.setItem(PRACTICE_KEY, JSON.stringify({ history: moves.slice(-200), showAtari }));
    } catch (err) {
      // 저장이 막힌 환경에서는 그냥 넘어간다.
    }
  }

  function onTap(idx) {
    const state = cur();
    if (isOver(state)) {
      if (toggleDead(dead, state, idx)) draw();
      return;
    }
    if (state.board[idx] !== EMPTY) {
      shown = groupAt(state.board, state.size, idx);
      draw();
      const n = shown.liberties.length;
      return say(colorName(shown.color) + '돌 ' + shown.stones.length + '점, 활로는 ' + n + '개예요.' + (n === 1 ? ' 단수예요.' : ''));
    }
    const r = play(state, idx);
    if (!r.ok) return say(REASON_TEXT[r.reason], 'warn');
    shown = null;
    moves.push(r.state);
    draw();
    const mover = colorName(state.turn);
    const where = toCoord(state.size, idx);
    if (r.captured.length > 0) {
      say(mover + '이 ' + where + '에 두어 ' + r.captured.length + '점을 따냈어요.' + (r.state.ko >= 0 ? ' 패 모양이에요. 네모 표시 자리는 바로 되따낼 수 없어요.' : ''), 'ok');
    } else {
      const danger = groupsInAtari(r.state).some((g) => g.color === r.state.turn);
      say(mover + ' ' + where + '.' + (danger ? ' 단수. ' + colorName(r.state.turn) + '돌의 활로가 하나 남았어요.' : ''));
    }
  }

  function newGame(size) {
    moves = [createGame(size)];
    shown = null;
    dead = new Set();
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
    dead = new Set();
    draw();
    say('한 수 물렀어요.');
  });
  $('passBtn').addEventListener('click', () => {
    const state = cur();
    if (isOver(state)) return;
    const next = pass(state);
    shown = null;
    moves.push(next);
    if (isOver(next)) dead = new Set(suggestDead(next));
    draw();
    say(isOver(next) ? '두 사람이 연달아 쉬어서 대국이 끝났어요. 아래에서 집을 세어 볼게요.' : colorName(state.turn) + '이 한 수 쉬었어요. 상대도 쉬면 대국이 끝나요.');
    if (isOver(next)) $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('reset').addEventListener('click', () => newGame(cur().size));
  document.querySelectorAll('.sizes button').forEach((b) => b.addEventListener('click', () => {
    const size = Number(b.dataset.size);
    if (size === cur().size) return;
    if (cur().moveNumber > 0 && !confirm('지금 두던 판을 지우고 ' + size + '줄 새 판을 시작할까요?')) return;
    newGame(size);
  }));

  if (isOver(cur())) dead = new Set(suggestDead(cur()));
  draw();
}

// ---------------------------------------------------------------- 용어 사전

function viewTerms() {
  root.innerHTML =
    barHtml('다시 보기', '용어 사전') +
    '<div class="terms">' + GLOSSARY.map((g, i) =>
      '<article class="glass term">' + (g.rows ? '<div class="boardwrap mini"><svg class="board" data-term="' + i + '" role="img" aria-label="' + esc(g.term) + ' 그림"></svg></div>' : '') +
      '<div class="term-body"><h2>' + esc(g.term) + '</h2><p>' + esc(g.text) + '</p></div></article>'
    ).join('') + '</div>';
  document.querySelectorAll('svg[data-term]').forEach((svg) => {
    const p = parseBoard({ rows: GLOSSARY[Number(svg.dataset.term)].rows });
    createBoardView(svg, null).draw({ state: p.state, marks: parsedMarks(p, p.state.board), showLast: false });
  });
}

window.addEventListener('hashchange', route);
route();
