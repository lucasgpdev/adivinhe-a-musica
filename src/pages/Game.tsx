import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, Check, ChevronRight, Divide, Ear, Flame, Loader2, Mic, Pause, Play, RotateCcw, Sparkles, Trophy, User, WifiOff, X, Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, AudioLoadError } from '../audio/AudioEngine';
import { sfx } from '../audio/sfx';
import { Button, useConfirm } from '../components/ui';
import { Avatar, TimerRing, Waveform } from '../components/visuals';
import { DIFFICULTY_NAME } from '../data/artists';
import { HINT_INFO, MAX_HINTS_PER_MATCH, MYSTERY_LEVELS } from '../data/modes';
import { comboMultiplier } from '../game/scoring';
import {
  abort, advance, answer, applyHint, beginTurn, canUseHint, createSession, currentPlayerId, isMulti, replaceCurrentTrack,
  standings, type Session,
} from '../game/session';
import { filterPool } from '../services/catalog';
import { useStore, type GameLaunch } from '../state/AppStore';
import type { HintId, Track } from '../types';
import { cx, fmtNumber } from '../utils';

const LETTERS = ['A', 'B', 'C', 'D'];
type AudioUi = 'loading' | 'playing' | 'paused' | 'blocked' | 'error';

export function GamePage({ launch }: { launch: GameLaunch }) {
  const { data, tracks, updateCatalog, finishGame, go, toast } = useStore();
  const confirm = useConfirm();
  const settings = data.settings;
  const autoAdvance = settings.autoAdvance && !settings.presenter;

  const [session, setSession] = useState<Session>(() => {
    const players = launch.playerIds
      .map((id) => data.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const pool = launch.config.fixedQuestionIds ? tracks : filterPool(tracks, launch.config.filters);
    return createSession(launch.config, players, pool, tracks);
  });
  const sRef = useRef(session);
  sRef.current = session;

  const engine = useRef<AudioEngine>();
  if (!engine.current) engine.current = new AudioEngine();
  const [audio, setAudio] = useState<AudioUi>('loading');
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  timerRef.current = timerStart;
  const [now, setNow] = useState(() => performance.now());
  const [shake, setShake] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [netError, setNetError] = useState<string | null>(null);
  const failStreak = useRef(0);
  const finished = useRef(false);

  const q = session.question;
  const multi = isMulti(session);
  const pid = currentPlayerId(session);
  const turn = session.turns[pid];
  const player = session.players.find((p) => p.id === pid);
  const turnKey = q ? `${q.index}-${session.turnIdx}-${q.track.id}-${retry}` : 'none';
  const inQuestion = session.phase === 'question';

  // Volume
  useEffect(() => engine.current!.setVolume(settings.volume), [settings.volume]);

  // Eventos reais do player
  useEffect(() => {
    const e = engine.current!;
    const off1 = e.on('playing', () => {
      setAudio('playing');
      if (sRef.current.phase === 'question') setTimerStart((t) => t ?? performance.now());
    });
    const off2 = e.on('paused', () => setAudio((a) => (a === 'playing' ? 'paused' : a)));
    return () => { off1(); off2(); e.dispose(); };
  }, []);

  const snippetSeconds = useCallback((s: Session) => {
    const qq = s.question!;
    if (s.config.mode.mysterious) return MYSTERY_LEVELS[s.turns[currentPlayerId(s)]?.mysteryLevel ?? 0].seconds;
    return qq.snippetSec;
  }, []);

  const onAudioFail = useCallback((err: unknown) => {
    const s = sRef.current;
    const qq = s.question;
    if (!qq) return;
    const e = err instanceof AudioLoadError ? err : new AudioLoadError('unknown', 'Falha ao reproduzir a prévia.');
    // falhas da própria faixa contam para tirá-la do catálogo; falhas de rede não
    if (e.kind === 'unsupported' || e.kind === 'decode') {
      updateCatalog((c) => ({ ...c, failures: { ...c.failures, [qq.track.trackId]: (c.failures[qq.track.trackId] ?? 0) + 1 } }));
    }
    failStreak.current++;
    if (failStreak.current >= 4) {
      setAudio('error');
      setNetError(e.kind === 'network' || e.kind === 'timeout'
        ? 'Não foi possível carregar as prévias. Verifique a conexão com a internet.'
        : 'Várias prévias seguidas falharam ao carregar.');
      return;
    }
    toast(`${e.message} Trocamos por outra música verificada — ninguém perde pontos.`, 'info');
    setSession(replaceCurrentTrack(s));
  }, [toast, updateCatalog]);

  // Carrega e toca a prévia a cada novo turno
  useEffect(() => {
    if (!inQuestion || !q) return;
    let cancelled = false;
    setTimerStart(null);
    setAudio('loading');
    const e = engine.current!;
    (async () => {
      try {
        await e.load(q.track.previewUrl);
        if (cancelled) return;
        failStreak.current = 0;
        setNetError(null);
        sfx.suspense();
        try {
          await e.playSnippet(q.snippetStart, snippetSeconds(sRef.current));
        } catch (err) {
          if (err instanceof AudioLoadError && err.kind === 'blocked') { if (!cancelled) setAudio('blocked'); return; }
          throw err;
        }
      } catch (err) {
        if (!cancelled && !(err instanceof AudioLoadError && err.message === 'Carregamento substituído.')) onAudioFail(err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, inQuestion]);

  // Cronômetro (só corre depois que o áudio realmente começou)
  useEffect(() => {
    if (timerStart === null || !inQuestion) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [timerStart, inQuestion]);

  const elapsedMs = timerStart !== null ? Math.max(0, now - timerStart) : 0;
  const remaining = q ? Math.max(0, q.timeSec - elapsedMs / 1000) : 0;
  const lastTick = useRef(0);
  useEffect(() => {
    if (!inQuestion || timerStart === null) return;
    const sec = Math.ceil(remaining);
    if (sec <= 3 && sec > 0 && sec !== lastTick.current) { lastTick.current = sec; sfx.tick(); }
    if (remaining <= 0) submit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, inQuestion, timerStart]);

  const submit = useCallback((optionId: string | null) => {
    const s = sRef.current;
    if (s.phase !== 'question') return;
    if (timerRef.current === null) return; // ainda não começou a tocar
    const el = performance.now() - timerRef.current;
    const out = answer(s, optionId, el);
    if (out.ignored) return;
    const id = currentPlayerId(s);
    if (out.secondChance) {
      sfx.wrong();
      setShake(optionId);
      setTimeout(() => setShake(null), 600);
      toast('Segunda chance! Você ainda pode acertar (vale metade dos pontos).', 'info');
      setSession(out.session);
      return;
    }
    const t = out.session.turns[id];
    if (!isMulti(s)) {
      if (t.correct) {
        sfx.correct();
        const st = out.session.players[0].streak;
        if ([3, 6, 10].includes(st) && s.config.combo) setTimeout(() => sfx.combo(), 250);
      } else if (optionId) { sfx.wrong(); setShake(optionId); setTimeout(() => setShake(null), 600); }
      else sfx.timeout();
    } else {
      if (!optionId) sfx.timeout();
      engine.current!.stop();
    }
    setSession(out.session);
  }, [toast]);

  const next = useCallback(() => {
    const s = sRef.current;
    if (s.phase === 'reveal' || s.phase === 'locked') {
      const n = advance(s);
      if (n.phase === 'handoff') engine.current!.stop();
      setSession(n);
    }
  }, []);

  const startTurn = useCallback(() => setSession((s) => beginTurn(s)), []);

  // Avanço automático (~2s após a resposta)
  useEffect(() => {
    if (session.phase === 'locked') {
      const t = setTimeout(next, 1300);
      return () => clearTimeout(t);
    }
    if (session.phase === 'reveal' && autoAdvance) {
      const t = setTimeout(next, multi ? 4200 : 2200);
      return () => clearTimeout(t);
    }
  }, [session.phase, session.question?.index, session.turnIdx, autoAdvance, multi, next]);

  // Revelação multi: efeito sonoro e retomada da música
  useEffect(() => {
    if (session.phase === 'reveal' && multi) {
      const anyRight = Object.values(session.turns).some((t) => t.correct);
      if (anyRight) sfx.correct(); else sfx.wrong();
    }
  }, [session.phase, multi, session.turns]);

  // Fim de jogo
  const [fatal, setFatal] = useState<string | null>(null);
  useEffect(() => {
    if (session.phase !== 'finished' || finished.current) return;
    finished.current = true;
    engine.current!.stop();
    if (session.players.every((p) => p.answers.length === 0)) {
      if (session.finishedReason === 'aborted') { go({ name: 'home' }); return; }
      setFatal('Não há músicas verificadas suficientes para esta configuração. Escolha outros gêneros ou filtros.');
      return;
    }
    const result = finishGame(session, launch);
    for (const [playerId, ids] of Object.entries(result.newAchievements)) {
      const name = session.players.find((p) => p.id === playerId)?.name ?? '';
      ids.forEach((a, i) => setTimeout(() => { sfx.achievement(); toast(name, 'achievement', a); }, 700 + i * 900));
    }
    go({ name: 'result', result });
  }, [session, launch, finishGame, go, toast]);

  // Teclado: 1-4 / A-D respondem; espaço = play/pause; Enter/→ = avançar
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const s = sRef.current;
      if (s.phase === 'question' && s.question) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key) >= 0 ? ['1', '2', '3', '4'].indexOf(e.key) : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
        if (idx >= 0 && s.question.options[idx]) { e.preventDefault(); submit(s.question.options[idx].id); }
        if (e.key === ' ') { e.preventDefault(); void engine.current!.toggle().catch(() => undefined); }
      } else if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        if (s.phase === 'handoff') { e.preventDefault(); startTurn(); }
        else if (s.phase === 'reveal' || s.phase === 'locked') { e.preventDefault(); next(); }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [submit, next, startTurn]);

  const quit = async () => {
    const ok = await confirm({
      title: 'Encerrar partida?',
      message: launch.context.kind.startsWith('champ')
        ? 'Esta é uma partida de campeonato. Se encerrar agora, nada será registrado e ela poderá ser jogada novamente.'
        : 'As respostas já dadas serão registradas no histórico e no ranking.',
      confirmLabel: 'Encerrar', danger: true,
    });
    if (ok) setSession(abort(sRef.current));
  };

  const useHintAction = (h: HintId) => {
    const r = applyHint(sRef.current, h);
    if (!r.ok) { toast(r.reason, 'info'); return; }
    setSession(r.session);
    if (h === 'more') {
      const lvl = r.session.turns[currentPlayerId(r.session)].mysteryLevel;
      void engine.current!.extendSnippet(MYSTERY_LEVELS[lvl].seconds).catch(() => undefined);
    }
  };

  const togglePlay = () => {
    engine.current!.toggle().catch((err) => {
      if (err instanceof AudioLoadError && err.kind === 'blocked') setAudio('blocked');
    });
  };

  if (fatal) {
    return (
      <Centered>
        <div className="glass max-w-lg p-8 text-center">
          <X className="mx-auto mb-3 text-red-300" size={36} />
          <h2 className="h-display text-2xl">Não foi possível iniciar</h2>
          <p className="mt-2 text-zinc-400">{fatal}</p>
          <Button className="mt-6" variant="primary" onClick={() => go({ name: 'home' })}>Voltar ao menu</Button>
        </div>
      </Centered>
    );
  }
  if (!q || session.phase === 'finished') return <Centered><Loader2 className="animate-spin text-accent" size={36} /></Centered>;

  const answeredTurn = session.phase === 'reveal' || session.phase === 'locked';
  const st = standings(session);

  return (
    <div className="relative flex min-h-screen flex-col">
      <GameHeader session={session} onQuit={quit} />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-8 md:px-6">
        <AnimatePresence mode="wait">
          {session.phase === 'handoff' && player && (
            <motion.div key={`h-${turnKey}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="label mb-4">{session.config.mode.name} · Música {q.index + 1}{session.config.questions ? ` de ${session.config.questions}` : ''}</div>
              <Avatar id={player.avatar} size={120} ring />
              <div className="mt-6 text-zinc-400">Vez de</div>
              <div className="h-display text-5xl md:text-6xl">{player.name}</div>
              <p className="mt-3 max-w-md text-sm text-zinc-500">Os outros jogadores não devem olhar a tela. A resposta só será revelada quando todos tiverem respondido.</p>
              <Button variant="primary" size="xl" className="mt-8" onClick={startTurn} icon={<Play size={22} />}>Estou pronto</Button>
              {session.turnOrder[session.turnIdx + 1] && (
                <div className="mt-6 text-sm text-zinc-500">Próximo: <span className="text-zinc-300">{session.players.find((p) => p.id === session.turnOrder[session.turnIdx + 1])?.name}</span></div>
              )}
              <MiniStandings session={session} />
            </motion.div>
          )}

          {(session.phase === 'question' || answeredTurn) && (
            <motion.div key={`q-${q.index}-${session.turnIdx}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex flex-1 flex-col">
              {/* Jogador da vez + badges */}
              <div className="mb-4 mt-2 flex flex-wrap items-center justify-center gap-2">
                {multi && player && (
                  <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-sm">
                    <Avatar id={player.avatar} size={26} /> <b>{player.name}</b>
                  </span>
                )}
                {q.bonus && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">Rodada bônus · pontos em dobro</span>}
                {q.steal && <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fuchsia-300">Roubo de pontos · o mais rápido leva tudo</span>}
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-zinc-400">{DIFFICULTY_NAME[q.difficulty]}</span>
              </div>

              {/* Player */}
              <div className="glass relative flex flex-col items-center px-6 py-6">
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="w-24 text-left">
                    {session.config.mode.mysterious && turn && (
                      <div className="text-xs text-zinc-500">Trecho<br /><b className="text-lg text-zinc-200">{MYSTERY_LEVELS[turn.mysteryLevel].seconds}s</b></div>
                    )}
                  </div>
                  <button
                    onClick={togglePlay}
                    disabled={audio === 'loading' || audio === 'error'}
                    className={cx(
                      'relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-white shadow-glow transition hover:scale-105 disabled:opacity-60 md:h-28 md:w-28',
                      audio === 'playing' && 'pulse-ring',
                    )}
                    aria-label={audio === 'playing' ? 'Pausar' : 'Tocar'}
                  >
                    {audio === 'loading' ? <Loader2 className="animate-spin" size={40} /> : audio === 'playing' ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
                  </button>
                  <div className="flex w-24 justify-end">
                    {inQuestion ? <TimerRing remaining={timerStart === null ? q.timeSec : remaining} total={q.timeSec} /> : <div className="h-[92px]" />}
                  </div>
                </div>
                <Waveform playing={audio === 'playing'} />
                <div className="h-5 text-center text-sm text-zinc-500">
                  {audio === 'loading' && 'Carregando prévia oficial…'}
                  {audio === 'blocked' && <span className="text-amber-300">Clique no botão para ouvir — o cronômetro começa quando a música tocar.</span>}
                  {audio === 'paused' && inQuestion && 'Pausado · o tempo continua correndo'}
                  {audio === 'playing' && inQuestion && 'Que música é essa?'}
                </div>
                {/* Dicas reveladas */}
                {turn && (turn.hints.includes('artist') || turn.hints.includes('decade')) && inQuestion && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {turn.hints.includes('artist') && <span className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-sm text-accent-soft"><Mic size={14} /> {q.track.artistName}</span>}
                    {turn.hints.includes('decade') && q.track.year && <span className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-sm text-accent-soft"><Calendar size={14} /> Lançamento: {q.track.year} (anos {Math.floor(q.track.year / 10) * 10})</span>}
                  </div>
                )}
              </div>

              {/* Dicas */}
              {inQuestion && session.config.hints.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {session.config.hints.map((h) => {
                    const reason = canUseHint(session, h);
                    return (
                      <button
                        key={h} onClick={() => useHintAction(h)} disabled={!!reason || timerStart === null} title={reason ?? HINT_INFO[h].description}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-accent/50 hover:bg-accent/10 disabled:opacity-35"
                      >
                        {h === 'artist' && <User size={15} />}{h === 'decade' && <Calendar size={15} />}{h === 'fifty' && <Divide size={15} />}{h === 'more' && <Ear size={15} />}
                        {HINT_INFO[h].name}
                        <span className="text-xs text-zinc-500">{h === 'more' ? `${Math.round(MYSTERY_LEVELS[Math.min(3, (turn?.mysteryLevel ?? 0) + 1)].factor * 100)}%` : `−${HINT_INFO[h].penalty * 100}%`}</span>
                      </button>
                    );
                  })}
                  {!session.config.mode.mysterious && player && (
                    <span className="text-xs text-zinc-600">{MAX_HINTS_PER_MATCH - player.hintsUsed} dica(s) restante(s)</span>
                  )}
                </div>
              )}

              {/* Alternativas */}
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {q.options.map((o, i) => (
                  <OptionButton
                    key={o.id} track={o} letter={LETTERS[i]} session={session}
                    disabled={!inQuestion || timerStart === null || !!turn?.eliminated.includes(o.id)}
                    shake={shake === o.id}
                    onClick={() => submit(o.id)}
                  />
                ))}
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {session.phase === 'locked' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 flex items-center justify-center gap-3 text-lg">
                    <Check className="text-accent-soft" /> Resposta registrada. Passe para o próximo jogador.
                  </motion.div>
                )}
                {session.phase === 'reveal' && !multi && turn && <RevealSolo session={session} />}
              </AnimatePresence>

              {session.phase === 'reveal' && multi && <RevealMulti session={session} order={st} />}

              {answeredTurn && (!autoAdvance || session.phase === 'locked') && (
                <div className="mt-6 flex justify-center">
                  <Button variant="primary" size="lg" onClick={next} icon={<ChevronRight size={20} />}>
                    {session.phase === 'locked' ? 'Próximo jogador' : 'Continuar'}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {netError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur">
          <div className="glass-strong max-w-md p-8 text-center">
            <WifiOff className="mx-auto mb-3 text-amber-300" size={40} />
            <h2 className="h-display text-2xl">Problema de reprodução</h2>
            <p className="mt-2 text-zinc-400">{netError} Nenhum ponto foi perdido.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="ghost" onClick={() => setSession(abort(sRef.current))}>Encerrar partida</Button>
              <Button variant="primary" icon={<RotateCcw size={16} />} onClick={() => { failStreak.current = 0; setNetError(null); setRetry((r) => r + 1); }}>Tentar novamente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-4">{children}</div>;
}

function GameHeader({ session, onQuit }: { session: Session; onQuit: () => void }) {
  const q = session.question!;
  const multi = isMulti(session);
  const p = session.players.find((x) => x.id === currentPlayerId(session)) ?? session.players[0];
  const total = session.config.questions;
  const progress = total ? (q.index + (session.phase === 'reveal' ? 1 : 0)) / total : 0;
  const mult = session.config.combo ? comboMultiplier(p.streak) : 1;
  return (
    <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-6">
        <button onClick={onQuit} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Encerrar partida"><X size={20} /></button>
        <div className="min-w-0">
          <div className="label">{session.config.mode.name}{!session.config.ranked && ' · amistosa'}</div>
          <div className="h-display text-lg tabular-nums">
            {total ? <>Música {q.index + 1}<span className="text-zinc-500"> / {total}</span></> : <>Rodada {q.index + 1}</>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          {!multi && p.streak >= 2 && (
            <motion.div key={p.streak} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 text-amber-300">
              <Flame size={18} /> <span className="font-semibold tabular-nums">{p.streak}</span>
              {mult > 1 && <span className="rounded bg-amber-400/15 px-1.5 text-xs font-bold">x{mult}</span>}
            </motion.div>
          )}
          {session.config.endOnWrong && multi && (
            <div className="text-sm text-zinc-400"><b className="text-white">{session.players.filter((x) => !x.eliminated).length}</b> vivos</div>
          )}
          <div className="text-right">
            <div className="label">{multi ? 'Líder' : 'Pontos'}</div>
            <div className="h-display text-xl tabular-nums">{fmtNumber(multi ? standings(session)[0].score : p.score)}</div>
          </div>
        </div>
      </div>
      {total ? (
        <div className="h-1 w-full bg-white/[0.04]">
          <motion.div className="h-full bg-gradient-to-r from-accent-deep to-accent" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
      ) : null}
    </div>
  );
}

function OptionButton({ track, letter, session, disabled, shake, onClick }: { track: Track; letter: string; session: Session; disabled: boolean; shake: boolean; onClick: () => void }) {
  const q = session.question!;
  const turn = session.turns[currentPlayerId(session)];
  const revealSolo = session.phase === 'reveal' && !isMulti(session);
  const revealMulti = session.phase === 'reveal' && isMulti(session);
  const isCorrect = track.id === q.track.id;
  const selected = turn?.selectedId === track.id;
  const eliminated = turn?.eliminated.includes(track.id);
  let state = 'idle';
  if ((revealSolo || revealMulti) && isCorrect) state = 'correct';
  else if (revealSolo && selected) state = 'wrong';
  else if (session.phase === 'locked' && selected) state = 'locked';
  else if (eliminated) state = 'eliminated';
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cx(
        'group flex min-h-[72px] items-center gap-4 rounded-2xl border px-4 py-3 text-left transition duration-200',
        state === 'idle' && 'border-white/10 bg-white/[0.04] hover:border-accent/60 hover:bg-accent/10 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04]',
        state === 'correct' && 'border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_40px_-10px_rgba(52,211,153,0.6)]',
        state === 'wrong' && 'border-red-400/60 bg-red-500/15',
        state === 'locked' && 'border-accent/60 bg-accent/15',
        state === 'eliminated' && 'border-white/5 bg-transparent opacity-30 line-through',
        shake && 'animate-shake border-red-400/60 bg-red-500/10',
        disabled && state === 'idle' && 'cursor-default',
      )}
    >
      <span className={cx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
        state === 'correct' ? 'bg-emerald-400 text-ink-950' : state === 'wrong' ? 'bg-red-400 text-ink-950' : 'bg-white/[0.07] text-zinc-300 group-hover:bg-accent group-hover:text-white',
      )}>
        {state === 'correct' ? <Check size={20} /> : state === 'wrong' ? <X size={20} /> : letter}
      </span>
      <span className="h-display text-lg leading-snug md:text-xl">{track.displayTitle}</span>
    </motion.button>
  );
}

function SongCard({ track }: { track: Track }) {
  return (
    <div className="flex items-center gap-4">
      {track.artworkUrl ? (
        <img src={track.artworkUrl} alt="" className="h-20 w-20 rounded-xl object-cover shadow-lg" referrerPolicy="no-referrer" />
      ) : <div className="h-20 w-20 rounded-xl bg-white/5" />}
      <div className="min-w-0 text-left">
        <div className="h-display truncate text-xl">{track.title}</div>
        <div className="truncate text-zinc-300">{track.artistName}</div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {track.featured.length > 0 && <>Participação: {track.featured.join(', ')} · </>}
          {track.year && <>{track.year} · </>}
          {track.explicitness === 'cleaned' ? 'Versão limpa' : track.explicitness === 'explicit' ? 'Versão explícita' : 'Sem conteúdo explícito'}
        </div>
      </div>
    </div>
  );
}

function RevealSolo({ session }: { session: Session }) {
  const q = session.question!;
  const t = session.turns[session.turnOrder[0]];
  const p = session.players[0];
  const pts = (t.breakdown?.total ?? 0) + (t.steal ?? 0);
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={cx('glass mt-6 flex flex-wrap items-center justify-between gap-4 p-5', t.correct ? 'border-emerald-400/30' : 'border-red-400/25')}>
      <SongCard track={q.track} />
      <div className="text-right">
        {t.correct ? (
          <>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300 }} className="h-display text-4xl text-emerald-300">+{fmtNumber(pts)}</motion.div>
            <div className="mt-1 flex flex-wrap justify-end gap-2 text-xs text-zinc-400">
              {t.breakdown && t.breakdown.speed > 0 && <span className="flex items-center gap-1"><Zap size={12} />+{t.breakdown.speed} velocidade</span>}
              {t.breakdown && t.breakdown.multiplier > 1 && <span className="flex items-center gap-1 text-amber-300"><Flame size={12} />x{t.breakdown.multiplier}</span>}
              {t.usedSecondChance && <span>segunda chance (½)</span>}
              {t.breakdown && t.breakdown.hintPenalty > 0 && <span>dicas −{Math.round(t.breakdown.hintPenalty * 100)}%</span>}
            </div>
            {p.streak >= 3 && <div className="mt-1 text-sm text-amber-300">{p.streak} acertos seguidos!</div>}
          </>
        ) : (
          <>
            <div className="h-display text-2xl text-red-300">{t.timedOut ? 'Tempo esgotado' : 'Não foi dessa vez'}</div>
            <div className="text-sm text-zinc-500">+0 pontos · a resposta correta está acima</div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function RevealMulti({ session, order }: { session: Session; order: ReturnType<typeof standings> }) {
  const q = session.question!;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid gap-4 md:grid-cols-[1fr_1.1fr]">
      <div className="glass p-5">
        <div className="label mb-3">Resposta correta</div>
        <SongCard track={q.track} />
      </div>
      <div className="glass p-5">
        <div className="label mb-3 flex items-center gap-2"><Trophy size={14} /> Classificação ao vivo</div>
        <div className="space-y-1.5">
          {order.map((p, i) => {
            const t = session.turns[p.id];
            const gained = t ? (t.breakdown?.total ?? 0) + (t.steal ?? 0) : null;
            return (
              <motion.div layout key={p.id} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', i === 0 ? 'bg-gold/10' : 'bg-white/[0.03]', p.eliminated && 'opacity-50')}>
                <span className="w-5 text-center text-sm font-bold text-zinc-400">{i + 1}</span>
                <Avatar id={p.avatar} size={28} />
                <span className="flex-1 truncate font-medium">{p.name}{p.eliminated && <span className="ml-2 text-xs text-red-300">eliminado</span>}</span>
                {t && (t.correct ? <Check size={16} className="text-emerald-300" /> : <X size={16} className="text-red-300" />)}
                {gained !== null && <span className={cx('w-16 text-right text-sm tabular-nums', gained > 0 ? 'text-emerald-300' : 'text-zinc-600')}>+{gained}</span>}
                {t?.steal ? <span className="text-xs text-fuchsia-300"><Sparkles size={12} className="inline" /> roubo</span> : null}
                <span className="h-display w-16 text-right tabular-nums">{fmtNumber(p.score)}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function MiniStandings({ session }: { session: Session }) {
  const order = useMemo(() => standings(session), [session]);
  if (!session.question || session.question.index === 0) return null;
  return (
    <div className="mt-10 flex flex-wrap justify-center gap-2">
      {order.map((p, i) => (
        <span key={p.id} className={cx('flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm', p.eliminated && 'opacity-40 line-through')}>
          <b className="text-zinc-500">{i + 1}º</b> {p.name} <span className="tabular-nums text-zinc-400">{fmtNumber(p.score)}</span>
        </span>
      ))}
    </div>
  );
}
