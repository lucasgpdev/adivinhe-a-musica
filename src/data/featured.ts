import type { CategoryId, Track } from '../types';
import { normalize } from '../utils';
import { ARTIST_BY_ID } from './artists';

/**
 * Músicas em destaque: pedidas pelos jogadores e garantidas nas categorias indicadas.
 * O título aqui serve só para ENCONTRAR a música na Apple Music — título, artista,
 * ano e prévia continuam vindo da ficha oficial e passam pela mesma verificação
 * (versão limpa, com prévia, artista conferido). Se não houver versão limpa, ela não entra.
 */
export interface FeaturedSong {
  /** id do artista em data/artists.ts */
  artistId: string;
  title: string;
  categories: CategoryId[];
}

export const FEATURED_SONGS: FeaturedSong[] = [
  { artistId: 'mc-tuto', title: '2026', categories: ['tiktok', 'funk', 'hits'] },
];

/** Coloca as músicas em destaque nas categorias pedidas. Retorna as que não foram achadas. */
export function applyFeatured(tracks: Track[], list: FeaturedSong[] = FEATURED_SONGS): { tracks: Track[]; missing: FeaturedSong[] } {
  const out = tracks.slice();
  const missing: FeaturedSong[] = [];
  for (const f of list) {
    const a = ARTIST_BY_ID[f.artistId];
    const title = normalize(f.title);
    const idx = out.findIndex((t) =>
      normalize(t.displayTitle) === title && (t.artistId === f.artistId || (!!a && normalize(t.artistName).includes(normalize(a.name)))));
    if (idx < 0) { missing.push(f); continue; }
    const t = out[idx];
    const categories = [...new Set([...t.categories, ...f.categories])];
    out[idx] = { ...t, categories, isHit: t.isHit || categories.includes('hits'), difficulty: 1, rankInArtist: 0 };
  }
  return { tracks: out, missing };
}
