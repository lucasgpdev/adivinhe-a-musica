import { AlertTriangle, ArrowLeft, Check, Music2, Play, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Badge, Button, Chip, PageHeader, Segmented, Toggle } from '../components/ui';
import { Avatar } from '../components/visuals';
import { ArtistSearch } from '../components/ArtistSearch';
import { CATEGORIES } from '../data/artists';
import { MODE_BY_ID } from '../data/modes';
import { buildConfig, DEFAULT_CUSTOM, TIME_ADJUSTABLE, type CustomOptions } from '../game/config';
import { distinctTitles, filterPool } from '../services/catalog';
import { useStore, type LaunchContext } from '../state/AppStore';
import type { CategoryId, Difficulty, ExtraFilter, ModeId } from '../types';
import { cx } from '../utils';
import { addPlayer } from './Identify';

const EXTRA: { value: ExtraFilter; label: string }[] = [
  { value: 'random', label: 'Aleatórias' },
  { value: 'big-hits', label: 'Grandes sucessos' },
  { value: 'popular', label: 'Populares' },
  { value: 'hard', label: 'Difíceis' },
  { value: 'new', label: 'Atuais' },
  { value: 'old', label: 'Antigas' },
];

export function SetupPage({ mode: modeId, playerIds: preset, context, category }: { mode: ModeId; playerIds?: string[]; context?: LaunchContext; category?: CategoryId }) {
  const { data, tracks, currentPlayer, go, update, toast } = useStore();
  const mode = MODE_BY_ID[modeId];
  const solo = mode.maxPlayers === 1;
  const [selected, setSelected] = useState<string[]>(() => preset ?? (currentPlayer ? [currentPlayer.id] : []));
  const [categories, setCategories] = useState<CategoryId[]>(category ? [category] : []);
  const [artists, setArtists] = useState<string[]>([]);
  const [extra, setExtra] = useState<ExtraFilter>('random');
  const [custom, setCustom] = useState<CustomOptions>(DEFAULT_CUSTOM);
  const [newName, setNewName] = useState('');

  const enabledCats = CATEGORIES.filter((c) => data.settings.enabledCategories.includes(c.id));
  const effectiveCats = categories.length ? categories : enabledCats.length < CATEGORIES.length ? enabledCats.map((c) => c.id) : [];
  const filters = { categories: effectiveCats, artists, extra };
  const pool = useMemo(() => filterPool(tracks, filters), [tracks, effectiveCats.join(), artists.join(), extra]); // eslint-disable-line react-hooks/exhaustive-deps
  const titles = distinctTitles(pool);
  const needed = modeId === 'custom' ? custom.questions : mode.questions;
  const players = selected.map((id) => data.players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const minP = modeId === 'custom' ? 1 : mode.minPlayers;
  const playersOk = players.length >= minP && players.length <= mode.maxPlayers;
  const canStart = playersOk && titles >= 4;

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const togglePlayer = (id: string) => {
    if (solo) { setSelected([id]); return; }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= mode.maxPlayers ? s : [...s, id]));
  };
  const quickAdd = () => {
    const r = addPlayer(data, newName, 'mic');
    if ('error' in r) { toast(r.error, 'error'); return; }
    if (r.created) update((d) => ({ ...d, players: [...d.players, r.player] }), { action: 'Novo participante', details: r.player.name });
    if (!selected.includes(r.player.id)) togglePlayer(r.player.id);
    setNewName('');
  };

  const start = () => {
    const config = buildConfig(modeId, data.settings, filters, custom);
    go({ name: 'game', launch: { config, playerIds: selected, context: context ?? { kind: 'normal' } } });
  };

  const rules = [
    mode.questions ? `${modeId === 'custom' ? custom.questions : mode.questions} músicas` : 'Ilimitado',
    `${modeId === 'custom' ? custom.timeSec : data.settings.timeOverride && TIME_ADJUSTABLE.includes(modeId) ? data.settings.timeOverride : mode.timeSec}s por música${mode.progressive && mode.minTimeSec ? ' (diminui)' : ''}`,
    `${modeId === 'custom' ? custom.points : mode.points} pts por acerto`,
    mode.endOnWrong ? 'Errou, saiu' : null,
    mode.progressive ? 'Dificuldade progressiva' : null,
    mode.id === 'hardcore' || mode.mysterious ? 'Artista oculto' : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={<button onClick={() => go({ name: 'home' })} className="mb-3 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Modos</button>}
        title={<span className="flex items-center gap-3"><span className="rounded-xl bg-accent/15 p-2 text-accent-soft"><Icon name={mode.icon} size={26} /></span>{mode.name}</span>}
        subtitle={mode.description}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {rules.map((r) => <Badge key={r} tone="accent">{r}</Badge>)}
        {!mode.ranked && <Badge tone="amber">Não conta para o ranking</Badge>}
        {context?.kind === 'queue' && <Badge tone="gold">Fila de participantes</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {/* Jogadores */}
          <section className="glass p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="label">{solo ? 'Jogador' : `Jogadores (${players.length}/${mode.maxPlayers}${minP > 1 ? `, mínimo ${minP}` : ''})`}</div>
              {solo && <button className="text-sm text-accent-soft hover:underline" onClick={() => go({ name: 'identify', then: { name: 'setup', mode: modeId, category } })}>Trocar</button>}
            </div>
            {solo ? (
              players[0] ? (
                <div className="flex items-center gap-3"><Avatar id={players[0].avatar} size={44} /><span className="h-display text-xl">{players[0].name}</span></div>
              ) : (
                <Button variant="primary" onClick={() => go({ name: 'identify', then: { name: 'setup', mode: modeId, category } })}>Identificar jogador</Button>
              )
            ) : (
              <>
                {players.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {players.map((p, i) => (
                      <span key={p.id} className="flex items-center gap-2 rounded-full bg-accent/15 py-1 pl-1 pr-2 text-sm">
                        <Avatar id={p.avatar} size={24} /> <b className="text-xs text-accent-soft">{i + 1}º</b> {p.name}
                        <button onClick={() => togglePlayer(p.id)} className="text-zinc-400 hover:text-white" aria-label={`Remover ${p.name}`}><X size={14} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {data.players.filter((p) => !p.archived && !selected.includes(p.id)).map((p) => (
                    <Chip key={p.id} active={false} onClick={() => togglePlayer(p.id)}>{p.name}</Chip>
                  ))}
                </div>
                <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); quickAdd(); }}>
                  <input className="input" placeholder="Adicionar novo participante" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <Button type="submit" icon={<Plus size={16} />}>Adicionar</Button>
                </form>
                <p className="mt-3 text-xs text-zinc-500">A ordem de seleção define a ordem de resposta em cada música.</p>
              </>
            )}
          </section>

          {/* Filtros */}
          <section className="glass p-6">
            <div className="label mb-3">Gênero</div>
            <div className="flex flex-wrap gap-2">
              <Chip active={!categories.length} onClick={() => setCategories([])}>Todos os gêneros</Chip>
              {enabledCats.map((c) => <Chip key={c.id} active={categories.includes(c.id)} onClick={() => setCategories(toggle(categories, c.id))}>{c.name}</Chip>)}
            </div>
            <div className="label mb-3 mt-6">Artistas {artists.length > 0 && <span className="normal-case tracking-normal text-zinc-400">· {artists.length} selecionado(s)</span>}</div>
            <ArtistSearch tracks={tracks} selected={artists} onChange={setArtists} />
            <div className="label mb-3 mt-6">Seleção de músicas</div>
            <Segmented size="sm" value={extra} onChange={setExtra} options={EXTRA} />
          </section>

          {modeId === 'custom' && <CustomPanel value={custom} onChange={setCustom} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-accent/15 p-3 text-accent-soft"><Music2 /></span>
              <div>
                <div className="h-display text-3xl tabular-nums">{pool.length}</div>
                <div className="text-sm text-zinc-400">músicas verificadas disponíveis</div>
              </div>
            </div>
            {titles < 4 && (
              <p className="mt-4 flex gap-2 text-sm text-amber-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> São necessárias pelo menos 4 músicas diferentes. Amplie os filtros.</p>
            )}
            {titles >= 4 && needed && pool.length < needed && (
              <p className="mt-4 flex gap-2 text-sm text-amber-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> Só há {pool.length} músicas com estes filtros — a partida terminará quando acabarem (sem repetir).</p>
            )}
            {!playersOk && !solo && <p className="mt-4 text-sm text-zinc-400">Selecione {mode.minPlayers === mode.maxPlayers ? `${mode.minPlayers}` : `de ${minP} a ${mode.maxPlayers}`} jogadores.</p>}
            <Button variant="primary" size="xl" className="mt-6 w-full" disabled={!canStart} onClick={start} icon={<Play size={20} fill="currentColor" />}>Começar</Button>
          </div>
          <div className="glass p-5 text-sm text-zinc-400">
            <div className="label mb-2">Mecânicas ativas</div>
            <ul className="space-y-1.5">
              {(() => {
                const c = buildConfig(modeId, data.settings, filters, custom);
                const list: [boolean, string][] = [
                  [c.hints.some((h) => h !== 'more'), 'Dicas (máx. 3 por partida)'],
                  [c.combo, 'Combo: x1,5 com 3 seguidas, x2 com 6, x3 com 10'],
                  [c.bonusRound, 'Rodada bônus a cada 5 músicas (dobro)'],
                  [c.secondChance, 'Segunda chance (1 por partida, ½ pontos)'],
                  [c.steal, 'Roubo de pontos a cada 4 músicas'],
                  [true, 'Bônus de velocidade: até +50%'],
                ];
                return list.map(([on, t]) => (
                  <li key={t} className={cx('flex items-center gap-2', !on && 'opacity-35 line-through')}><Check size={14} className={on ? 'text-accent-soft' : ''} /> {t}</li>
                ));
              })()}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CustomPanel({ value, onChange }: { value: CustomOptions; onChange: (v: CustomOptions) => void }) {
  const set = (p: Partial<CustomOptions>) => onChange({ ...value, ...p });
  const DIFF: { value: string; label: string; range: [Difficulty, Difficulty] }[] = [
    { value: '1-4', label: 'Misto', range: [1, 4] },
    { value: '1-1', label: 'Fácil', range: [1, 1] },
    { value: '2-2', label: 'Médio', range: [2, 2] },
    { value: '3-3', label: 'Difícil', range: [3, 3] },
    { value: '4-4', label: 'Extremo', range: [4, 4] },
  ];
  return (
    <section className="glass space-y-5 p-6">
      <div className="label">Regras personalizadas</div>
      <Range label="Quantidade de perguntas" min={5} max={50} step={5} value={value.questions} onChange={(v) => set({ questions: v })} />
      <Range label="Tempo por pergunta" suffix="s" min={5} max={60} step={5} value={value.timeSec} onChange={(v) => set({ timeSec: v })} />
      <Range label="Pontos por acerto" min={50} max={500} step={50} value={value.points} onChange={(v) => set({ points: v })} />
      <div>
        <div className="mb-2 text-sm font-medium">Dificuldade</div>
        <Segmented size="sm" value={value.difficulty.join('-')} onChange={(v) => set({ difficulty: DIFF.find((d) => d.value === v)!.range })} options={DIFF} />
      </div>
      <div className="divide-y divide-white/5">
        <Toggle label="Dicas" checked={value.hints} onChange={(v) => set({ hints: v })} />
        <Toggle label="Combo" checked={value.combo} onChange={(v) => set({ combo: v })} />
        <Toggle label="Rodada bônus" checked={value.bonusRound} onChange={(v) => set({ bonusRound: v })} />
        <Toggle label="Segunda chance" checked={value.secondChance} onChange={(v) => set({ secondChance: v })} />
      </div>
    </section>
  );
}

function Range({ label, value, onChange, min, max, step, suffix = '' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string }) {
  return (
    <label className="block">
      <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-accent-soft">{value}{suffix}</span></div>
      <input type="range" className="w-full accent-[rgb(var(--accent))]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
