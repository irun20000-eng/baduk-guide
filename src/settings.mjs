// 기기 설정(소리, 진동, 화면 밝기)과 "새로 생긴 것" 안내. 프로필과 상관없이 기기마다 하나.
// storage 는 getItem/setItem 을 가진 객체. 저장이 막혀 있으면 기본값으로 동작한다.

export const APP_VERSION = '1.1.0';
export const SETTINGS_KEY = 'baduk-guide:settings';
export const THEMES = ['auto', 'dark', 'light'];

export const DEFAULT_SETTINGS = Object.freeze({
  sound: true, // 기본은 켬(작은 소리). 첫 터치 전에는 소리를 내지 않는다.
  vibrate: true,
  theme: 'dark', // 기본은 "달밤 대국실"
  seen: '', // "새로 생긴 것"을 마지막으로 보여 준 판
});

// 이번 판에서 새로 생긴 것. 판이 바뀌면 한 번만 보여 준다.
export const WHATS_NEW = [
  { title: '돌 소리와 진동', text: '돌을 놓거나 따낼 때 작은 소리가 나요. 설정에서 끌 수 있어요.' },
  { title: '틀린 문제 다시 풀기', text: '틀리거나 힌트를 본 문제를 모아 두었다가 다시 풀 수 있어요. 한 번에 맞히면 목록에서 빠져요.' },
  { title: '밝은 화면', text: '설정에서 화면을 밝게 바꿀 수 있어요. 기기 설정을 따라가게 할 수도 있어요.' },
  { title: '기록 옮기기', text: '배운 기록을 파일로 내보내고, 다른 기기에서 가져올 수 있어요.' },
  { title: '키보드로 두기', text: '컴퓨터에서는 화살표로 자리를 옮기고 Enter로 돌을 놓아요. P는 한 수 쉬기예요.' },
  { title: '인터넷 없이 열기', text: '주소로 한 번 열어 두면 인터넷이 없어도 다시 열려요.' },
];

export function cleanSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (!s || typeof s !== 'object') return out;
  if (typeof s.sound === 'boolean') out.sound = s.sound;
  if (typeof s.vibrate === 'boolean') out.vibrate = s.vibrate;
  if (THEMES.includes(s.theme)) out.theme = s.theme;
  if (typeof s.seen === 'string' && s.seen.length <= 20) out.seen = s.seen;
  return out;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    return cleanSettings(raw ? JSON.parse(raw) : null);
  } catch (err) {
    return cleanSettings(null);
  }
}

export function saveSettings(storage, s) {
  const clean = cleanSettings(s);
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(clean));
  } catch (err) {
    // 저장이 막혀 있으면 이번 실행 동안만 쓴다.
  }
  return clean;
}

// 실제로 쓸 화면: 'auto' 면 기기 설정(prefersLight)을 따른다.
export function resolveTheme(theme, prefersLight) {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return prefersLight ? 'light' : 'dark';
}

// "새로 생긴 것"을 보여 줄지. 처음 쓰는 사람(프로필 없음)에게는 보여 주지 않고 본 것으로 친다.
export function shouldShowNews(settings, hasProfiles) {
  return Boolean(hasProfiles) && settings.seen !== APP_VERSION;
}
