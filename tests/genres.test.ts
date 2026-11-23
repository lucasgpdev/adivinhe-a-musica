import { describe, expect, it } from 'vitest';
import { ARTISTS, ALL_CATEGORY_IDS, CATEGORIES } from '../src/data/artists';
import { migrate } from '../src/state/defaults';

describe('gêneros', () => {
  it('todo gênero (exceto Hits) tem artistas suficientes', () => {
    for (const c of CATEGORIES.filter((x) => x.id !== 'hits')) {
      const n = ARTISTS.filter((a) => a.categories.includes(c.id as never)).length;
      expect(n, c.name).toBeGreaterThanOrEqual(5);
    }
  });

  it('ids de artistas são únicos', () => {
    expect(new Set(ARTISTS.map((a) => a.id)).size).toBe(ARTISTS.length);
  });

  it('jogo salvo antigo recebe os gêneros novos já ativados, mantendo o que o professor desligou', () => {
    const d = migrate({ settings: { enabledCategories: ['trap', 'hits'] } as never });
    expect(d.settings.enabledCategories).toContain('sertanejo');
    expect(d.settings.enabledCategories).toContain('pop-intl');
    expect(d.settings.enabledCategories).not.toContain('funk');
    // depois de salvo, não reativa o que for desligado
    const again = migrate({ settings: { ...d.settings, enabledCategories: ['trap'] } });
    expect(again.settings.enabledCategories).toEqual(['trap']);
    expect(ALL_CATEGORY_IDS.length).toBe(13);
  });
});
