/** Sistema de pontuação — funções puras e determinísticas. */
import { HINT_INFO, MYSTERY_LEVELS } from '../data/modes';
import type { HintId } from '../types';

export function comboMultiplier(streak: number): number {
  if (streak >= 10) return 3;
  if (streak >= 6) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export interface PointsInput {
  base: number;
  correct: boolean;
  /** 0..1 — fração do tempo que sobrou */
  remainingRatio: number;
  /** sequência de acertos INCLUINDO esta resposta */
  streakAfter: number;
  hints: HintId[];
  secondChance: boolean;
  bonusRound: boolean;
  combo: boolean;
  /** nível do modo Misterioso (0 = 1 segundo); undefined fora do modo */
  mysteryLevel?: number;
}

export interface PointsBreakdown {
  total: number;
  base: number;
  speed: number;
  hintPenalty: number;
  multiplier: number;
  bonus: boolean;
}

export function computePoints(i: PointsInput): PointsBreakdown {
  if (!i.correct) return { total: 0, base: 0, speed: 0, hintPenalty: 0, multiplier: 1, bonus: false };
  const r = Math.max(0, Math.min(1, Number.isFinite(i.remainingRatio) ? i.remainingRatio : 0));
  let base = i.base;
  if (i.mysteryLevel !== undefined) base = Math.round(i.base * (MYSTERY_LEVELS[i.mysteryLevel]?.factor ?? 0.3));
  const speed = Math.round(base * 0.5 * r);
  const penalty = Math.min(
    0.75,
    [...new Set(i.hints)].reduce((s, h) => s + (h === 'more' ? 0 : HINT_INFO[h].penalty), 0),
  );
  let sub = (base + speed) * (1 - penalty);
  if (i.secondChance) sub *= 0.5;
  const multiplier = (i.combo ? comboMultiplier(i.streakAfter) : 1) * (i.bonusRound ? 2 : 1);
  const total = Math.max(0, Math.round(sub * multiplier));
  return { total, base, speed, hintPenalty: penalty, multiplier, bonus: i.bonusRound };
}
