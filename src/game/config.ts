import { MODE_BY_ID, type ModeDef } from '../data/modes';
import type { Difficulty, MatchFilters, ModeId, Settings } from '../types';
import type { SessionConfig } from './session';

export interface CustomOptions {
  questions: number;
  timeSec: number;
  points: number;
  difficulty: [Difficulty, Difficulty];
  hints: boolean;
  combo: boolean;
  bonusRound: boolean;
  secondChance: boolean;
}

export const DEFAULT_CUSTOM: CustomOptions = {
  questions: 10, timeSec: 15, points: 100, difficulty: [1, 4], hints: true, combo: true, bonusRound: false, secondChance: true,
};

/** Modos cujo tempo pode ser ajustado pelo professor (os demais têm o tempo como identidade). */
export const TIME_ADJUSTABLE: ModeId[] = ['classic', 'duel', 'battle', 'mysterious'];

export function buildConfig(modeId: ModeId, settings: Settings, filters: MatchFilters, custom?: CustomOptions): SessionConfig {
  const mode: ModeDef = MODE_BY_ID[modeId];
  const m = settings.mechanics;
  if (modeId === 'custom' && custom) {
    return {
      mode, questions: custom.questions, timeSec: custom.timeSec, points: custom.points, difficulty: custom.difficulty,
      progressive: false, endOnWrong: false, hints: custom.hints ? mode.hints : [], secondChance: custom.secondChance,
      combo: custom.combo, bonusRound: custom.bonusRound, steal: m.steal, ranked: false, filters,
    };
  }
  const timeSec = settings.timeOverride && TIME_ADJUSTABLE.includes(modeId) ? settings.timeOverride : mode.timeSec;
  return {
    mode,
    questions: mode.questions,
    timeSec,
    points: mode.points,
    difficulty: mode.difficulty,
    progressive: mode.progressive,
    endOnWrong: mode.endOnWrong,
    // "Ouvir mais" faz parte da regra do Misterioso, não é uma dica opcional
    hints: m.hints ? mode.hints : mode.hints.filter((h) => h === 'more'),
    secondChance: m.secondChance && mode.secondChance,
    combo: m.combo,
    bonusRound: m.bonusRound,
    steal: m.steal && mode.competitive,
    ranked: mode.ranked,
    filters,
  };
}
