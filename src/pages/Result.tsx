import { motion } from 'framer-motion';
import { Award, Crown, Home, ListOrdered, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { ACHIEVEMENT_BY_ID } from '../achievements/achievements';
import { sfx } from '../audio/sfx';
import { Icon } from '../components/Icon';
import { Button, Stat } from '../components/ui';
import { Avatar, Confetti, Podium } from '../components/visuals';
import { MODE_BY_ID } from '../data/modes';
import { personalStats, positionOf } from '../ranking/ranking';
import { useStore, type GameResultInfo } from '../state/AppStore';
import { fmtNumber, pct } from '../utils';

export function ResultPage({ result }: { result: GameResultInfo }) {
  const { data, go } = useStore();
  const recs = result.records.slice().sort((a, b) => (a.placement ?? 1) - (b.placement ?? 1));
  const multi = result.launch.playerIds.length > 1;
  const mode = MODE_BY_ID[result.launch.config.mode.id];
  const ctx = result.launch.context;
  const anyRecord = Object.values(result.newRecord).some(Boolean);

  useEffect(() => {
    if (multi || anyRecord) sfx.fanfare();
  }, [multi, anyRecord]);

  const again = () => go({ name: 'game', launch: { ...result.launch, config: { ...result.launch.config } } });
  const canReplay = ctx.kind === 'normal';

  if (!recs.length) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-zinc-400">{result.championshipNote ?? 'Nenhuma resposta registrada.'}</p>
        <Button className="mt-6" variant="primary" onClick={() => go({ name: 'home' })}>Voltar</Button>
      </div>
    );
  }

  const r = recs[0];
  const me = data.players.find((p) => p.id === r.playerId);
  const ps = personalStats(r.playerId, data.matches);
  const pos = positionOf(r.playerId, data.matches, data.players);

  return (
    <div className="mx-auto max-w-5xl">
      {(multi || anyRecord) && <Confetti />}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="label">{mode.name} · {result.reason === 'aborted' ? 'partida encerrada' : result.reason === 'exhausted' ? 'catálogo esgotado' : 'fim de jogo'}</div>
        {multi ? (
          <>
            <h1 className="h-display mt-3 text-4xl md:text-5xl"><Crown className="mb-2 inline text-gold" size={40} /> {recs[0].playerName} venceu!</h1>
            <div className="mt-10"><Podium big entries={recs.slice(0, 3).map((x) => ({ id: x.playerId, name: x.playerName, avatar: data.players.find((p) => p.id === x.playerId)?.avatar ?? 'mic', value: mode.endOnWrong ? `${x.roundsSurvived ?? 0} rodadas` : `${fmtNumber(x.score)} pts` }))} /></div>
          </>
        ) : (
          <>
            <div className="mt-6 flex justify-center">{me && <Avatar id={me.avatar} size={72} ring />}</div>
            <h1 className="h-display mt-4 text-2xl text-zinc-300">{r.playerName}</h1>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.15 }} className="h-display text-gradient mt-2 text-7xl tabular-nums md:text-8xl">
              {fmtNumber(r.score)}
            </motion.div>
            <div className="text-zinc-500">pontos</div>
            {result.newRecord[r.playerId] && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.5 }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 font-semibold text-gold shadow-[0_0_40px_-8px_rgba(245,196,81,0.7)]">
                <Sparkles size={18} /> Novo recorde pessoal neste modo!
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {result.championshipNote && <p className="mt-6 text-center text-amber-300">{result.championshipNote}</p>}
      {!r.ranked && <p className="mt-4 text-center text-sm text-zinc-500">Partida amistosa: registrada no histórico, mas não entra no ranking.</p>}

      {!multi && (
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Acertos" value={r.correct} sub={`de ${r.total} músicas`} />
          <Stat label="Erros" value={r.wrong} />
          <Stat label="Aproveitamento" value={pct(r.accuracy)} />
          <Stat label={mode.endOnWrong ? 'Rodadas' : 'Maior sequência'} value={mode.endOnWrong ? r.roundsSurvived ?? 0 : r.bestStreak} />
          <Stat label="Recorde pessoal" value={fmtNumber(ps.best)} />
          <Stat label="Posição no ranking" value={pos ? `${pos}º` : '—'} />
          <Stat label="Dicas usadas" value={r.hintsUsed} />
          <Stat label="Partidas jogadas" value={ps.matches} />
        </div>
      )}

      {multi && (
        <div className="glass mt-10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr className="border-b border-white/5">
                <th className="px-5 py-3">#</th><th className="py-3">Jogador</th><th className="py-3 text-right">Pontos</th><th className="py-3 text-right">Acertos</th><th className="py-3 text-right">Aproveit.</th><th className="px-5 py-3 text-right">{mode.endOnWrong ? 'Rodadas' : 'Sequência'}</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((x) => (
                <tr key={x.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 font-bold text-zinc-400">{x.placement}º</td>
                  <td className="py-3"><span className="flex items-center gap-2"><Avatar id={data.players.find((p) => p.id === x.playerId)?.avatar ?? 'mic'} size={28} />{x.playerName}{x.won && <Trophy size={14} className="text-gold" />}</span></td>
                  <td className="h-display py-3 text-right tabular-nums">{fmtNumber(x.score)}</td>
                  <td className="py-3 text-right tabular-nums">{x.correct}/{x.total}</td>
                  <td className="py-3 text-right tabular-nums">{pct(x.accuracy)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{mode.endOnWrong ? x.roundsSurvived ?? 0 : x.bestStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Object.entries(result.newAchievements).some(([, a]) => a.length) && (
        <div className="mt-8">
          <div className="label mb-3 flex items-center gap-2"><Award size={14} /> Conquistas desbloqueadas</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(result.newAchievements).flatMap(([pid, ids]) => ids.map((id, i) => {
              const a = ACHIEVEMENT_BY_ID[id];
              return (
                <motion.div key={pid + id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="glass flex items-center gap-3 border-gold/25 p-4">
                  <span className="rounded-xl bg-gradient-to-br from-gold to-amber-600 p-2.5 text-ink-950"><Icon name={a.icon} size={20} /></span>
                  <div><div className="font-semibold">{a.name}</div><div className="text-xs text-zinc-400">{multi ? `${data.players.find((p) => p.id === pid)?.name} · ` : ''}{a.condition}</div></div>
                </motion.div>
              );
            }))}
          </div>
        </div>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {canReplay && <Button variant="primary" size="lg" icon={<RotateCcw size={18} />} onClick={again}>Jogar novamente</Button>}
        <Button size="lg" icon={<ListOrdered size={18} />} onClick={() => go({ name: 'ranking' })}>Ver ranking</Button>
        <Button size="lg" variant="ghost" icon={<Home size={18} />} onClick={() => go({ name: 'home' })}>Voltar ao menu</Button>
      </div>
    </div>
  );
}
