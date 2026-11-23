import type { AchievementUnlock, Championship, MatchRecord } from '../types';

export interface PlayerStats {
  correct: number;
  distinctCorrect: number;
  bestStreak: number;
  catCorrect: Record<string, number>;
  perfectMatch: boolean;
  hardcoreBestAcc: number;
  duelWins: number;
  battleWins: number;
  survivalBest: number;
  isTop1: boolean;
  championshipsWon: number;
  mysteryOneSec: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  progress: (s: PlayerStats) => { current: number; target: number };
}

const bool = (v: boolean) => ({ current: v ? 1 : 0, target: 1 });

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-hit', name: 'Primeiro Acerto', icon: 'sparkles', description: 'Toda lenda começa com uma música.',
    condition: 'Acerte 1 música', progress: (s) => ({ current: s.correct, target: 1 }) },
  { id: 'hits-10', name: '10 Acertos', icon: 'target', description: 'O ouvido está afiado.',
    condition: 'Acumule 10 acertos', progress: (s) => ({ current: s.correct, target: 10 }) },
  { id: 'discover-50', name: '50 Músicas Descobertas', icon: 'library', description: 'Repertório de respeito.',
    condition: 'Acerte 50 músicas diferentes', progress: (s) => ({ current: s.distinctCorrect, target: 50 }) },
  { id: 'discover-100', name: '100 Músicas Descobertas', icon: 'gem', description: 'Uma playlist ambulante.',
    condition: 'Acerte 100 músicas diferentes', progress: (s) => ({ current: s.distinctCorrect, target: 100 }) },
  { id: 'streak-perfect', name: 'Sequência Perfeita', icon: 'check-check', description: 'Nenhum erro do início ao fim.',
    condition: 'Acerte todas em uma partida de 10+ perguntas', progress: (s) => bool(s.perfectMatch) },
  { id: 'streak-10', name: '10 Consecutivos', icon: 'zap', description: 'Dez seguidas sem piscar.',
    condition: 'Faça uma sequência de 10 acertos', progress: (s) => ({ current: s.bestStreak, target: 10 }) },
  { id: 'trap-expert', name: 'Especialista em Trap', icon: 'disc-3', description: 'Domina o trap nacional.',
    condition: '25 acertos em Trap Nacional', progress: (s) => ({ current: s.catCorrect.trap ?? 0, target: 25 }) },
  { id: 'funk-expert', name: 'Especialista em Funk', icon: 'speaker', description: 'Conhece o funk de ponta a ponta.',
    condition: '25 acertos em Funk Nacional', progress: (s) => ({ current: s.catCorrect.funk ?? 0, target: 25 }) },
  { id: 'rap-expert', name: 'Especialista em Rap', icon: 'mic', description: 'Rimas não têm segredo.',
    condition: '25 acertos em Rap Nacional', progress: (s) => ({ current: s.catCorrect.rap ?? 0, target: 25 }) },
  { id: 'hardcore-king', name: 'Rei do Hardcore', icon: 'flame', description: 'Cinco segundos bastam.',
    condition: '80% de aproveitamento no Hardcore', progress: (s) => ({ current: Math.round(s.hardcoreBestAcc * 100), target: 80 }) },
  { id: 'perfect-ear', name: 'Ouvido Absoluto', icon: 'ear', description: 'Um segundo é tudo que precisa.',
    condition: '5 acertos com trecho de 1s no Misterioso', progress: (s) => ({ current: s.mysteryOneSec, target: 5 }) },
  { id: 'duel-champ', name: 'Campeão do Duelo', icon: 'swords', description: 'Venceu o mano a mano.',
    condition: 'Vença um Duelo', progress: (s) => ({ current: s.duelWins, target: 1 }) },
  { id: 'battle-champ', name: 'Campeão da Batalha', icon: 'shield', description: 'O melhor entre muitos.',
    condition: 'Vença uma Batalha', progress: (s) => ({ current: s.battleWins, target: 1 }) },
  { id: 'survivor', name: 'Sobrevivente', icon: 'heart-pulse', description: 'Resistiu a 10 rodadas.',
    condition: 'Sobreviva 10 rodadas', progress: (s) => ({ current: s.survivalBest, target: 10 }) },
  { id: 'first-place', name: 'Primeiro Lugar', icon: 'crown', description: 'Topo do ranking geral.',
    condition: 'Fique em 1º no ranking geral', progress: (s) => bool(s.isTop1) },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function computePlayerStats(
  playerId: string,
  matches: MatchRecord[],
  championships: Championship[],
  topPlayerId: string | null,
): PlayerStats {
  const mine = matches.filter((m) => m.playerId === playerId);
  const s: PlayerStats = {
    correct: 0, distinctCorrect: 0, bestStreak: 0, catCorrect: {}, perfectMatch: false, hardcoreBestAcc: 0,
    duelWins: 0, battleWins: 0, survivalBest: 0, isTop1: topPlayerId === playerId, championshipsWon: 0, mysteryOneSec: 0,
  };
  const distinct = new Set<string>();
  for (const m of mine) {
    s.correct += m.correct;
    s.bestStreak = Math.max(s.bestStreak, m.bestStreak);
    if (m.total >= 10 && m.correct === m.total && m.mode !== 'infinite' && m.mode !== 'survival') s.perfectMatch = true;
    if (m.mode === 'hardcore' && m.total >= 10) s.hardcoreBestAcc = Math.max(s.hardcoreBestAcc, m.accuracy);
    if (m.mode === 'duel' && m.won) s.duelWins++;
    if (m.mode === 'battle' && m.won) s.battleWins++;
    if (m.mode === 'survival' || m.mode === 'infinite') s.survivalBest = Math.max(s.survivalBest, m.roundsSurvived ?? 0);
    for (const a of m.answers) {
      if (!a.correct) continue;
      distinct.add(a.trackId);
      for (const c of a.categories) s.catCorrect[c] = (s.catCorrect[c] ?? 0) + 1;
      if (m.mode === 'mysterious' && !a.hints.includes('more')) s.mysteryOneSec++;
    }
  }
  s.distinctCorrect = distinct.size;
  s.championshipsWon = championships.filter((c) => c.status === 'encerrado' && c.podium?.first === playerId).length;
  return s;
}

/** Retorna as conquistas recém-desbloqueadas (ainda não registradas). */
export function evaluateAchievements(
  playerId: string,
  stats: PlayerStats,
  unlocked: AchievementUnlock[],
): string[] {
  const have = new Set(unlocked.filter((u) => u.playerId === playerId).map((u) => u.achievementId));
  return ACHIEVEMENTS.filter((a) => {
    if (have.has(a.id)) return false;
    const p = a.progress(stats);
    return p.current >= p.target;
  }).map((a) => a.id);
}
