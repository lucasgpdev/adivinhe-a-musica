import { motion } from 'framer-motion';
import { Award, Check, Crown, Flame, Lock, Medal, Pencil, Star, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, computePlayerStats } from '../achievements/achievements';
import { Icon } from '../components/Icon';
import { Badge, Button, Empty, PageHeader, Stat } from '../components/ui';
import { Avatar } from '../components/visuals';
import { AVATARS, THEMES } from '../data/cosmetics';
import { MODE_BY_ID } from '../data/modes';
import { hallOfFame, personalStats, positionOf, topPlayerId } from '../ranking/ranking';
import { useStore } from '../state/AppStore';
import { cx, fmtDate, fmtNumber, pct } from '../utils';
import { NAME_MAX } from './Identify';
import { PlayerHistory } from './Ranking';

// ─── Hall da Fama ────────────────────────────────────────────

export function HallOfFamePage() {
  const { data } = useStore();
  const h = useMemo(() => hallOfFame(data.matches, data.championships, data.players), [data.matches, data.championships, data.players]);
  const name = (id?: string) => data.players.find((p) => p.id === id)?.name ?? '—';
  const avatar = (id?: string) => data.players.find((p) => p.id === id)?.avatar ?? 'mic';
  if (!data.matches.length) return <><PageHeader title="Hall da Fama" /><Empty icon={<Medal size={28} />} title="A história ainda vai ser escrita" text="Os recordes aparecem aqui depois das primeiras partidas." /></>;
  return (
    <div>
      <PageHeader title="Hall da Fama" subtitle="Campeões, recordes históricos e as maiores marcas da turma." />
      <section className="mb-10">
        <h2 className="h-display mb-4 flex items-center gap-2 text-xl"><Crown className="text-gold" size={20} /> Campeões anteriores</h2>
        {h.champions.length === 0 ? <p className="text-sm text-zinc-500">Nenhum campeonato encerrado ainda.</p> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {h.champions.map((c) => (
              <div key={c.championship.id} className="glass relative overflow-hidden border-gold/20 p-5">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />
                <div className="label">{fmtDate(c.championship.endedAt ?? c.championship.createdAt)}</div>
                <div className="h-display text-lg">{c.championship.name}</div>
                <div className="mt-4 flex items-center gap-3"><Avatar id={avatar(c.first)} size={48} ring /><div><div className="text-xs text-gold">Campeão</div><div className="h-display text-xl">{name(c.first)}</div></div></div>
                <div className="mt-3 flex gap-4 text-sm text-zinc-400"><span>🥈 {name(c.second)}</span><span>🥉 {name(c.third)}</span></div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass p-6">
          <h2 className="h-display mb-4 flex items-center gap-2 text-lg"><Star size={18} className="text-accent-soft" /> Maiores pontuações</h2>
          <ol className="space-y-2">
            {h.topScores.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center font-bold text-zinc-500">{i + 1}</span><Avatar id={avatar(m.playerId)} size={28} />
                <span className="flex-1 truncate">{name(m.playerId)} <span className="text-zinc-500">· {MODE_BY_ID[m.mode].name}</span></span>
                <span className="h-display tabular-nums">{fmtNumber(m.score)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="glass p-6">
          <h2 className="h-display mb-4 flex items-center gap-2 text-lg"><Medal size={18} className="text-accent-soft" /> Recordes por modo</h2>
          <ul className="space-y-2">
            {h.modeRecords.map(({ mode, match }) => (
              <li key={mode} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-zinc-400">{MODE_BY_ID[mode].name}</span><Avatar id={avatar(match.playerId)} size={26} />
                <span className="flex-1 truncate">{name(match.playerId)}</span><span className="h-display tabular-nums">{fmtNumber(match.score)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass p-6">
          <h2 className="h-display mb-4 flex items-center gap-2 text-lg"><Trophy size={18} className="text-gold" /> Mais vitórias</h2>
          {h.mostWins.length === 0 ? <p className="text-sm text-zinc-500">Vitórias contam em Duelo, Batalha, Sobrevivência e campeonatos.</p> : (
            <ol className="space-y-2">{h.mostWins.map((w, i) => (
              <li key={w.playerId} className="flex items-center gap-3 text-sm"><span className="w-6 text-center font-bold text-zinc-500">{i + 1}</span><Avatar id={avatar(w.playerId)} size={28} /><span className="flex-1">{name(w.playerId)}</span><span className="h-display">{w.wins}</span></li>
            ))}</ol>
          )}
        </section>
        <section className="glass p-6">
          <h2 className="h-display mb-4 flex items-center gap-2 text-lg"><Flame size={18} className="text-amber-300" /> Maiores sequências de acertos</h2>
          <ol className="space-y-2">{h.longestStreaks.map((s, i) => (
            <li key={s.playerId} className="flex items-center gap-3 text-sm"><span className="w-6 text-center font-bold text-zinc-500">{i + 1}</span><Avatar id={avatar(s.playerId)} size={28} /><span className="flex-1">{name(s.playerId)} <span className="text-zinc-500">· {MODE_BY_ID[s.match.mode].name}</span></span><span className="h-display">{s.streak}</span></li>
          ))}</ol>
        </section>
      </div>
    </div>
  );
}

// ─── Conquistas ──────────────────────────────────────────────

export function AchievementsPage() {
  const { data, currentPlayer, go } = useStore();
  if (!currentPlayer) {
    return <><PageHeader title="Conquistas" /><Empty icon={<Award size={28} />} title="Entre com seu jogador" text="As conquistas são individuais." action={<Button variant="primary" onClick={() => go({ name: 'identify', then: { name: 'achievements' } })}>Identificar</Button>} /></>;
  }
  const stats = computePlayerStats(currentPlayer.id, data.matches, data.championships, topPlayerId(data.matches, data.players));
  const unlocked = new Map(data.achievements.filter((a) => a.playerId === currentPlayer.id).map((a) => [a.achievementId, a.unlockedAt]));
  return (
    <div>
      <PageHeader title="Conquistas" subtitle={`${unlocked.size} de ${ACHIEVEMENTS.length} desbloqueadas por ${currentPlayer.name}.`} />
      <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div className="h-full bg-gradient-to-r from-accent-deep via-accent to-gold" initial={{ width: 0 }} animate={{ width: `${(unlocked.size / ACHIEVEMENTS.length) * 100}%` }} transition={{ duration: 0.8 }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a, i) => {
          const at = unlocked.get(a.id);
          const p = a.progress(stats);
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cx('glass flex gap-4 p-5', at ? 'border-gold/25' : 'opacity-80')}>
              <span className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', at ? 'bg-gradient-to-br from-gold to-amber-600 text-ink-950 shadow-[0_0_30px_-8px_rgba(245,196,81,0.6)]' : 'bg-white/[0.05] text-zinc-600')}>
                {at ? <Icon name={a.icon} size={26} /> : <Lock size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-zinc-400">{a.description}</div>
                <div className="mt-2 text-xs text-zinc-500">{a.condition}</div>
                {at ? (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gold"><Check size={12} /> Desbloqueada em {fmtDate(at)}</div>
                ) : (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (p.current / p.target) * 100)}%` }} /></div>
                    <div className="mt-1 text-right text-[11px] tabular-nums text-zinc-500">{Math.min(p.current, p.target)}/{p.target}</div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Perfil ──────────────────────────────────────────────────

export function ProfilePage() {
  const { data, currentPlayer, update, go, toast, setCurrentPlayer } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentPlayer?.name ?? '');
  const [hist, setHist] = useState(false);
  if (!currentPlayer) {
    return <Empty icon={<Award size={28} />} title="Nenhum jogador selecionado" action={<Button variant="primary" onClick={() => go({ name: 'identify' })}>Identificar</Button>} />;
  }
  const unlocked = new Set(data.achievements.filter((a) => a.playerId === currentPlayer.id).map((a) => a.achievementId));
  const st = personalStats(currentPlayer.id, data.matches);
  const pos = positionOf(currentPlayer.id, data.matches, data.players);
  const setField = (patch: Partial<typeof currentPlayer>, audit?: string) =>
    update((d) => ({ ...d, players: d.players.map((p) => (p.id === currentPlayer.id ? { ...p, ...patch } : p)) }), audit ? { action: audit, details: currentPlayer.name } : undefined);
  const saveName = () => {
    const n = name.replace(/\s+/g, ' ').trim();
    if (n.length < 2 || n.length > NAME_MAX) { toast(`O nome deve ter entre 2 e ${NAME_MAX} caracteres.`, 'error'); return; }
    if (data.players.some((p) => p.id !== currentPlayer.id && p.name.toLowerCase() === n.toLowerCase())) { toast('Já existe um jogador com esse nome.', 'error'); return; }
    update((d) => ({ ...d, players: d.players.map((p) => (p.id === currentPlayer.id ? { ...p, name: n } : p)) }), { action: 'Nome alterado', details: `${currentPlayer.name} → ${n}` });
    setEditing(false);
  };
  return (
    <div className="mx-auto max-w-5xl">
      <div className="glass mb-8 flex flex-wrap items-center gap-6 p-6">
        <Avatar id={currentPlayer.avatar} size={96} ring />
        <div className="flex-1">
          {editing ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
              <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <Button type="submit" variant="primary">Salvar</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </form>
          ) : (
            <h1 className="h-display flex items-center gap-3 text-3xl">{currentPlayer.name}<button onClick={() => { setName(currentPlayer.name); setEditing(true); }} className="text-zinc-500 hover:text-white" aria-label="Editar nome"><Pencil size={18} /></button></h1>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {pos && <Badge tone="accent">{pos}º no ranking</Badge>}
            {[...unlocked].slice(0, 6).map((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id)!; return <Badge key={id} tone="gold"><Icon name={a.icon} size={12} /> {a.name}</Badge>; })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setHist(true)}>Histórico</Button>
          <Button variant="ghost" onClick={() => { setCurrentPlayer(null); go({ name: 'identify' }); }}>Trocar jogador</Button>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pontuação total" value={fmtNumber(st.total)} />
        <Stat label="Recorde" value={fmtNumber(st.best)} />
        <Stat label="Aproveitamento" value={pct(st.accuracy)} sub={`${st.correct} acertos · ${st.wrong} erros`} />
        <Stat label="Maior sequência" value={st.bestStreak} sub={`${st.matches} partidas`} />
      </div>
      <section className="glass mb-6 p-6">
        <div className="label mb-4">Avatar</div>
        <div className="flex flex-wrap gap-3">
          {AVATARS.map((a) => {
            const locked = !!a.unlock && !unlocked.has(a.unlock);
            return (
              <button key={a.id} disabled={locked} onClick={() => setField({ avatar: a.id })} title={locked ? `Desbloqueie: ${ACHIEVEMENTS.find((x) => x.id === a.unlock)?.name}` : ''}
                className={cx('relative rounded-full p-1 transition', currentPlayer.avatar === a.id ? 'ring-2 ring-accent' : 'hover:opacity-80', locked && 'opacity-25')}>
                <Avatar id={a.id} size={52} />{locked && <Lock size={14} className="absolute bottom-0 right-0 text-white" />}
              </button>
            );
          })}
        </div>
      </section>
      <section className="glass p-6">
        <div className="label mb-4">Tema visual</div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THEMES.map((t) => {
            const locked = !!t.unlock && !unlocked.has(t.unlock);
            return (
              <button key={t.id} disabled={locked} onClick={() => setField({ theme: t.id })}
                className={cx('rounded-xl border p-3 text-left text-sm transition', currentPlayer.theme === t.id ? 'border-white/40 bg-white/[0.06]' : 'border-white/10 hover:border-white/20', locked && 'opacity-35')}>
                <span className="mb-2 block h-8 rounded-lg" style={{ background: `linear-gradient(135deg, rgb(${t.accent}), rgb(${t.deep}))` }} />
                <span className="flex items-center gap-1">{locked && <Lock size={12} />}{t.name}</span>
                {locked && <span className="block text-[11px] text-zinc-500">{ACHIEVEMENTS.find((x) => x.id === t.unlock)?.name}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <PlayerHistory playerId={hist ? currentPlayer.id : null} onClose={() => setHist(false)} />
    </div>
  );
}
