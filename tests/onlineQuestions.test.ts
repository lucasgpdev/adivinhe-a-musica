import { describe, expect, it } from 'vitest';
import { buildOnlineQuestions } from '../src/online/questions';
import { normalize, makeRng } from '../src/utils';
import { fakeTrack } from './fixtures';

describe('perguntas do modo online', () => {
  const tracks = Array.from({ length: 60 }, (_, i) => fakeTrack(i, `a${i % 6}`, ((i % 3) + 1) as 1 | 2 | 3, i < 30 ? ['sertanejo'] : ['mpb']));

  it('monta N perguntas sem repetir título, com 4 alternativas e a certa entre elas', () => {
    const qs = buildOnlineQuestions(tracks, ['sertanejo'], 10, makeRng(1));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => normalize(q.track.title))).size).toBe(10);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.id)).toContain(q.answerId);
      expect(new Set(q.options.map((o) => normalize(o.title))).size).toBe(4);
      expect(tracks.find((t) => t.id === q.answerId)!.categories).toContain('sertanejo');
    }
  });

  it('sem gênero escolhido usa todos', () => {
    expect(buildOnlineQuestions(tracks, [], 20, makeRng(2))).toHaveLength(20);
  });
});
