import { describe, expect, it } from 'vitest';
import { MODE_BY_ID } from '../src/data/modes';
import { computePoints, comboMultiplier } from '../src/game/scoring';
import {
  advance, answer, applyHint, beginTurn, buildOptions, createSession, replaceCurrentTrack, toMatchRecords, type SessionConfig,
} from '../src/game/session';
import type { ModeId } from '../src/types';
import { makeRng, normalize } from '../src/utils';
import { fakeTracks } from './fixtures';

function cfg(mode: ModeId, over: Partial<SessionConfig> = {}): SessionConfig {
  const m = MODE_BY_ID[mode];
  return {
    mode: m, questions: m.questions, timeSec: m.timeSec, points: m.points, difficulty: m.difficulty,
    progressive: m.progressive, endOnWrong: m.endOnWrong, hints: m.hints, secondChance: false, combo: true,
    bonusRound: false, steal: false, ranked: m.ranked, filters: { categories: [], artists: [], extra: 'random' }, ...over,
  };
}
const P = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}`, avatar: 'mic' }));

describe('pontuação', () => {
  it('erro vale zero e nunca negativo', () => {
    expect(computePoints({ base: 100, correct: false, remainingRatio: 1, streakAfter: 0, hints: ['fifty'], secondChance: false, bonusRound: true, combo: true }).total).toBe(0);
  });
  it('bônus de velocidade, dicas, combo e rodada bônus', () => {
    const p = computePoints({ base: 100, correct: true, remainingRatio: 1, streakAfter: 1, hints: [], secondChance: false, bonusRound: false, combo: true });
    expect(p.total).toBe(150);
    const h = computePoints({ base: 100, correct: true, remainingRatio: 0, streakAfter: 1, hints: ['artist', 'fifty'], secondChance: false, bonusRound: false, combo: true });
    expect(h.total).toBe(45);
    const b = computePoints({ base: 100, correct: true, remainingRatio: 0, streakAfter: 3, hints: [], secondChance: false, bonusRound: true, combo: true });
    expect(b.total).toBe(300);
    expect(comboMultiplier(10)).toBe(3);
  });
  it('dicas repetidas não reduzem duas vezes; penalidade máxima 75%', () => {
    const p = computePoints({ base: 100, correct: true, remainingRatio: 0, streakAfter: 1, hints: ['artist', 'artist', 'decade', 'fifty'], secondChance: false, bonusRound: false, combo: false });
    expect(p.total).toBe(30);
  });
});

describe('alternativas', () => {
  it('sempre 4 títulos distintos incluindo a correta', () => {
    const all = fakeTracks(40);
    const rng = makeRng(1);
    for (let i = 0; i < 40; i++) {
      for (const d of [1, 2, 3, 4] as const) {
        const o = buildOptions(all[i], all, d, rng)!;
        expect(o).toHaveLength(4);
        expect(o.some((t) => t.id === all[i].id)).toBe(true);
        expect(new Set(o.map((t) => normalize(t.displayTitle))).size).toBe(4);
      }
    }
  });
  it('dificuldade alta usa o mesmo artista', () => {
    const all = fakeTracks(40);
    const o = buildOptions(all[0], all, 4, makeRng(3))!;
    expect(o.every((t) => t.artistId === all[0].artistId)).toBe(true);
  });
});

describe('partida solo', () => {
  it('clássico: 10 perguntas sem repetição e sem respostas duplicadas', () => {
    let s = createSession(cfg('classic'), P(1), fakeTracks(60), fakeTracks(60), 42);
    const seen = new Set<string>();
    let n = 0;
    while (s.phase !== 'finished') {
      expect(s.phase).toBe('question');
      const q = s.question!;
      expect(seen.has(q.track.id)).toBe(false);
      seen.add(q.track.id);
      const r1 = answer(s, q.track.id, 2000);
      const r2 = answer(r1.session, q.track.id, 2000); // clique repetido
      expect(r2.ignored).toBe(true);
      s = advance(r2.session);
      n++;
    }
    expect(n).toBe(10);
    const rec = toMatchRecords(s)[0];
    expect(rec.correct).toBe(10);
    expect(rec.answers).toHaveLength(10);
    expect(rec.bestStreak).toBe(10);
    expect(rec.score).toBe(rec.answers.reduce((a, b) => a + b.points, 0));
  });
  it('tempo esgotado: 0 pontos e zera sequência', () => {
    let s = createSession(cfg('classic'), P(1), fakeTracks(30), fakeTracks(30), 7);
    s = answer(s, s.question!.track.id, 1000).session;
    s = advance(s);
    s = answer(s, null, 15000).session;
    expect(s.players[0].streak).toBe(0);
    expect(s.players[0].answers[1].points).toBe(0);
    expect(s.players[0].answers[1].timedOut).toBe(true);
  });
  it('infinito termina no primeiro erro', () => {
    let s = createSession(cfg('infinite'), P(1), fakeTracks(80), fakeTracks(80), 9);
    for (let i = 0; i < 6; i++) s = advance(answer(s, s.question!.track.id, 500).session);
    const wrong = s.question!.options.find((o) => o.id !== s.question!.track.id)!;
    s = advance(answer(s, wrong.id, 500).session);
    expect(s.phase).toBe('finished');
    expect(toMatchRecords(s)[0].roundsSurvived).toBe(6);
  });
  it('infinito: dificuldade progressiva', () => {
    let s = createSession(cfg('infinite'), P(1), fakeTracks(120), fakeTracks(120), 11);
    const diffs: number[] = [];
    for (let i = 0; i < 16; i++) { diffs.push(s.question!.difficulty); s = advance(answer(s, s.question!.track.id, 500).session); }
    expect(diffs.slice(0, 5).every((d) => d === 1)).toBe(true);
    expect(diffs.slice(15).every((d) => d === 4)).toBe(true);
  });
  it('catálogo esgotado encerra sem erro', () => {
    let s = createSession(cfg('infinite'), P(1), fakeTracks(8), fakeTracks(8), 1);
    let guard = 0;
    while (s.phase !== 'finished' && guard++ < 50) s = advance(answer(s, s.question!.track.id, 100).session);
    expect(s.finishedReason).toBe('exhausted');
  });
  it('50/50 deixa uma correta e uma incorreta; segunda chance funciona uma vez', () => {
    let s = createSession(cfg('classic', { secondChance: true }), P(1), fakeTracks(40), fakeTracks(40), 5);
    const h = applyHint(s, 'fifty');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    s = h.session;
    const left = s.question!.options.filter((o) => !s.turns.p0.eliminated.includes(o.id));
    expect(left).toHaveLength(2);
    expect(left.some((o) => o.id === s.question!.track.id)).toBe(true);
    expect(applyHint(s, 'fifty').ok).toBe(false);
    s = advance(answer(s, s.question!.track.id, 100).session);
    const wrong = s.question!.options.find((o) => o.id !== s.question!.track.id)!;
    const r = answer(s, wrong.id, 1000);
    expect(r.secondChance).toBe(true);
    const r2 = answer(r.session, s.question!.track.id, 2000);
    expect(r2.session.players[0].answers[1].secondChance).toBe(true);
    expect(r2.session.players[0].answers[1].points).toBeGreaterThan(0);
  });
  it('falha de áudio substitui a música sem afetar pontuação', () => {
    let s = createSession(cfg('classic'), P(1), fakeTracks(30), fakeTracks(30), 3);
    const before = s.question!.track.id;
    s = replaceCurrentTrack(s);
    expect(s.question!.track.id).not.toBe(before);
    expect(s.question!.index).toBe(0);
    expect(s.players[0].score).toBe(0);
    expect(s.usedIds).toContain(before);
  });
  it('limite de dicas por partida', () => {
    let s = createSession(cfg('classic'), P(1), fakeTracks(40), fakeTracks(40), 8);
    let used = 0;
    for (let i = 0; i < 4; i++) {
      const r = applyHint(s, 'artist');
      if (r.ok) { used++; s = r.session; }
      s = advance(answer(s, s.question!.track.id, 100).session);
    }
    expect(used).toBe(3);
  });
});

describe('multijogador', () => {
  it('duelo: mesmas músicas, revelação só após os dois responderem, vencedor correto', () => {
    let s = createSession(cfg('duel'), P(2), fakeTracks(40), fakeTracks(40), 21);
    while (s.phase !== 'finished') {
      expect(s.phase).toBe('handoff');
      s = beginTurn(s);
      const q = s.question!;
      s = answer(s, q.track.id, 1000).session; // J0 acerta
      expect(s.phase).toBe('locked');
      s = beginTurn(advance(s));
      const wrong = q.options.find((o) => o.id !== q.track.id)!;
      s = answer(s, wrong.id, 1000).session; // J1 erra
      expect(s.phase).toBe('reveal');
      s = advance(s);
    }
    const recs = toMatchRecords(s);
    expect(recs).toHaveLength(2);
    expect(recs[0].answers.map((a) => a.trackId)).toEqual(recs[1].answers.map((a) => a.trackId));
    expect(recs.find((r) => r.playerId === 'p0')!.won).toBe(true);
    expect(recs.find((r) => r.playerId === 'p1')!.score).toBe(0);
  });
  it('roubo de pontos: o acerto mais rápido ganha o valor-base dos que erraram', () => {
    let s = createSession(cfg('battle', { steal: true }), P(3), fakeTracks(40), fakeTracks(40), 2);
    for (let i = 0; i < 4; i++) {
      const q = s.question!;
      const wrong = q.options.find((o) => o.id !== q.track.id)!;
      s = answer(beginTurn(s), q.track.id, 3000).session; s = advance(s);
      s = answer(beginTurn(s), q.track.id, 1000).session; s = advance(s);
      s = answer(beginTurn(s), wrong.id, 1000).session;
      if (i < 3) s = advance(s);
    }
    const last = s.players[1].answers[3];
    expect(last.steal).toBe(100);
    expect(s.players[0].answers[3].steal).toBeUndefined();
  });
  it('sobrevivência: quem erra é eliminado; termina com 1 restante', () => {
    let s = createSession(cfg('survival'), P(3), fakeTracks(60), fakeTracks(60), 4);
    const q = s.question!;
    const wrong = q.options.find((o) => o.id !== q.track.id)!;
    s = advance(answer(beginTurn(s), q.track.id, 100).session);
    s = advance(answer(beginTurn(s), wrong.id, 100).session);
    s = answer(beginTurn(s), q.track.id, 100).session;
    s = advance(s);
    expect(s.turnOrder).toEqual(['p0', 'p2']);
    const q2 = s.question!;
    const w2 = q2.options.find((o) => o.id !== q2.track.id)!;
    s = advance(answer(beginTurn(s), q2.track.id, 100).session);
    s = advance(answer(beginTurn(s), w2.id, 100).session);
    expect(s.phase).toBe('finished');
    const recs = toMatchRecords(s);
    expect(recs.find((r) => r.playerId === 'p0')!.placement).toBe(1);
  });
});
