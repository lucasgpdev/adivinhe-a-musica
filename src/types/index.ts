// ─────────────────────────────────────────────────────────────
// Tipos centrais do jogo ADIVINHE A MÚSICA
// ─────────────────────────────────────────────────────────────

export type CategoryId = 'trap' | 'funk' | 'rap' | 'hits';
/** 1 = Fácil, 2 = Médio, 3 = Difícil, 4 = Extremo */
export type Difficulty = 1 | 2 | 3 | 4;

export interface ArtistDef {
  id: string;
  /** Nome como é buscado/conferido na Apple Music. */
  name: string;
  /** Grafias alternativas aceitas na conferência (sem acento/maiúsculas). */
  aliases?: string[];
  categories: Exclude<CategoryId, 'hits'>[];
}

/** Música verificada — todos os campos textuais vêm da fonte oficial (Apple). */
export interface Track {
  id: string; // "itunes:<trackId>"
  trackId: number;
  /** Título oficial exatamente como publicado pela Apple. */
  title: string;
  /** Título sem o trecho "(feat. ...)" — usado nas alternativas. */
  displayTitle: string;
  artistId: string; // id interno do artista principal
  /** Crédito oficial do(s) artista(s) como publicado pela Apple. */
  artistName: string;
  featured: string[];
  categories: CategoryId[];
  difficulty: Difficulty;
  year?: number;
  album?: string;
  previewUrl: string;
  storeUrl?: string;
  artworkUrl?: string;
  source: 'apple-itunes-preview';
  /** notExplicit = sem conteúdo explícito; cleaned = versão editada (limpa). */
  explicitness: 'notExplicit' | 'cleaned';
  verification: 'verificado';
  verifiedAt: string;
  rankInArtist: number;
  isHit: boolean;
}

export type ArtistSyncStatus = 'ok' | 'pendente' | 'nao-encontrado' | 'erro' | 'sem-musicas-limpas';

export interface AppleArtistCandidate {
  appleArtistId: number;
  name: string;
  genres: string[];
  sampleTitles: string[];
}

export interface CatalogArtistStatus {
  artistId: string;
  status: ArtistSyncStatus;
  appleArtistId?: number;
  appleArtistName?: string;
  candidates?: AppleArtistCandidate[];
  found: number;
  removedExplicit: number;
  removedVariants: number;
  removedNoPreview: number;
  usable: number;
  message?: string;
  syncedAt: string;
}

export interface Catalog {
  version: 1;
  syncedAt: string | null;
  country: string;
  tracks: Track[];
  artists: Record<string, CatalogArtistStatus>;
  /** trackIds excluídos manualmente pelo professor. */
  excluded: number[];
  /** Escolha do professor para artistas ambíguos: artistId interno → ids Apple confirmados. */
  confirmedArtists: Record<string, number[]>;
  /** Contador de falhas de reprodução por trackId. */
  failures: Record<number, number>;
}

// ─── Jogadores e partidas ─────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  avatar: string;
  theme: string;
  createdAt: string;
  archived?: boolean;
}

export type HintId = 'artist' | 'decade' | 'fifty' | 'more';

export interface AnswerRecord {
  trackId: string;
  artistId: string;
  categories: CategoryId[];
  difficulty: Difficulty;
  correct: boolean;
  timedOut: boolean;
  points: number;
  timeMs: number;
  hints: HintId[];
  secondChance?: boolean;
  bonus?: boolean;
  steal?: number;
}

export type ModeId =
  | 'classic'
  | 'lightning'
  | 'hardcore'
  | 'infinite'
  | 'duel'
  | 'battle'
  | 'mysterious'
  | 'survival'
  | 'custom';

export interface MatchFilters {
  categories: CategoryId[];
  artists: string[];
  extra: ExtraFilter;
}

export type ExtraFilter = 'random' | 'old' | 'new' | 'big-hits' | 'popular' | 'hard';

export interface MatchRecord {
  id: string;
  groupId: string;
  mode: ModeId;
  ranked: boolean;
  startedAt: string;
  endedAt: string;
  playerId: string;
  playerName: string;
  score: number;
  correct: number;
  wrong: number;
  total: number;
  accuracy: number; // 0..1
  bestStreak: number;
  hintsUsed: number;
  roundsSurvived?: number;
  participants: number;
  placement?: number;
  won?: boolean;
  filters: MatchFilters;
  championshipId?: string;
  championshipPhase?: ChampionshipPhase;
  answers: AnswerRecord[];
}

export interface AchievementUnlock {
  playerId: string;
  achievementId: string;
  unlockedAt: string;
}

// ─── Campeonato ───────────────────────────────────────────────

export type ChampionshipPhase = 'classificatoria' | 'semifinal' | 'final';
export type ChampionshipStatus = 'classificatoria' | 'semifinal' | 'final' | 'encerrado' | 'cancelado';

export interface BoutResult {
  groupId: string;
  scores: Record<string, number>;
  correct: Record<string, number>;
  timeMs: Record<string, number>;
  winnerId: string;
}

export interface Bout {
  id: string;
  label: string;
  a: string;
  b: string;
  questionIds: string[];
  result?: BoutResult;
}

export interface Championship {
  id: string;
  name: string;
  createdAt: string;
  endedAt?: string;
  status: ChampionshipStatus;
  participantIds: string[];
  qualifiersCount: 2 | 4;
  config: {
    questions: number;
    timeSec: number;
    categories: CategoryId[];
    artists: string[];
  };
  qualifying: { questionIds: string[]; results: Record<string, string> }; // playerId → matchId
  semifinals: Bout[];
  final?: Bout;
  podium?: { first: string; second?: string; third?: string };
  resets: number;
}

// ─── Fila, configurações, auditoria ───────────────────────────

export interface QueueItem {
  playerId: string;
  played: boolean;
}

export interface QueueState {
  items: QueueItem[];
  championshipId?: string;
}

export interface MechanicsSettings {
  hints: boolean;
  combo: boolean;
  bonusRound: boolean;
  secondChance: boolean;
  steal: boolean;
}

export interface Settings {
  sfx: boolean;
  effects: boolean;
  volume: number;
  presenter: boolean;
  autoAdvance: boolean;
  enabledCategories: CategoryId[];
  mechanics: MechanicsSettings;
  /** Sobrescreve o tempo dos modos padrão (segundos) — null = padrão do modo. */
  timeOverride: number | null;
  teacherPin: string | null;
  lastPlayerId: string | null;
}

export interface AuditEntry {
  at: string;
  action: string;
  details?: string;
}

export interface AppData {
  schemaVersion: 1;
  players: Player[];
  matches: MatchRecord[];
  achievements: AchievementUnlock[];
  championships: Championship[];
  queue: QueueState;
  settings: Settings;
  audit: AuditEntry[];
}

export interface BackupEntry {
  id: string;
  createdAt: string;
  reason: string;
  data: AppData;
}
