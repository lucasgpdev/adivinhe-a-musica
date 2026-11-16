/**
 * Efeitos sonoros sintetizados com Web Audio API (osciladores) —
 * nenhum arquivo de áudio externo é usado para os efeitos.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(v: boolean): void {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  correct() {
    tone(660, 0, 0.14, 'triangle');
    tone(880, 0.09, 0.14, 'triangle');
    tone(1320, 0.18, 0.25, 'triangle', 0.1);
  },
  wrong() {
    tone(220, 0, 0.22, 'sawtooth', 0.06);
    tone(165, 0.14, 0.3, 'sawtooth', 0.06);
  },
  tick() {
    tone(1200, 0, 0.05, 'square', 0.035);
  },
  timeout() {
    tone(330, 0, 0.15, 'square', 0.05);
    tone(247, 0.15, 0.35, 'square', 0.05);
  },
  suspense() {
    tone(392, 0, 0.12, 'sine', 0.06);
    tone(392, 0.25, 0.12, 'sine', 0.06);
    tone(523, 0.5, 0.25, 'sine', 0.08);
  },
  combo() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.06, 0.12, 'triangle', 0.08));
  },
  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.22, 'sine', 0.09));
  },
  fanfare() {
    [523, 523, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 5 ? 0.6 : 0.14, 'triangle', 0.1));
  },
  click() {
    tone(900, 0, 0.03, 'sine', 0.04);
  },
};
