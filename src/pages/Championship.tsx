import { motion } from 'framer-motion';
import { ArrowLeft, Ban, Check, ChevronRight, Crown, ListOrdered, Play, Plus, RotateCcw, Swords, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createChampionship, hasPlayedQualifying, pendingBout, qualifyingStandings, resetPhase, startKnockout,
} from '../championship/championship';
import { Badge, Button, Chip, Empty, Modal, PageHeader, useConfirm } from '../components/ui';
import { Avatar, Confetti, Podium } from '../components/visuals';
import { CATEGORIES } from '../data/artists';
import { buildConfig } from '../game/config';
import type { SessionConfig } from '../game/session';
import { filterPool } from '../services/catalog';
import { useStore } from '../state/AppStore';
import type { Bout, CategoryId, Championship, ChampionshipPhase } from '../types';
import { cx, fmtDate, fmtNumber, makeRng, pct } from '../utils';

const STATUS_LABEL: Record<Championship['status'], string> = {
  classificatoria: 'Classificatória', semifinal: 'Semifinal', final: 'Final', encerrado: 'Encerrado', cancelado: 'Cancelado',
};

function useTeacherGuard() {
  const { data, teacherUnlocked, toast, go } = useStore();
  return () => {
    if (!data.settings.teacherPin || teacherUnlocked) return true;
    toast('Ação do professor: desbloqueie o painel com o PIN primeiro.', 'info');
    go({ name: 'teacher' });
    return false;
  };
}

export function ChampionshipPage({ id }: { id?: string }) {
  const { data, go } = useStore();
  const [creating, setCreating] = useState(false);
  const guard = useTeacherGuard();
  const ch = id ? data.championships.find((c) => c.id === id) : undefined;
  if (ch) return <ChampionshipDetail ch={ch} />;
  const list = data.championships.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <PageHeader
        title="Campeonato da Turma"
        subtitle="Classificatória com as mesmas músicas para todos, semifinais e final em duelos com músicas difíceis. Campeonatos antigos ficam guardados."
        actions={<Button variant="primary" icon={<Plus size={18} />} onClick={() => guard() && setCreating(true)}>Novo campeonato</Button>}
      />
      {list.length === 0 ? (
        <Empty icon={<Trophy size={28} />} title="Nenhum campeonato ainda" text="O professor pode criar um campeonato e chamar os participantes pela fila." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => {
            const champ = c.podium?.first ? data.players.find((p) => p.id === c.podium!.first) : undefined;
            return (
              <button key={c.id} onClick={() => go({ name: 'championship', id: c.id })} className="glass flex items-center gap-4 p-5 text-left transition hover:border-accent/40">
                <span className={cx('rounded-xl p-3', c.status === 'encerrado' ? 'bg-gold/15 text-gold' : c.status === 'cancelado' ? 'bg-white/5 text-zinc-500' : 'bg-accent/15 text-accent-soft')}><Trophy /></span>
                <div className="flex-1">
                  <div className="h-display text-lg">{c.name}</div>
                  <div className="text-sm text-zinc-400">{fmtDate(c.createdAt)} · {c.participantIds.length} participantes</div>
                  {champ && <div className="mt-1 text-sm text-gold"><Crown size={14} className="inline" /> {champ.name}</div>}
                </div>
                <Badge tone={c.status === 'encerrado' ? 'gold' : c.status === 'cancelado' ? 'default' : 'accent'}>{STATUS_LABEL[c.status]}</Badge>
                <ChevronRight className="text-zinc-600" />
              </button>
            );
          })}
        </div>
      )}
      <CreateChampionship open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateChampionship({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, tracks, update, go, toast } = useStore();
  const active = data.players.filter((p) => !p.archived);
  const [name, setName] = useState(`Campeonato ${new Date().toLocaleDateString('pt-BR')}`);
  const [sel, setSel] = useState<string[]>([]);
  const [questions, setQuestions] = useState(10);
  const [timeSec, setTimeSec] = useState(15);
  const [cats, setCats] = useState<CategoryId[]>([]);
  const pool = filterPool(tracks, { categories: cats, artists: [], extra: 'random' });
  const need = questions * 4;
  const create = () => {
    if (sel.length < 2) { toast('Selecione pelo menos 2 participantes.', 'error'); return; }
    try {
      const ch = createChampionship(name, sel, { questions, timeSec, categories: cats, artists: [] }, pool, makeRng(Date.now()));
      if (ch.qualifying.questionIds.length < questions) { toast('Músicas insuficientes para estes filtros.', 'error'); return; }
      update((d) => ({ ...d, championships: [...d.championships, ch] }), { action: 'Campeonato criado', details: `${ch.name} · ${sel.length} participantes` });
      onClose();
      go({ name: 'championship', id: ch.id });
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Novo campeonato" wide>
      <div className="space-y-5">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do campeonato" />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Participantes ({sel.length})</span>
            <button className="text-sm text-accent-soft" onClick={() => setSel(sel.length === active.length ? [] : active.map((p) => p.id))}>{sel.length === active.length ? 'Limpar' : 'Selecionar todos'}</button>
          </div>
          {active.length === 0 ? <p className="text-sm text-zinc-500">Cadastre participantes primeiro (tela de identificação ou fila).</p> : (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {active.map((p) => <Chip key={p.id} active={sel.includes(p.id)} onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])}>{p.name}</Chip>)}
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-500">Com 4 ou mais participantes, os 4 melhores vão às semifinais. Com 2 ou 3, os 2 melhores vão direto à final.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium">Músicas por partida: {questions}</span><input type="range" min={5} max={15} value={questions} onChange={(e) => setQuestions(+e.target.value)} className="w-full accent-[rgb(var(--accent))]" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Tempo por música: {timeSec}s</span><input type="range" min={8} max={20} value={timeSec} onChange={(e) => setTimeSec(+e.target.value)} className="w-full accent-[rgb(var(--accent))]" /></label>
        </div>
        <div>
          <div className="label mb-2">Gêneros</div>
          <div className="flex flex-wrap gap-2">
            <Chip active={!cats.length} onClick={() => setCats([])}>Todos</Chip>
            {CATEGORIES.map((c) => <Chip key={c.id} active={cats.includes(c.id)} onClick={() => setCats(cats.includes(c.id) ? cats.filter((x) => x !== c.id) : [...cats, c.id])}>{c.name}</Chip>)}
          </div>
          <p className={cx('mt-2 text-xs', pool.length < need ? 'text-amber-300' : 'text-zinc-500')}>{pool.length} músicas disponíveis · recomendado: {need} (sem repetir entre as fases)</p>
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={create}>Criar campeonato</Button></div>
      </div>
    </Modal>
  );
}

export function champConfig(ch: Championship, phase: ChampionshipPhase, questionIds: string[], settings: Parameters<typeof buildConfig>[1]): SessionConfig {
  const base = buildConfig(phase === 'classificatoria' ? 'classic' : 'duel', settings, { categories: ch.config.categories, artists: [], extra: 'random' });
  return {
    ...base,
    questions: questionIds.length,
    timeSec: ch.config.timeSec,
    secondChance: false,
    fixedQuestionIds: questionIds,
    championshipId: ch.id,
    championshipPhase: phase,
    ranked: true,
  };
}

function ChampionshipDetail({ ch }: { ch: Championship }) {
  const { data, tracks, update, go, backup, toast } = useStore();
  const confirm = useConfirm();
  const guard = useTeacherGuard();
  const name = (id?: string) => data.players.find((p) => p.id === id)?.name ?? '—';
  const avatar = (id?: string) => data.players.find((p) => p.id === id)?.avatar ?? 'mic';
  const qual = useMemo(() => qualifyingStandings(ch, data.matches), [ch, data.matches]);
  const pool = filterPool(tracks, { categories: ch.config.categories, artists: [], extra: 'random' });
  const steps: Championship['status'][] = ['classificatoria', 'semifinal', 'final', 'encerrado'];
  const stepIdx = steps.indexOf(ch.status);
  const setCh = (fn: (c: Championship) => Championship, action: string, details?: string) =>
    update((d) => ({ ...d, championships: d.championships.map((c) => (c.id === ch.id ? fn(c) : c)) }), { action, details: `${ch.name}${details ? ' · ' + details : ''}` });

  const playQual = (pid: string) => {
    if (hasPlayedQualifying(ch, pid)) { toast(`${name(pid)} já jogou a classificatória.`, 'info'); return; }
    go({ name: 'game', launch: { config: champConfig(ch, 'classificatoria', ch.qualifying.questionIds, data.settings), playerIds: [pid], context: { kind: 'champ-qual', championshipId: ch.id } } });
  };
  const playBout = (b: Bout) => {
    const phase: ChampionshipPhase = ch.status === 'final' ? 'final' : 'semifinal';
    go({ name: 'game', launch: { config: champConfig(ch, phase, b.questionIds, data.settings), playerIds: [b.a, b.b], context: { kind: 'champ-bout', championshipId: ch.id, boutId: b.id } } });
  };
  const queuePending = () => {
    const pending = ch.participantIds.filter((p) => !hasPlayedQualifying(ch, p));
    update((d) => ({ ...d, queue: { championshipId: ch.id, items: pending.map((playerId) => ({ playerId, played: false })) } }), { action: 'Fila do campeonato montada', details: `${pending.length} participantes` });
    go({ name: 'queue' });
  };
  const startKO = async () => {
    if (!guard()) return;
    const played = qual.filter((r) => r.played).length;
    const ok = await confirm({
      title: 'Encerrar a classificatória?',
      message: <>Jogaram {played} de {ch.participantIds.length} participantes.{played < ch.participantIds.length && ' Quem não jogou ficará fora do mata-mata.'} Os {played >= 4 && ch.qualifiersCount === 4 ? 4 : 2} melhores avançam.</>,
      confirmLabel: 'Iniciar mata-mata',
    });
    if (!ok) return;
    try {
      const next = startKnockout(ch, data.matches, pool, makeRng(Date.now()));
      setCh(() => next, 'Classificatória encerrada');
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const reset = async (phase: ChampionshipPhase) => {
    if (!guard()) return;
    const ok = await confirm({
      title: `Reiniciar ${phase === 'classificatoria' ? 'a classificatória' : phase === 'semifinal' ? 'as semifinais' : 'a final'}?`,
      message: 'Os resultados desta fase (e das seguintes) deixam de valer para o campeonato. As partidas continuam no histórico geral. Um backup será criado antes.',
      danger: true, confirmLabel: 'Reiniciar', typeToConfirm: 'REINICIAR',
    });
    if (!ok) return;
    await backup(`Antes de reiniciar fase (${phase}) de ${ch.name}`);
    setCh((c) => resetPhase(c, phase), 'Fase reiniciada', phase);
  };
  const cancel = async () => {
    if (!guard()) return;
    const ok = await confirm({ title: 'Cancelar campeonato?', message: 'O campeonato será marcado como cancelado e mantido no histórico.', danger: true, typeToConfirm: 'CANCELAR', confirmLabel: 'Cancelar campeonato' });
    if (!ok) return;
    await backup(`Antes de cancelar ${ch.name}`);
    setCh((c) => ({ ...c, status: 'cancelado', endedAt: new Date().toISOString() }), 'Campeonato cancelado');
  };

  // Tela do campeão
  if (ch.status === 'encerrado' && ch.podium) {
    const finalRes = ch.final?.result;
    const champMatches = data.matches.filter((m) => m.championshipId === ch.id && m.playerId === ch.podium!.first);
    const tot = champMatches.reduce((s, m) => s + m.total, 0);
    const cor = champMatches.reduce((s, m) => s + m.correct, 0);
    return (
      <div className="mx-auto max-w-4xl text-center">
        <Confetti duration={7000} />
        <button onClick={() => go({ name: 'championship' })} className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Campeonatos</button>
        <div className="label !text-gold">{ch.name}</div>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 120 }} className="mt-4 flex flex-col items-center">
          <Crown size={56} className="text-gold drop-shadow-[0_0_20px_rgba(245,196,81,0.7)]" />
          <Avatar id={avatar(ch.podium.first)} size={140} ring />
          <div className="mt-4 text-sm uppercase tracking-[0.3em] text-gold">Campeão</div>
          <h1 className="h-display text-5xl md:text-7xl">{name(ch.podium.first)}</h1>
        </motion.div>
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-3">
          <div className="glass p-4"><div className="label">Pontos na final</div><div className="h-display text-2xl">{fmtNumber(finalRes?.scores[ch.podium.first] ?? 0)}</div></div>
          <div className="glass p-4"><div className="label">Acertos no torneio</div><div className="h-display text-2xl">{cor}/{tot}</div></div>
          <div className="glass p-4"><div className="label">Desempenho</div><div className="h-display text-2xl">{pct(tot ? cor / tot : 0)}</div></div>
        </div>
        <div className="mt-12"><Podium big entries={[ch.podium.first, ch.podium.second, ch.podium.third].filter(Boolean).map((id) => ({ id: id!, name: name(id), avatar: avatar(id), value: '' }))} /></div>
        <div className="mt-10 flex justify-center gap-2">
          <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => reset('final')}>Refazer a final</Button>
          <Button variant="primary" icon={<ListOrdered size={16} />} onClick={() => go({ name: 'hall' })}>Hall da Fama</Button>
        </div>
      </div>
    );
  }

  const pb = pendingBout(ch);
  return (
    <div>
      <PageHeader
        back={<button onClick={() => go({ name: 'championship' })} className="mb-3 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Campeonatos</button>}
        title={ch.name}
        subtitle={`${ch.participantIds.length} participantes · ${ch.config.questions} músicas por partida · ${ch.config.timeSec}s por música${ch.resets ? ` · reiniciado ${ch.resets}x` : ''}`}
        actions={ch.status !== 'cancelado' ? <Button variant="danger" icon={<Ban size={16} />} onClick={cancel}>Cancelar</Button> : <Badge>Cancelado</Badge>}
      />
      {/* Fases */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto">
        {(['Classificatória', ch.qualifiersCount === 4 ? 'Semifinal' : null, 'Final', 'Campeão'].filter(Boolean) as string[]).map((label, i, arr) => {
          const idx = ch.qualifiersCount === 4 ? i : i === 0 ? 0 : i + 1;
          const done = stepIdx > idx;
          const cur = stepIdx === idx;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={cx('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium', done ? 'bg-emerald-500/15 text-emerald-300' : cur ? 'bg-accent text-white shadow-glow' : 'bg-white/5 text-zinc-500')}>
                {done ? <Check size={14} /> : <span className="text-xs">{i + 1}</span>} {label}
              </span>
              {i < arr.length - 1 && <ChevronRight size={16} className="text-zinc-600" />}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="glass p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-display flex items-center gap-2 text-lg"><Users size={18} /> Classificatória</h2>
            {ch.status === 'classificatoria' && (
              <div className="flex gap-2">
                <Button size="sm" onClick={queuePending}>Montar fila</Button>
                <Button size="sm" variant="primary" onClick={startKO} disabled={qual.filter((r) => r.played).length < 2}>Encerrar fase</Button>
              </div>
            )}
            {ch.status !== 'classificatoria' && ch.status !== 'cancelado' && <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => reset('classificatoria')}>Reiniciar</Button>}
          </div>
          <div className="space-y-1.5">
            {qual.map((r, i) => {
              const qualified = ch.status !== 'classificatoria' && ([...ch.semifinals.flatMap((b) => [b.a, b.b]), ch.final?.a, ch.final?.b].includes(r.playerId));
              return (
                <div key={r.playerId} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', qualified ? 'bg-accent/10' : 'bg-white/[0.02]')}>
                  <span className="w-6 text-center text-sm font-bold text-zinc-500">{r.played ? i + 1 : '–'}</span>
                  <Avatar id={avatar(r.playerId)} size={30} />
                  <span className="flex-1 truncate font-medium">{name(r.playerId)} {qualified && <Badge tone="accent">classificado</Badge>}</span>
                  {r.played ? (
                    <><span className="text-sm text-zinc-400">{r.correct} acertos</span><span className="h-display w-20 text-right tabular-nums">{fmtNumber(r.score)}</span></>
                  ) : ch.status === 'classificatoria' ? (
                    <Button size="sm" variant="primary" icon={<Play size={14} />} onClick={() => playQual(r.playerId)}>Jogar</Button>
                  ) : <span className="text-xs text-zinc-600">não jogou</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          {ch.semifinals.length > 0 && (
            <div className="glass p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="h-display flex items-center gap-2 text-lg"><Swords size={18} /> Semifinais</h2>
                {(ch.status === 'final' || ch.status === 'semifinal') && ch.semifinals.some((b) => b.result) && <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => reset('semifinal')}>Reiniciar</Button>}
              </div>
              <div className="space-y-3">{ch.semifinals.map((b) => <BoutCard key={b.id} bout={b} name={name} avatar={avatar} onPlay={ch.status === 'semifinal' && pb?.id === b.id ? () => playBout(b) : undefined} />)}</div>
            </div>
          )}
          {ch.final && (
            <div className="glass border-gold/25 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="h-display flex items-center gap-2 text-lg text-gold"><Trophy size={18} /> Final</h2>
                <Badge tone="gold">músicas difíceis</Badge>
              </div>
              <BoutCard bout={ch.final} name={name} avatar={avatar} onPlay={ch.status === 'final' && pb?.id === ch.final.id ? () => playBout(ch.final!) : undefined} />
            </div>
          )}
          {ch.status === 'classificatoria' && (
            <div className="glass p-6 text-sm text-zinc-400">
              <p>Todos jogam as <b className="text-zinc-200">mesmas {ch.config.questions} músicas</b>. Cada participante joga uma única vez.</p>
              <p className="mt-2">Depois, {ch.qualifiersCount === 4 ? 'os 4 melhores disputam semifinais (1º × 4º e 2º × 3º)' : 'os 2 melhores disputam a final'} em duelos. Desempate: acertos, depois menor tempo total.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BoutCard({ bout, name, avatar, onPlay }: { bout: Bout; name: (id?: string) => string; avatar: (id?: string) => string; onPlay?: () => void }) {
  const r = bout.result;
  const side = (id: string) => (
    <div className={cx('flex flex-1 items-center gap-2', r && r.winnerId !== id && 'opacity-45')}>
      <Avatar id={avatar(id)} size={34} />
      <div className="min-w-0"><div className="truncate font-medium">{name(id)}</div>{r && <div className="text-xs tabular-nums text-zinc-400">{fmtNumber(r.scores[id] ?? 0)} pts · {r.correct[id] ?? 0} acertos</div>}</div>
      {r?.winnerId === id && <Crown size={16} className="ml-auto text-gold" />}
    </div>
  );
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="label mb-3">{bout.label}</div>
      <div className="flex items-center gap-3">{side(bout.a)}<span className="text-xs font-bold text-zinc-600">VS</span>{side(bout.b)}</div>
      {onPlay && <Button variant="primary" className="mt-4 w-full" icon={<Play size={16} />} onClick={onPlay}>Iniciar confronto</Button>}
    </div>
  );
}
