import type { ArtistDef, CategoryId } from '../types';

/**
 * Artistas cadastrados (lista definida pelo professor).
 * IMPORTANTE: aqui ficam apenas os nomes dos artistas. Nenhum título de música
 * é digitado à mão — as músicas, créditos, anos e prévias vêm da Apple Music
 * (iTunes Search API) e passam pela verificação em services/catalog.ts.
 */
export const ARTISTS: ArtistDef[] = [
  { id: 'matue', name: 'Matuê', categories: ['trap'] },
  { id: 'veigh', name: 'Veigh', categories: ['trap'] },
  { id: 'teto', name: 'Teto', categories: ['trap'] },
  { id: 'wiu', name: 'WIU', categories: ['trap'] },
  { id: 'mc-cabelinho', name: 'MC Cabelinho', categories: ['funk', 'rap'] },
  { id: 'kayblack', name: 'KayBlack', aliases: ['kay black'], categories: ['trap'] },
  { id: 'borges', name: 'Borges', categories: ['trap', 'rap'] },
  { id: 'filipe-ret', name: 'Filipe Ret', categories: ['trap', 'rap'] },
  { id: 'orochi', name: 'Orochi', categories: ['trap', 'rap'] },
  { id: 'l7nnon', name: 'L7NNON', categories: ['trap', 'rap'] },
  { id: 'tz-da-coronel', name: 'TZ da Coronel', categories: ['trap'] },
  { id: 'vulgo-fk', name: 'Vulgo FK', categories: ['trap'] },
  { id: 'derek', name: 'Derek', categories: ['trap'] },
  { id: 'alee', name: 'Alee', categories: ['trap'] },
  { id: 'yunk-vino', name: 'Yunk Vino', categories: ['trap'] },
  { id: 'brandao', name: 'Brandão', categories: ['trap'] },
  { id: 'ryu-the-runner', name: 'Ryu, The Runner', categories: ['trap'] },
  { id: 'mc-ryan-sp', name: 'MC Ryan SP', categories: ['funk'] },
  { id: 'mc-ig', name: 'MC IG', categories: ['funk'] },
  { id: 'mc-hariel', name: 'MC Hariel', categories: ['funk'] },
];

export const ARTIST_BY_ID: Record<string, ArtistDef> = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));

export const CATEGORIES: { id: CategoryId; name: string; short: string; description: string }[] = [
  { id: 'trap', name: 'Trap Nacional', short: 'Trap', description: 'O trap brasileiro que domina as paradas.' },
  { id: 'funk', name: 'Funk Nacional', short: 'Funk', description: 'Funk de SP e do Rio, das quebradas para o mundo.' },
  { id: 'rap', name: 'Rap Nacional', short: 'Rap', description: 'Rimas e flow de quem escreve a cena.' },
  { id: 'hits', name: 'Hits do Momento', short: 'Hits', description: 'Lançamentos recentes mais bem posicionados.' },
];

export const CATEGORY_NAME: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name]),
) as Record<CategoryId, string>;

export const DIFFICULTY_NAME = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil', 4: 'Extremo' } as const;
