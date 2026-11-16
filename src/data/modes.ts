import type { Difficulty, HintId, ModeId } from '../types';

export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  description: string;
  icon: string; // nome do ícone lucide (ver components/Icon.tsx)
  /** null = ilimitado */
  questions: number | null;
  timeSec: number;
  points: number;
  minPlayers: number;
  maxPlayers: number;
  /** Faixa de dificuldade das músicas (quando não progressivo). */
  difficulty: [Difficulty, Difficulty];
  progressive: boolean;
  endOnWrong: boolean;
  hints: HintId[];
  secondChance: boolean;
  /** Modos multiplayer competitivos (permitem Roubo de Pontos). */
  competitive: boolean;
  ranked: boolean;
  mysterious?: boolean;
  /** Tempo mínimo nos modos progressivos */
  minTimeSec?: number;
}

export const MODES: ModeDef[] = [
  {
    id: 'classic', name: 'Clássico', tagline: '10 músicas · 15s · 100 pts',
    description: 'O jeito tradicional: dificuldade equilibrada, quatro alternativas e tempo para pensar.',
    icon: 'disc', questions: 10, timeSec: 15, points: 100, minPlayers: 1, maxPlayers: 1,
    difficulty: [1, 3], progressive: false, endOnWrong: false,
    hints: ['artist', 'decade', 'fifty'], secondChance: true, competitive: false, ranked: true,
  },
  {
    id: 'lightning', name: 'Relâmpago', tagline: '20 músicas · 10s · 150 pts',
    description: 'Ritmo acelerado. Responda rápido e mantenha a sequência para multiplicar os pontos.',
    icon: 'zap', questions: 20, timeSec: 10, points: 150, minPlayers: 1, maxPlayers: 1,
    difficulty: [1, 3], progressive: false, endOnWrong: false,
    hints: ['artist', 'fifty'], secondChance: true, competitive: false, ranked: true,
  },
  {
    id: 'hardcore', name: 'Hardcore', tagline: '15 músicas · 5s · 200 pts',
    description: 'Só para quem conhece de verdade: trechos curtos, músicas difíceis e artista sempre oculto.',
    icon: 'flame', questions: 15, timeSec: 5, points: 200, minPlayers: 1, maxPlayers: 1,
    difficulty: [3, 4], progressive: false, endOnWrong: false,
    hints: [], secondChance: false, competitive: false, ranked: true,
  },
  {
    id: 'infinite', name: 'Infinito', tagline: 'Sem limite · errou, acabou',
    description: 'Perguntas ilimitadas com dificuldade progressiva. Até onde você chega sem errar?',
    icon: 'infinity', questions: null, timeSec: 15, minTimeSec: 6, points: 100, minPlayers: 1, maxPlayers: 1,
    difficulty: [1, 4], progressive: true, endOnWrong: true,
    hints: ['fifty'], secondChance: false, competitive: false, ranked: true,
  },
  {
    id: 'duel', name: 'Duelo', tagline: '2 jogadores · mesmas músicas',
    description: 'Dois jogadores, as mesmas perguntas, um vencedor. As respostas só são reveladas depois que os dois responderem.',
    icon: 'swords', questions: 10, timeSec: 15, points: 100, minPlayers: 2, maxPlayers: 2,
    difficulty: [1, 3], progressive: false, endOnWrong: false,
    hints: ['fifty'], secondChance: false, competitive: true, ranked: true,
  },
  {
    id: 'battle', name: 'Batalha', tagline: '3 a 12 jogadores · placar ao vivo',
    description: 'Toda a turma disputa a mesma sequência de músicas, com classificação atualizada a cada rodada.',
    icon: 'users', questions: 10, timeSec: 15, points: 100, minPlayers: 3, maxPlayers: 12,
    difficulty: [1, 3], progressive: false, endOnWrong: false,
    hints: ['fifty'], secondChance: false, competitive: true, ranked: true,
  },
  {
    id: 'mysterious', name: 'Misterioso', tagline: 'Trechos de 1 segundo',
    description: 'Um trecho minúsculo e nenhuma informação extra. Quanto menos você ouvir antes de acertar, mais pontos ganha.',
    icon: 'eye-off', questions: 10, timeSec: 20, points: 300, minPlayers: 1, maxPlayers: 1,
    difficulty: [1, 4], progressive: true, endOnWrong: false,
    hints: ['more'], secondChance: false, competitive: false, ranked: true, mysterious: true,
  },
  {
    id: 'survival', name: 'Sobrevivência', tagline: '1 a 12 jogadores · cada erro elimina',
    description: 'A cada rodada a dificuldade sobe e o tempo cai. Quem errar está fora. Vence quem chegar mais longe.',
    icon: 'heart-pulse', questions: null, timeSec: 15, minTimeSec: 5, points: 100, minPlayers: 1, maxPlayers: 12,
    difficulty: [1, 4], progressive: true, endOnWrong: true,
    hints: [], secondChance: false, competitive: true, ranked: true,
  },
  {
    id: 'custom', name: 'Personalizado', tagline: 'Você define as regras',
    description: 'Escolha quantidade de perguntas, tempo, pontuação e dificuldade. Partidas amistosas: não entram no ranking.',
    icon: 'sliders', questions: 10, timeSec: 15, points: 100, minPlayers: 1, maxPlayers: 12,
    difficulty: [1, 4], progressive: false, endOnWrong: false,
    hints: ['artist', 'decade', 'fifty'], secondChance: true, competitive: true, ranked: false,
  },
];

export const MODE_BY_ID: Record<ModeId, ModeDef> = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<
  ModeId,
  ModeDef
>;

export const HINT_INFO: Record<HintId, { name: string; penalty: number; description: string }> = {
  artist: { name: 'Dica do artista', penalty: 0.25, description: 'Revela o artista (−25% dos pontos)' },
  decade: { name: 'Dica do ano', penalty: 0.15, description: 'Mostra o ano de lançamento (−15%)' },
  fifty: { name: '50/50', penalty: 0.3, description: 'Elimina duas alternativas erradas (−30%)' },
  more: { name: 'Ouvir mais', penalty: 0, description: 'Toca um trecho maior (vale menos pontos)' },
};

/** Máximo de dicas por partida — evita uso abusivo para inflar o ranking. */
export const MAX_HINTS_PER_MATCH = 3;

/** Duração do trecho no modo Misterioso por nível de "ouvir mais" e fator de pontos. */
export const MYSTERY_LEVELS = [
  { seconds: 1, factor: 1 },
  { seconds: 2, factor: 0.7 },
  { seconds: 4, factor: 0.45 },
  { seconds: 8, factor: 0.3 },
];
