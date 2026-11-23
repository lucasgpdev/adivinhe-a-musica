import { cx } from '../utils';

/** Pacote de figurinhas do jogo (desenhos próprios, sem imagens de terceiros). */
export const STICKERS: { id: string; emoji: string; label: string; from: string; to: string }[] = [
  { id: 'kkkk', emoji: '😂', label: 'KKKKK', from: '#facc15', to: '#f97316' },
  { id: 'acertei', emoji: '🎯', label: 'ACERTEI!', from: '#34d399', to: '#059669' },
  { id: 'errei', emoji: '🤡', label: 'ERREI', from: '#f87171', to: '#b91c1c' },
  { id: 'facil', emoji: '😎', label: 'MUITO FÁCIL', from: '#60a5fa', to: '#4f46e5' },
  { id: 'fogo', emoji: '🔥', label: 'TÔ ON FIRE', from: '#fb923c', to: '#dc2626' },
  { id: 'chorando', emoji: '😭', label: 'NÃO ACREDITO', from: '#93c5fd', to: '#3b82f6' },
  { id: 'pensando', emoji: '🤔', label: 'CONHEÇO ESSA…', from: '#c4b5fd', to: '#7c3aed' },
  { id: 'dancando', emoji: '🕺', label: 'QUE HINO', from: '#f0abfc', to: '#c026d3' },
  { id: 'gg', emoji: '🏆', label: 'GG', from: '#fde047', to: '#ca8a04' },
  { id: 'bora', emoji: '🚀', label: 'BORA!', from: '#5eead4', to: '#0d9488' },
  { id: 'sus', emoji: '🤨', label: 'SUSPEITO', from: '#d4d4d8', to: '#52525b' },
  { id: 'brabo', emoji: '💪', label: 'BRABO', from: '#a78bfa', to: '#6d28d9' },
  { id: 'coracao', emoji: '❤️', label: 'AMEI', from: '#fda4af', to: '#e11d48' },
  { id: 'raiva', emoji: '😡', label: 'AFF', from: '#fca5a5', to: '#991b1b' },
  { id: 'chocado', emoji: '😱', label: 'MEU DEUS', from: '#fdba74', to: '#ea580c' },
  { id: 'dormindo', emoji: '😴', label: 'ACORDA', from: '#a5b4fc', to: '#4338ca' },
];
const BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s]));

export function Sticker({ id, size = 120, className }: { id: string; size?: number; className?: string }) {
  const s = BY_ID[id];
  if (!s) return null;
  return (
    <div
      className={cx('relative flex select-none flex-col items-center justify-center rounded-[28%] border-4 border-white shadow-lg', className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${s.from}, ${s.to})`, transform: 'rotate(-4deg)' }}
      aria-label={`Figurinha: ${s.label}`} role="img"
    >
      <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{s.emoji}</span>
      <span className="mt-1 text-center font-black uppercase leading-none text-white" style={{ fontSize: Math.max(9, size * 0.12), textShadow: '0 2px 0 rgba(0,0,0,.35)' }}>
        {s.label}
      </span>
    </div>
  );
}
