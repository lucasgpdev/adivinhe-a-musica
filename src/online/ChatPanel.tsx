import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera, CornerUpLeft, Image as ImageIcon, MessageCircle, Mic, Pause, Play, Plus, Send, Smile, Sticker as StickerIcon, Trash2, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import { Avatar } from '../components/visuals';
import { TEAM_STYLE, type Online } from '../pages/Online';
import { cx } from '../utils';
import { compressPhoto, loadMyStickers, makeSticker, saveMyStickers, startRecording, type Recording } from './media';
import { Sticker, STICKERS } from './stickers';
import type { ChatMessage, ChatOutgoing, RoomState } from './useOnline';

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function ChatPanel({ room, online, open, setOpen }: { room: RoomState; online: Online; open: boolean; setOpen: (v: boolean) => void }) {
  const teams = room.settings.format === 'teams';
  const me = room.players.find((p) => p.id === online.me);
  const [tab, setTab] = useState<'all' | 'team'>('all');
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [tray, setTray] = useState<null | 'stickers' | 'attach'>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
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
  useEffect(() => { setReplyTo(null); }, [tab]);

  const send = (msg: ChatOutgoing) => {
    online.sendChat({ ...msg, replyTo: replyTo?.id }, scope);
    setReplyTo(null);
    setTray(null);
  };
  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    send({ kind: 'text', text: t });
    setText('');
  };
  const withBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setLocalError(null);
    try { await fn(); } catch (e) { setLocalError((e as Error).message); } finally { setBusy(null); }
  };
  const sendPhoto = (f: File) => withBusy('Enviando foto…', async () => send({ kind: 'image', media: await compressPhoto(f) }));

  const jumpTo = (id: number) => {
    const el = listRef.current?.querySelector(`[data-msg="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('ring-2', 'ring-accent');
    setTimeout(() => el?.classList.remove('ring-2', 'ring-accent'), 1200);
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
    <div className="fixed bottom-4 right-4 z-40 flex h-[520px] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-2xl backdrop-blur-xl xl:bottom-6 xl:top-24 xl:h-auto">
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

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {!shown.length && (
          <p className="pt-10 text-center text-sm text-zinc-500">
            {scope === 'team' ? 'Só o seu time vê as mensagens daqui. Combine a estratégia!' : 'Mande um oi, uma foto, um áudio ou uma figurinha!'}
          </p>
        )}
        {shown.map((m) => (
          <Bubble key={m.id} m={m} mine={m.from.id === online.me} teams={teams} onReply={() => setReplyTo(m)} onJump={jumpTo} onOpenImage={setViewer} />
        ))}
      </div>

      {(busy || localError) && (
        <div className={cx('px-3 py-1.5 text-xs', localError ? 'text-red-300' : 'text-zinc-400')}>
          {localError ?? busy}
          {localError && <button onClick={() => setLocalError(null)} className="ml-2 underline">ok</button>}
        </div>
      )}

      {replyTo && (
        <div className="mx-2 mb-1 flex items-start gap-2 rounded-xl border-l-4 border-accent bg-white/[0.05] px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-accent-soft">Respondendo {replyTo.from.id === online.me ? 'você' : replyTo.from.name}</div>
            <div className="truncate text-xs text-zinc-400">{previewOf(replyTo)}</div>
          </div>
          <button onClick={() => setReplyTo(null)} aria-label="Cancelar resposta" className="text-zinc-400 hover:text-white"><X size={14} /></button>
        </div>
      )}

      <AnimatePresence>
        {tray === 'stickers' && <StickerTray onSend={(s) => send(s)} onError={setLocalError} />}
        {tray === 'attach' && <AttachTray onPhoto={sendPhoto} />}
      </AnimatePresence>

      <Composer
        text={text} setText={setText} onSend={sendText} scope={scope}
        tray={tray} setTray={setTray}
        onAudio={(dataUrl, durationSec) => send({ kind: 'audio', media: dataUrl, durationSec })}
        onError={setLocalError}
      />

      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewer(null)}>
            <img src={viewer} alt="Foto do chat" className="max-h-full max-w-full rounded-xl object-contain" />
            <button aria-label="Fechar foto" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function previewOf(m: ChatMessage): string {
  if (m.kind === 'image') return '📷 Foto';
  if (m.kind === 'audio') return `🎤 Áudio${m.durationSec ? ` (${fmtSec(m.durationSec)})` : ''}`;
  if (m.kind === 'sticker') return 'Figurinha';
  return m.text;
}

// ─── Balão de mensagem ───────────────────────────────────────

function Bubble({ m, mine, teams, onReply, onJump, onOpenImage }: {
  m: ChatMessage; mine: boolean; teams: boolean; onReply: () => void; onJump: (id: number) => void; onOpenImage: (src: string) => void;
}) {
  const kind = m.kind ?? 'text';
  const bare = kind === 'sticker';
  const time = new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  // m.at vem do relógio do servidor; se for muito antigo/inválido, não mostra
  const showTime = Number.isFinite(m.at) && m.at > 1e12;
  return (
    <div data-msg={m.id} className={cx('group flex gap-2 rounded-xl transition', mine && 'flex-row-reverse')} onDoubleClick={onReply}>
      <Avatar id={m.from.avatar} size={24} />
      <div className={cx('flex max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
        <div className={cx(!bare && 'rounded-2xl px-3 py-1.5 text-sm', !bare && (mine ? 'bg-accent/25' : 'bg-white/[0.06]'))}>
          {!mine && (
            <div className={cx('text-[11px] font-semibold', teams ? TEAM_STYLE[m.from.team].text : 'text-zinc-400', bare && 'mb-1')}>{m.from.name}</div>
          )}
          {m.replyTo && (
            <button onClick={() => onJump(m.replyTo!.id)} className="mb-1 block w-full rounded-lg border-l-4 border-accent-soft bg-black/25 px-2 py-1 text-left">
              <div className="text-[11px] font-semibold text-accent-soft">{m.replyTo.name}</div>
              <div className="truncate text-xs text-zinc-400">{m.replyTo.preview}</div>
            </button>
          )}
          {kind === 'text' && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
          {kind === 'image' && (m.media ? (
            <button onClick={() => onOpenImage(m.media!)} className="block" aria-label="Ver foto">
              <img src={m.media} alt="Foto" className="max-h-56 max-w-full rounded-xl object-cover" />
            </button>
          ) : <Expired />)}
          {kind === 'audio' && (m.media ? <AudioMessage src={m.media} durationSec={m.durationSec} mine={mine} /> : <Expired />)}
          {kind === 'sticker' && (m.stickerId ? <Sticker id={m.stickerId} size={110} /> : m.media ? (
            <img src={m.media} alt="Figurinha" className="h-[120px] w-[120px] object-contain drop-shadow-lg" />
          ) : <Expired />)}
        </div>
        <div className={cx('mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500', mine && 'flex-row-reverse')}>
          {showTime && <span>{time}</span>}
          <button onClick={onReply} className="flex items-center gap-0.5 opacity-70 hover:text-white hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Responder">
            <CornerUpLeft size={11} /> Responder
          </button>
        </div>
      </div>
    </div>
  );
}

function Expired() {
  return <span className="text-xs italic text-zinc-500">Mídia expirada</span>;
}

function AudioMessage({ src, durationSec, mine }: { src: string; durationSec?: number; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = durationSec || 0;
  return (
    <div className="flex w-52 items-center gap-2 py-1">
      <button
        onClick={() => { const a = ref.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); }}
        className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', mine ? 'bg-white text-accent' : 'bg-accent text-white')}
        aria-label={playing ? 'Pausar áudio' : 'Ouvir áudio'}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-accent-soft transition-[width]" style={{ width: total ? `${Math.min(100, (pos / total) * 100)}%` : '0%' }} />
        </div>
        <div className="mt-1 text-[10px] tabular-nums text-zinc-400">{fmtSec(playing || pos ? pos : total)}</div>
      </div>
      <Mic size={14} className="text-zinc-500" />
      <audio
        ref={ref} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
      />
    </div>
  );
}

// ─── Figurinhas e anexos ─────────────────────────────────────

function Tray({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/10">
      <div className="max-h-56 overflow-y-auto p-2">{children}</div>
    </motion.div>
  );
}

function StickerTray({ onSend, onError }: { onSend: (m: ChatOutgoing) => void; onError: (e: string) => void }) {
  const [mine, setMine] = useState<string[]>(() => loadMyStickers());
  const [tab, setTab] = useState<'jogo' | 'minhas'>('jogo');
  const fileRef = useRef<HTMLInputElement>(null);
  const create = async (f: File) => {
    try {
      const url = await makeSticker(f);
      const next = [url, ...mine].slice(0, 30);
      setMine(next); saveMyStickers(next); setTab('minhas');
    } catch (e) { onError((e as Error).message); }
  };
  return (
    <Tray>
      <div className="mb-2 flex gap-1">
        <button onClick={() => setTab('jogo')} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold', tab === 'jogo' ? 'bg-white/10' : 'text-zinc-400')}>Do jogo</button>
        <button onClick={() => setTab('minhas')} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold', tab === 'minhas' ? 'bg-white/10' : 'text-zinc-400')}>Minhas ({mine.length})</button>
        <button onClick={() => fileRef.current?.click()} className="ml-auto flex items-center gap-1 rounded-lg bg-accent/20 px-2.5 py-1 text-xs font-semibold text-accent-soft">
          <Plus size={13} /> Criar de uma foto
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void create(f); }} />
      </div>
      {tab === 'jogo' ? (
        <div className="grid grid-cols-4 gap-2">
          {STICKERS.map((s) => (
            <button key={s.id} onClick={() => onSend({ kind: 'sticker', stickerId: s.id })} className="flex justify-center rounded-xl p-1 hover:bg-white/10" aria-label={`Enviar figurinha ${s.label}`}>
              <Sticker id={s.id} size={64} />
            </button>
          ))}
        </div>
      ) : mine.length ? (
        <div className="grid grid-cols-4 gap-2">
          {mine.map((url, i) => (
            <div key={i} className="group relative">
              <button onClick={() => onSend({ kind: 'sticker', media: url })} className="block rounded-xl p-1 hover:bg-white/10" aria-label="Enviar minha figurinha">
                <img src={url} alt="" className="h-16 w-16 object-contain" />
              </button>
              <button
                onClick={() => { const next = mine.filter((_, j) => j !== i); setMine(next); saveMyStickers(next); }}
                className="absolute -right-1 -top-1 hidden rounded-full bg-black/80 p-1 text-red-300 group-hover:block" aria-label="Apagar figurinha"
              ><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-zinc-500">Toque em “Criar de uma foto” para transformar qualquer imagem em figurinha.</p>
      )}
    </Tray>
  );
}

function AttachTray({ onPhoto }: { onPhoto: (f: File) => void }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(f); };
  return (
    <Tray>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.05] py-3 text-xs hover:bg-white/10">
          <span className="rounded-full bg-fuchsia-500 p-2.5 text-white"><ImageIcon size={18} /></span> Galeria
        </button>
        <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.05] py-3 text-xs hover:bg-white/10">
          <span className="rounded-full bg-sky-500 p-2.5 text-white"><Camera size={18} /></span> Câmera
        </button>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </Tray>
  );
}

// ─── Caixa de mensagem + gravar áudio (segure para gravar) ───

function Composer({ text, setText, onSend, scope, tray, setTray, onAudio, onError }: {
  text: string; setText: (v: string) => void; onSend: () => void; scope: 'all' | 'team';
  tray: null | 'stickers' | 'attach'; setTray: (t: null | 'stickers' | 'attach') => void;
  onAudio: (dataUrl: string, durationSec: number) => void; onError: (e: string) => void;
}) {
  const rec = useRef<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [willCancel, setWillCancel] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - (rec.current?.startedAt ?? Date.now())) / 1000), 200);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => () => rec.current?.cancel(), []);

  const finish = async (cancel: boolean) => {
    const r = rec.current;
    rec.current = null;
    setRecording(false); setWillCancel(false);
    if (!r) return;
    if (cancel) { r.cancel(); return; }
    const out = await r.stop();
    if (out) onAudio(out.dataUrl, out.durationSec);
  };
  const pressed = useRef(false);
  const begin = async (x: number) => {
    if (rec.current) return;
    pressed.current = true;
    startX.current = x;
    try {
      const r = await startRecording(() => void finish(false));
      if (!pressed.current) {
        // soltou antes de começar (ex.: pedido de permissão do microfone)
        r.cancel();
        onError('Microfone liberado! Agora segure o botão 🎤 enquanto fala.');
        return;
      }
      rec.current = r;
      setElapsed(0); setRecording(true);
    } catch (e) { onError((e as Error).message); }
  };
  const release = (cancel: boolean) => {
    pressed.current = false;
    void finish(cancel);
  };

  const hasText = !!text.trim();
  return (
    <div className="flex items-center gap-1.5 border-t border-white/10 p-2">
      {recording ? (
        <div className={cx('flex h-10 flex-1 items-center gap-2 rounded-xl px-3 text-sm', willCancel ? 'bg-red-500/15 text-red-300' : 'bg-white/[0.05]')}>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="tabular-nums">{fmtSec(elapsed)}</span>
          <span className="ml-auto text-xs text-zinc-400">{willCancel ? 'Solte para cancelar' : '◀ arraste para cancelar · solte para enviar'}</span>
        </div>
      ) : (
        <>
          <button onClick={() => setTray(tray === 'stickers' ? null : 'stickers')} aria-label="Figurinhas" className={cx('rounded-lg p-2', tray === 'stickers' ? 'text-accent-soft' : 'text-zinc-400 hover:text-white')}>
            {tray === 'stickers' ? <StickerIcon size={19} /> : <Smile size={19} />}
          </button>
          <button onClick={() => setTray(tray === 'attach' ? null : 'attach')} aria-label="Enviar foto" className={cx('rounded-lg p-2', tray === 'attach' ? 'text-accent-soft' : 'text-zinc-400 hover:text-white')}>
            <Plus size={19} />
          </button>
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
            <input
              className="input h-10 w-full py-0 text-sm" value={text} maxLength={200} onChange={(e) => setText(e.target.value)}
              onFocus={() => setTray(null)}
              placeholder={scope === 'team' ? 'Mensagem para o seu time…' : 'Mensagem para todos…'} aria-label="Mensagem do chat"
            />
          </form>
        </>
      )}
      {hasText && !recording ? (
        <button onClick={onSend} aria-label="Enviar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Send size={16} /></button>
      ) : (
        <button
          aria-label="Segure para gravar áudio" title="Segure para gravar áudio"
          className={cx('flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-full text-white transition', recording ? 'scale-125 bg-red-500' : 'bg-accent')}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void begin(e.clientX); }}
          onPointerMove={(e) => { if (recording) setWillCancel(startX.current - e.clientX > 70); }}
          onPointerUp={() => release(willCancel)}
          onPointerCancel={() => release(true)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Mic size={18} />
        </button>
      )}
    </div>
  );
}
