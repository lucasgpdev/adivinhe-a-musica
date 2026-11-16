/** Rankings calculados a partir do histórico imutável de partidas. */
import type { CategoryId, Championship, MatchRecord, ModeId, Player } from '../types';
import { periodStart } from '../utils';

export interface RankingRow {
  playerId: string;
  name: string;
  avatar: string;
  score: number;
  matches: number;
  correct: number;
  total: number;
  accuracy: number;
  best: number;
  bestStreak: number;
  wins: number;
}

export type Period = 'all' | 'day' | 'week' | 'month';

export interface RankingOptions {
  period?: Period;
  category?: CategoryId;
  artistId?: string;
  mode?: ModeId;
  now?: Date;
}

export function compareRows(a: RankingRow, b: RankingRow): number {
  return b.score - a.score || b.accuracy - a.accuracy || b.correct - a.correct || a.name.localeCompare(b.name);
}

export function computeRanking(matches: MatchRecord[], players: Player[], opts: RankingOptions = {}): RankingRow[] {
  const since = opts.period && opts.period !== 'all' ? periodStart(opts.period, opts.now).getTime() : 0;
  const pmap = new Map(players.map((p) => [p.id, p]));
  const rows = new Map<string, RankingRow>();
  const scoped = !!(opts.category || opts.artistId);

  for (const m of matches) {
    if (!m.ranked) continue;
    if (since && new Date(m.endedAt).getTime() < since) continue;
    if (opts.mode && m.mode !== opts.mode) continue;
    const p = pmap.get(m.playerId);
    if (!p || p.archived) continue;

    let score = m.score, correct = m.correct, total = m.total;
    if (scoped) {
      const ans = m.answers.filter(
        (a) => (!opts.category || a.categories.includes(opts.category)) && (!opts.artistId || a.artistId === opts.artistId),
      );
      if (!ans.length) continue;
      score = ans.reduce((s, a) => s + a.points, 0);
      correct = ans.filter((a) => a.correct).length;
      total = ans.length;
    }
    let r = rows.get(p.id);
    if (!r) {
      r = { playerId: p.id, name: p.name, avatar: p.avatar, score: 0, matches: 0, correct: 0, total: 0, accuracy: 0, best: 0, bestStreak: 0, wins: 0 };
      rows.set(p.id, r);
    }
    r.score += score;
    r.matches++;
    r.correct += correct;
    r.total += total;
    r.best = Math.max(r.best, score);
    r.bestStreak = Math.max(r.bestStreak, m.bestStreak);
    if (m.won) r.wins++;
  }
  const out = [...rows.values()];
  for (const r of out) r.accuracy = r.total ? r.correct / r.total : 0;
  return out.sort(compareRows);
}

export function topPlayerId(matches: MatchRecord[], players: Player[]): string | null {
  return computeRanking(matches, players)[0]?.playerId ?? null;
}

export function positionOf(playerId: string, matches: MatchRecord[], players: Player[]): number | null {
  const i = computeRanking(matches, players).findIndex((r) => r.playerId === playerId);
  return i >= 0 ? i + 1 : null;
}

export interface PersonalStats {
  matches: number;
  best: number;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  bestStreak: number;
  bestSurvival: number;
}

export function personalStats(playerId: string, matches: MatchRecord[]): PersonalStats {
  const mine = matches.filter((m) => m.playerId === playerId);
  const correct = mine.reduce((s, m) => s + m.correct, 0);
  const answered = mine.reduce((s, m) => s + m.total, 0);
  return {
    matches: mine.length,
    best: mine.filter((m) => m.ranked).reduce((s, m) => Math.max(s, m.score), 0),
    total: mine.filter((m) => m.ranked).reduce((s, m) => s + m.score, 0),
    correct,
    wrong: answered - correct,
    accuracy: answered ? correct / answered : 0,
    bestStreak: mine.reduce((s, m) => Math.max(s, m.bestStreak), 0),
    bestSurvival: mine.reduce((s, m) => Math.max(s, m.roundsSurvived ?? 0), 0),
  };
}

/** Melhor pontuação anterior do jogador no mesmo modo (para detectar novo recorde). */
export function previousBest(playerId: string, mode: ModeId, matches: MatchRecord[], excludeGroup?: string): number {
  return matches
    .filter((m) => m.playerId === playerId && m.mode === mode && m.ranked && m.groupId !== excludeGroup)
    .reduce((s, m) => Math.max(s, m.score), 0);
}

export interface HallOfFame {
  champions: { championship: Championship; first: string; second?: string; third?: string }[];
  topScores: MatchRecord[];
  modeRecords: { mode: ModeId; match: MatchRecord }[];
  mostWins: { playerId: string; wins: number }[];
  longestStreaks: { playerId: string; streak: number; match: MatchRecord }[];
}

export function hallOfFame(matches: MatchRecord[], championships: Championship[], players: Player[]): HallOfFame {
  const active = new Set(players.filter((p) => !p.archived).map((p) => p.id));
  const ranked = matches.filter((m) => m.ranked && active.has(m.playerId));
  const champions = championships
    .filter((c) => c.status === 'encerrado' && c.podium)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))
    .map((c) => ({ championship: c, ...c.podium! }));
  const topScores = ranked.slice().sort((a, b) => b.score - a.score).slice(0, 10);
  const modeBest = new Map<ModeId, MatchRecord>();
  for (const m of ranked) {
    const cur = modeBest.get(m.mode);
    if (!cur || m.score > cur.score) modeBest.set(m.mode, m);
  }
  const wins = new Map<string, number>();
  for (const m of ranked) if (m.won) wins.set(m.playerId, (wins.get(m.playerId) ?? 0) + 1);
  for (const c of champions) wins.set(c.first, (wins.get(c.first) ?? 0) + 1);
  const bestStreak = new Map<string, { streak: number; match: MatchRecord }>();
  for (const m of ranked) {
    const cur = bestStreak.get(m.playerId);
    if (!cur || m.bestStreak > cur.streak) bestStreak.set(m.playerId, { streak: m.bestStreak, match: m });
  }
  return {
    champions,
    topScores,
    modeRecords: [...modeBest.entries()].map(([mode, match]) => ({ mode, match })),
    mostWins: [...wins.entries()].map(([playerId, w]) => ({ playerId, wins: w })).sort((a, b) => b.wins - a.wins).slice(0, 10),
    longestStreaks: [...bestStreak.entries()]
      .map(([playerId, v]) => ({ playerId, ...v }))
      .filter((x) => x.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 10),
  };
}
