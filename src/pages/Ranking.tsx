import { ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Empty, Modal, PageHeader, Segmented } from '../components/ui';
import { Avatar, Podium } from '../components/visuals';
import { ARTISTS, ARTIST_BY_ID, CATEGORIES, CATEGORY_NAME } from '../data/artists';
import { MODE_BY_ID } from '../data/modes';
import { computeRanking, type Period, type RankingOptions } from '../ranking/ranking';
import { useStore } from '../state/AppStore';
import type { CategoryId } from '../types';
import { cx, fmtDateTime, fmtNumber, pct } from '../utils';

type Scope = 'general' | 'category' | 'artist';

export function RankingPage() {
  const { data, currentPlayer, tracks } = useStore();
  const [period, setPeriod] = useState<Period>('all');
  const [scope, setScope] = useState<Scope>('general');
  const [category, setCategory] = useState<CategoryId>('trap');
  const [artist, setArtist] = useState<string>(ARTISTS[0].id);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const opts: RankingOptions = { period, ...(scope === 'category' ? { category } : {}), ...(scope === 'artist' ? { artistId: artist } : {}) };
  const rows = useMemo(() => computeRanking(data.matches, data.players, opts), [data.matches, data.players, period, scope, category, artist]); // eslint-disable-line react-hooks/exhaustive-deps
  const artistsWithMusic = ARTISTS.filter((a) => tracks.some((t) => t.artistId === a.id) || data.matches.some((m) => m.answers.some((x) => x.artistId === a.id)));

  return (
    <div>
      <PageHeader title="Ranking" subtitle="Todos os participantes deste computador. Ordenado por pontuação, depois aproveitamento e acertos. Partidas amistosas não contam." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented value={period} onChange={setPeriod} options={[{ value: 'all', label: 'Geral' }, { value: 'day', label: 'Hoje' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }]} />
        <Segmented value={scope} onChange={setScope} options={[{ value: 'general', label: 'Todos os gêneros' }, { value: 'category', label: 'Por categoria' }, { value: 'artist', label: 'Por artista' }]} />
      </div>
      {scope === 'category' && (
        <div className="mb-6"><Segmented size="sm" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} /></div>
      )}
      {scope === 'artist' && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {artistsWithMusic.map((a) => (
            <button key={a.id} onClick={() => setArtist(a.id)} className={cx('rounded-full border px-3 py-1 text-sm', artist === a.id ? 'border-accent/60 bg-accent/20' : 'border-white/10 text-zinc-400 hover:text-white')}>{a.name}</button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty icon={<ListOrdered size={28} />} title="Ninguém pontuou aqui ainda" text="Jogue uma partida para aparecer no ranking." />
      ) : (
        <>
          <div className="mb-10 mt-4">
            <Podium entries={rows.slice(0, 3).map((r) => ({ id: r.playerId, name: r.name, avatar: r.avatar, value: `${fmtNumber(r.score)} pts` }))} />
          </div>
          {scope !== 'general' && (
            <p className="mb-3 text-sm text-zinc-500">
              Pontos e acertos considerando apenas as músicas de {scope === 'category' ? CATEGORY_NAME[category] : ARTIST_BY_ID[artist]?.name}, em qualquer modo ranqueado.
            </p>
          )}
          <div className="glass overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3">Pos.</th><th className="py-3">Nome</th><th className="py-3 text-right">Pontuação</th><th className="py-3 text-right">Partidas</th>
                  <th className="py-3 text-right">Acertos</th><th className="py-3 text-right">Aproveitamento</th><th className="px-5 py-3 text-right">Recorde</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.playerId} onClick={() => setHistoryOf(r.playerId)}
                    className={cx('cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]', currentPlayer?.id === r.playerId && 'bg-accent/10')}
                  >
                    <td className="px-5 py-3">
                      <span className={cx('inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold', i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-silver/15 text-silver' : i === 2 ? 'bg-bronze/20 text-bronze' : 'text-zinc-500')}>{i + 1}</span>
                    </td>
                    <td className="py-3"><span className="flex items-center gap-3"><Avatar id={r.avatar} size={30} /><span className="font-medium">{r.name}</span>{currentPlayer?.id === r.playerId && <Badge tone="accent">você</Badge>}</span></td>
                    <td className="h-display py-3 text-right text-base tabular-nums">{fmtNumber(r.score)}</td>
                    <td className="py-3 text-right tabular-nums text-zinc-300">{r.matches}</td>
                    <td className="py-3 text-right tabular-nums text-zinc-300">{r.correct}</td>
                    <td className="py-3 text-right tabular-nums text-zinc-300">{pct(r.accuracy)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-300">{fmtNumber(r.best)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <PlayerHistory playerId={historyOf} onClose={() => setHistoryOf(null)} />
    </div>
  );
}

export function PlayerHistory({ playerId, onClose }: { playerId: string | null; onClose: () => void }) {
  const { data } = useStore();
  const p = data.players.find((x) => x.id === playerId);
  const list = data.matches.filter((m) => m.playerId === playerId).slice().reverse();
  return (
    <Modal open={!!p} onClose={onClose} title={p ? `Histórico de ${p.name}` : ''} wide>
      {list.length === 0 ? <p className="text-zinc-500">Nenhuma partida.</p> : (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2">Data</th><th>Modo</th><th className="text-right">Pontos</th><th className="text-right">Acertos</th><th className="text-right">Aprov.</th><th className="text-right">Resultado</th></tr></thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="py-2 text-zinc-400">{fmtDateTime(m.endedAt)}</td>
                  <td>{MODE_BY_ID[m.mode]?.name}{!m.ranked && <span className="ml-1 text-xs text-amber-300">(amistosa)</span>}{m.championshipId && <span className="ml-1 text-xs text-gold">(campeonato)</span>}</td>
                  <td className="text-right tabular-nums">{fmtNumber(m.score)}</td>
                  <td className="text-right tabular-nums">{m.correct}/{m.total}</td>
                  <td className="text-right tabular-nums">{pct(m.accuracy)}</td>
                  <td className="text-right text-zinc-400">{m.placement ? `${m.placement}º de ${m.participants}` : m.roundsSurvived !== undefined ? `${m.roundsSurvived} rodadas` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
