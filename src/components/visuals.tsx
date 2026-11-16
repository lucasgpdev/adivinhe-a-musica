import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { ACHIEVEMENT_BY_ID } from '../achievements/achievements';
import { AVATAR_BY_ID } from '../data/cosmetics';
import { useStore } from '../state/AppStore';
import { cx, fmtNumber } from '../utils';
import { Icon } from './Icon';

export function Avatar({ id, size = 40, ring }: { id: string; size?: number; ring?: boolean }) {
  const a = AVATAR_BY_ID[id] ?? AVATAR_BY_ID.headphones;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full text-white', ring && 'ring-2 ring-white/20 ring-offset-2 ring-offset-ink-900')}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
    >
      <Icon name={a.icon} size={size * 0.48} strokeWidth={2} />
    </span>
  );
}

export function Equalizer({ bars = 5, active = true, className, height = 28 }: { bars?: number; active?: boolean; className?: string; height?: number }) {
  const delays = useMemo(() => Array.from({ length: bars }, (_, i) => ((i * 0.37) % 1).toFixed(2)), [bars]);
  return (
    <span className={cx('inline-flex items-end gap-[3px]', !active && 'paused', className)} style={{ height }} aria-hidden>
      {delays.map((d, i) => (
        <span
          key={i}
          className="eq-bar w-[4px] rounded-full bg-gradient-to-t from-accent-deep via-accent to-accent-soft"
          style={{ height: '100%', animationDelay: `-${d}s`, animationDuration: `${0.8 + ((i * 0.23) % 0.6)}s` }}
        />
      ))}
    </span>
  );
}

export function Logo({ size = 'md', compact }: { size?: 'sm' | 'md' | 'lg'; compact?: boolean }) {
  const s = { sm: 'text-lg', md: 'text-xl', lg: 'text-5xl md:text-7xl' }[size];
  return (
    <span className="inline-flex items-center gap-3">
      <span className={cx('relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep shadow-glow', size === 'lg' ? 'h-16 w-16 md:h-20 md:w-20' : 'h-9 w-9')}>
        <Equalizer bars={4} height={size === 'lg' ? 34 : 16} className="[&>span]:!bg-white [&>span]:!bg-none" />
      </span>
      <span className={cx('h-display leading-none', s, compact && 'hidden sm:inline')}>
        <span className="text-zinc-400">Adivinhe a </span>
        <span className="text-gradient">Música</span>
      </span>
    </span>
  );
}

/** Ondas sonoras animadas — refletem o estado REAL do player (tocando/pausado). */
export function Waveform({ playing, bars = 48 }: { playing: boolean; bars?: number }) {
  const heights = useMemo(() => Array.from({ length: bars }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21))), [bars]);
  return (
    <div className={cx('flex h-20 items-center justify-center gap-[3px]', !playing && 'paused')} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={cx('eq-bar w-[3px] rounded-full md:w-1', playing ? 'bg-gradient-to-t from-accent-deep via-accent to-accent-soft' : 'bg-white/15')}
          style={{ height: `${h * 100}%`, animationDelay: `-${(i * 0.13) % 1.1}s`, animationDuration: `${0.7 + (i % 5) * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function TimerRing({ remaining, total, size = 92 }: { remaining: number; total: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, remaining / total));
  const danger = remaining <= Math.min(3, total * 0.3);
  return (
    <div className={cx('relative', danger && remaining > 0 && 'animate-pulse')} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.08)" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={6} fill="none" strokeLinecap="round"
          stroke={danger ? '#f87171' : 'rgb(var(--accent))'} strokeDasharray={c} strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <span className={cx('h-display absolute inset-0 flex items-center justify-center text-2xl tabular-nums', danger ? 'text-red-300' : 'text-white')}>
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}

export interface PodiumEntry {
  id: string;
  name: string;
  avatar: string;
  value: string | number;
}

export function Podium({ entries, big }: { entries: PodiumEntry[]; big?: boolean }) {
  const order = [entries[1], entries[0], entries[2]];
  const cfg = [
    { h: big ? 'h-40' : 'h-24', color: 'from-silver/40 to-silver/5', ring: '#cfd6e4', place: 2 },
    { h: big ? 'h-56' : 'h-32', color: 'from-gold/50 to-gold/5', ring: '#f5c451', place: 1 },
    { h: big ? 'h-28' : 'h-16', color: 'from-bronze/45 to-bronze/5', ring: '#d08a55', place: 3 },
  ];
  return (
    <div className="flex items-end justify-center gap-3 md:gap-5">
      {order.map((e, i) => (
        <motion.div
          key={i}
          className="flex w-28 flex-col items-center md:w-40"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * [1, 0, 2][i], type: 'spring', stiffness: 120 }}
        >
          {e ? (
            <>
              {cfg[i].place === 1 && <Crown className="mb-1 text-gold drop-shadow-[0_0_12px_rgba(245,196,81,0.6)]" size={big ? 36 : 24} />}
              <span className="rounded-full p-[3px]" style={{ background: cfg[i].ring }}>
                <Avatar id={e.avatar} size={big ? 84 : 52} />
              </span>
              <span className={cx('mt-2 max-w-full truncate text-center font-semibold', big ? 'text-xl' : 'text-sm')}>{e.name}</span>
              <span className={cx('tabular-nums text-zinc-400', big ? 'text-lg' : 'text-xs')}>{typeof e.value === 'number' ? fmtNumber(e.value) : e.value}</span>
            </>
          ) : (
            <span className="mb-2 text-xs text-zinc-600">—</span>
          )}
          <div className={cx('mt-3 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-white/10 bg-gradient-to-b pt-3', cfg[i].h, cfg[i].color)}>
            <span className={cx('h-display', big ? 'text-5xl' : 'text-2xl')} style={{ color: cfg[i].ring }}>{cfg[i].place}º</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Confetes em canvas (desligados quando efeitos estão desativados). */
export function Confetti({ active = true, duration = 5000 }: { active?: boolean; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { data } = useStore();
  useEffect(() => {
    if (!active || !data.settings.effects) return;
    const cv = ref.current!;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize();
    addEventListener('resize', resize);
    const colors = ['#a78bfa', '#8b5cf6', '#f5c451', '#e879f9', '#ffffff', '#c4b5fd'];
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3.5,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25, w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const fade = Math.max(0, 1 - Math.max(0, t - t0 - duration + 1200) / 1200);
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.02;
        if (p.y > cv.height + 20 && t - t0 < duration - 1500) { p.y = -20; p.x = Math.random() * cv.width; p.vy = 2 + Math.random() * 3; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (t - t0 < duration) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, [active, duration, data.settings.effects]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40" aria-hidden />;
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const ach = t.achievementId ? ACHIEVEMENT_BY_ID[t.achievementId] : undefined;
          return (
            <motion.div
              key={t.id} layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
              className={cx(
                'glass-strong pointer-events-auto flex items-center gap-3 p-4',
                t.kind === 'error' && 'border-red-500/30', t.kind === 'success' && 'border-emerald-500/30', ach && 'border-gold/40 shadow-[0_0_40px_-10px_rgba(245,196,81,0.5)]',
              )}
            >
              {ach ? (
                <motion.span initial={{ rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring' }} className="rounded-xl bg-gradient-to-br from-gold to-amber-600 p-2.5 text-ink-950">
                  <Icon name={ach.icon} size={22} />
                </motion.span>
              ) : t.kind === 'achievement' ? <Trophy className="text-gold" /> : null}
              <div className="min-w-0 flex-1">
                {ach && <div className="label !text-gold">Conquista desbloqueada</div>}
                <div className="text-sm font-medium">{ach ? ach.name : t.text}</div>
                {ach && <div className="text-xs text-zinc-400">{t.text}</div>}
              </div>
              <button className="text-zinc-500 hover:text-white" onClick={() => dismissToast(t.id)} aria-label="Fechar"><X size={16} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
