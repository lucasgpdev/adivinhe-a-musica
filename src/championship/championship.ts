/** Campeonato da Turma: classificatória → semifinal → final → campeão. Lógica pura. */
import type { Bout, BoutResult, Championship, ChampionshipPhase, Difficulty, MatchRecord, Track } from '../types';
import { normalize, shuffle, uid } from '../utils';

export function pickQuestionIds(
  pool: Track[], n: number, range: [Difficulty, Difficulty], rng: () => number, exclude: Set<string> = new Set(),
): string[] {
  const titles = new Set<string>();
  const inRange = pool.filter((t) => t.difficulty >= range[0] && t.difficulty <= range[1] && !exclude.has(t.id));
  const rest = pool.filter((t) => !inRange.includes(t) && !exclude.has(t.id));
  const out: string[] = [];
  for (const t of [...shuffle(inRange, rng), ...shuffle(rest, rng)]) {
    if (out.length >= n) break;
    const k = normalize(t.displayTitle);
    if (titles.has(k)) continue;
    titles.add(k);
    out.push(t.id);
  }
  return out;
}

export function createChampionship(
  name: string,
  participantIds: string[],
  config: Championship['config'],
  pool: Track[],
  rng: () => number,
): Championship {
  if (participantIds.length < 2) throw new Error('São necessários pelo menos 2 participantes.');
  return {
    id: uid('c'),
    name: name.trim() || 'Campeonato da Turma',
    createdAt: new Date().toISOString(),
    status: 'classificatoria',
    participantIds: [...new Set(participantIds)],
    qualifiersCount: participantIds.length >= 4 ? 4 : 2,
    config,
    qualifying: { questionIds: pickQuestionIds(pool, config.questions, [1, 3], rng), results: {} },
    semifinals: [],
    resets: 0,
  };
}

export interface QualRow {
  playerId: string;
  played: boolean;
  score: number;
  correct: number;
  accuracy: number;
  timeMs: number;
}

export function qualifyingStandings(ch: Championship, matches: MatchRecord[]): QualRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  return ch.participantIds
    .map((pid) => {
      const m = ch.qualifying.results[pid] ? byId.get(ch.qualifying.results[pid]) : undefined;
      return {
        playerId: pid, played: !!m, score: m?.score ?? 0, correct: m?.correct ?? 0, accuracy: m?.accuracy ?? 0,
        timeMs: m ? m.answers.reduce((s, a) => s + a.timeMs, 0) : 0,
      };
    })
    .sort((a, b) =>
      Number(b.played) - Number(a.played) || b.score - a.score || b.accuracy - a.accuracy || b.correct - a.correct || a.timeMs - b.timeMs,
    );
}

export function hasPlayedQualifying(ch: Championship, playerId: string): boolean {
  return !!ch.qualifying.results[playerId];
}

export function recordQualifying(ch: Championship, playerId: string, matchId: string): Championship {
  if (ch.status !== 'classificatoria' || hasPlayedQualifying(ch, playerId) || !ch.participantIds.includes(playerId)) return ch;
  return { ...ch, qualifying: { ...ch.qualifying, results: { ...ch.qualifying.results, [playerId]: matchId } } };
}

function usedIds(ch: Championship): Set<string> {
  return new Set([
    ...ch.qualifying.questionIds,
    ...ch.semifinals.flatMap((b) => b.questionIds),
    ...(ch.final?.questionIds ?? []),
  ]);
}

/** Encerra a classificatória e cria os confrontos (semifinais ou final direta). */
export function startKnockout(ch: Championship, matches: MatchRecord[], pool: Track[], rng: () => number): Championship {
  const st = qualifyingStandings(ch, matches).filter((r) => r.played);
  if (st.length < 2) throw new Error('Pelo menos 2 participantes precisam ter jogado a classificatória.');
  const n = st.length >= 4 && ch.qualifiersCount === 4 ? 4 : 2;
  const seeds = st.slice(0, n).map((r) => r.playerId);
  const used = usedIds(ch);
  const q = ch.config.questions;
  if (n === 4) {
    const s1 = pickQuestionIds(pool, q, [2, 3], rng, used);
    s1.forEach((id) => used.add(id));
    const s2 = pickQuestionIds(pool, q, [2, 3], rng, used);
    return {
      ...ch,
      status: 'semifinal',
      qualifiersCount: 4,
      semifinals: [
        { id: uid('b'), label: 'Semifinal 1', a: seeds[0], b: seeds[3], questionIds: s1 },
        { id: uid('b'), label: 'Semifinal 2', a: seeds[1], b: seeds[2], questionIds: s2 },
      ],
    };
  }
  return {
    ...ch,
    status: 'final',
    qualifiersCount: 2,
    semifinals: [],
    final: { id: uid('b'), label: 'Final', a: seeds[0], b: seeds[1], questionIds: pickQuestionIds(pool, q, [3, 4], rng, used) },
  };
}

/** Define o vencedor de um confronto: pontos → acertos → menor tempo total → melhor semente (a). */
export function decideBout(b: Bout, scores: Record<string, number>, correct: Record<string, number>, timeMs: Record<string, number>, groupId: string): BoutResult {
  const order = [b.a, b.b].sort(
    (x, y) => scores[y] - scores[x] || correct[y] - correct[x] || timeMs[x] - timeMs[y] || (x === b.a ? -1 : 1),
  );
  return { groupId, scores, correct, timeMs, winnerId: order[0] };
}

export function recordBout(
  ch: Championship, boutId: string, result: BoutResult, matches: MatchRecord[], pool: Track[], rng: () => number,
): Championship {
  if (ch.status === 'semifinal') {
    const semis = ch.semifinals.map((b) => (b.id === boutId && !b.result ? { ...b, result } : b));
    const next: Championship = { ...ch, semifinals: semis };
    if (semis.every((b) => b.result)) {
      const used = usedIds(next);
      return {
        ...next,
        status: 'final',
        final: {
          id: uid('b'), label: 'Final', a: semis[0].result!.winnerId, b: semis[1].result!.winnerId,
          questionIds: pickQuestionIds(pool, ch.config.questions, [3, 4], rng, used),
        },
      };
    }
    return next;
  }
  if (ch.status === 'final' && ch.final && ch.final.id === boutId && !ch.final.result) {
    const final = { ...ch.final, result };
    const second = final.a === result.winnerId ? final.b : final.a;
    let third: string | undefined;
    if (ch.semifinals.length) {
      const losers = ch.semifinals.map((b) => {
        const l = b.result!.winnerId === b.a ? b.b : b.a;
        return { id: l, score: b.result!.scores[l] ?? 0, correct: b.result!.correct[l] ?? 0 };
      });
      const qual = qualifyingStandings(ch, matches).map((r) => r.playerId);
      losers.sort((x, y) => y.score - x.score || y.correct - x.correct || qual.indexOf(x.id) - qual.indexOf(y.id));
      third = losers[0]?.id;
    } else {
      third = qualifyingStandings(ch, matches).filter((r) => r.played).map((r) => r.playerId).find((id) => id !== final.a && id !== final.b);
    }
    return {
      ...ch, final, status: 'encerrado', endedAt: new Date().toISOString(),
      podium: { first: result.winnerId, second, third },
    };
  }
  return ch;
}

/** Reinicia uma fase específica (e as seguintes). O histórico de partidas é preservado. */
export function resetPhase(ch: Championship, phase: ChampionshipPhase): Championship {
  const base = { ...ch, resets: ch.resets + 1, podium: undefined, endedAt: undefined };
  if (phase === 'classificatoria')
    return { ...base, status: 'classificatoria', qualifying: { ...ch.qualifying, results: {} }, semifinals: [], final: undefined };
  if (phase === 'semifinal')
    return { ...base, status: 'semifinal', semifinals: ch.semifinals.map((b) => ({ ...b, result: undefined })), final: undefined };
  return { ...base, status: 'final', final: ch.final ? { ...ch.final, result: undefined } : undefined };
}

export function pendingBout(ch: Championship): Bout | undefined {
  if (ch.status === 'semifinal') return ch.semifinals.find((b) => !b.result);
  if (ch.status === 'final') return ch.final && !ch.final.result ? ch.final : undefined;
  return undefined;
}
