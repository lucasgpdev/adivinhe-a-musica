import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, Check, Copy, Crown, Globe, LogOut, MessageCircle, Play, RotateCcw, Search, Send, Shuffle, Swords, Users, Volume2, Wifi, WifiOff, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { sfx } from '../audio/sfx';
import { ArtistSearch } from '../components/ArtistSearch';
import { Badge, Button, Chip, PageHeader, Segmented, Spinner, Toggle } from '../components/ui';
import { Avatar, Confetti, Equalizer, Podium, TimerRing } from '../components/visuals';
import { AVATARS } from '../data/cosmetics';
import { CATEGORIES } from '../data/artists';
import { buildOnlineQuestions } from '../online/questions';
import {
  loadProfile, onlineAvailable, saveProfile, useOnline, type OnlinePlayer, type RoomState, type Team,
} from '../online/useOnline';
import { filterPool } from '../services/catalog';
import { useStore } from '../state/AppStore';
import type { CategoryId } from '../types';
import { cx, fmtNumber } from '../utils';

const NAME_MAX = 24;
const LETTERS = ['A', 'B', 'C', 'D'];
const TEAM_STYLE: Record<Team, { name: string; text: string; border: string; bg: string; dot: string }> = {
  A: { name: 'Time Roxo', text: 'text-fuchsia-300', border: 'border-fuchsia-400/40', bg: 'bg-fuchsia-500/10', dot: 'bg-fuchsia-400' },
  B: { name: 'Time Azul', text: 'text-sky-300', border: 'border-sky-400/40', bg: 'bg-sky-500/10', dot: 'bg-sky-400' },
};

export function OnlinePage({ code: inviteCode }: { code?: string }) {
  const { currentPlayer } = useStore();
  const [profile, setProfile] = useState<{ name: string; avatar: string } | null>(() => loadProfile());
  const [editing, setEditing] = useState(!profile);
  const online = useOnline(editing ? null : profile);
  // em telas grandes o chat fica aberto ao lado (sem cobrir nada); nas menores abre pelo botão
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 1280);

  if (!onlineAvailable()) {
    return (
      <div className="glass mx-auto max-w-lg p-8 text-center">
        <WifiOff className="mx-auto mb-3 text-amber-300" size={36} />
        <h2 className="h-display text-2xl">Modo online indisponível</h2>
        <p className="mt-2 text-zinc-400">Abra o jogo pelo link do site para jogar online com os amigos.</p>
      </div>
    );
  }

  if (editing || !profile) {
    return (
      <ProfileForm
        initial={profile ?? (currentPlayer ? { name: currentPlayer.name, avatar: currentPlayer.avatar } : null)}
        onSave={(p) => {
          saveProfile(p);
          setProfile(p);
          setEditing(false);
          if (profile) online.reconnect();
        }}
      />
    );
  }

  const room = online.room;
  return (
    <div className={cx(room && chatOpen && 'xl:pr-[364px]')}>
      <ConnectionBar status={online.status} error={online.error} onDismiss={online.clearError} />
      {!room ? (
        <Menu profile={profile} inviteCode={inviteCode} online={online} onEditProfile={() => setEditing(true)} />
      ) : room.phase === 'lobby' ? (
        <LobbyView room={room} online={online} />
      ) : room.phase === 'finished' ? (
        <FinishedView room={room} online={online} />
      ) : (
        <MatchView room={room} online={online} />
      )}
      {room && <ChatPanel room={room} online={online} open={chatOpen} setOpen={setChatOpen} />}
    </div>
  );
}

// ─── Chat ────────────────────────────────────────────────────

function ChatPanel({ room, online, open, setOpen }: { room: RoomState; online: Online; open: boolean; setOpen: (v: boolean) => void }) {
  const teams = room.settings.format === 'teams';
  const me = room.players.find((p) => p.id === online.me);
  const [tab, setTab] = useState<'all' | 'team'>('all');
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const scope = teams ? tab : 'all';
  const shown = online.chat.filter((m) => (scope === 'team' ? m.scope === 'team' : m.scope === 'all'));
  const lastId = online.chat.length ? online.chat[online.chat.length - 1].id : 0;
  const unread = open ? 0 : online.chat.filter((m) => m.id > seen && m.from.id !== online.me).length;

  useEffect(() => { if (open) setSeen(lastId); }, [open, lastId]);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, open, tab]);
  useEffect(() => {
    const last = online.chat[online.chat.length - 1];
    if (last && last.from.id !== online.me && !open) sfx.click();
  }, [lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = text.trim();
    if (!t) return;
    online.sendChat(t, scope);
    setText('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)} aria-label="Abrir chat"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 font-semibold text-white shadow-glow"
      >
        <MessageCircle size={20} /> Chat
        {unread > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold text-accent">{unread}</span>}
      </button>
    );
  }
  return (
    <div className="fixed bottom-4 right-4 z-40 flex h-[420px] w-[calc(100vw-2rem)] max-w-[340px] flex-col xl:bottom-6 xl:top-24 xl:h-auto overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <MessageCircle size={16} className="text-accent-soft" />
        {teams ? (
          <div className="flex gap-1">
            <button onClick={() => setTab('all')} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold', tab === 'all' ? 'bg-white/10 text-white' : 'text-zinc-400')}>Todos</button>
            <button onClick={() => setTab('team')} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold', tab === 'team' ? cx(TEAM_STYLE[me?.team ?? 'A'].bg, TEAM_STYLE[me?.team ?? 'A'].text) : 'text-zinc-400')}>
              Meu time{me ? ` (${TEAM_STYLE[me.team].name.replace('Time ', '')})` : ''}
            </button>
          </div>
        ) : <span className="text-sm font-semibold">Chat da sala</span>}
        <button onClick={() => setOpen(false)} aria-label="Fechar chat" className="ml-auto text-zinc-400 hover:text-white"><X size={16} /></button>
      </div>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!shown.length && (
          <p className="pt-10 text-center text-sm text-zinc-500">
            {scope === 'team' ? 'Só o seu time vê as mensagens daqui. Combine a estratégia!' : 'Mande um oi para a sala!'}
          </p>
        )}
        {shown.map((m) => {
          const mine = m.from.id === online.me;
          return (
            <div key={m.id} className={cx('flex gap-2', mine && 'flex-row-reverse')}>
              <Avatar id={m.from.avatar} size={24} />
              <div className={cx('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', mine ? 'bg-accent/25' : 'bg-white/[0.06]')}>
                {!mine && (
                  <div className={cx('text-[11px] font-semibold', teams ? TEAM_STYLE[m.from.team].text : 'text-zinc-400')}>{m.from.name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form className="flex gap-2 border-t border-white/10 p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          className="input h-10 flex-1 py-0 text-sm" value={text} maxLength={200} onChange={(e) => setText(e.target.value)}
          placeholder={scope === 'team' ? 'Mensagem para o seu time…' : 'Mensagem para todos…'} aria-label="Mensagem do chat"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Enviar" className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"><Send size={16} /></button>
      </form>
    </div>
  );
}

type Online = ReturnType<typeof useOnline>;

// ─── Nome e avatar ───────────────────────────────────────────

function ProfileForm({ initial, onSave }: { initial: { name: string; avatar: string } | null; onSave: (p: { name: string; avatar: string }) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar && AVATARS.some((a) => a.id === initial.avatar && !a.unlock) ? initial.avatar : 'headphones');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const n = name.replace(/\s+/g, ' ').trim();
    if (n.length < 2) return setError('O nome precisa ter pelo menos 2 letras.');
    if (n.length > NAME_MAX) return setError(`Use no máximo ${NAME_MAX} caracteres.`);
    onSave({ name: n, avatar });
  };
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Jogar online" subtitle="Escolha como seus amigos vão te ver na sala." />
      <form className="glass p-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="label mb-2">Seu nome</div>
        <input
          className={cx('input text-lg', error && 'border-red-400/60')} placeholder="Nome ou apelido" value={name} maxLength={NAME_MAX + 4}
          onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus aria-label="Seu nome"
        />
        {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
        <div className="label mb-2 mt-5">Avatar</div>
        <div className="flex flex-wrap gap-2">
          {AVATARS.filter((a) => !a.unlock).map((a) => (
            <button type="button" key={a.id} onClick={() => setAvatar(a.id)} className={cx('rounded-full p-0.5 transition', avatar === a.id ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100')}>
              <Avatar id={a.id} size={44} />
            </button>
          ))}
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" icon={<ArrowRight size={18} />}>Continuar</Button>
      </form>
    </div>
  );
}

function ConnectionBar({ status, error, onDismiss }: { status: Online['status']; error: string | null; onDismiss: () => void }) {
  return (
    <div className="mb-4 space-y-2">
      {(status === 'connecting' || status === 'reconnecting') && (
        <div className="glass flex items-center gap-3 border-amber-400/30 px-4 py-2.5 text-sm text-amber-200">
          <Spinner size={16} />
          {status === 'connecting' ? 'Conectando ao servidor… (o primeiro acesso pode levar até 1 minuto)' : 'Conexão perdida. Reconectando…'}
        </div>
      )}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass flex items-center gap-3 border-red-400/30 px-4 py-2.5 text-sm text-red-200" role="alert">
            <span className="flex-1">{error}</span>
            <button onClick={onDismiss} aria-label="Fechar" className="text-red-300 hover:text-white"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Criar / entrar ──────────────────────────────────────────

function Menu({ profile, inviteCode, online, onEditProfile }: { profile: { name: string; avatar: string }; inviteCode?: string; online: Online; onEditProfile: () => void }) {
  const [code, setCode] = useState(inviteCode ?? '');
  const autoJoined = useRef(false);
  useEffect(() => {
    if (inviteCode && online.status === 'online' && !autoJoined.current) {
      autoJoined.current = true;
      online.join(inviteCode);
    }
  }, [inviteCode, online.status, online]);
  const busy = online.status !== 'online';
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Jogar online"
        subtitle="Crie uma sala e mande o código para os amigos, ou entre na sala de alguém."
        actions={
          <button onClick={onEditProfile} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-sm hover:border-white/20">
            <Avatar id={profile.avatar} size={28} /> <span className="font-medium">{profile.name}</span> <span className="text-xs text-zinc-500">trocar</span>
          </button>
        }
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass flex flex-col p-6">
          <div className="mb-3 flex items-center gap-2 text-accent-soft"><Crown size={18} /><span className="label !text-accent-soft">Criar sala</span></div>
          <p className="flex-1 text-sm text-zinc-400">Você será o dono da sala: escolhe o formato (times de 1v1 até 4v4 ou todos contra todos), os gêneros e quando começar.</p>
          <Button variant="primary" size="lg" className="mt-5" disabled={busy} icon={<Play size={18} fill="currentColor" />}
            onClick={() => online.create({ format: 'teams', categories: [], artists: [], rounds: 10, timeSec: 20, explicit: true })}>
            Criar sala
          </Button>
        </div>
        <form className="glass flex flex-col p-6" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) online.join(code); }}>
          <div className="mb-3 flex items-center gap-2 text-sky-300"><Users size={18} /><span className="label !text-sky-300">Entrar com código</span></div>
          <input
            className="input h-display text-center text-3xl uppercase tracking-[0.4em]" placeholder="K7Q2" maxLength={4} value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label="Código da sala"
          />
          <Button type="submit" size="lg" className="mt-5" disabled={busy || code.length < 4} icon={<ArrowRight size={18} />}>Entrar na sala</Button>
        </form>
      </div>
    </div>
  );
}

// ─── Sala de espera ──────────────────────────────────────────

function LobbyView({ room, online }: { room: RoomState; online: Online }) {
  const { tracks } = useStore();
  const isHost = room.hostId === online.me;
  const s = room.settings;
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?sala=${room.code}`;
  const counts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.id, filterPool(tracks, { categories: [c.id], artists: [], extra: 'random', explicit: s.explicit }).length])),
    [tracks, s.explicit],
  );
  const artistsSel = s.artists ?? [];
  const available = filterPool(tracks, { categories: s.categories, artists: artistsSel, extra: 'random', explicit: s.explicit }).length;
  const teamsOk = s.format !== 'teams' || (room.players.some((p) => p.team === 'A') && room.players.some((p) => p.team === 'B'));
  const enough = s.format === 'teams' ? teamsOk : room.players.length >= 2;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão */ }
  };
  const toggleCat = (c: CategoryId) =>
    online.updateSettings({ categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c] });
  const start = () => {
    const qs = buildOnlineQuestions(tracks, s.categories, s.rounds, Math.random, artistsSel, { explicit: s.explicit, timeSec: s.timeSec });
    online.start(qs);
  };
  const size = s.format === 'teams'
    ? `${room.players.filter((p) => p.team === 'A').length}v${room.players.filter((p) => p.team === 'B').length}`
    : `${room.players.length} jogadores`;

  return (
    <div className="space-y-6">
      <div className="glass flex flex-wrap items-center gap-5 p-6">
        <div>
          <div className="label">Código da sala</div>
          <div className="h-display text-5xl tracking-[0.3em] text-accent-soft md:text-6xl">{room.code}</div>
        </div>
        <div className="min-w-[220px] flex-1 text-sm text-zinc-400">
          Mande o código ou o link para os amigos.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copy}>{copied ? 'Link copiado!' : 'Copiar link de convite'}</Button>
          </div>
        </div>
        <Button variant="ghost" icon={<LogOut size={16} />} onClick={online.leave}>Sair</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Jogadores */}
        <div className="glass p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="label">Jogadores · {size}</div>
            {s.format === 'teams' && <span className="text-xs text-zinc-500">Clique em um time para trocar</span>}
          </div>
          {s.format === 'teams' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(['A', 'B'] as Team[]).map((t) => {
                const list = room.players.filter((p) => p.team === t);
                const mine = room.players.find((p) => p.id === online.me)?.team === t;
                return (
                  <button
                    key={t} onClick={() => !mine && online.setTeam(t)} disabled={mine || list.length >= 4}
                    className={cx('rounded-2xl border p-4 text-left transition', TEAM_STYLE[t].border, TEAM_STYLE[t].bg, !mine && list.length < 4 && 'hover:brightness-125')}
                  >
                    <div className={cx('h-display mb-3 flex items-center justify-between text-lg', TEAM_STYLE[t].text)}>
                      {TEAM_STYLE[t].name} <span className="text-sm text-zinc-400">{list.length}/4</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((p) => <PlayerRow key={p.id} p={p} host={p.id === room.hostId} me={p.id === online.me} />)}
                      {!list.length && <div className="py-3 text-center text-sm text-zinc-500">Ninguém ainda</div>}
                      {!mine && list.length < 4 && <div className="pt-1 text-center text-xs text-zinc-400">Entrar neste time</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {room.players.map((p) => <PlayerRow key={p.id} p={p} host={p.id === room.hostId} me={p.id === online.me} />)}
            </div>
          )}
        </div>

        {/* Configurações */}
        <div className="glass space-y-5 p-6">
          <div className="label">Configurações {isHost ? '' : '(o dono da sala escolhe)'}</div>
          <div>
            <div className="mb-2 text-sm font-medium">Formato</div>
            <Disabled off={!isHost}>
              <Segmented size="sm" value={s.format} onChange={(v) => online.updateSettings({ format: v })}
                options={[{ value: 'teams', label: <span className="flex items-center gap-1.5"><Swords size={14} />Times (até 4v4)</span> }, { value: 'ffa', label: <span className="flex items-center gap-1.5"><Users size={14} />Todos contra todos</span> }]} />
            </Disabled>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Gêneros <span className="font-normal text-zinc-500">{s.categories.length ? '' : '(todos)'}</span></div>
            <Disabled off={!isHost}>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <Chip key={c.id} active={s.categories.includes(c.id)} onClick={() => toggleCat(c.id)}>
                    {c.short}{tracks.length > 0 && <span className="ml-1 text-[10px] opacity-60">{counts[c.id]}</span>}
                  </Chip>
                ))}
              </div>
            </Disabled>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Search size={14} /> Cantores <span className="font-normal text-zinc-500">{artistsSel.length ? '' : '(todos)'}</span></div>
            <ArtistSearch
              tracks={filterPool(tracks, { categories: s.categories, artists: [], extra: 'random', explicit: s.explicit })}
              selected={artistsSel} onChange={(ids) => online.updateSettings({ artists: ids })} disabled={!isHost}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 text-sm font-medium">Músicas</div>
              <Disabled off={!isHost}>
                <Segmented size="sm" value={String(s.rounds)} onChange={(v) => online.updateSettings({ rounds: Number(v) })} options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: String(n) }))} />
              </Disabled>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Tempo</div>
              <Disabled off={!isHost}>
                <Segmented size="sm" value={String(s.timeSec)} onChange={(v) => online.updateSettings({ timeSec: Number(v) })} options={[10, 15, 20, 30].map((n) => ({ value: String(n), label: `${n}s` }))} />
              </Disabled>
            </div>
          </div>
          <Toggle
            label="Com palavrão" description={s.explicit ? 'Toca a versão original das músicas (explícita).' : 'Só versões limpas, sem palavrão.'}
            checked={s.explicit} onChange={(v) => online.updateSettings({ explicit: v })} disabled={!isHost}
          />
          {isHost ? (
            <>
              <Button variant="primary" size="lg" className="w-full" icon={<Play size={18} fill="currentColor" />} onClick={start} disabled={!enough || available < 8}>
                Começar partida
              </Button>
              <p className="text-center text-xs text-zinc-500">
                {!tracks.length ? 'Carregando as músicas…'
                  : available < 8 ? 'Poucas músicas com esses filtros. Escolha mais gêneros ou cantores.'
                    : !enough ? (s.format === 'teams' ? 'Cada time precisa de pelo menos 1 jogador.' : 'Precisa de pelo menos 2 jogadores.')
                      : `${fmtNumber(available)} músicas disponíveis`}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-4 text-sm text-zinc-400">
              <Equalizer bars={4} height={14} /> Esperando o dono da sala começar…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Disabled({ off, children }: { off: boolean; children: ReactNode }) {
  return <div className={cx(off && 'pointer-events-none opacity-60')}>{children}</div>;
}

function PlayerRow({ p, host, me, right }: { p: OnlinePlayer; host?: boolean; me?: boolean; right?: ReactNode }) {
  return (
    <div className={cx('flex items-center gap-2.5 rounded-xl bg-black/20 px-2.5 py-2', !p.connected && 'opacity-40')}>
      <Avatar id={p.avatar} size={30} />
      <span className="min-w-0 flex-1 truncate font-medium">{p.name}{me && <span className="ml-1.5 text-xs text-zinc-500">(você)</span>}</span>
      {host && <Crown size={14} className="text-gold" aria-label="Dono da sala" />}
      {!p.connected && <WifiOff size={14} className="text-zinc-500" aria-label="Desconectado" />}
      {right}
    </div>
  );
}

// ─── Partida ─────────────────────────────────────────────────

function useCountdown(room: RoomState, receivedAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, receivedAt + room.remainingMs - now) / 1000;
}

function MatchView({ room, online }: { room: RoomState; online: Online }) {
  const { data } = useStore();
  const engine = useRef<AudioEngine | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [picked, setPicked] = useState<{ round: number; id: string } | null>(null);
  const remaining = useCountdown(room, online.receivedAt);
  const q = room.question;
  const me = room.players.find((p) => p.id === online.me);
  const myAnswer = picked?.round === room.round ? picked.id : null;
  const answered = room.answered.includes(online.me) || !!myAnswer;
  const lastPhase = useRef<string>('');

  useEffect(() => {
    engine.current = new AudioEngine();
    engine.current.setVolume(data.settings.volume);
    return () => engine.current?.dispose();
  }, [data.settings.volume]);

  // carrega na contagem, toca quando a pergunta abre
  useEffect(() => {
    const e = engine.current;
    if (!e || !q) return;
    const key = `${room.round}:${room.phase}`;
    if (lastPhase.current === key) return;
    lastPhase.current = key;
    if (room.phase === 'countdown') {
      setBlocked(false);
      e.load(q.previewUrl).catch(() => undefined);
    } else if (room.phase === 'question') {
      // toca até o fim da prévia (30s): continua tocando na revelação da resposta
      const play = () => e.playSnippet(q.snippetStart, 30).catch((err) => {
        if ((err as { kind?: string }).kind === 'blocked') setBlocked(true);
      });
      e.load(q.previewUrl).then(play, play);
    } else if (room.phase === 'reveal') {
      const r = room.reveal?.results[online.me];
      if (r?.correct) sfx.correct();
      else sfx.wrong();
    }
  }, [room.phase, room.round, q, room.settings.timeSec, room.reveal, online.me]);

  useEffect(() => {
    if (room.phase === 'reveal') return;
    if (room.phase === 'question' && remaining > 0 && remaining <= 3.05 && Math.abs(remaining - Math.round(remaining)) < 0.06) sfx.tick();
  }, [remaining, room.phase]);

  const choose = (id: string) => {
    if (room.phase !== 'question' || answered) return;
    setPicked({ round: room.round, id });
    online.answer(room.round, id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-5 flex items-center gap-4">
          <div>
            <div className="label">Sala {room.code} · {room.settings.format === 'teams' ? 'Times' : 'Todos contra todos'}</div>
            <div className="h-display text-2xl tabular-nums">Música {room.round + 1}<span className="text-zinc-500"> / {room.totalRounds}</span></div>
          </div>
          <div className="ml-auto">
            {room.phase === 'question' && <TimerRing remaining={remaining} total={room.settings.timeSec} size={76} />}
          </div>
        </div>

        <div className="glass relative overflow-hidden p-6">
          <AnimatePresence mode="wait">
            {room.phase === 'countdown' ? (
              <motion.div key={`cd${room.round}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-16">
                <div className="label mb-2">Prepare-se</div>
                <div className="h-display text-8xl tabular-nums text-accent-soft">{Math.max(1, Math.ceil(remaining))}</div>
              </motion.div>
            ) : (
              <motion.div key={`q${room.round}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-5 flex items-center justify-center gap-3">
                  <Equalizer bars={9} height={34} active={room.phase === 'question'} />
                  {blocked && (
                    <Button size="sm" variant="primary" icon={<Volume2 size={15} />} onClick={() => { setBlocked(false); void engine.current?.toggle(); }}>Toque para ouvir</Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {q?.options.map((o, i) => {
                    const reveal = room.phase === 'reveal' ? room.reveal : null;
                    const isRight = reveal?.answerId === o.id;
                    const mine = myAnswer === o.id || reveal?.results[online.me]?.optionId === o.id;
                    const state = reveal ? (isRight ? 'correct' : mine ? 'wrong' : 'idle') : mine ? 'locked' : 'idle';
                    return (
                      <motion.button
                        key={o.id} onClick={() => choose(o.id)} disabled={room.phase !== 'question' || answered}
                        whileTap={room.phase === 'question' && !answered ? { scale: 0.98 } : undefined}
                        className={cx(
                          'group flex min-h-[68px] items-center gap-4 rounded-2xl border px-4 py-3 text-left transition',
                          state === 'idle' && 'border-white/10 bg-white/[0.04] enabled:hover:border-accent/60 enabled:hover:bg-accent/10',
                          state === 'locked' && 'border-accent/60 bg-accent/15',
                          state === 'correct' && 'border-emerald-400/60 bg-emerald-500/15',
                          state === 'wrong' && 'border-red-400/60 bg-red-500/15',
                          reveal && state === 'idle' && 'opacity-50',
                        )}
                      >
                        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                          state === 'correct' ? 'bg-emerald-400 text-ink-950' : state === 'wrong' ? 'bg-red-400 text-ink-950' : state === 'locked' ? 'bg-accent text-white' : 'bg-white/[0.07] text-zinc-300')}>
                          {state === 'correct' ? <Check size={20} /> : state === 'wrong' ? <X size={20} /> : LETTERS[i]}
                        </span>
                        <span className="h-display text-lg leading-snug">{o.title}</span>
                      </motion.button>
                    );
                  })}
                </div>
                {room.phase === 'question' && (
                  <div className="mt-5 text-center text-sm text-zinc-400">
                    {answered ? 'Resposta enviada! Esperando os outros…' : 'Escolha a música certa — quanto mais rápido, mais pontos.'}
                    <span className="ml-2 text-zinc-500">({room.answered.length}/{room.players.filter((p) => p.connected).length} responderam)</span>
                  </div>
                )}
                {room.phase === 'reveal' && room.reveal && <RevealCard room={room} me={online.me} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {me && <div className="mt-3 text-center text-xs text-zinc-500">Você: {fmtNumber(me.score)} pts · {me.correct} acertos</div>}
      </div>
      <Scoreboard room={room} me={online.me} />
    </div>
  );
}

function RevealCard({ room, me }: { room: RoomState; me: string }) {
  const r = room.reveal!;
  const mine = r.results[me];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-black/25 p-4">
      {r.track.artworkUrl ? <img src={r.track.artworkUrl} alt="" className="h-16 w-16 rounded-xl object-cover" referrerPolicy="no-referrer" /> : <div className="h-16 w-16 rounded-xl bg-white/5" />}
      <div className="min-w-0 flex-1">
        <div className="h-display truncate text-lg">{r.track.title}</div>
        <div className="truncate text-sm text-zinc-400">{r.track.artistName}{r.track.year ? ` · ${r.track.year}` : ''}</div>
      </div>
      <div className={cx('h-display text-3xl', mine?.correct ? 'text-emerald-300' : 'text-red-300')}>
        {mine?.correct ? `+${fmtNumber(mine.points)}` : mine?.optionId ? 'Errou' : 'Sem resposta'}
      </div>
    </motion.div>
  );
}

function Scoreboard({ room, me }: { room: RoomState; me: string }) {
  const reveal = room.phase === 'reveal' ? room.reveal : null;
  const row = (p: OnlinePlayer) => {
    const r = reveal?.results[p.id];
    return (
      <PlayerRow key={p.id} p={p} me={p.id === me} right={
        <span className="flex items-center gap-2">
          {room.phase === 'question' && room.answered.includes(p.id) && <Check size={14} className="text-accent-soft" aria-label="Respondeu" />}
          {r && (r.correct ? <span className="text-xs font-semibold text-emerald-300">+{r.points}</span> : <X size={14} className="text-red-300" />)}
          <span className="w-14 text-right text-sm font-semibold tabular-nums">{fmtNumber(p.score)}</span>
        </span>
      } />
    );
  };
  if (room.settings.format === 'teams') {
    return (
      <div className="space-y-4">
        {(['A', 'B'] as Team[]).map((t) => (
          <div key={t} className={cx('rounded-2xl border p-4', TEAM_STYLE[t].border, TEAM_STYLE[t].bg)}>
            <div className={cx('mb-3 flex items-center justify-between', TEAM_STYLE[t].text)}>
              <span className="h-display">{TEAM_STYLE[t].name}</span>
              <span className="h-display text-2xl tabular-nums">{fmtNumber(room.teamScores[t])}</span>
            </div>
            <div className="space-y-1.5">{room.players.filter((p) => p.team === t).sort((a, b) => b.score - a.score).map(row)}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="glass p-4">
      <div className="label mb-3">Placar</div>
      <div className="space-y-1.5">{[...room.players].sort((a, b) => b.score - a.score).map(row)}</div>
    </div>
  );
}

// ─── Fim de partida ──────────────────────────────────────────

function FinishedView({ room, online }: { room: RoomState; online: Online }) {
  const isHost = room.hostId === online.me;
  const ranked = [...room.players].sort((a, b) => b.score - a.score || b.correct - a.correct);
  const teams = room.settings.format === 'teams';
  const { A, B } = room.teamScores;
  const winnerTeam: Team | null = A === B ? null : A > B ? 'A' : 'B';
  const meP = room.players.find((p) => p.id === online.me);
  const iWon = teams ? !!winnerTeam && meP?.team === winnerTeam : ranked[0]?.id === online.me;
  useEffect(() => { if (iWon) sfx.fanfare(); }, [iWon]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 text-center">
      {iWon && <Confetti />}
      <div>
        <div className="label">Fim de partida · Sala {room.code}</div>
        {teams ? (
          <h1 className={cx('h-display mt-2 text-4xl md:text-5xl', winnerTeam ? TEAM_STYLE[winnerTeam].text : '')}>
            {winnerTeam ? `${TEAM_STYLE[winnerTeam].name} venceu!` : 'Empate!'}
          </h1>
        ) : (
          <h1 className="h-display mt-2 text-4xl md:text-5xl">{ranked[0]?.name} venceu!</h1>
        )}
        {teams && (
          <div className="mt-4 flex items-center justify-center gap-6 text-3xl">
            <span className={cx('h-display tabular-nums', TEAM_STYLE.A.text)}>{fmtNumber(A)}</span>
            <span className="text-zinc-600">×</span>
            <span className={cx('h-display tabular-nums', TEAM_STYLE.B.text)}>{fmtNumber(B)}</span>
          </div>
        )}
      </div>
      {!teams && <Podium big entries={ranked.slice(0, 3).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, value: p.score }))} />}
      <div className="glass mx-auto max-w-xl p-5 text-left">
        <div className="label mb-3">Classificação</div>
        <div className="space-y-1.5">
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
              <span className="w-6 text-sm font-bold text-zinc-500">{i + 1}º</span>
              <Avatar id={p.avatar} size={30} />
              <span className="flex-1 truncate font-medium">{p.name}{p.id === online.me && <span className="ml-1.5 text-xs text-zinc-500">(você)</span>}</span>
              {teams && <span className={cx('h-2 w-2 rounded-full', TEAM_STYLE[p.team].dot)} />}
              <span className="text-xs text-zinc-500">{p.correct} {p.correct === 1 ? "acerto" : "acertos"}</span>
              <span className="w-16 text-right font-semibold tabular-nums">{fmtNumber(p.score)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {isHost ? (
          <Button variant="primary" size="lg" icon={<RotateCcw size={18} />} onClick={online.backToLobby}>Jogar de novo</Button>
        ) : (
          <Badge className="px-4 py-2 text-sm"><Shuffle size={14} /> O dono da sala pode começar outra</Badge>
        )}
        <Button size="lg" icon={<LogOut size={18} />} onClick={online.leave}>Sair da sala</Button>
      </div>
    </div>
  );
}

export function OnlineHomeCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="glass group flex w-full items-center gap-5 border-accent/30 p-6 text-left transition hover:border-accent/60">
      <span className="rounded-2xl bg-accent/20 p-4 text-accent-soft"><Globe size={28} /></span>
      <div className="flex-1">
        <div className="label !text-accent-soft">Novo · Multiplayer</div>
        <div className="h-display text-2xl">Jogar online com amigos</div>
        <div className="text-sm text-zinc-400">Times de 1v1 até 4v4 ou todos contra todos. Crie uma sala e mande o código.</div>
      </div>
      <Wifi className="text-zinc-500 transition group-hover:text-accent-soft" />
    </button>
  );
}
