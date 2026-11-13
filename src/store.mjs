// 프로필과 진행도 저장. 기기 안(localStorage)에만 저장하고 밖으로 보내지 않는다.
// storage 는 getItem/setItem 을 가진 객체. 저장이 막힌 환경에서도 앱은 동작한다(저장만 안 됨).

// 저장 형식
// - version: 1 은 그대로 둔다. v1.0 앱도 같은 칸을 읽으므로, 새 칸은 "더하기만" 한다(v1.0은 모르는 칸을 무시함).
// - rev: 자료 개정 번호. 1(v1.0, 칸 없음) → 2(v1.1, 프로필마다 review 목록 추가).
export const STORE_KEY = 'baduk-guide:v1';
export const STORE_REV = 2;
export const MAX_PROFILES = 5;
export const MAX_NAME = 8;
export const MAX_REVIEW = 60;
export const BACKUP_APP = 'baduk-guide';

function emptyData() {
  return { version: 1, rev: STORE_REV, current: null, profiles: [] };
}

function isValid(d) {
  return Boolean(d) && d.version === 1 && Array.isArray(d.profiles) &&
    d.profiles.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.done && typeof p.done === 'object');
}

// 예전 형식(rev 없음)이나 빠진 칸이 있는 자료를 지금 형식으로 맞춘다. 맞출 수 없으면 null.
export function migrateData(d) {
  if (!isValid(d)) return null;
  const profiles = d.profiles.map((p) => {
    const done = {};
    for (const [k, v] of Object.entries(p.done)) {
      const stars = v && Number.isFinite(v.stars) ? Math.max(0, Math.min(3, Math.round(v.stars))) : 1;
      done[k] = { stars };
    }
    const missions = {};
    if (p.missions && typeof p.missions === 'object') for (const [k, v] of Object.entries(p.missions)) if (v) missions[k] = true;
    const review = Array.isArray(p.review) ? [...new Set(p.review.filter((k) => typeof k === 'string' && k.length <= 20))].slice(-MAX_REVIEW) : [];
    return {
      id: p.id, name: p.name,
      color: Number.isInteger(p.color) ? p.color : 0,
      done, missions, review,
      last: typeof p.last === 'string' ? p.last : null,
    };
  });
  const current = profiles.some((p) => p.id === d.current) ? d.current : (profiles[0] ? profiles[0].id : null);
  return { version: 1, rev: STORE_REV, current, profiles };
}

// 기록 파일(내보내기 결과)을 검사한다. { ok: true, data } 또는 { ok: false, error }
// error: 'format'(JSON이 아님·모양이 다름) | 'app'(다른 앱의 파일) | 'profiles'(프로필 자료가 망가짐) | 'too-many'
export function validateBackup(obj) {
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch (err) { return { ok: false, error: 'format' }; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'format' };
  if (obj.app !== BACKUP_APP || obj.kind !== 'backup') return { ok: false, error: 'app' };
  const raw = obj.data;
  if (!raw || !Array.isArray(raw.profiles)) return { ok: false, error: 'format' };
  if (raw.profiles.length > MAX_PROFILES) return { ok: false, error: 'too-many' };
  const data = migrateData(raw);
  if (!data) return { ok: false, error: 'profiles' };
  const ids = new Set();
  const names = new Set();
  for (const p of data.profiles) {
    const clean = cleanName(p.name);
    if (!clean || clean !== p.name || ids.has(p.id) || names.has(p.name)) return { ok: false, error: 'profiles' };
    ids.add(p.id);
    names.add(p.name);
  }
  return { ok: true, data };
}

export function cleanName(name) {
  return [...String(name ?? '').replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('');
}

export function createStore(storage) {
  let data = emptyData();
  try {
    const raw = storage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const migrated = migrateData(parsed);
    if (migrated) data = migrated;
  } catch (err) {
    data = emptyData();
  }

  const save = () => {
    try {
      storage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      // 저장이 막혀 있으면 이번 실행 동안만 기억한다.
    }
  };
  const current = () => data.profiles.find((p) => p.id === data.current) || null;

  return {
    profiles: () => data.profiles.map((p) => ({ ...p })),
    current,

    // 성공하면 프로필, 실패하면 { error: 'empty' | 'full' | 'duplicate' }
    addProfile(name) {
      const clean = cleanName(name);
      if (!clean) return { error: 'empty' };
      if (data.profiles.length >= MAX_PROFILES) return { error: 'full' };
      if (data.profiles.some((p) => p.name === clean)) return { error: 'duplicate' };
      const used = data.profiles.map((p) => Number(p.id.slice(1)) || 0);
      const n = Math.max(0, ...used) + 1;
      const colors = data.profiles.map((p) => p.color);
      let color = 0;
      while (colors.includes(color) && color < MAX_PROFILES) color++;
      const profile = { id: 'p' + n, name: clean, color, done: {}, missions: {}, review: [], last: null };
      data.profiles.push(profile);
      data.current = profile.id;
      save();
      return profile;
    },

    selectProfile(id) {
      if (!data.profiles.some((p) => p.id === id)) return false;
      data.current = id;
      save();
      return true;
    },

    removeProfile(id) {
      const before = data.profiles.length;
      data.profiles = data.profiles.filter((p) => p.id !== id);
      if (data.profiles.length === before) return false;
      if (data.current === id) data.current = data.profiles[0] ? data.profiles[0].id : null;
      save();
      return true;
    },

    // 차시 완료. 별은 가장 좋았던 기록을 남긴다.
    completeLesson(lessonId, stars) {
      const p = current();
      if (!p) return;
      const prev = p.done[lessonId] ? p.done[lessonId].stars : 0;
      p.done[lessonId] = { stars: Math.max(prev, stars) };
      p.last = lessonId;
      save();
    },
    isDone(lessonId) {
      const p = current();
      return Boolean(p && p.done[lessonId]);
    },
    starsOf(lessonId) {
      const p = current();
      return p && p.done[lessonId] ? p.done[lessonId].stars : 0;
    },

    completeMission(missionId) {
      const p = current();
      if (!p) return;
      p.missions = p.missions || {};
      p.missions[missionId] = true;
      save();
    },
    missionDone(missionId) {
      const p = current();
      return Boolean(p && p.missions && p.missions[missionId]);
    },

    // 복습: 틀렸거나 힌트를 본 문제(차시 id + ':' + 걸음 번호). 다시 한 번에 맞히면 빠진다.
    reviewList() {
      const p = current();
      return p ? [...p.review] : [];
    },
    addReview(key) {
      const p = current();
      if (!p || typeof key !== 'string') return;
      p.review = p.review.filter((k) => k !== key);
      p.review.push(key);
      if (p.review.length > MAX_REVIEW) p.review = p.review.slice(-MAX_REVIEW);
      save();
    },
    resolveReview(key) {
      const p = current();
      if (!p || !p.review.includes(key)) return false;
      p.review = p.review.filter((k) => k !== key);
      save();
      return true;
    },

    // 기록 내보내기·가져오기 (파일로 옮기기)
    exportBackup(now = new Date()) {
      return { app: BACKUP_APP, kind: 'backup', exportedAt: now.toISOString(), data: JSON.parse(JSON.stringify(data)) };
    },
    importBackup(obj) {
      const r = validateBackup(obj);
      if (!r.ok) return r;
      data = r.data;
      save();
      return { ok: true, count: data.profiles.length };
    },
  };
}

// 테스트와 저장이 막힌 환경에서 쓰는 메모리 저장소
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}
