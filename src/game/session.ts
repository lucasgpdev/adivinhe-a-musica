/**
 * Motor da partida — estado imutável e funções puras.
 * Suporta 1 jogador e vários jogadores no mesmo computador (passa-e-joga):
 * cada jogador responde à MESMA música; as respostas só são reveladas
 * quando todos responderam.
 */
import { MAX_HINTS_PER_MATCH, MYSTERY_LEVELS, type ModeDef } from '../data/modes';
import type {
  AnswerRecord, ChampionshipPhase, Difficulty, HintId, MatchFilters, MatchRecord, Player, Track,
} from '../types';
import { makeRng, normalize, shuffle, uid } from '../utils';
import { computePoints, type PointsBreakdown } from './scoring';

export interface SessionConfig {
  mode: ModeDef;
  questions: number | null;
  timeSec: number;
  points: number;
  difficulty: [Difficulty, Difficulty];
  progressive: boolean;
  endOnWrong: boolean;
  hints: HintId[];
  secondChance: boolean;
  combo: boolean;
  bonusRound: boolean;
  steal: boolean;
  ranked: boolean;
  filters: MatchFilters;
  fixedQuestionIds?: string[];
  championshipId?: string;
  championshipPhase?: ChampionshipPhase;
}

export interface Question {
  index: number;
  track: Track;
  options: Track[];
  difficulty: Difficulty;
  timeSec: number;
  snippetStart: number;
  snippetSec: number;
  bonus: boolean;
  steal: boolean;
}

export interface TurnState {
  answered: boolean;
  selectedId?: string;
  correct: boolean;
  timedOut: boolean;
  timeMs: number;
  hints: HintId[];
  eliminated: string[]; // opções removidas (50/50 e segunda chance)
  usedSecondChance: boolean;
  mysteryLevel: number;
  breakdown?: PointsBreakdown;
  steal?: number;
}

export interface SessionPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  hintsUsed: number;
  secondChanceLeft: number;
  eliminated: boolean;
  totalTimeMs: number;
  answers: AnswerRecord[];
}

export type Phase = 'handoff' | 'question' | 'locked' | 'reveal' | 'finished';

export interface Session {
  groupId: string;
  startedAt: string;
  config: SessionConfig;
  players: SessionPlayer[];
  pool: Track[];
  allTracks: Track[];
  usedIds: string[];
  question: Question | null;
  turnOrder: string[];
  turnIdx: number;
  turns: Record<string, TurnState>;
  phase: Phase;
  finishedReason?: 'completed' | 'eliminated' | 'exhausted' | 'aborted';
  rng: () => number;
}

export const isMulti = (s: Session) => s.players.length > 1;
export const currentPlayerId = (s: Session) => s.turnOrder[s.turnIdx];

// ─── Criação ─────────────────────────────────────────────────

export function createSession(
  config: SessionConfig,
  players: Pick<Player, 'id' | 'name' | 'avatar'>[],
  pool: Track[],
  allTracks: Track[],
  seed = Date.now(),
): Session {
  const s: Session = {
    groupId: uid('g'),
    startedAt: new Date().toISOString(),
    config,
    players: players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0,
      hintsUsed: 0, secondChanceLeft: config.secondChance ? 1 : 0, eliminated: false, totalTimeMs: 0, answers: [],
    })),
    pool,
    allTracks: allTracks.length ? allTracks : pool,
    usedIds: [],
    question: null,
    turnOrder: [],
    turnIdx: 0,
    turns: {},
    phase: 'handoff',
    rng: makeRng(seed),
  };
  return nextQuestion(s);
}

// ─── Seleção de músicas ─────────────────────────────────────

export function difficultyFor(s: Session, index: number): Difficulty {
  const c = s.config;
  if (c.progressive) {
    const step = c.mode.id === 'infinite' ? 5 : 3;
    const d = c.difficulty[0] + Math.floor(index / step);
    return Math.min(c.difficulty[1], d) as Difficulty;
  }
  const [lo, hi] = c.difficulty;
  return (lo + Math.floor(s.rng() * (hi - lo + 1))) as Difficulty;
}

export function timeFor(s: Session, index: number): number {
  const c = s.config;
  if (!c.progressive || !c.mode.minTimeSec) return c.timeSec;
  if (c.mode.id === 'survival') return Math.max(c.mode.minTimeSec, c.timeSec - index);
  return Math.max(c.mode.minTimeSec, c.timeSec - 2 * Math.floor(index / 5));
}

function pickTrack(s: Session, index: number, d: Difficulty): Track | null {
  const used = new Set(s.usedIds);
  const usedTitles = new Set(s.pool.filter((t) => used.has(t.id)).map((t) => normalize(t.displayTitle)));
  const fixed = s.config.fixedQuestionIds?.[index];
  if (fixed && !used.has(fixed)) {
    const t = s.pool.find((x) => x.id === fixed) ?? s.allTracks.find((x) => x.id === fixed);
    if (t) return t;
  }
  const avail = s.pool.filter((t) => !used.has(t.id) && !usedTitles.has(normalize(t.displayTitle)));
  if (!avail.length) return null;
  for (let delta = 0; delta <= 3; delta++) {
    const near = avail.filter((t) => Math.abs(t.difficulty - d) === delta);
    // em empate de distância, prioriza a dificuldade mais alta (modos progressivos)
    if (near.length) return near[Math.floor(s.rng() * near.length)];
  }
  return avail[Math.floor(s.rng() * avail.length)];
}

/** Monta as 4 alternativas. Quanto maior a dificuldade, mais parecidas (mesmo artista/gênero). */
export function buildOptions(track: Track, all: Track[], d: Difficulty, rng: () => number): Track[] | null {
  const key = normalize(track.displayTitle);
  const seen = new Set([key]);
  const out: Track[] = [];
  const take = (cands: Track[]) => {
    for (const t of shuffle(cands, rng)) {
      if (out.length >= 3) return;
      const k = normalize(t.displayTitle);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  };
  const sameArtist = all.filter((t) => t.artistId === track.artistId);
  const sameCat = all.filter((t) => t.artistId !== track.artistId && t.categories.some((c) => track.categories.includes(c)));
  const others = all.filter((t) => t.artistId !== track.artistId);
  if (d >= 3) take(sameArtist);
  if (d === 2) take(sameCat);
  if (d === 1) take(others.filter((t) => !t.categories.some((c) => track.categories.includes(c))));
  take(sameCat);
  take(others);
  take(sameArtist);
  if (out.length < 3) return null;
  return shuffle([track, ...out], rng);
}

function snippetFor(s: Session, d: Difficulty, timeSec: number): { start: number; sec: number } {
  const r = s.rng;
  if (s.config.mode.mysterious) return { start: 3 + Math.floor(r() * 15), sec: MYSTERY_LEVELS[0].seconds };
  switch (d) {
    case 1: return { start: 0, sec: Math.min(29, Math.max(timeSec, 12)) };
    case 2: return { start: Math.floor(r() * 8), sec: Math.min(10, Math.max(timeSec, 6)) };
    case 3: return { start: 4 + Math.floor(r() * 12), sec: 5 };
    default: return { start: 6 + Math.floor(r() * 14), sec: 2.5 };
  }
}

function freshTurn(): TurnState {
  return { answered: false, correct: false, timedOut: false, timeMs: 0, hints: [], eliminated: [], usedSecondChance: false, mysteryLevel: 0 };
}

function setupQuestion(s: Session, index: number, exclude: string[] = []): Session {
  const d = difficultyFor(s, index);
  const sx: Session = { ...s, usedIds: [...s.usedIds, ...exclude] };
  let track = pickTrack(sx, index, d);
  let options: Track[] | null = null;
  while (track && !(options = buildOptions(track, sx.allTracks, track.difficulty, sx.rng))) {
    sx.usedIds = [...sx.usedIds, track.id];
    track = pickTrack(sx, index, d);
  }
  if (!track || !options) return { ...s, usedIds: sx.usedIds, question: null, phase: 'finished', finishedReason: 'exhausted' };
  const timeSec = timeFor(s, index);
  const snip = snippetFor(s, track.difficulty, timeSec);
  const multi = s.players.length > 1;
  const active = s.players.filter((p) => !p.eliminated).map((p) => p.id);
  const q: Question = {
    index, track, options, difficulty: track.difficulty, timeSec,
    snippetStart: snip.start, snippetSec: Math.min(snip.sec, 29),
    bonus: s.config.bonusRound && (index + 1) % 5 === 0,
    steal: s.config.steal && multi && s.config.mode.competitive && (index + 1) % 4 === 0,
  };
  return {
    ...s,
    usedIds: [...sx.usedIds, track.id],
    question: q,
    turnOrder: active,
    turnIdx: 0,
    turns: Object.fromEntries(active.map((id) => [id, freshTurn()])),
    phase: multi ? 'handoff' : 'question',
  };
}

export function nextQuestion(s: Session): Session {
  const index = s.question ? s.question.index + 1 : 0;
  if (s.config.questions !== null && index >= s.config.questions) {
    return { ...s, phase: 'finished', finishedReason: 'completed' };
  }
  return setupQuestion(s, index);
}

/** Substitui a música atual (falha de áudio) sem afetar a pontuação de ninguém. */
export function replaceCurrentTrack(s: Session): Session {
  if (!s.question) return s;
  const failed = s.question.track.id;
  // descarta a música também da lista fixa (campeonato)
  const fixed = s.config.fixedQuestionIds?.map((id, i) => (i === s.question!.index && id === failed ? '' : id));
  const sx = { ...s, config: { ...s.config, fixedQuestionIds: fixed } };
  return setupQuestion(sx, s.question.index, [failed]);
}

// ─── Ações do jogador ───────────────────────────────────────

export function beginTurn(s: Session): Session {
  return s.phase === 'handoff' ? { ...s, phase: 'question' } : s;
}

export type HintResult = { ok: true; session: Session } | { ok: false; reason: string };

export function canUseHint(s: Session, hint: HintId): string | null {
  const pid = currentPlayerId(s);
  const turn = s.turns[pid];
  const player = s.players.find((p) => p.id === pid);
  if (!s.question || !turn || !player || s.phase !== 'question' || turn.answered) return 'Indisponível agora.';
  if (!s.config.hints.includes(hint)) return 'Dica desativada neste modo.';
  if (hint === 'more') return turn.mysteryLevel >= MYSTERY_LEVELS.length - 1 ? 'Trecho máximo atingido.' : null;
  if (turn.hints.includes(hint)) return 'Dica já usada nesta pergunta.';
  if (player.hintsUsed >= MAX_HINTS_PER_MATCH) return `Limite de ${MAX_HINTS_PER_MATCH} dicas por partida.`;
  if (hint === 'decade' && !s.question.track.year) return 'Ano de lançamento não verificado.';
  return null;
}

export function applyHint(s: Session, hint: HintId): HintResult {
  const reason = canUseHint(s, hint);
  if (reason) return { ok: false, reason };
  const pid = currentPlayerId(s);
  const turn = { ...s.turns[pid], hints: [...s.turns[pid].hints] };
  if (hint === 'more') {
    turn.mysteryLevel++;
    if (!turn.hints.includes('more')) turn.hints.push('more');
  } else {
    turn.hints.push(hint);
    if (hint === 'fifty') {
      const q = s.question!;
      const wrong = q.options.filter((o) => o.id !== q.track.id && !turn.eliminated.includes(o.id));
      // deixa exatamente uma correta e uma incorreta
      const remove = shuffle(wrong, s.rng).slice(0, Math.max(0, Math.min(2, wrong.length - 1)));
      turn.eliminated = [...turn.eliminated, ...remove.map((o) => o.id)];
    }
  }
  const players = s.players.map((p) => (p.id === pid && hint !== 'more' ? { ...p, hintsUsed: p.hintsUsed + 1 } : p));
  return { ok: true, session: { ...s, players, turns: { ...s.turns, [pid]: turn } } };
}

export interface AnswerOutcome {
  session: Session;
  /** true quando a resposta foi ignorada (duplicada / fora de hora) */
  ignored: boolean;
  secondChance: boolean;
}

/**
 * Registra a resposta do jogador da vez. `optionId = null` → tempo esgotado.
 * Respostas repetidas ou fora da fase são ignoradas (não geram pontos duplicados).
 */
export function answer(s: Session, optionId: string | null, elapsedMs: number): AnswerOutcome {
  const pid = currentPlayerId(s);
  const turn = s.turns[pid];
  if (s.phase !== 'question' || !s.question || !turn || turn.answered) return { session: s, ignored: true, secondChance: false };
  if (optionId && (turn.eliminated.includes(optionId) || !s.question.options.some((o) => o.id === optionId)))
    return { session: s, ignored: true, secondChance: false };
  const q = s.question;
  const correct = optionId === q.track.id;
  const player = s.players.find((p) => p.id === pid)!;
  const timeMs = Math.max(0, Math.min(elapsedMs, q.timeSec * 1000));

  // Segunda chance: uma vez por partida, apenas em erro (não em tempo esgotado)
  if (!correct && optionId && s.config.secondChance && player.secondChanceLeft > 0 && !turn.usedSecondChance
      && timeMs < q.timeSec * 1000 - 1000 && q.options.length - turn.eliminated.length > 2) {
    const t2: TurnState = { ...turn, usedSecondChance: true, eliminated: [...turn.eliminated, optionId] };
    const players = s.players.map((p) => (p.id === pid ? { ...p, secondChanceLeft: p.secondChanceLeft - 1 } : p));
    return { session: { ...s, players, turns: { ...s.turns, [pid]: t2 } }, ignored: false, secondChance: true };
  }

  const done: TurnState = { ...turn, answered: true, selectedId: optionId ?? undefined, correct, timedOut: optionId === null, timeMs };
  // pontos calculados já (para feedback imediato no modo solo); efetivados em commitRound
  const streakAfter = correct ? player.streak + 1 : 0;
  done.breakdown = computePoints({
    base: s.config.points, correct, remainingRatio: 1 - timeMs / (q.timeSec * 1000), streakAfter,
    hints: done.hints, secondChance: done.usedSecondChance, bonusRound: q.bonus, combo: s.config.combo,
    mysteryLevel: s.config.mode.mysterious ? done.mysteryLevel : undefined,
  });
  let next: Session = { ...s, turns: { ...s.turns, [pid]: done } };
  if (s.turnIdx < s.turnOrder.length - 1) next = { ...next, phase: 'locked' };
  else next = commitRound(next);
  return { session: next, ignored: false, secondChance: false };
}

/** Aplica os resultados da rodada aos jogadores (pontos, sequências, eliminações, roubo). */
function commitRound(s: Session): Session {
  const q = s.question!;
  const turns = { ...s.turns };
  // Roubo de pontos: o acerto mais rápido leva o valor-base de cada adversário que errou.
  if (q.steal) {
    const ids = s.turnOrder;
    const winners = ids.filter((id) => turns[id].correct).sort((a, b) => turns[a].timeMs - turns[b].timeMs);
    const losers = ids.filter((id) => !turns[id].correct).length;
    if (winners.length && losers) turns[winners[0]] = { ...turns[winners[0]], steal: losers * s.config.points };
  }
  const players = s.players.map((p) => {
    const t = turns[p.id];
    if (!t) return p;
    const pts = (t.breakdown?.total ?? 0) + (t.steal ?? 0);
    const streak = t.correct ? p.streak + 1 : 0;
    const rec: AnswerRecord = {
      trackId: q.track.id, artistId: q.track.artistId, categories: q.track.categories, difficulty: q.difficulty,
      correct: t.correct, timedOut: t.timedOut, points: pts, timeMs: t.timeMs, hints: t.hints,
      secondChance: t.usedSecondChance || undefined, bonus: q.bonus || undefined, steal: t.steal,
    };
    return {
      ...p,
      score: p.score + pts,
      correct: p.correct + (t.correct ? 1 : 0),
      wrong: p.wrong + (t.correct ? 0 : 1),
      streak,
      bestStreak: Math.max(p.bestStreak, streak),
      totalTimeMs: p.totalTimeMs + t.timeMs,
      eliminated: p.eliminated || (s.config.endOnWrong && !t.correct),
      answers: [...p.answers, rec],
    };
  });
  return { ...s, players, turns, phase: 'reveal' };
}

/** Avança: próximo jogador (passa-e-joga) ou próxima pergunta. */
export function advance(s: Session): Session {
  if (s.phase === 'locked') return { ...s, turnIdx: s.turnIdx + 1, phase: 'handoff' };
  if (s.phase !== 'reveal') return s;
  const active = s.players.filter((p) => !p.eliminated);
  if (s.config.endOnWrong) {
    if (!active.length) return { ...s, phase: 'finished', finishedReason: 'eliminated' };
    if (s.players.length > 1 && active.length === 1) return { ...s, phase: 'finished', finishedReason: 'eliminated' };
  }
  return nextQuestion(s);
}

export function abort(s: Session): Session {
  return { ...s, phase: 'finished', finishedReason: 'aborted' };
}

// ─── Resultado ──────────────────────────────────────────────

export function standings(s: Session): SessionPlayer[] {
  const survival = s.config.endOnWrong;
  return s.players.slice().sort((a, b) => {
    if (survival) {
      const ra = a.correct, rb = b.correct;
      if (rb !== ra) return rb - ra;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.totalTimeMs - b.totalTimeMs;
  });
}

export function toMatchRecords(s: Session): MatchRecord[] {
  const order = standings(s);
  const endedAt = new Date().toISOString();
  const multi = s.players.length > 1;
  return s.players
    .filter((p) => p.answers.length > 0)
    .map((p) => {
      const placement = order.findIndex((x) => x.id === p.id) + 1;
      const total = p.answers.length;
      return {
        id: uid('m'),
        groupId: s.groupId,
        mode: s.config.mode.id,
        ranked: s.config.ranked,
        startedAt: s.startedAt,
        endedAt,
        playerId: p.id,
        playerName: p.name,
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        total,
        accuracy: total ? p.correct / total : 0,
        bestStreak: p.bestStreak,
        hintsUsed: p.hintsUsed,
        roundsSurvived: s.config.endOnWrong ? p.correct : undefined,
        participants: s.players.length,
        placement: multi ? placement : undefined,
        won: multi ? placement === 1 : undefined,
        filters: s.config.filters,
        championshipId: s.config.championshipId,
        championshipPhase: s.config.championshipPhase,
        answers: p.answers,
      } satisfies MatchRecord;
    });
}
