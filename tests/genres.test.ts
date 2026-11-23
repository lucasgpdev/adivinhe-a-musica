import { describe, expect, it } from 'vitest';
import { ARTISTS, ALL_CATEGORY_IDS, CATEGORIES } from '../src/data/artists';
import { markHits } from '../src/services/catalog';
import { applyFeatured, FEATURED_SONGS } from '../src/data/featured';
import { ARTIST_BY_ID } from '../src/data/artists';
import { fakeTrack } from './fixtures';
import { migrate } from '../src/state/defaults';

describe('gêneros', () => {
  it('todo gênero (exceto Hits) tem artistas suficientes', () => {
    for (const c of CATEGORIES.filter((x) => x.id !== 'hits' && x.id !== 'tiktok' && x.id !== 'submundo')) {
      const n = ARTISTS.filter((a) => a.categories.includes(c.id as never)).length;
      expect(n, c.name).toBeGreaterThanOrEqual(5);
    }
  });

  it('TikTok: muitos artistas virais e só as mais populares e recentes entram', () => {
    expect(ARTISTS.filter((a) => a.tiktok).length).toBeGreaterThanOrEqual(20);
    expect(CATEGORIES.some((c) => c.id === ('gospel' as never))).toBe(false);
    const now = new Date('2026-11-23');
    const base = fakeTrack(1, 'mc-ig', 1, ['funk']);
    const [top, old, deep, notViral] = markHits([
      { ...base, rankInArtist: 0, year: 2025 },
      { ...base, rankInArtist: 0, year: 2019 },
      { ...base, rankInArtist: 30, year: 2025 },
      { ...base, artistId: 'emicida', rankInArtist: 0, year: 2025 },
    ], now);
    expect(top.categories).toContain('tiktok');
    expect(top.categories).toContain('funk');
    expect(old.categories).not.toContain('tiktok');
    expect(deep.categories).not.toContain('tiktok');
    expect(notViral.categories).not.toContain('tiktok');
  });

  it('Submundo 808: só músicas de 2024 em diante dos artistas da cena', () => {
    const now = new Date('2026-11-23');
    const base = fakeTrack(2, 'dj-clei', 2, ['funk']);
    const [nova, velha, outro] = markHits([
      { ...base, year: 2024, rankInArtist: 40 },
      { ...base, year: 2023 },
      { ...base, artistId: 'mc-ig', year: 2025 },
    ], now);
    expect(nova.categories).toEqual(['funk', 'submundo']);
    expect(velha.categories).not.toContain('submundo');
    expect(outro.categories).not.toContain('submundo');
    expect(ARTISTS.filter((a) => a.submundo).length).toBeGreaterThanOrEqual(10);
  });

  it('músicas em destaque entram nas categorias pedidas (ex.: "2026" do MC Tuto)', () => {
    for (const f of FEATURED_SONGS) expect(ARTIST_BY_ID[f.artistId], f.artistId).toBeTruthy();
    const base = fakeTrack(3, 'mc-tuto', 3, ['funk']);
    const tracks = markHits([
      { ...base, title: '2026', displayTitle: '2026', artistName: 'MC Tuto & DJ Oreia', rankInArtist: 40, year: 2025 },
      { ...base, trackId: 9, id: 'itunes:9', title: 'Outra', displayTitle: 'Outra', year: 2015 },
    ], new Date('2026-11-23'));
    const r = applyFeatured(tracks, [{ artistId: 'mc-tuto', title: '2026', categories: ['tiktok', 'funk'] }]);
    expect(r.missing).toHaveLength(0);
    expect(r.tracks[0].categories).toEqual(expect.arrayContaining(['funk', 'tiktok']));
    expect(r.tracks[1].categories).not.toContain('tiktok');
    expect(applyFeatured(tracks, [{ artistId: 'mc-tuto', title: 'Não existe', categories: ['tiktok'] }]).missing).toHaveLength(1);
  });

  it('ids de artistas são únicos', () => {
    expect(new Set(ARTISTS.map((a) => a.id)).size).toBe(ARTISTS.length);
  });

  it('jogo salvo antigo recebe os gêneros novos já ativados, mantendo o que o professor desligou', () => {
    const d = migrate({ settings: { enabledCategories: ['trap', 'hits'] } as never });
    expect(d.settings.enabledCategories).toContain('sertanejo');
    expect(d.settings.enabledCategories).toContain('pop-intl');
    expect(d.settings.enabledCategories).toContain('tiktok');
    expect(d.settings.enabledCategories).not.toContain('funk');
    // depois de salvo, não reativa o que for desligado
    const again = migrate({ settings: { ...d.settings, enabledCategories: ['trap'] } });
    expect(again.settings.enabledCategories).toEqual(['trap']);
    expect(ALL_CATEGORY_IDS.length).toBe(15);
  });
});
