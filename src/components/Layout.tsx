import {
  Award, GraduationCap, Home, ListOrdered, Maximize, Medal, Minimize, Presentation, Trophy, UserPlus, Users, Volume2, VolumeX,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore, type Route } from '../state/AppStore';
import { cx } from '../utils';
import { Avatar, Logo } from './visuals';

const NAV: { route: Route; label: string; icon: ReactNode; match: Route['name'][] }[] = [
  { route: { name: 'home' }, label: 'Jogar', icon: <Home size={17} />, match: ['home', 'setup', 'result'] },
  { route: { name: 'ranking' }, label: 'Ranking', icon: <ListOrdered size={17} />, match: ['ranking'] },
  { route: { name: 'hall' }, label: 'Hall da Fama', icon: <Medal size={17} />, match: ['hall'] },
  { route: { name: 'championship' }, label: 'Campeonato', icon: <Trophy size={17} />, match: ['championship'] },
  { route: { name: 'achievements' }, label: 'Conquistas', icon: <Award size={17} />, match: ['achievements'] },
  { route: { name: 'queue' }, label: 'Fila', icon: <Users size={17} />, match: ['queue'] },
  { route: { name: 'teacher' }, label: 'Professor', icon: <GraduationCap size={17} />, match: ['teacher'] },
];

export function useFullscreen(): [boolean, () => void] {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return [fs, toggle];
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, go, currentPlayer, data, update } = useStore();
  const [fs, toggleFs] = useFullscreen();
  const s = data.settings;
  const inGame = route.name === 'game';
  return (
    <div className="flex min-h-screen flex-col">
      {!inGame && (
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
            <button onClick={() => go({ name: 'home' })} className="shrink-0" aria-label="Início"><Logo size="sm" compact /></button>
            <nav className="ml-2 hidden flex-1 items-center gap-0.5 xl:flex">
              {NAV.map((n) => (
                <button
                  key={n.label} onClick={() => go(n.route)} title={n.label}
                  className={cx(
                    'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                    n.match.includes(route.name) ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-zinc-100',
                  )}
                >
                  {n.icon}<span className="nav-label">{n.label}</span>
                </button>
              ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <IconBtn label={s.sfx ? 'Desativar sons' : 'Ativar sons'} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, sfx: !d.settings.sfx } }))}>
                {s.sfx ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </IconBtn>
              <IconBtn
                label={s.presenter ? 'Sair do modo apresentador' : 'Modo apresentador'} active={s.presenter}
                onClick={() => update((d) => ({ ...d, settings: { ...d.settings, presenter: !d.settings.presenter } }))}
              >
                <Presentation size={18} />
              </IconBtn>
              <IconBtn label={fs ? 'Sair da tela cheia' : 'Tela cheia'} onClick={toggleFs}>{fs ? <Minimize size={18} /> : <Maximize size={18} />}</IconBtn>
              {currentPlayer ? (
                <button onClick={() => go({ name: 'profile' })} className="ml-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-sm hover:border-white/20">
                  <Avatar id={currentPlayer.avatar} size={28} />
                  <span className="hidden max-w-[120px] truncate font-medium sm:inline">{currentPlayer.name}</span>
                </button>
              ) : (
                <button onClick={() => go({ name: 'identify' })} className="ml-1 flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white">
                  <UserPlus size={16} /> Entrar
                </button>
              )}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 xl:hidden">
            {NAV.map((n) => (
              <button
                key={n.label} onClick={() => go(n.route)}
                className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium', n.match.includes(route.name) ? 'bg-white/10 text-white' : 'text-zinc-400')}
              >
                {n.icon}{n.label}
              </button>
            ))}
          </nav>
        </header>
      )}
      <main className={cx('mx-auto w-full flex-1', inGame ? 'max-w-none' : 'max-w-7xl px-4 py-8 md:px-6 md:py-10')}>{children}</main>
      {!inGame && (
        <footer className="mx-auto w-full max-w-7xl px-6 pb-6 pt-2 text-xs text-zinc-600">
          Prévias musicais oficiais fornecidas pela Apple Music (iTunes). Dados salvos apenas neste computador e navegador.
        </footer>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, active }: { children: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick} title={label} aria-label={label}
      className={cx('rounded-lg p-2 transition', active ? 'bg-accent/20 text-accent-soft' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white')}
    >
      {children}
    </button>
  );
}
