// 기기 설정(소리, 진동, 화면 밝기)과 "새로 생긴 것" 안내. 프로필과 상관없이 기기마다 하나.
// storage 는 getItem/setItem 을 가진 객체. 저장이 막혀 있으면 기본값으로 동작한다.

export const APP_VERSION = '1.2.1';
export const SETTINGS_KEY = 'baduk-guide:settings';
export const THEMES = ['auto', 'dark', 'light'];

export const DEFAULT_SETTINGS = Object.freeze({
  sound: true, // 기본은 켬(작은 소리). 첫 터치 전에는 소리를 내지 않는다.
  vibrate: true,
  theme: 'dark', // 기본은 "달밤 대국실"
  seen: '', // "새로 생긴 것"을 마지막으로 보여 준 판
  coach: true, // 9줄 대국의 지도 모드 (둘 때마다 선생님이 한 마디)
});

// 판마다 새로 생긴 것. 마지막으로 본 판보다 새 판의 항목만 한 번 보여 준다.
export const WHATS_NEW = [
  { v: '1.2.1', title: '큰 판에서 대국', text: '대국에서 9줄, 13줄, 19줄 판을 고를 수 있어요. 지도 모드, 힌트, 복기도 큰 판에서 함께 써요.' },
  { v: '1.2.0', title: '지도 모드', text: '9줄 대국에서 지도 모드를 켜면 내가 둘 때마다 선생님이 좋은 수인지, 더 나은 곳은 어디인지, 전문가는 어떻게 생각하는지 알려 줘요. 힌트 버튼으로 둘 만한 곳 세 개도 볼 수 있어요.' },
  { v: '1.2.0', title: '선생님과 복기하기', text: '대국이 끝나면 내가 둔 수를 하나씩 다시 읽어서, 가장 아쉬웠던 장면, 고칠 습관, 다시 볼 차시, 다음 판 목표를 정리해 줘요.' },
  { v: '1.1.1', title: '소리 들어 보기, 더 잘 보이는 좌표', text: '설정에서 돌 소리를 미리 들어 볼 수 있어요. 바둑판 좌표 글자를 더 진하고 크게 했어요.' },
  { v: '1.1.0', title: '돌 소리와 진동', text: '돌을 놓거나 따낼 때 작은 소리가 나요. 설정에서 끌 수 있어요.' },
  { v: '1.1.0', title: '틀린 문제 다시 풀기', text: '틀리거나 힌트를 본 문제를 모아 두었다가 다시 풀 수 있어요. 한 번에 맞히면 목록에서 빠져요.' },
  { v: '1.1.0', title: '밝은 화면', text: '설정에서 화면을 밝게 바꿀 수 있어요. 기기 설정을 따라가게 할 수도 있어요.' },
  { v: '1.1.0', title: '기록 옮기기', text: '배운 기록을 파일로 내보내고, 다른 기기에서 가져올 수 있어요.' },
  { v: '1.1.0', title: '키보드로 두기', text: '컴퓨터에서는 화살표로 자리를 옮기고 Enter로 돌을 놓아요. P는 한 수 쉬기예요.' },
  { v: '1.1.0', title: '인터넷 없이 열기', text: '주소로 한 번 열어 두면 인터넷이 없어도 다시 열려요.' },
];

export function cleanSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (!s || typeof s !== 'object') return out;
  if (typeof s.sound === 'boolean') out.sound = s.sound;
  if (typeof s.vibrate === 'boolean') out.vibrate = s.vibrate;
  if (THEMES.includes(s.theme)) out.theme = s.theme;
  if (typeof s.seen === 'string' && s.seen.length <= 20) out.seen = s.seen;
  if (typeof s.coach === 'boolean') out.coach = s.coach;
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
export function compareVersion(a, b) {
  const pa = String(a || '0').split('.').map((n) => Number(n) || 0);
  const pb = String(b || '0').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// 마지막으로 본 판(seen) 뒤에 생긴 항목. seen 이 비어 있으면(v1.0에서 올라옴) 전부.
export function newsSince(seen) {
  return WHATS_NEW.filter((n) => !seen || compareVersion(n.v, seen) > 0);
}

export function shouldShowNews(settings, hasProfiles) {
  return Boolean(hasProfiles) && newsSince(settings.seen).length > 0;
}
