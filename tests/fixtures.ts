// Dados SOMENTE para testes automatizados (nunca usados no jogo).
import type { ItunesTrack } from '../src/services/itunes';
import type { Track, Difficulty, CategoryId } from '../src/types';

export function fakeTrack(i: number, artistId = `a${i % 5}`, difficulty: Difficulty = ((i % 4) + 1) as Difficulty, cats: CategoryId[] = ['trap']): Track {
  return {
    id: `itunes:${1000 + i}`, trackId: 1000 + i, title: `Teste ${i}`, displayTitle: `Teste ${i}`, artistId,
    artistName: `Artista ${artistId}`, featured: [], categories: cats, difficulty, year: 2020 + (i % 6),
    previewUrl: `https://example.test/${i}.m4a`, source: 'apple-itunes-preview', explicitness: 'notExplicit',
    verification: 'verificado', verifiedAt: '2026-01-01T00:00:00Z', rankInArtist: i, isHit: false,
  };
}

export function fakeTracks(n: number): Track[] {
  return Array.from({ length: n }, (_, i) => fakeTrack(i));
}

export function itunesSong(p: Partial<ItunesTrack> & { trackId: number; artistId: number; artistName: string; trackName: string }): ItunesTrack {
  return {
    wrapperType: 'track', kind: 'song', previewUrl: `https://audio.test/${p.trackId}.m4a`, trackExplicitness: 'notExplicit',
    primaryGenreName: 'Hip-Hop/Rap', releaseDate: '2024-03-01T12:00:00Z', collectionName: 'Album', ...p,
  };
}
