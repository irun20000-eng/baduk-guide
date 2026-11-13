// 돌 소리와 진동. 소리 파일 없이 WebAudio로 그때그때 만든다.
// - 첫 터치·키 입력 전에는 소리를 내지 않는다(브라우저 정책, 갑자기 소리 나지 않게).
// - 설정에서 끄면(soundPrefs.sound = false) 아무 소리도 내지 않는다. 화면이 가려져 있을 때도 내지 않는다.

const soundPrefs = { sound: true, vibrate: true };
const MASTER_VOLUME = 0.22; // 작게
let audioCtx = null;
let userGestured = false;

function markGesture() {
  userGestured = true;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
window.addEventListener('pointerdown', markGesture, { capture: true });
window.addEventListener('keydown', markGesture, { capture: true });

function getAudio() {
  if (!userGestured || !soundPrefs.sound || document.hidden) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try { audioCtx = new AC(); } catch (err) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// 짧은 "딱": 걸러 낸 잡음 한 조각 + 낮은 울림
function clack(ac, t, gainMul) {
  const len = Math.floor(ac.sampleRate * 0.04);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = MASTER_VOLUME * 1.6 * gainMul;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);

  const o = ac.createOscillator();
  const og = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.07);
  og.gain.setValueAtTime(MASTER_VOLUME * 0.8 * gainMul, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(og).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.09);
}

function tone(ac, t, freq, dur, type, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(MASTER_VOLUME * vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const VIBRATE_PATTERN = { place: 8, capture: [12, 40, 12], ok: 16, bad: [24, 50, 24] };

// kind: place(돌 놓기) | capture(따내기) | ok(맞음) | bad(아쉬움)
function playCue(kind) {
  if (soundPrefs.vibrate && userGestured && navigator.vibrate && VIBRATE_PATTERN[kind] !== undefined) {
    try { navigator.vibrate(VIBRATE_PATTERN[kind]); } catch (err) { /* 진동이 막힌 기기 */ }
  }
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  if (kind === 'place') clack(ac, t, 1);
  else if (kind === 'capture') {
    clack(ac, t, 1);
    tone(ac, t + 0.09, 660, 0.09, 'triangle', 0.5);
    tone(ac, t + 0.16, 880, 0.12, 'triangle', 0.5);
  } else if (kind === 'ok') {
    tone(ac, t, 784, 0.12, 'sine', 0.6);
    tone(ac, t + 0.1, 1047, 0.18, 'sine', 0.6);
  } else if (kind === 'bad') {
    tone(ac, t, 247, 0.2, 'triangle', 0.55);
  }
}

function setSoundPrefs(p) {
  soundPrefs.sound = Boolean(p.sound);
  soundPrefs.vibrate = Boolean(p.vibrate);
}

const canVibrate = () => typeof navigator.vibrate === 'function';
