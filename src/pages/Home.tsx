import { motion } from 'framer-motion';
import { AlertTriangle, Globe, ListOrdered, Play, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Badge, Button, Spinner } from '../components/ui';
import { Equalizer, Logo } from '../components/visuals';
import { CATEGORIES } from '../data/artists';
import { MODES } from '../data/modes';
import { personalStats, positionOf } from '../ranking/ranking';
import { filterPool, syncCatalog } from '../services/catalog';
import { OnlineHomeCard } from './Online';
import { useStore } from '../state/AppStore';
import type { CategoryId, ModeId } from '../types';
import { fmtNumber, pct } from '../utils';

export function HomePage() {
  const { data, tracks, currentPlayer, go, catalogStatus, getCatalog, updateCatalog, toast } = useStore();
  const [syncing, setSyncing] = useState<string | null>(null);
  const syncHere = async () => {
    setSyncing('Começando…');
    try {
      const next = await syncCatalog(getCatalog(), (p) => setSyncing(`${p.done}/${p.total}${p.current ? ` · ${p.current}` : ''}`));
      updateCatalog(() => next);
      toast(`${next.tracks.length} músicas carregadas!`, 'success');
    } catch {
      toast('Não foi possível buscar as músicas. Verifique a internet.', 'error');
    } finally {
      setSyncing(null);
    }
  };
  const stats = currentPlayer ? personalStats(currentPlayer.id, data.matches) : null;
  const pos = currentPlayer ? positionOf(currentPlayer.id, data.matches, data.players) : null;
  const catCounts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.id, filterPool(tracks, { categories: [c.id], artists: [], extra: 'random' }).length])),
    [tracks],
  );
  const play = (mode: ModeId, category?: CategoryId) => {
    const target = { name: 'setup' as const, mode, category };
    if (!currentPlayer && MODES.find((m) => m.id === mode)!.maxPlayers === 1) go({ name: 'identify', then: target });
    else go(target);
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 px-6 py-12 md:px-12 md:py-16">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 right-10 hidden opacity-60 md:block">
          <Equalizer bars={22} height={160} className="gap-[6px] [&>span]:w-[8px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-2xl">
          <Badge tone="accent" className="mb-6">Trap · Funk · Sertanejo · MPB · Pop · e muito mais</Badge>
          <Logo size="lg" />
          <p className="mt-6 max-w-xl text-lg text-zinc-400">
            Ouça o trecho, descubra a música e desafie seus amigos online — em times ou todos contra todos. Prévias oficiais, nomes e artistas verificados.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="xl" icon={<Play size={22} fill="currentColor" />} onClick={() => play('classic')} disabled={!tracks.length}>
              JOGAR
            </Button>
            <Button size="lg" icon={<ListOrdered size={18} />} onClick={() => go({ name: 'ranking' })}>Ranking</Button>
            <Button size="lg" icon={<Globe size={18} />} onClick={() => go({ name: 'online' })}>Jogar online</Button>
          </div>
          {currentPlayer && stats && (
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <div><div className="label">Recorde pessoal</div><div className="h-display text-2xl tabular-nums">{fmtNumber(stats.best)}</div></div>
              <div><div className="label">Partidas</div><div className="h-display text-2xl tabular-nums">{stats.matches}</div></div>
              <div><div className="label">Aproveitamento</div><div className="h-display text-2xl tabular-nums">{pct(stats.accuracy)}</div></div>
              <div><div className="label">Posição</div><div className="h-display text-2xl tabular-nums">{pos ? `${pos}º` : '—'}</div></div>
            </div>
          )}
        </motion.div>
      </section>

      {!tracks.length && catalogStatus === 'loading' && (
        <div className="glass flex items-center gap-3 p-5 text-zinc-300"><Spinner size={18} /> Carregando as músicas…</div>
      )}
      {!tracks.length && catalogStatus === 'unavailable' && (
        <div className="glass flex flex-wrap items-center gap-4 border-amber-500/30 p-5">
          <AlertTriangle className="text-amber-300" />
          <div className="flex-1">
            <div className="font-semibold">Músicas ainda não carregadas</div>
            <div className="text-sm text-zinc-400">{syncing ? `Buscando na Apple Music: ${syncing}` : 'Busque as prévias oficiais na Apple Music (precisa de internet e leva alguns minutos).'}</div>
          </div>
          <Button variant="primary" icon={syncing ? <Spinner size={16} /> : <RefreshCw size={16} />} onClick={syncHere} disabled={!!syncing}>Buscar músicas</Button>
        </div>
      )}

      <OnlineHomeCard onOpen={() => go({ name: 'online' })} />

      {/* Modos */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="label">Escolha como jogar</div>
            <h2 className="h-display mt-1 text-2xl">Modos de jogo</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m, i) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => play(m.id)}
              disabled={!tracks.length}
              className="glass group relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:border-accent/40 disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/0 blur-2xl transition group-hover:bg-accent/25" />
              <div className="flex items-start justify-between">
                <span className="rounded-xl bg-accent/12 p-2.5 text-accent-soft ring-1 ring-accent/20"><Icon name={m.icon} size={22} /></span>
                {m.maxPlayers > 1 && <Badge>{m.minPlayers === m.maxPlayers ? `${m.minPlayers} jogadores` : `até ${m.maxPlayers}`}</Badge>}
                {!m.ranked && <Badge tone="amber">amistoso</Badge>}
              </div>
              <div className="h-display mt-4 text-xl">{m.name}</div>
              <div className="mt-0.5 text-sm font-medium text-accent-soft/90">{m.tagline}</div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{m.description}</p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Categorias */}
      <section>
        <div className="label">Gêneros</div>
        <h2 className="h-display mb-5 mt-1 text-2xl">Categorias</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.filter((c) => data.settings.enabledCategories.includes(c.id)).map((c) => (
            <button
              key={c.id}
              onClick={() => play('classic', c.id)}
              disabled={!catCounts[c.id]}
              className="glass group p-5 text-left transition hover:border-accent/40 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="h-display text-lg">{c.name}</span>
                <Equalizer bars={4} height={18} active={false} className="opacity-60 group-hover:[&]:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-zinc-500">{c.description}</p>
              <div className="mt-4 text-xs text-zinc-400">{catCounts[c.id] ?? 0} músicas verificadas</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
