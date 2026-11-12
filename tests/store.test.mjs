import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage, cleanName, STORE_KEY, MAX_PROFILES } from '../src/store.mjs';

test('프로필: 만들면 바로 선택되고 다시 열어도 남아 있다', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  assert.equal(s.current(), null);
  const p = s.addProfile('  가은  ');
  assert.equal(p.name, '가은');
  assert.equal(s.current().id, p.id);

  const again = createStore(storage);
  assert.equal(again.current().name, '가은');
  assert.equal(again.profiles().length, 1);
});

test('프로필: 빈 이름, 같은 이름, 5명 초과는 만들 수 없다', () => {
  const s = createStore(memoryStorage());
  assert.deepEqual(s.addProfile('   '), { error: 'empty' });
  s.addProfile('하나');
  assert.deepEqual(s.addProfile('하나'), { error: 'duplicate' });
  for (const n of ['둘', '셋', '넷', '다섯']) assert.ok(s.addProfile(n).id);
  assert.equal(s.profiles().length, MAX_PROFILES);
  assert.deepEqual(s.addProfile('여섯'), { error: 'full' });
  // 색은 서로 겹치지 않는다
  assert.equal(new Set(s.profiles().map((p) => p.color)).size, MAX_PROFILES);
});

test('프로필: 이름은 8글자까지, 앞뒤 공백 정리', () => {
  assert.equal(cleanName('  바둑을   좋아하는 아이  '), '바둑을 좋아하는');
  assert.equal(cleanName(null), '');
  assert.equal([...cleanName('가나다라마바사아자차')].length, 8);
});

test('프로필: 바꾸기와 지우기', () => {
  const s = createStore(memoryStorage());
  const a = s.addProfile('가');
  const b = s.addProfile('나');
  assert.equal(s.current().id, b.id);
  assert.equal(s.selectProfile(a.id), true);
  assert.equal(s.current().id, a.id);
  assert.equal(s.selectProfile('없음'), false);
  assert.equal(s.removeProfile(a.id), true);
  assert.equal(s.current().id, b.id);
  assert.equal(s.removeProfile(b.id), true);
  assert.equal(s.current(), null);
  assert.equal(s.removeProfile('없음'), false);
  // 지운 뒤 새로 만든 프로필의 id 는 겹치지 않는다
  const c = s.addProfile('다');
  assert.ok(c.id);
});

test('진행도: 프로필마다 따로 저장되고, 별은 가장 좋은 기록을 남긴다', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  const a = s.addProfile('가');
  s.completeLesson('L01', 2);
  s.completeLesson('L01', 1);
  assert.equal(s.starsOf('L01'), 2);
  s.completeLesson('L01', 3);
  assert.equal(s.starsOf('L01'), 3);
  assert.equal(s.isDone('L01'), true);
  assert.equal(s.isDone('L02'), false);
  assert.equal(s.current().last, 'L01');
  s.completeMission('capture-go');
  assert.equal(s.missionDone('capture-go'), true);

  s.addProfile('나');
  assert.equal(s.isDone('L01'), false);
  assert.equal(s.starsOf('L01'), 0);
  assert.equal(s.missionDone('capture-go'), false);

  const again = createStore(storage);
  again.selectProfile(a.id);
  assert.equal(again.starsOf('L01'), 3);
  assert.equal(again.missionDone('capture-go'), true);
});

test('저장: 프로필이 없으면 진행도 기록은 조용히 무시한다', () => {
  const s = createStore(memoryStorage());
  s.completeLesson('L01', 3);
  s.completeMission('capture-go');
  assert.equal(s.isDone('L01'), false);
  assert.equal(s.missionDone('capture-go'), false);
});

test('저장: 깨진 내용이나 막힌 저장소에서도 동작한다', () => {
  const broken = memoryStorage();
  broken.setItem(STORE_KEY, '{이건 JSON 이 아님');
  assert.equal(createStore(broken).profiles().length, 0);

  const wrongShape = memoryStorage();
  wrongShape.setItem(STORE_KEY, JSON.stringify({ version: 1, profiles: [{ id: 1 }] }));
  assert.equal(createStore(wrongShape).profiles().length, 0);

  const blocked = {
    getItem() { throw new Error('막힘'); },
    setItem() { throw new Error('막힘'); },
  };
  const s = createStore(blocked);
  const p = s.addProfile('가');
  assert.equal(p.name, '가');
  s.completeLesson('L01', 3);
  assert.equal(s.starsOf('L01'), 3);
});
