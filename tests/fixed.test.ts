import { describe, expect, it } from 'vitest';
import { MODE_BY_ID } from '../src/data/modes';
import { advance, answer, createSession, replaceCurrentTrack } from '../src/game/session';
import { fakeTracks } from './fixtures';

describe('lista fixa (campeonato) com faixa quebrada', () => {
  it('substitui e continua até o fim', () => {
    const tracks = fakeTracks(60);
    const fixed = tracks.slice(0, 5).map((t) => t.id);
    const m = MODE_BY_ID.classic;
    let s = createSession({
      mode: m, questions: 5, timeSec: 15, points: 100, difficulty: [1, 3], progressive: false, endOnWrong: false, hints: [],
      secondChance: false, combo: true, bonusRound: false, steal: false, ranked: true,
      filters: { categories: [], artists: [], extra: 'random' }, fixedQuestionIds: fixed,
    }, [{ id: 'p', name: 'P', avatar: 'mic' }], tracks, tracks, 1);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (i === 2) {
        const bad = s.question!.track.id;
        s = replaceCurrentTrack(s);
        expect(s.phase).toBe('question');
        expect(s.question!.track.id).not.toBe(bad);
      }
      seen.push(s.question!.track.id);
      s = advance(answer(s, s.question!.track.id, 100).session);
    }
    expect(s.phase).toBe('finished');
    expect(new Set(seen).size).toBe(5);
    expect(seen[3]).toBe(fixed[3]);
  });
});
