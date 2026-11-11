// Suara kiosk: nada pendek dari Web Audio (tanpa berkas) dan sapaan lewat speechSynthesis bila tersedia.
let ctx: AudioContext | null = null;
const KEY = 'kiosk.suara';

export function soundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* penyimpanan diblokir, abaikan */ }
  if (!on) window.speechSynthesis?.cancel();
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribeSound(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Browser baru mengizinkan suara setelah ada interaksi pengguna; panggil dari handler sentuh atau klik. */
export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* tanpa Web Audio */ }
}

function tone(freq: number, start: number, dur: number, gain = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime + start;
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function chime(kind: 'ok' | 'late' | 'fail') {
  if (!soundEnabled()) return;
  unlockSound();
  if (kind === 'ok') { tone(660, 0, 0.16); tone(880, 0.14, 0.28); }
  else if (kind === 'late') { tone(660, 0, 0.16); tone(523, 0.14, 0.3); }
  else { tone(300, 0, 0.22, 0.2); tone(220, 0.2, 0.36, 0.2); }
}

export function speak(text: string) {
  if (!soundEnabled() || typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('id'));
  if (v) u.voice = v;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function announceResult(r: { ok: boolean; name?: string; direction: 'IN' | 'OUT'; late?: boolean; message?: string }) {
  if (r.ok) {
    chime(r.late ? 'late' : 'ok');
    const nama = r.name ? `, ${r.name}` : '';
    speak(r.direction === 'IN' ? `Absen masuk berhasil${nama}${r.late ? '. Anda terlambat' : ''}` : `Absen pulang berhasil${nama}`);
  } else {
    chime('fail');
    speak(r.message?.split('.')[0] || 'Absen gagal');
  }
}
