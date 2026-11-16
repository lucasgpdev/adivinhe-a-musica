import type { AppData, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  effects: true,
  volume: 0.9,
  presenter: false,
  autoAdvance: true,
  enabledCategories: ['trap', 'funk', 'rap', 'hits'],
  mechanics: { hints: true, combo: true, bonusRound: true, secondChance: true, steal: true },
  timeOverride: null,
  teacherPin: null,
  lastPlayerId: null,
};

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    players: [],
    matches: [],
    achievements: [],
    championships: [],
    queue: { items: [] },
    settings: { ...DEFAULT_SETTINGS },
    audit: [],
  };
}

/** Garante que dados antigos/importados tenham todos os campos atuais. */
export function migrate(d: Partial<AppData> | undefined): AppData {
  const base = emptyData();
  if (!d) return base;
  return {
    ...base,
    ...d,
    schemaVersion: 1,
    settings: { ...base.settings, ...(d.settings ?? {}), mechanics: { ...base.settings.mechanics, ...(d.settings?.mechanics ?? {}) } },
    queue: d.queue ?? base.queue,
    players: d.players ?? [],
    matches: d.matches ?? [],
    achievements: d.achievements ?? [],
    championships: d.championships ?? [],
    audit: d.audit ?? [],
  };
}
