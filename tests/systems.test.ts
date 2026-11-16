import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { computePlayerStats, evaluateAchievements } from '../src/achievements/achievements';
import {
  createChampionship, decideBout, pendingBout, qualifyingStandings, recordBout, recordQualifying, resetPhase, startKnockout,
} from '../src/championship/championship';
import { ARTIST_BY_ID } from '../src/data/artists';
import { cleanTitle, filterPool, isVariant, markHits, processArtistResults, splitArtists } from '../src/services/catalog';
import { computeRanking, hallOfFame } from '../src/ranking/ranking';
import { buildExport, mergeImport } from '../src/storage/backup';
import { createBackup, listBackups, loadData, saveData } from '../src/storage/db';
import { emptyData } from '../src/state/defaults';
import type { MatchRecord, Player } from '../src/types';
import { makeRng } from '../src/utils';
import { fakeTracks, itunesSong } from './fixtures';

describe('catálogo (verificação)', () => {
  const matue = ARTIST_BY_ID['matue'];
  it('aceita só o artista exato, remove explícitas, variantes, sem prévia e duplicatas', () => {
    const res = processArtistResults(matue, [
      itunesSong({ trackId: 1, artistId: 10, artistName: 'Matuê', trackName: 'Faixa A' }),
      itunesSong({ trackId: 2, artistId: 10, artistName: 'Matuê', trackName: 'Faixa B', trackExplicitness: 'explicit' }),
      itunesSong({ trackId: 3, artistId: 10, artistName: 'Matuê', trackName: 'Faixa C (Ao Vivo)' }),
      itunesSong({ trackId: 4, artistId: 10, artistName: 'Matuê', trackName: 'Faixa D', previewUrl: undefined }),
      itunesSong({ trackId: 5, artistId: 10, artistName: 'Matuê, Teto & WIU', trackName: 'Faixa E' }),
      itunesSong({ trackId: 6, artistId: 10, artistName: 'Matuê', trackName: 'Faixa A' }), // duplicata (single/álbum)
      itunesSong({ trackId: 7, artistId: 99, artistName: 'Matuê Cover Band', trackName: 'Outra' }),
      itunesSong({ trackId: 8, artistId: 10, artistName: 'Matuê', trackName: 'Faixa F (feat. Alguém)', trackExplicitness: 'cleaned', trackCensoredName: 'Faixa F (feat. Alguém)' }),
    ], undefined, new Date('2026-06-01'));
    expect(res.status.status).toBe('ok');
    expect(res.tracks.map((t) => t.trackId)).toEqual([1, 5, 8]);
    expect(res.status.removedExplicit).toBe(1);
    expect(res.status.removedVariants).toBe(1);
    expect(res.status.removedNoPreview).toBe(1);
    expect(res.tracks[1].featured).toEqual(['Teto', 'WIU']);
    expect(res.tracks[2].displayTitle).toBe('Faixa F');
    expect(res.tracks[2].featured).toEqual(['Alguém']);
    expect(res.tracks.every((t) => t.artistId === 'matue' && t.verification === 'verificado')).toBe(true);
  });
  it('artista com nome ambíguo fica pendente até confirmação', () => {
    const derek = ARTIST_BY_ID['derek'];
    const songs = [
      itunesSong({ trackId: 1, artistId: 1, artistName: 'Derek', trackName: 'X' }),
      itunesSong({ trackId: 2, artistId: 2, artistName: 'Derek', trackName: 'Y', primaryGenreName: 'Pop' }),
    ];
    const r = processArtistResults(derek, songs, undefined);
    expect(r.status.status).toBe('pendente');
    expect(r.tracks).toHaveLength(0);
    expect(r.status.candidates).toHaveLength(2);
    const ok = processArtistResults(derek, songs, [2]);
    expect(ok.tracks.map((t) => t.trackId)).toEqual([2]);
  });
  it('gênero incompatível isolado é escolhido automaticamente só se for o único compatível', () => {
    const borges = ARTIST_BY_ID['borges'];
    const r = processArtistResults(borges, [
      itunesSong({ trackId: 1, artistId: 1, artistName: 'Borges', trackName: 'X', primaryGenreName: 'Hip-Hop/Rap' }),
      itunesSong({ trackId: 2, artistId: 2, artistName: 'Borges', trackName: 'Y', primaryGenreName: 'Classical' }),
    ], undefined);
    expect(r.status.status).toBe('ok');
    expect(r.tracks.map((t) => t.trackId)).toEqual([1]);
  });
  it('nomes com vírgula (Ryu, The Runner) não são divididos', () => {
    expect(splitArtists('Ryu, The Runner & Matuê')).toEqual(['Ryu, The Runner', 'Matuê']);
    expect(splitArtists('Teto, Matuê & WIU')).toEqual(['Teto', 'Matuê', 'WIU']);
  });
  it('detecção de variantes e limpeza de título', () => {
    expect(isVariant('Música (Sped Up)')).toBe(true);
    expect(isVariant('Música - Remix')).toBe(true);
    expect(isVariant('Música')).toBe(false);
    expect(cleanTitle('Música [feat. A & B]')).toEqual({ displayTitle: 'Música', featured: ['A', 'B'] });
  });
  it('hits e filtros', () => {
    const t = markHits(fakeTracks(20).map((x, i) => ({ ...x, year: i < 3 ? 2026 : 2019, rankInArtist: i })), new Date('2026-06-01'));
    expect(t.filter((x) => x.isHit).length).toBe(3);
    expect(filterPool(t, { categories: ['hits'], artists: [], extra: 'random' }).length).toBe(3);
    expect(filterPool(t, { categories: [], artists: [], extra: 'old' }, new Date('2026-06-01')).every((x) => x.year! <= 2022)).toBe(true);
  });
});

function match(p: string, score: number, correct: number, total: number, endedAt: string, extra: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: `m_${p}_${score}_${endedAt}`, groupId: 'g', mode: 'classic', ranked: true, startedAt: endedAt, endedAt, playerId: p,
    playerName: p, score, correct, wrong: total - correct, total, accuracy: correct / total, bestStreak: correct, hintsUsed: 0,
    participants: 1, filters: { categories: [], artists: [], extra: 'random' },
    answers: Array.from({ length: total }, (_, i) => ({
      trackId: `t${i}`, artistId: i % 2 ? 'matue' : 'mc-ig', categories: i % 2 ? ['trap'] : ['funk'], difficulty: 1,
      correct: i < correct, timedOut: false, points: i < correct ? score / correct : 0, timeMs: 1000, hints: [],
    })),
    ...extra,
  };
}
const players: Player[] = ['ana', 'bia', 'caio', 'davi', 'edu'].map((id) => ({ id, name: id, avatar: 'mic', theme: 'violeta', createdAt: '' }));

describe('ranking', () => {
  const now = new Date('2026-11-16T15:00:00');
  const ms = [
    match('ana', 1000, 8, 10, '2026-11-16T10:00:00'),
    match('bia', 1000, 9, 10, '2026-11-16T11:00:00'),
    match('caio', 2000, 10, 10, '2026-10-01T10:00:00'),
    match('davi', 500, 5, 10, '2026-11-16T09:00:00', { ranked: false }),
  ];
  it('ordena por pontuação, depois aproveitamento; ignora amistosas', () => {
    const r = computeRanking(ms, players);
    expect(r.map((x) => x.playerId)).toEqual(['caio', 'bia', 'ana']);
  });
  it('ranking diário/mensal', () => {
    expect(computeRanking(ms, players, { period: 'day', now }).map((x) => x.playerId)).toEqual(['bia', 'ana']);
    expect(computeRanking(ms, players, { period: 'month', now }).length).toBe(2);
  });
  it('ranking por categoria/artista usa apenas as respostas daquela categoria', () => {
    const r = computeRanking(ms, players, { category: 'trap' });
    expect(r[0].total).toBe(5);
    const a = computeRanking(ms, players, { artistId: 'mc-ig' });
    expect(a.every((x) => x.total === 5)).toBe(true);
  });
  it('hall da fama', () => {
    const h = hallOfFame(ms, [], players);
    expect(h.topScores[0].playerId).toBe('caio');
    expect(h.longestStreaks[0].streak).toBe(10);
  });
});

describe('campeonato', () => {
  it('fluxo completo: classificatória → semifinais → final → pódio', () => {
    const pool = fakeTracks(120);
    const rng = makeRng(1);
    let ch = createChampionship('Turma A', players.map((p) => p.id), { questions: 5, timeSec: 15, categories: [], artists: [] }, pool, rng);
    expect(ch.qualifying.questionIds).toHaveLength(5);
    const scores: Record<string, number> = { ana: 900, bia: 800, caio: 700, davi: 600, edu: 100 };
    const ms: MatchRecord[] = [];
    for (const p of players) {
      const m = match(p.id, scores[p.id], 5, 5, '2026-11-16T10:00:00');
      ms.push(m);
      ch = recordQualifying(ch, p.id, m.id);
    }
    // não pode jogar duas vezes
    expect(recordQualifying(ch, 'ana', 'outra').qualifying.results.ana).toBe(ms[0].id);
    expect(qualifyingStandings(ch, ms)[0].playerId).toBe('ana');
    ch = startKnockout(ch, ms, pool, rng);
    expect(ch.status).toBe('semifinal');
    expect([ch.semifinals[0].a, ch.semifinals[0].b]).toEqual(['ana', 'davi']);
    expect([ch.semifinals[1].a, ch.semifinals[1].b]).toEqual(['bia', 'caio']);
    const all = new Set([...ch.qualifying.questionIds, ...ch.semifinals.flatMap((b) => b.questionIds)]);
    expect(all.size).toBe(15); // sem músicas repetidas entre fases
    const b1 = pendingBout(ch)!;
    ch = recordBout(ch, b1.id, decideBout(b1, { ana: 300, davi: 500 }, { ana: 3, davi: 5 }, { ana: 1, davi: 1 }, 'g1'), ms, pool, rng);
    const b2 = pendingBout(ch)!;
    ch = recordBout(ch, b2.id, decideBout(b2, { bia: 400, caio: 400 }, { bia: 4, caio: 4 }, { bia: 900, caio: 500 }, 'g2'), ms, pool, rng);
    expect(ch.status).toBe('final');
    expect([ch.final!.a, ch.final!.b]).toEqual(['davi', 'caio']);
    const f = pendingBout(ch)!;
    ch = recordBout(ch, f.id, decideBout(f, { davi: 100, caio: 900 }, { davi: 1, caio: 9 }, { davi: 1, caio: 1 }, 'g3'), ms, pool, rng);
    expect(ch.status).toBe('encerrado');
    expect(ch.podium).toEqual({ first: 'caio', second: 'davi', third: 'bia' });
    const reset = resetPhase(ch, 'final');
    expect(reset.status).toBe('final');
    expect(reset.podium).toBeUndefined();
    expect(reset.resets).toBe(1);
  });
  it('com 2 ou 3 participantes vai direto para a final', () => {
    const pool = fakeTracks(60);
    const rng = makeRng(2);
    let ch = createChampionship('Mini', ['ana', 'bia', 'caio'], { questions: 5, timeSec: 15, categories: [], artists: [] }, pool, rng);
    const ms = ['ana', 'bia', 'caio'].map((p, i) => match(p, 100 * (i + 1), 1, 5, '2026-11-16T10:00:00'));
    ms.forEach((m) => (ch = recordQualifying(ch, m.playerId, m.id)));
    ch = startKnockout(ch, ms, pool, rng);
    expect(ch.status).toBe('final');
    expect([ch.final!.a, ch.final!.b]).toEqual(['caio', 'bia']);
  });
});

describe('conquistas', () => {
  it('desbloqueia uma única vez', () => {
    const ms = [match('ana', 1500, 10, 10, '2026-11-16T10:00:00')];
    const st = computePlayerStats('ana', ms, [], 'ana');
    const a = evaluateAchievements('ana', st, []);
    expect(a).toEqual(expect.arrayContaining(['first-hit', 'hits-10', 'streak-perfect', 'streak-10', 'first-place']));
    const again = evaluateAchievements('ana', st, a.map((id) => ({ playerId: 'ana', achievementId: id, unlockedAt: '' })));
    expect(again).toEqual([]);
  });
});

describe('armazenamento e backup', () => {
  it('persiste no IndexedDB', async () => {
    const d = emptyData();
    d.players.push(players[0]);
    await saveData(d);
    expect((await loadData())!.players[0].id).toBe('ana');
    await createBackup('teste', d);
    expect((await listBackups())[0].reason).toBe('teste');
  });
  it('exporta e importa sem duplicar e informa conflitos', () => {
    const a = emptyData();
    a.players = [players[0], players[1]];
    a.matches = [match('ana', 100, 1, 1, '2026-11-16T10:00:00')];
    const file = JSON.parse(JSON.stringify(buildExport(a)));
    // importar no mesmo banco: tudo duplicado
    const same = mergeImport(a, file, false);
    expect(same.ok).toBe(true);
    expect(same.added.matches).toBe(0);
    expect(same.skippedDuplicates).toBeGreaterThan(0);
    // outro computador com jogador "ana" de id diferente
    const b = emptyData();
    b.players = [{ ...players[0], id: 'ana-2' }];
    const r = mergeImport(b, file, true);
    expect(r.conflicts.some((c) => c.includes('ana'))).toBe(true);
    expect(r.merged!.matches[0].playerId).toBe('ana-2');
    expect(r.merged!.players).toHaveLength(2);
    // arquivo inválido
    expect(mergeImport(a, { app: 'outro' }, false).ok).toBe(false);
    expect(mergeImport(a, { ...file, exportVersion: 99 }, false).ok).toBe(false);
  });
});
