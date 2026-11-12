// 프로필과 진행도 저장. 기기 안(localStorage)에만 저장하고 밖으로 보내지 않는다.
// storage 는 getItem/setItem 을 가진 객체. 저장이 막힌 환경에서도 앱은 동작한다(저장만 안 됨).

export const STORE_KEY = 'baduk-guide:v1';
export const MAX_PROFILES = 5;
export const MAX_NAME = 8;

function emptyData() {
  return { version: 1, current: null, profiles: [] };
}

function isValid(d) {
  return Boolean(d) && d.version === 1 && Array.isArray(d.profiles) &&
    d.profiles.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.done && typeof p.done === 'object');
}

export function cleanName(name) {
  return [...String(name ?? '').replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('');
}

export function createStore(storage) {
  let data = emptyData();
  try {
    const raw = storage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isValid(parsed)) data = parsed;
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
      const profile = { id: 'p' + n, name: clean, color, done: {}, missions: {}, last: null };
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
