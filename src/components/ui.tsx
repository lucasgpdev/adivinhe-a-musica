import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { sfx } from '../audio/sfx';
import { cx } from '../utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  variant = 'secondary', size = 'md', className, children, icon, onClick, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: ReactNode }) {
  const v: Record<Variant, string> = {
    primary: 'bg-accent text-white shadow-glow hover:brightness-110 active:brightness-95',
    secondary: 'bg-white/[0.06] text-zinc-100 border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
    ghost: 'text-zinc-300 hover:text-white hover:bg-white/[0.06]',
    danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
    success: 'bg-emerald-500/90 text-white hover:bg-emerald-500',
  };
  const s = { sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg', md: 'h-11 px-5 text-sm gap-2 rounded-xl', lg: 'h-13 px-6 py-3.5 text-base gap-2.5 rounded-xl', xl: 'h-16 px-10 text-lg gap-3 rounded-2xl' };
  return (
    <button
      {...rest}
      onClick={(e) => { sfx.click(); onClick?.(e); }}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-40',
        v[variant], s[size], className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className={cx('glass p-5', onClick && 'cursor-pointer transition hover:border-white/15 hover:bg-white/[0.05]', className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'green' | 'red' | 'amber' | 'gold'; className?: string }) {
  const t = {
    default: 'bg-white/[0.06] text-zinc-300 border-white/10',
    accent: 'bg-accent/15 text-accent-soft border-accent/30',
    green: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
    red: 'bg-red-500/12 text-red-300 border-red-500/25',
    amber: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
    gold: 'bg-gold/15 text-gold border-gold/30',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', t, className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back}
        <h1 className="h-display text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('flex cursor-pointer items-start justify-between gap-4 py-2.5', disabled && 'pointer-events-none opacity-40')}>
      <span>
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-white/15')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-ink-900/70 p-1">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-accent text-white shadow-glow' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cx(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active ? 'border-accent/60 bg-accent/20 text-white' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200',
      )}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true"
            className={cx('glass-strong relative max-h-[90vh] w-full overflow-y-auto p-6', wide ? 'max-w-3xl' : 'max-w-lg')}
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="h-display text-xl">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X size={20} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-accent/10 p-4 text-accent-soft">{icon}</div>
      <p className="h-display text-lg">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="glass px-5 py-4">
      <div className="label">{label}</div>
      <div className="h-display mt-1 text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-accent"
      style={{ width: size, height: size }}
      aria-label="Carregando"
    />
  );
}

// ─── Confirmação global (ações administrativas) ──────────────

interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Exige digitar esta palavra para confirmar (operações destrutivas). */
  typeToConfirm?: string;
}

const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(v: boolean) => void>();
  const confirm = useCallback((o: ConfirmOpts) => {
    setTyped('');
    setOpts(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  const blocked = !!opts?.typeToConfirm && typed.trim().toUpperCase() !== opts.typeToConfirm.toUpperCase();
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => close(false)} title={opts?.title ?? ''}>
        <div className="text-sm leading-relaxed text-zinc-300">{opts?.message}</div>
        {opts?.typeToConfirm && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-zinc-500">Digite <b className="text-zinc-200">{opts.typeToConfirm}</b> para confirmar:</p>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
            {opts?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
