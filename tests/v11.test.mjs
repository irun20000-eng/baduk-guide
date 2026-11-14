// v1.1: 저장 형식 옮기기, 복습 목록, 기록 내보내기·가져오기, 설정, 서비스 워커
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStore, memoryStorage, migrateData, validateBackup, STORE_KEY, STORE_REV, MAX_REVIEW } from '../src/store.mjs';
import { loadSettings, saveSettings, cleanSettings, resolveTheme, shouldShowNews, newsSince, compareVersion, APP_VERSION, SETTINGS_KEY, DEFAULT_SETTINGS, WHATS_NEW } from '../src/settings.mjs';
import { lessonById } from '../src/lessons.mjs';

// v1.0이 실제로 저장하던 모양 (rev 없음, review 없음)
const V10_DATA = {
  version: 1,
  current: 'p2',
  profiles: [
    { id: 'p1', name: '첫째', color: 0, done: { L01: { stars: 3 }, L02: { stars: 2 } }, missions: { M1: true }, last: 'L02' },
    { id: 'p2', name: '둘째', color: 1, done: { L01: { stars: 1 } }, missions: {}, last: 'L01' },
  ],
};

// v1.0 앱의 검사 함수 그대로 (v1.1이 저장한 자료를 v1.0이 읽어도 지워지지 않는지 본다)
function v10IsValid(d) {
  return Boolean(d) && d.version === 1 && Array.isArray(d.profiles) &&
    d.profiles.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.done && typeof p.done === 'object');
}

function storageWith(obj) {
  const s = memoryStorage();
  s.setItem(STORE_KEY, JSON.stringify(obj));
  return s;
}

test('저장 옮기기: v1.0 기록이 그대로 읽히고 복습 목록이 빈 채로 붙는다', () => {
  const store = createStore(storageWith(V10_DATA));
  assert.equal(store.current().id, 'p2');
  assert.equal(store.isDone('L01'), true);
  assert.equal(store.starsOf('L01'), 1);
  store.selectProfile('p1');
  assert.equal(store.starsOf('L01'), 3);
  assert.equal(store.starsOf('L02'), 2);
  assert.equal(store.missionDone('M1'), true);
  assert.deepEqual(store.reviewList(), []);
});

test('저장 옮기기: v1.1이 저장한 자료를 v1.0 앱도 읽을 수 있다 (판을 되돌려도 기록이 남음)', () => {
  const storage = storageWith(V10_DATA);
  const store = createStore(storage);
  store.addReview('L01:3');
  const saved = JSON.parse(storage.getItem(STORE_KEY));
  assert.equal(saved.version, 1);
  assert.equal(saved.rev, STORE_REV);
  assert.equal(v10IsValid(saved), true);
  assert.deepEqual(saved.profiles.find((p) => p.id === 'p2').review, ['L01:3']);
  assert.deepEqual(saved.profiles.find((p) => p.id === 'p1').done, V10_DATA.profiles[0].done);
});

test('저장 옮기기: 망가진 자료는 버리고, 빠진 칸은 채운다', () => {
  assert.equal(migrateData(null), null);
  assert.equal(migrateData({ version: 2, profiles: [] }), null);
  assert.equal(migrateData({ version: 1, profiles: [{ id: 'p1' }] }), null);
  const m = migrateData({ version: 1, current: 'nope', profiles: [{ id: 'p1', name: '가', done: { L01: { stars: 9 }, L02: {} } }] });
  assert.equal(m.current, 'p1');
  assert.deepEqual(m.profiles[0].done, { L01: { stars: 3 }, L02: { stars: 1 } });
  assert.deepEqual(m.profiles[0].missions, {});
  assert.deepEqual(m.profiles[0].review, []);
  // 깨진 JSON 은 빈 자료로 시작
  const s = memoryStorage();
  s.setItem(STORE_KEY, '{망가짐');
  assert.equal(createStore(s).profiles().length, 0);
});

test('복습 목록: 넣기, 같은 문제는 한 번만, 맞히면 빠짐, 프로필마다 따로', () => {
  const store = createStore(memoryStorage());
  store.addProfile('가');
  store.addReview('L03:2');
  store.addReview('L05:1');
  store.addReview('L03:2');
  assert.deepEqual(store.reviewList(), ['L05:1', 'L03:2']);
  assert.equal(store.resolveReview('L05:1'), true);
  assert.equal(store.resolveReview('L05:1'), false);
  assert.deepEqual(store.reviewList(), ['L03:2']);
  store.addProfile('나');
  assert.deepEqual(store.reviewList(), []);
  store.addReview('L01:4');
  const first = store.profiles().find((p) => p.name === '가');
  store.selectProfile(first.id);
  assert.deepEqual(store.reviewList(), ['L03:2']);
  for (let k = 0; k < MAX_REVIEW + 10; k++) store.addReview('L09:' + k);
  assert.equal(store.reviewList().length, MAX_REVIEW);
});

test('복습 목록: 들어가는 열쇠가 실제 차시 걸음을 가리킨다', () => {
  const l = lessonById('L03');
  assert.ok(l && l.steps.length > 1);
});

test('기록 내보내기 → 가져오기: 그대로 돌아온다', () => {
  const a = createStore(storageWith(V10_DATA));
  a.addReview('L02:1');
  const file = JSON.stringify(a.exportBackup(new Date('2026-11-13T00:00:00Z')));
  const parsed = JSON.parse(file);
  assert.equal(parsed.app, 'baduk-guide');
  assert.equal(parsed.kind, 'backup');
  assert.equal(parsed.exportedAt, '2026-11-13T00:00:00.000Z');

  const bStorage = memoryStorage();
  const b = createStore(bStorage);
  b.addProfile('다른 사람');
  const r = b.importBackup(file);
  assert.deepEqual(r, { ok: true, count: 2 });
  assert.deepEqual(b.profiles().map((p) => p.name), ['첫째', '둘째']);
  assert.equal(b.current().id, 'p2');
  assert.deepEqual(b.reviewList(), ['L02:1']);
  // 저장소에도 남아서 다시 열어도 같다
  const again = createStore(bStorage);
  assert.equal(again.profiles().length, 2);
  assert.equal(again.starsOf('L01'), 1);
});

test('기록 가져오기: 잘못된 파일은 거절하고 지금 기록을 건드리지 않는다', () => {
  assert.deepEqual(validateBackup('{망가짐'), { ok: false, error: 'format' });
  assert.deepEqual(validateBackup([]), { ok: false, error: 'format' });
  assert.deepEqual(validateBackup({ app: 'guitar-lesson', kind: 'backup', data: V10_DATA }), { ok: false, error: 'app' });
  assert.deepEqual(validateBackup({ app: 'baduk-guide', kind: 'backup' }), { ok: false, error: 'format' });
  const six = { ...V10_DATA, profiles: Array.from({ length: 6 }, (_, k) => ({ id: 'p' + k, name: '이름' + k, done: {} })) };
  assert.deepEqual(validateBackup({ app: 'baduk-guide', kind: 'backup', data: six }), { ok: false, error: 'too-many' });
  const dup = { ...V10_DATA, profiles: [V10_DATA.profiles[0], { ...V10_DATA.profiles[1], name: '첫째' }] };
  assert.deepEqual(validateBackup({ app: 'baduk-guide', kind: 'backup', data: dup }), { ok: false, error: 'profiles' });
  const longName = { ...V10_DATA, profiles: [{ ...V10_DATA.profiles[0], name: '아주아주긴이름이에요' }] };
  assert.equal(validateBackup({ app: 'baduk-guide', kind: 'backup', data: longName }).ok, false);

  const store = createStore(memoryStorage());
  store.addProfile('그대로');
  const r = store.importBackup({ app: 'nope' });
  assert.equal(r.ok, false);
  assert.deepEqual(store.profiles().map((p) => p.name), ['그대로']);
});

test('설정: 기본값(소리 켬, 진동 켬, 어두운 화면), 잘못된 값은 기본값으로', () => {
  const s = memoryStorage();
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.theme, 'dark');
  saveSettings(s, { sound: false, vibrate: true, theme: 'light', seen: '1.1.0', junk: 1 });
  assert.deepEqual(JSON.parse(s.getItem(SETTINGS_KEY)), { sound: false, vibrate: true, theme: 'light', seen: '1.1.0', coach: true });
  // v1.2: 지도 모드 켜고 끄기도 기억한다
  assert.equal(cleanSettings({ coach: false }).coach, false);
  assert.equal(cleanSettings({ coach: 'no' }).coach, true);
  assert.deepEqual(cleanSettings({ sound: 'yes', theme: 'neon' }), DEFAULT_SETTINGS);
  s.setItem(SETTINGS_KEY, '{망가짐');
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
});

test('설정: 화면 고르기와 새로 생긴 것 안내', () => {
  assert.equal(resolveTheme('auto', true), 'light');
  assert.equal(resolveTheme('auto', false), 'dark');
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(shouldShowNews({ seen: '' }, true), true);
  assert.equal(shouldShowNews({ seen: APP_VERSION }, true), false);
  assert.equal(shouldShowNews({ seen: '' }, false), false, '처음 쓰는 사람에게는 보여 주지 않는다');
  assert.ok(WHATS_NEW.length >= 3 && WHATS_NEW.every((n) => n.title && n.text));
});

test('판 번호: 앱 안 표시와 package.json 이 같다', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, pkg.version);
});


test('새로 생긴 것(v1.1.1): 마지막으로 본 판 뒤의 항목만 보여 준다', () => {
  assert.ok(WHATS_NEW.every((n) => /^\d+\.\d+\.\d+$/.test(n.v)));
  assert.ok(WHATS_NEW.some((n) => n.v === APP_VERSION), '이번 판 항목이 있어야 한다');
  assert.equal(compareVersion('1.1.1', '1.1.0') > 0, true);
  assert.equal(compareVersion('1.10.0', '1.9.0') > 0, true);
  assert.equal(compareVersion('1.1.0', '1.1.0'), 0);
  assert.deepEqual(newsSince('1.1.0').map((n) => n.v), ['1.2.1', '1.2.0', '1.2.0', '1.1.1']);
  assert.deepEqual(newsSince('1.1.1').map((n) => n.v), ['1.2.1', '1.2.0', '1.2.0']);
  assert.equal(newsSince('').length, WHATS_NEW.length);
  assert.equal(newsSince(APP_VERSION).length, 0);
  assert.equal(shouldShowNews({ seen: '1.1.0' }, true), true);
  assert.equal(shouldShowNews({ seen: APP_VERSION }, true), false);
});