import {
  AlertTriangle, Archive, ArchiveRestore, CheckCircle2, ChevronDown, ChevronRight, Database, Download, ExternalLink, History, Lock,
  Pause, Play, RefreshCw, Settings as SettingsIcon, ShieldCheck, Trash2, Unlock, Upload, Users, Wifi, WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Modal, PageHeader, Segmented, Spinner, Stat, Toggle, useConfirm } from '../components/ui';
import { Avatar } from '../components/visuals';
import { ARTISTS, CATEGORIES, DIFFICULTY_NAME } from '../data/artists';
import { TIME_ADJUSTABLE } from '../game/config';
import { computeRanking, personalStats } from '../ranking/ranking';
import { pingApple } from '../services/itunes';
import { syncCatalog, type SyncProgress } from '../services/catalog';
import { buildExport, mergeImport, type ImportReport } from '../storage/backup';
import { listBackups } from '../storage/db';
import { emptyData } from '../state/defaults';
import { useStore } from '../state/AppStore';
import type { BackupEntry, CatalogArtistStatus, CategoryId, Settings } from '../types';
import { cx, downloadJson, fmtDateTime, fmtNumber, pct } from '../utils';
import { PlayerHistory } from './Ranking';

type Tab = 'overview' | 'catalog' | 'settings' | 'data' | 'log';

export function TeacherPage() {
  const { data, teacherUnlocked, setTeacherUnlocked } = useStore();
  const [tab, setTab] = useState<Tab>(() => (data.settings.teacherPin ? 'overview' : 'overview'));
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  if (data.settings.teacherPin && !teacherUnlocked) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <Lock className="mx-auto mb-4 text-accent-soft" size={36} />
        <h1 className="h-display text-2xl">Painel do professor</h1>
        <p className="mt-1 text-sm text-zinc-400">Digite o PIN para continuar.</p>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (pin === data.settings.teacherPin) setTeacherUnlocked(true); else { setErr(true); setPin(''); } }}>
          <input className={cx('input text-center text-2xl tracking-[0.5em]', err && 'border-red-400/60')} type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setErr(false); }} autoFocus aria-label="PIN" />
          <Button type="submit" variant="primary">Entrar</Button>
        </form>
        {err && <p className="mt-2 text-sm text-red-300">PIN incorreto.</p>}
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Painel do professor" subtitle="Organize a turma, o catálogo e os dados. Ações importantes pedem confirmação e ficam registradas." />
      <div className="mb-8"><Segmented value={tab} onChange={setTab} options={[
        { value: 'overview', label: 'Participantes' }, { value: 'catalog', label: 'Catálogo musical' }, { value: 'settings', label: 'Configurações' },
        { value: 'data', label: 'Dados e backup' }, { value: 'log', label: 'Registro' },
      ]} /></div>
      {tab === 'overview' && <Overview />}
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'log' && <LogTab />}
    </div>
  );
}

// ─── Participantes ────────────────────────────────────────────

function Overview() {
  const { data, tracks, update, go } = useStore();
  const confirm = useConfirm();
  const [hist, setHist] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const ranking = computeRanking(data.matches, data.players);
  const today = new Date().toDateString();
  const list = data.players.filter((p) => showArchived || !p.archived).sort((a, b) => a.name.localeCompare(b.name));
  const archive = async (id: string, v: boolean) => {
    const p = data.players.find((x) => x.id === id)!;
    const ok = await confirm({
      title: v ? `Arquivar ${p.name}?` : `Restaurar ${p.name}?`,
      message: v ? 'O participante some do ranking e das listas, mas todo o histórico é preservado e pode ser restaurado.' : 'O participante volta a aparecer no ranking com todo o histórico.',
      confirmLabel: v ? 'Arquivar' : 'Restaurar',
    });
    if (ok) update((d) => ({ ...d, players: d.players.map((x) => (x.id === id ? { ...x, archived: v } : x)) }), { action: v ? 'Participante arquivado' : 'Participante restaurado', details: p.name });
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Participantes" value={data.players.filter((p) => !p.archived).length} />
        <Stat label="Partidas" value={data.matches.length} sub={`${data.matches.filter((m) => new Date(m.endedAt).toDateString() === today).length} hoje`} />
        <Stat label="Músicas verificadas" value={tracks.length} />
        <Stat label="Campeonatos" value={data.championships.length} sub={`${data.championships.filter((c) => c.status === 'encerrado').length} encerrados`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Users size={16} />} onClick={() => go({ name: 'queue' })}>Fila de participantes</Button>
        <Button icon={<History size={16} />} onClick={() => go({ name: 'championship' })}>Campeonatos</Button>
        <Toggle label="Mostrar arquivados" checked={showArchived} onChange={setShowArchived} />
      </div>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-white/5"><th className="px-5 py-3">Participante</th><th className="text-right">Posição</th><th className="text-right">Partidas</th><th className="text-right">Pontuação</th><th className="text-right">Aproveit.</th><th className="text-right">Último jogo</th><th className="px-5 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const st = personalStats(p.id, data.matches);
              const pos = ranking.findIndex((r) => r.playerId === p.id);
              const last = data.matches.filter((m) => m.playerId === p.id).at(-1);
              return (
                <tr key={p.id} className={cx('border-b border-white/5 last:border-0', p.archived && 'opacity-50')}>
                  <td className="px-5 py-2.5"><span className="flex items-center gap-2"><Avatar id={p.avatar} size={28} />{p.name}{p.archived && <Badge>arquivado</Badge>}</span></td>
                  <td className="text-right tabular-nums">{pos >= 0 ? `${pos + 1}º` : '—'}</td>
                  <td className="text-right tabular-nums">{st.matches}</td>
                  <td className="text-right tabular-nums">{fmtNumber(st.total)}</td>
                  <td className="text-right tabular-nums">{pct(st.accuracy)}</td>
                  <td className="text-right text-zinc-400">{last ? fmtDateTime(last.endedAt) : '—'}</td>
                  <td className="px-5 text-right">
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setHist(p.id)}>Histórico</Button>
                      <Button size="sm" variant="ghost" icon={p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} onClick={() => archive(p.id, !p.archived)}>{p.archived ? 'Restaurar' : 'Arquivar'}</Button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PlayerHistory playerId={hist} onClose={() => setHist(null)} />
    </div>
  );
}

// ─── Catálogo ─────────────────────────────────────────────────

function statusBadge(s?: CatalogArtistStatus) {
  if (!s) return <Badge>não sincronizado</Badge>;
  switch (s.status) {
    case 'ok': return <Badge tone="green"><CheckCircle2 size={12} /> verificado</Badge>;
    case 'pendente': return <Badge tone="amber">confirmar artista</Badge>;
    case 'nao-encontrado': return <Badge tone="red">não encontrado</Badge>;
    case 'sem-musicas-limpas': return <Badge tone="amber">sem versões limpas</Badge>;
    default: return <Badge tone="red">erro</Badge>;
  }
}

function CatalogTab() {
  const { catalog, updateCatalog, getCatalog, tracks, toast, update } = useStore();
  const confirm = useConfirm();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);

  const run = async (only?: string[]) => {
    setProgress({ done: 0, total: only?.length ?? ARTISTS.length });
    try {
      const next = await syncCatalog(getCatalog(), setProgress, only);
      // preserva alterações feitas pelo professor durante a sincronização
      updateCatalog((c) => ({ ...next, excluded: c.excluded, failures: c.failures, confirmedArtists: c.confirmedArtists }));
      const ok = Object.values(next.artists).filter((a) => a.status === 'ok').length;
      update((d) => d, { action: 'Catálogo sincronizado', details: `${next.tracks.length} músicas verificadas · ${ok} artistas ok` });
      toast(`Catálogo atualizado: ${next.tracks.length} músicas verificadas.`, 'success');
    } catch (e) {
      toast(`Falha na sincronização: ${(e as Error).message}`, 'error');
    } finally {
      setProgress(null);
    }
  };
  const test = async () => { setOnline(null); setOnline(await pingApple()); };
  const togglePreview = (url: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (preview === url) { a.pause(); setPreview(null); return; }
    a.src = url;
    a.onerror = () => { toast('Esta prévia não carregou.', 'error'); setPreview(null); };
    a.onended = () => setPreview(null);
    void a.play().then(() => setPreview(url)).catch(() => toast('Não foi possível reproduzir.', 'error'));
  };
  const confirmArtist = async (artistId: string, ids: number[]) => {
    const a = ARTISTS.find((x) => x.id === artistId)!;
    const ok = await confirm({ title: `Confirmar perfil de ${a.name}?`, message: `As músicas do(s) perfil(is) selecionado(s) na Apple Music serão verificadas e adicionadas. Só confirme se tiver certeza de que é o artista correto.`, confirmLabel: 'Confirmar e sincronizar' });
    if (!ok) return;
    updateCatalog((c) => ({ ...c, confirmedArtists: { ...c.confirmedArtists, [artistId]: ids } }));
    update((d) => d, { action: 'Artista confirmado manualmente', details: `${a.name} → Apple ${ids.join(', ')}` });
    setTimeout(() => void run([artistId]), 50);
  };
  const toggleExclude = (trackId: number, title: string) => {
    const excluded = catalog.excluded.includes(trackId);
    updateCatalog((c) => ({ ...c, excluded: excluded ? c.excluded.filter((x) => x !== trackId) : [...c.excluded, trackId] }));
    update((d) => d, { action: excluded ? 'Música reativada' : 'Música excluída do jogo', details: title });
  };

  const total = (k: keyof CatalogArtistStatus) => Object.values(catalog.artists).reduce((s, a) => s + (Number(a[k]) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="glass p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex-1">
            <h3 className="h-display flex items-center gap-2 text-lg"><ShieldCheck size={18} className="text-accent-soft" /> Fonte oficial: Apple Music (iTunes Search API)</h3>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Título, artista, participações, ano e a prévia oficial de 30s vêm da mesma ficha da Apple — o áudio sempre corresponde ao título.
              Entram apenas versões <b className="text-zinc-200">não explícitas ou limpas</b>, sem ao vivo/remix/acelerada. Nenhuma letra é exibida.
            </p>
            <p className="mt-2 text-xs text-zinc-500">Última sincronização: {catalog.syncedAt ? fmtDateTime(catalog.syncedAt) : 'nunca'} · Loja: Brasil</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button variant="primary" size="lg" icon={progress ? <Spinner size={16} /> : <RefreshCw size={18} />} disabled={!!progress} onClick={() => run()}>
              {progress ? `Sincronizando… ${progress.done}/${progress.total}` : catalog.syncedAt ? 'Sincronizar novamente' : 'Sincronizar catálogo'}
            </Button>
            <button className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white" onClick={test}>
              {online === null ? <Wifi size={14} /> : online ? <Wifi size={14} className="text-emerald-300" /> : <WifiOff size={14} className="text-red-300" />}
              {online === null ? 'Testar conexão com a Apple' : online ? 'Conexão OK' : 'Sem conexão com a Apple'}
            </button>
          </div>
        </div>
        {progress && (
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
            <p className="mt-2 text-xs text-zinc-500">Consultando {progress.current ?? '…'} — a Apple limita as consultas, por isso leva cerca de 3 segundos por artista.</p>
          </div>
        )}
        {catalog.syncedAt && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="No jogo" value={tracks.length} />
            <Stat label="Encontradas" value={total('found')} />
            <Stat label="Explícitas removidas" value={total('removedExplicit')} />
            <Stat label="Versões alternativas" value={total('removedVariants')} />
            <Stat label="Excluídas manualmente" value={catalog.excluded.length} />
          </div>
        )}
      </div>

      <div className="glass divide-y divide-white/5">
        {ARTISTS.map((a) => {
          const s = catalog.artists[a.id];
          const list = catalog.tracks.filter((t) => t.artistId === a.id);
          const isOpen = open === a.id;
          return (
            <div key={a.id}>
              <button className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02]" onClick={() => setOpen(isOpen ? null : a.id)}>
                {isOpen ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                <span className="w-44 truncate font-medium">{a.name}</span>
                <span className="hidden w-40 text-xs text-zinc-500 md:block">{a.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.short).join(' · ')}</span>
                {statusBadge(s)}
                <span className="ml-auto text-sm tabular-nums text-zinc-400">{s ? `${list.filter((t) => !catalog.excluded.includes(t.trackId)).length} no jogo` : ''}</span>
              </button>
              {isOpen && (
                <div className="bg-black/20 px-5 py-4 text-sm">
                  {s?.message && <p className="mb-3 flex items-start gap-2 text-amber-200"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{s.message}</p>}
                  {s && s.status !== 'pendente' && (
                    <p className="mb-3 text-xs text-zinc-500">
                      Perfil Apple: {s.appleArtistName ?? '—'} {s.appleArtistId && `(#${s.appleArtistId})`} · encontradas {s.found} · explícitas removidas {s.removedExplicit} · versões alternativas {s.removedVariants} · sem prévia {s.removedNoPreview}
                    </p>
                  )}
                  {s?.candidates && s.candidates.length > 0 && (s.status === 'pendente' || catalog.confirmedArtists[a.id]) && (
                    <CandidatePicker status={s} confirmed={catalog.confirmedArtists[a.id]} onConfirm={(ids) => confirmArtist(a.id, ids)} disabled={!!progress} />
                  )}
                  {list.length > 0 && (
                    <table className="mt-2 w-full text-sm">
                      <thead className="text-left text-xs text-zinc-500"><tr><th className="py-1.5">Título oficial</th><th>Crédito</th><th>Ano</th><th>Versão</th><th>Nível</th><th className="text-right">Ações</th></tr></thead>
                      <tbody>
                        {list.map((t) => {
                          const ex = catalog.excluded.includes(t.trackId);
                          return (
                            <tr key={t.id} className={cx('border-t border-white/5', ex && 'opacity-40')}>
                              <td className="py-1.5 pr-2">{t.title}{t.isHit && <Badge tone="accent" className="ml-2">hit</Badge>}{(catalog.failures[t.trackId] ?? 0) > 0 && <Badge tone="red" className="ml-2">{catalog.failures[t.trackId]} falha(s)</Badge>}</td>
                              <td className="pr-2 text-zinc-400">{t.artistName}</td>
                              <td className="text-zinc-400">{t.year ?? '—'}</td>
                              <td className="text-zinc-400">{t.explicitness === 'cleaned' ? 'limpa' : 'não explícita'}</td>
                              <td className="text-zinc-400">{DIFFICULTY_NAME[t.difficulty]}</td>
                              <td className="text-right">
                                <span className="inline-flex gap-1">
                                  <button className="rounded p-1.5 hover:bg-white/10" onClick={() => togglePreview(t.previewUrl)} aria-label="Ouvir prévia">{preview === t.previewUrl ? <Pause size={14} /> : <Play size={14} />}</button>
                                  {t.storeUrl && <a className="rounded p-1.5 hover:bg-white/10" href={t.storeUrl} target="_blank" rel="noreferrer" aria-label="Abrir na Apple Music"><ExternalLink size={14} /></a>}
                                  <button className="rounded px-2 py-1 text-xs hover:bg-white/10" onClick={() => toggleExclude(t.trackId, t.title)}>{ex ? 'Reativar' : 'Excluir'}</button>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-3"><Button size="sm" icon={<RefreshCw size={14} />} disabled={!!progress} onClick={() => run([a.id])}>Sincronizar só {a.name}</Button></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidatePicker({ status, confirmed, onConfirm, disabled }: { status: CatalogArtistStatus; confirmed?: number[]; onConfirm: (ids: number[]) => void; disabled: boolean }) {
  const [sel, setSel] = useState<number[]>(confirmed ?? []);
  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200">Perfis com este nome na Apple Music — marque o(s) correto(s)</div>
      <div className="space-y-2">
        {status.candidates!.map((c) => (
          <label key={c.appleArtistId} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-white/[0.03]">
            <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={sel.includes(c.appleArtistId)} onChange={() => setSel(sel.includes(c.appleArtistId) ? sel.filter((x) => x !== c.appleArtistId) : [...sel, c.appleArtistId])} />
            <span>
              <span className="font-medium">{c.name}</span> <span className="text-xs text-zinc-500">#{c.appleArtistId} · {c.genres.join(', ') || 'gênero n/d'}</span>
              <span className="block text-xs text-zinc-400">Ex.: {c.sampleTitles.join(' · ')}</span>
              <a className="text-xs text-accent-soft hover:underline" href={`https://music.apple.com/br/artist/${c.appleArtistId}`} target="_blank" rel="noreferrer">Ver perfil na Apple Music</a>
            </span>
          </label>
        ))}
      </div>
      <Button size="sm" variant="primary" className="mt-3" disabled={!sel.length || disabled} onClick={() => onConfirm(sel)}>Confirmar seleção</Button>
    </div>
  );
}

// ─── Configurações ────────────────────────────────────────────

function SettingsTab() {
  const { data, update, setTeacherUnlocked } = useStore();
  const s = data.settings;
  const set = (patch: Partial<Settings>, label?: string) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }), label ? { action: 'Configuração alterada', details: label } : undefined);
  const [newPin, setNewPin] = useState('');
  const toggleCat = (c: CategoryId) => {
    const next = s.enabledCategories.includes(c) ? s.enabledCategories.filter((x) => x !== c) : [...s.enabledCategories, c];
    if (next.length) set({ enabledCategories: next }, `Categorias: ${next.join(', ')}`);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass p-6">
        <div className="label mb-2">Jogo</div>
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">Categorias disponíveis</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => toggleCat(c.id)} className={cx('rounded-full border px-3 py-1.5 text-sm', s.enabledCategories.includes(c.id) ? 'border-accent/60 bg-accent/20' : 'border-white/10 text-zinc-500')}>{c.name}</button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <div className="mb-1 text-sm font-medium">Tempo por pergunta</div>
          <p className="mb-2 text-xs text-zinc-500">Aplica-se a: {TIME_ADJUSTABLE.map((m) => ({ classic: 'Clássico', duel: 'Duelo', battle: 'Batalha', mysterious: 'Misterioso' } as Record<string, string>)[m]).join(', ')}. Relâmpago, Hardcore e modos progressivos mantêm seus tempos.</p>
          <Segmented size="sm" value={String(s.timeOverride ?? 'default')} onChange={(v) => set({ timeOverride: v === 'default' ? null : Number(v) }, `Tempo: ${v}`)}
            options={[{ value: 'default', label: 'Padrão' }, ...[10, 15, 20, 25, 30].map((n) => ({ value: String(n), label: `${n}s` }))]} />
        </div>
        <div className="divide-y divide-white/5">
          <Toggle label="Dicas" description="Artista, ano e 50/50 (máx. 3 por partida)" checked={s.mechanics.hints} onChange={(v) => set({ mechanics: { ...s.mechanics, hints: v } }, `Dicas: ${v}`)} />
          <Toggle label="Combo" description="Multiplicador por acertos seguidos" checked={s.mechanics.combo} onChange={(v) => set({ mechanics: { ...s.mechanics, combo: v } }, `Combo: ${v}`)} />
          <Toggle label="Rodada bônus" description="A cada 5 músicas, pontos em dobro" checked={s.mechanics.bonusRound} onChange={(v) => set({ mechanics: { ...s.mechanics, bonusRound: v } }, `Bônus: ${v}`)} />
          <Toggle label="Segunda chance" description="Clássico e Relâmpago, 1 por partida" checked={s.mechanics.secondChance} onChange={(v) => set({ mechanics: { ...s.mechanics, secondChance: v } }, `Segunda chance: ${v}`)} />
          <Toggle label="Roubo de pontos" description="Duelo, Batalha e Sobrevivência: a cada 4 músicas" checked={s.mechanics.steal} onChange={(v) => set({ mechanics: { ...s.mechanics, steal: v } }, `Roubo: ${v}`)} />
        </div>
      </section>
      <section className="space-y-6">
        <div className="glass p-6">
          <div className="label mb-2">Apresentação</div>
          <div className="divide-y divide-white/5">
            <Toggle label="Modo apresentador" description="Textos maiores para projetor e avanço controlado pelo professor" checked={s.presenter} onChange={(v) => set({ presenter: v })} />
            <Toggle label="Avançar automaticamente" description="~2 segundos após cada resposta (desligado no modo apresentador)" checked={s.autoAdvance} onChange={(v) => set({ autoAdvance: v })} />
            <Toggle label="Efeitos sonoros" checked={s.sfx} onChange={(v) => set({ sfx: v })} />
            <Toggle label="Animações e efeitos visuais" checked={s.effects} onChange={(v) => set({ effects: v })} />
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 flex justify-between font-medium"><span>Volume das músicas</span><span className="text-accent-soft">{Math.round(s.volume * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
          </label>
        </div>
        <div className="glass p-6">
          <div className="label mb-2">PIN do professor (opcional)</div>
          <p className="mb-3 text-sm text-zinc-400">Protege este painel e as ações do campeonato neste computador. Não é uma senha online.</p>
          {s.teacherPin ? (
            <div className="flex gap-2">
              <Badge tone="green"><Lock size={12} /> PIN ativo</Badge>
              <Button size="sm" variant="ghost" icon={<Unlock size={14} />} onClick={() => { set({ teacherPin: null }, 'PIN removido'); setTeacherUnlocked(false); }}>Remover PIN</Button>
              <Button size="sm" variant="ghost" icon={<Lock size={14} />} onClick={() => setTeacherUnlocked(false)}>Bloquear agora</Button>
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (/^\d{4,8}$/.test(newPin)) { set({ teacherPin: newPin }, 'PIN definido'); setTeacherUnlocked(true); setNewPin(''); } }}>
              <input className="input" placeholder="4 a 8 dígitos" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} maxLength={8} />
              <Button type="submit" disabled={!/^\d{4,8}$/.test(newPin)}>Definir</Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Dados e backup ───────────────────────────────────────────

function DataTab() {
  const { data, update, replaceAll, backup, toast } = useStore();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<{ rep: ImportReport; raw: unknown } | null>(null);
  const [mergeSame, setMergeSame] = useState(true);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const reload = () => void listBackups().then(setBackups);
  useEffect(reload, []);

  const exportAll = () => {
    downloadJson(`adivinhe-a-musica-${new Date().toISOString().slice(0, 10)}.json`, buildExport(data));
    update((d) => d, { action: 'Dados exportados', details: `${data.players.length} jogadores, ${data.matches.length} partidas` });
  };
  const onFile = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      setReport({ rep: mergeImport(data, raw, mergeSame), raw });
    } catch {
      setReport({ rep: { ok: false, errors: ['O arquivo não é um JSON válido.'], conflicts: [], skippedDuplicates: 0, added: { players: 0, matches: 0, achievements: 0, championships: 0 } }, raw: null });
    }
  };
  const applyImport = async () => {
    if (!report?.raw) return;
    const rep = mergeImport(data, report.raw, mergeSame);
    if (!rep.ok || !rep.merged) return;
    await replaceAll(rep.merged, 'importação de dados');
    toast('Importação concluída. Backup anterior salvo.', 'success');
    setReport(null);
    reload();
  };
  const restore = async (b: BackupEntry) => {
    const ok = await confirm({ title: 'Restaurar este backup?', message: <>Os dados atuais serão substituídos pelo backup de <b>{fmtDateTime(b.createdAt)}</b> ({b.data.matches.length} partidas). Um novo backup do estado atual é criado antes.</>, danger: true, typeToConfirm: 'RESTAURAR', confirmLabel: 'Restaurar' });
    if (!ok) return;
    await replaceAll({ ...b.data, audit: [...b.data.audit, { at: new Date().toISOString(), action: 'Backup restaurado', details: `${b.reason} (${fmtDateTime(b.createdAt)})` }] }, 'restauração de backup');
    toast('Backup restaurado.', 'success');
    reload();
  };
  const wipe = async () => {
    const ok = await confirm({ title: 'Apagar TODOS os dados?', message: 'Jogadores, partidas, ranking, conquistas e campeonatos serão apagados deste computador. Um backup é criado antes e pode ser restaurado nesta tela. Recomendamos exportar um arquivo também.', danger: true, typeToConfirm: 'APAGAR', confirmLabel: 'Apagar tudo' });
    if (!ok) return;
    const fresh = emptyData();
    fresh.settings = { ...data.settings, lastPlayerId: null };
    fresh.audit = [{ at: new Date().toISOString(), action: 'Todos os dados apagados', details: `${data.players.length} jogadores, ${data.matches.length} partidas (backup criado)` }];
    await replaceAll(fresh, 'apagar todos os dados');
    toast('Dados apagados. O backup está disponível abaixo.', 'info');
    reload();
  };
  const manualBackup = async () => { await backup('Backup manual'); toast('Backup criado.', 'success'); reload(); };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass p-6">
        <h3 className="h-display mb-1 flex items-center gap-2 text-lg"><Download size={18} /> Exportar</h3>
        <p className="mb-4 text-sm text-zinc-400">Baixa um arquivo JSON com jogadores, pontuações, histórico, campeonatos, conquistas e recordes.</p>
        <Button variant="primary" icon={<Download size={16} />} onClick={exportAll}>Exportar todos os dados</Button>
        <div className="neon-line my-6" />
        <h3 className="h-display mb-1 flex items-center gap-2 text-lg"><Upload size={18} /> Importar</h3>
        <p className="mb-4 text-sm text-zinc-400">Mescla um arquivo exportado (de outro computador, por exemplo). Nada existente é apagado; duplicados são ignorados.</p>
        <Toggle label="Unificar jogadores com o mesmo nome" description="Se desligado, o importado recebe o sufixo “(importado)”" checked={mergeSame} onChange={setMergeSame} />
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        <Button className="mt-3" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Escolher arquivo…</Button>
      </section>
      <section className="glass p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="h-display flex items-center gap-2 text-lg"><Database size={18} /> Backups automáticos</h3>
          <Button size="sm" onClick={manualBackup}>Criar agora</Button>
        </div>
        <p className="mb-3 text-xs text-zinc-500">Criados antes de importações, restaurações, reinício de fases e exclusões. Os 15 mais recentes ficam guardados neste navegador.</p>
        {backups.length === 0 ? <p className="text-sm text-zinc-500">Nenhum backup ainda.</p> : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {backups.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                <div className="flex-1"><div>{b.reason}</div><div className="text-xs text-zinc-500">{fmtDateTime(b.createdAt)} · {b.data.players.length} jogadores · {b.data.matches.length} partidas</div></div>
                <Button size="sm" variant="ghost" onClick={() => restore(b)}>Restaurar</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="neon-line my-6" />
        <h3 className="h-display mb-1 flex items-center gap-2 text-lg text-red-300"><Trash2 size={18} /> Zona de perigo</h3>
        <p className="mb-4 text-sm text-zinc-400">O ranking fica salvo neste computador e navegador. Ele não é sincronizado com outros computadores.</p>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={wipe}>Apagar todos os dados…</Button>
      </section>
      <Modal open={!!report} onClose={() => setReport(null)} title="Conferência da importação">
        {report && (report.rep.ok ? (
          <div className="space-y-3 text-sm">
            <p>Serão adicionados: <b>{report.rep.added.players}</b> jogadores, <b>{report.rep.added.matches}</b> partidas, <b>{report.rep.added.championships}</b> campeonatos, <b>{report.rep.added.achievements}</b> conquistas.</p>
            <p className="text-zinc-400">{report.rep.skippedDuplicates} registro(s) duplicado(s) serão ignorados.</p>
            {report.rep.conflicts.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="mb-1 font-semibold text-amber-200">Conflitos encontrados</div>
                <ul className="list-disc space-y-0.5 pl-5 text-zinc-300">{report.rep.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setReport(null)}>Cancelar</Button><Button variant="primary" onClick={applyImport}>Importar</Button></div>
          </div>
        ) : (
          <div className="text-sm">
            <p className="mb-2 font-semibold text-red-300">Arquivo recusado:</p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">{report.rep.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ))}
      </Modal>
    </div>
  );
}

function LogTab() {
  const { data } = useStore();
  const list = useMemo(() => data.audit.slice().reverse(), [data.audit]);
  return (
    <div className="glass p-6">
      <div className="mb-4 flex items-center gap-2"><SettingsIcon size={16} className="text-zinc-500" /><span className="text-sm text-zinc-400">Toda ação administrativa fica registrada aqui. Resultados de partidas nunca são editados — só arquivados, restaurados ou recuperados de backup.</span></div>
      {list.length === 0 ? <p className="text-sm text-zinc-500">Nenhum registro.</p> : (
        <ul className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto text-sm">
          {list.map((e, i) => (
            <li key={i} className="flex gap-4 py-2"><span className="w-32 shrink-0 text-zinc-500">{fmtDateTime(e.at)}</span><span className="font-medium">{e.action}</span><span className="text-zinc-400">{e.details}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
