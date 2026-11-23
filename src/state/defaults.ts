import { ALL_CATEGORY_IDS } from '../data/artists';
import type { AppData, CategoryId, Settings } from '../types';

/** Categorias que existiam antes da expansão de gêneros. */
const LEGACY_CATEGORIES: CategoryId[] = ['trap', 'funk', 'rap', 'hits'];

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  effects: true,
  volume: 0.9,
  presenter: false,
  autoAdvance: true,
  enabledCategories: [...ALL_CATEGORY_IDS],
  knownCategories: [...ALL_CATEGORY_IDS],
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
  // Gêneros novos (que o jogo salvo ainda não conhecia) entram já ativados.
  const saved = d.settings;
  let enabledCategories = saved?.enabledCategories ?? base.settings.enabledCategories;
  if (saved) {
    const known = new Set(saved.knownCategories ?? LEGACY_CATEGORIES);
    const added = ALL_CATEGORY_IDS.filter((c) => !known.has(c));
    enabledCategories = [...enabledCategories.filter((c) => ALL_CATEGORY_IDS.includes(c)), ...added.filter((c) => !enabledCategories.includes(c))];
  }
  return {
    ...base,
    ...d,
    schemaVersion: 1,
    settings: { ...base.settings, ...(d.settings ?? {}), enabledCategories, knownCategories: [...ALL_CATEGORY_IDS], mechanics: { ...base.settings.mechanics, ...(d.settings?.mechanics ?? {}) } },
    queue: d.queue ?? base.queue,
    players: d.players ?? [],
    matches: d.matches ?? [],
    achievements: d.achievements ?? [],
    championships: d.championships ?? [],
    audit: d.audit ?? [],
  };
}
