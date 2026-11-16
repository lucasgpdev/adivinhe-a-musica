/**
 * Construção e verificação do catálogo musical.
 *
 * Regras de precisão (seção 3 da especificação):
 *  - Título, artista, participações, ano e áudio vêm da MESMA ficha oficial da Apple,
 *    portanto o áudio sempre corresponde ao título exibido.
 *  - O artista é conferido pelo nome exato (sem acento/caixa) e pelo ID do artista na Apple.
 *    Se houver mais de um artista com o mesmo nome, a música só entra depois que o
 *    professor confirmar qual é o correto no painel.
 *  - Somente versões não explícitas ou limpas (campo oficial trackExplicitness).
 *  - Versões alternativas (ao vivo, remix, acelerada, instrumental...) são descartadas.
 *  - Sem prévia oficial → música não entra.
 *  - Nenhuma letra é exibida.
 */
import { ARTISTS } from '../data/artists';
import type {
  AppleArtistCandidate, ArtistDef, Catalog, CatalogArtistStatus, CategoryId, Difficulty, ExtraFilter, Track,
} from '../types';
import { normalize } from '../utils';
import { lookupArtistSongs, searchSongsByArtist, type ItunesTrack } from './itunes';

export const EMPTY_CATALOG: Catalog = {
  version: 1, syncedAt: null, country: 'BR', tracks: [], artists: {}, excluded: [], confirmedArtists: {}, failures: {},
};

const SPLIT_ARTISTS = /\s*(?:,|&|\s+e\s+|\s+x\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+part\.?\s+|\s+com\s+)\s*/i;
const FEAT_IN_TITLE = /\s*[([]\s*(?:feat\.?|ft\.?|part\.?|participação de|com)\s+([^)\]]+)[)\]]\s*/i;
const VARIANT = /\b(ao vivo|live|remix|rmx|sped ?up|slowed|acelerad[ao]|instrumental|ac[uú]stic[ao]|karaok[eê]|8d|reverb|versão|version|edit|bootleg|mashup|medley|cover)\b/i;
const ALLOWED_GENRE = /hip|rap|trap|funk|brasil|brazil|urban|pop|r&b|soul|dance|electronic|eletr/i;

// Nomes artísticos que contêm vírgula (ex.: "Ryu, The Runner") não podem ser divididos.
const COMMA_NAMES = ARTISTS.filter((a) => a.name.includes(',')).map((a) => ({
  re: new RegExp(a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/,\s*/g, ',\\s*'), 'gi'),
  safe: a.name.replace(/,/g, '\u201A'), // vírgula baixa (não é separador)
}));

export function splitArtists(artistName: string): string[] {
  let s = artistName;
  for (const c of COMMA_NAMES) s = s.replace(c.re, c.safe);
  return s
    .split(SPLIT_ARTISTS)
    .map((p) => p.replace(/\u201A/g, ',').trim())
    .filter(Boolean);
}

export function artistNames(a: ArtistDef): Set<string> {
  return new Set([normalize(a.name), ...(a.aliases ?? []).map(normalize)]);
}

export function cleanTitle(trackName: string): { displayTitle: string; featured: string[] } {
  const m = trackName.match(FEAT_IN_TITLE);
  const featured = m ? splitArtists(m[1]) : [];
  const displayTitle = trackName.replace(FEAT_IN_TITLE, ' ').replace(/\s+-\s+feat\..*$/i, '').replace(/\s+/g, ' ').trim();
  return { displayTitle, featured };
}

export function isVariant(trackName: string): boolean {
  return VARIANT.test(trackName);
}

function difficultyFromRank(rank: number, n: number): Difficulty {
  if (n <= 1) return 1;
  const r = rank / (n - 1);
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

export interface ArtistProcessResult {
  status: CatalogArtistStatus;
  tracks: Track[];
}

/** Processamento puro (testável) dos resultados da Apple para um artista. */
export function processArtistResults(
  artist: ArtistDef,
  results: ItunesTrack[],
  confirmedIds: number[] | undefined,
  now = new Date(),
): ArtistProcessResult {
  const names = artistNames(artist);
  const syncedAt = now.toISOString();
  const songs = results.filter((r) => r.wrapperType === 'track' && (r.kind === 'song' || r.kind === undefined));

  // 1) Candidatos: IDs Apple cujo artista principal tem exatamente o nome cadastrado.
  const cand = new Map<number, AppleArtistCandidate & { count: number; allowed: number }>();
  for (const s of songs) {
    const primary = splitArtists(s.artistName)[0] ?? '';
    if (!names.has(normalize(primary))) continue;
    let c = cand.get(s.artistId);
    if (!c) {
      c = { appleArtistId: s.artistId, name: primary, genres: [], sampleTitles: [], count: 0, allowed: 0 };
      cand.set(s.artistId, c);
    }
    c.count++;
    if (s.primaryGenreName && ALLOWED_GENRE.test(s.primaryGenreName)) c.allowed++;
    if (s.primaryGenreName && !c.genres.includes(s.primaryGenreName)) c.genres.push(s.primaryGenreName);
    if (c.sampleTitles.length < 4) c.sampleTitles.push(s.trackName);
  }
  const candidates: AppleArtistCandidate[] = [...cand.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ appleArtistId, name, genres, sampleTitles }) => ({ appleArtistId, name, genres, sampleTitles }));

  const base: CatalogArtistStatus = {
    artistId: artist.id, status: 'ok', found: 0, removedExplicit: 0, removedVariants: 0, removedNoPreview: 0,
    usable: 0, syncedAt, candidates,
  };

  let chosen: number[];
  if (confirmedIds?.length) {
    chosen = confirmedIds;
  } else {
    const genreOk = [...cand.values()].filter((c) => c.allowed / c.count >= 0.5);
    if (cand.size === 0) {
      return { status: { ...base, status: 'nao-encontrado', message: 'Artista não encontrado na Apple Music (Brasil).' }, tracks: [] };
    }
    if (genreOk.length === 1) chosen = [genreOk[0].appleArtistId];
    else {
      return {
        status: {
          ...base, status: 'pendente',
          message: genreOk.length > 1
            ? `Há ${genreOk.length} artistas chamados "${artist.name}". Confirme qual é o correto.`
            : `Nenhum perfil de "${artist.name}" com gênero de rap/trap/funk. Confirme manualmente.`,
        },
        tracks: [],
      };
    }
  }

  const chosenSet = new Set(chosen);
  const mine = songs.filter((s) => chosenSet.has(s.artistId));
  base.found = mine.length;
  base.appleArtistId = chosen[0];
  base.appleArtistName = mine[0] ? splitArtists(mine[0].artistName)[0] : artist.name;

  const seen = new Set<string>();
  const kept: ItunesTrack[] = [];
  for (const s of mine) {
    if (!s.previewUrl) { base.removedNoPreview++; continue; }
    if (s.trackExplicitness === 'explicit' || !s.trackExplicitness) { base.removedExplicit++; continue; }
    if (isVariant(s.trackName)) { base.removedVariants++; continue; }
    const title = s.trackExplicitness === 'cleaned' && s.trackCensoredName ? s.trackCensoredName : s.trackName;
    const key = normalize(cleanTitle(title).displayTitle);
    if (!key || seen.has(key)) continue; // mesma música em outro álbum/single
    seen.add(key);
    kept.push(s);
  }

  const tracks: Track[] = kept.map((s, i) => {
    const title = s.trackExplicitness === 'cleaned' && s.trackCensoredName ? s.trackCensoredName : s.trackName;
    const { displayTitle, featured } = cleanTitle(title);
    const credited = splitArtists(s.artistName).slice(1);
    const feats = [...new Set([...credited, ...featured])].filter((f) => !names.has(normalize(f)));
    const year = s.releaseDate ? new Date(s.releaseDate).getFullYear() : undefined;
    return {
      id: `itunes:${s.trackId}`,
      trackId: s.trackId,
      title,
      displayTitle,
      artistId: artist.id,
      artistName: s.artistName,
      featured: feats,
      categories: [...artist.categories] as CategoryId[],
      difficulty: difficultyFromRank(i, kept.length),
      year: year && Number.isFinite(year) ? year : undefined,
      album: s.collectionName,
      previewUrl: s.previewUrl!,
      storeUrl: s.trackViewUrl,
      artworkUrl: s.artworkUrl100?.replace('100x100bb', '300x300bb'),
      source: 'apple-itunes-preview',
      explicitness: s.trackExplicitness as 'notExplicit' | 'cleaned',
      verification: 'verificado',
      verifiedAt: syncedAt,
      rankInArtist: i,
      isHit: false,
    };
  });

  base.usable = tracks.length;
  if (!tracks.length) {
    base.status = 'sem-musicas-limpas';
    base.message = base.found
      ? `${base.found} músicas encontradas, mas nenhuma em versão limpa com prévia oficial.`
      : 'Nenhuma música encontrada para este perfil.';
  }
  return { status: base, tracks };
}

/** Hits do Momento: lançamentos dos últimos 2 anos entre as 5 mais bem posicionadas de cada artista. */
export function markHits(tracks: Track[], now = new Date()): Track[] {
  const minYear = now.getFullYear() - 1;
  return tracks.map((t) => {
    const isHit = (t.year ?? 0) >= minYear && t.rankInArtist < 5;
    const cats = t.categories.filter((c) => c !== 'hits');
    return { ...t, isHit, categories: isHit ? [...cats, 'hits'] : cats };
  });
}

export interface SyncProgress {
  done: number;
  total: number;
  current?: string;
}

/** Sincroniza (todos ou alguns) artistas com a Apple Music. */
export async function syncCatalog(
  prev: Catalog,
  onProgress: (p: SyncProgress) => void,
  only?: string[],
): Promise<Catalog> {
  const list = only ? ARTISTS.filter((a) => only.includes(a.id)) : ARTISTS;
  const artists = { ...prev.artists };
  let tracks = prev.tracks.filter((t) => !list.some((a) => a.id === t.artistId));
  let done = 0;
  for (const a of list) {
    onProgress({ done, total: list.length, current: a.name });
    const confirmed = prev.confirmedArtists[a.id];
    try {
      let results: ItunesTrack[];
      if (confirmed?.length) {
        results = [];
        for (const id of confirmed) results.push(...(await lookupArtistSongs(id, prev.country)).results);
      } else {
        results = (await searchSongsByArtist(a.name, prev.country)).results;
      }
      const r = processArtistResults(a, results, confirmed);
      if (confirmed?.length && prev.artists[a.id]?.candidates) r.status.candidates = prev.artists[a.id].candidates;
      artists[a.id] = r.status;
      tracks = tracks.concat(r.tracks);
    } catch (e) {
      artists[a.id] = {
        artistId: a.id, status: 'erro', found: 0, removedExplicit: 0, removedVariants: 0, removedNoPreview: 0, usable: 0,
        syncedAt: new Date().toISOString(), message: (e as Error).message,
        candidates: prev.artists[a.id]?.candidates,
      };
      // mantém as músicas já verificadas anteriormente para este artista
      tracks = tracks.concat(prev.tracks.filter((t) => t.artistId === a.id));
    }
    done++;
  }
  onProgress({ done, total: list.length });
  // Remove duplicatas entre artistas (colaborações aparecem para os dois)
  const uniq = new Map<number, Track>();
  for (const t of tracks) if (!uniq.has(t.trackId)) uniq.set(t.trackId, t);
  return { ...prev, syncedAt: new Date().toISOString(), artists, tracks: markHits([...uniq.values()]) };
}

// ─── Seleção do pool de músicas para uma partida ─────────────

export interface PoolFilters {
  categories: CategoryId[];
  artists: string[];
  extra: ExtraFilter;
}

export function usableTracks(c: Catalog): Track[] {
  const excluded = new Set(c.excluded);
  return c.tracks.filter(
    (t) => !excluded.has(t.trackId) && (c.failures[t.trackId] ?? 0) < 3 && c.artists[t.artistId]?.status !== 'pendente',
  );
}

export function filterPool(tracks: Track[], f: PoolFilters, now = new Date()): Track[] {
  let pool = tracks;
  if (f.artists.length) pool = pool.filter((t) => f.artists.includes(t.artistId));
  if (f.categories.length) pool = pool.filter((t) => t.categories.some((c) => f.categories.includes(c)));
  const y = now.getFullYear();
  switch (f.extra) {
    case 'old': pool = pool.filter((t) => t.year !== undefined && t.year <= y - 4); break;
    case 'new': pool = pool.filter((t) => t.year !== undefined && t.year >= y - 1); break;
    case 'big-hits': pool = pool.filter((t) => t.difficulty === 1); break;
    case 'popular': pool = pool.filter((t) => t.difficulty <= 2); break;
    case 'hard': pool = pool.filter((t) => t.difficulty >= 3); break;
    default: break;
  }
  return pool;
}

/** Quantos títulos distintos existem — são necessários pelo menos 4 para montar alternativas. */
export function distinctTitles(tracks: Track[]): number {
  return new Set(tracks.map((t) => normalize(t.displayTitle))).size;
}
