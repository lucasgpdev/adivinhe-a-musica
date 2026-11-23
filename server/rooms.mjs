/**
 * Lógica das salas online (sem rede — testável).
 *
 * Formatos:
 *  - "teams": Time A x Time B, de 1v1 até 4v4. Os pontos de cada jogador somam para o time.
 *  - "ffa":   todos contra todos, até 8 jogadores.
 *
 * O dono da sala (host) monta as perguntas no navegador dele (a partir do catálogo)
 * e envia ao servidor. O servidor guarda a resposta certa, controla o tempo,
 * recebe as respostas e calcula os pontos — os outros jogadores só recebem
 * a resposta certa na hora da revelação.
 */

export const MAX_PER_TEAM = 4;
export const MAX_FFA = 8;
export const COUNTDOWN_MS = 3500;
export const REVEAL_MS = 5500;
export const GRACE_MS = 600;
export const NAME_MAX = 24;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const DEFAULT_SETTINGS = { format: 'teams', categories: [], artists: [], rounds: 10, timeSec: 20, explicit: true };
export const CHAT_MAX = 200;
export const CHAT_HISTORY = 60;
/** Anti-flood: no máximo CHAT_BURST mensagens a cada CHAT_WINDOW_MS por jogador. */
export const CHAT_BURST = 5;
export const CHAT_WINDOW_MS = 6000;

/** Pontos de um acerto: 500 fixos + até 500 pela velocidade. */
export function pointsFor(timeMs, totalMs) {
  const f = Math.max(0, Math.min(1, 1 - timeMs / totalMs));
  return 500 + Math.round(500 * f);
}

export function cleanName(raw) {
  const n = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return n.length >= 2 ? n : null;
}

export function sanitizeSettings(s, prev = DEFAULT_SETTINGS) {
  const out = { ...prev };
  if (s && (s.format === 'teams' || s.format === 'ffa')) out.format = s.format;
  if (s && Array.isArray(s.categories)) out.categories = s.categories.filter((c) => typeof c === 'string').slice(0, 20);
  if (s && Array.isArray(s.artists)) out.artists = [...new Set(s.artists.filter((c) => typeof c === 'string').map((c) => c.slice(0, 64)))].slice(0, 60);
  if (s && Number.isFinite(s.rounds)) out.rounds = Math.max(5, Math.min(30, Math.round(s.rounds)));
  if (s && Number.isFinite(s.timeSec)) out.timeSec = Math.max(5, Math.min(30, Math.round(s.timeSec)));
  if (s && typeof s.explicit === 'boolean') out.explicit = s.explicit;
  return out;
}

function sanitizeQuestion(q) {
  if (!q || typeof q.previewUrl !== 'string' || !/^https:\/\//.test(q.previewUrl)) return null;
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return null;
  const options = q.options.map((o) => ({ id: String(o.id).slice(0, 64), title: String(o.title).slice(0, 200) }));
  if (!options.some((o) => o.id === String(q.answerId))) return null;
  const t = q.track ?? {};
  return {
    previewUrl: q.previewUrl,
    snippetStart: Math.max(0, Math.min(25, Number(q.snippetStart) || 0)),
    options,
    answerId: String(q.answerId),
    track: {
      title: String(t.title ?? '').slice(0, 200),
      artistName: String(t.artistName ?? '').slice(0, 200),
      artworkUrl: typeof t.artworkUrl === 'string' && /^https:\/\//.test(t.artworkUrl) ? t.artworkUrl : undefined,
      year: Number.isFinite(t.year) ? t.year : undefined,
      storeUrl: typeof t.storeUrl === 'string' && /^https:\/\//.test(t.storeUrl) ? t.storeUrl : undefined,
    },
  };
}

export class Room {
  /** @param {{code:string, now?:()=>number, schedule?:(fn:()=>void, ms:number)=>any, cancel?:(h:any)=>void, onChange?:(room:Room)=>void}} o */
  constructor(o) {
    this.code = o.code;
    this.now = o.now ?? Date.now;
    this.schedule = o.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel = o.cancel ?? ((h) => clearTimeout(h));
    this.onChange = o.onChange ?? (() => {});
    this.settings = { ...DEFAULT_SETTINGS };
    /** @type {Map<string, any>} */
    this.players = new Map();
    this.hostId = null;
    this.phase = 'lobby';
    this.questions = [];
    this.round = -1;
    this.phaseEndsAt = 0;
    this.answers = new Map(); // playerId → {optionId, timeMs}
    this.lastReveal = null;
    this.timer = null;
    this.emptySince = null;
    /** @type {{id:number, at:number, scope:'all'|'team', team:string|null, from:{id:string,name:string,avatar:string,team:string}, text:string}[]} */
    this.chatLog = [];
    this.chatSeq = 0;
    this.chatTimes = new Map(); // playerId → timestamps recentes
  }

  /**
   * Mensagem de chat. scope "team" só chega aos colegas de time (no modo times).
   * Retorna { msg } ou { error }.
   */
  chat(id, rawText, scope) {
    const p = this.players.get(id);
    if (!p) return { error: 'Você não está na sala.' };
    const text = String(rawText ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!text) return { error: null };
    const now = this.now();
    const recent = (this.chatTimes.get(id) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) return { error: 'Calma! Você está mandando mensagens rápido demais.' };
    recent.push(now);
    this.chatTimes.set(id, recent);
    const team = scope === 'team' && this.settings.format === 'teams' ? p.team : null;
    const msg = { id: ++this.chatSeq, at: now, scope: team ? 'team' : 'all', team, from: { id: p.id, name: p.name, avatar: p.avatar, team: p.team }, text };
    this.chatLog.push(msg);
    if (this.chatLog.length > CHAT_HISTORY) this.chatLog.shift();
    return { msg };
  }

  /** Quem pode ver esta mensagem? */
  canSee(playerId, msg) {
    if (msg.scope === 'all') return true;
    return this.players.get(playerId)?.team === msg.team;
  }

  chatFor(playerId) {
    return this.chatLog.filter((m) => this.canSee(playerId, m));
  }

  get connectedCount() {
    return [...this.players.values()].filter((p) => p.connected).length;
  }

  teamCount(team) {
    return [...this.players.values()].filter((p) => p.team === team).length;
  }

  canJoin(id) {
    if (this.players.has(id)) return null;
    if (this.phase !== 'lobby') return 'A partida já começou. Espere ela acabar para entrar.';
    const max = this.settings.format === 'teams' ? MAX_PER_TEAM * 2 : MAX_FFA;
    if (this.players.size >= max) return `A sala está cheia (máximo ${max} jogadores).`;
    return null;
  }

  join(id, name, avatar) {
    const existing = this.players.get(id);
    if (existing) {
      existing.connected = true;
      existing.name = name;
      existing.avatar = avatar;
    } else {
      const team = this.teamCount('A') <= this.teamCount('B') ? 'A' : 'B';
      this.players.set(id, { id, name, avatar, team, connected: true, score: 0, correct: 0, streak: 0, bestStreak: 0, joinedAt: this.now() });
    }
    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = id;
    this.emptySince = null;
    this.changed();
  }

  disconnect(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'lobby') this.players.delete(id);
    else p.connected = false;
    this.fixHost();
    if (!this.connectedCount) this.emptySince = this.now();
    if (this.phase === 'question' && this.allAnswered()) this.endQuestion();
    this.changed();
  }

  leave(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.answers.delete(id);
    this.fixHost();
    if (!this.connectedCount) this.emptySince = this.now();
    if (this.phase === 'question' && this.allAnswered()) this.endQuestion();
    this.changed();
  }

  fixHost() {
    if (this.hostId && this.players.get(this.hostId)?.connected) return;
    const next = [...this.players.values()].filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.hostId = next?.id ?? null;
  }

  setTeam(id, team) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'lobby' || (team !== 'A' && team !== 'B') || p.team === team) return null;
    if (this.teamCount(team) >= MAX_PER_TEAM) return `O Time ${team} já está completo (máximo ${MAX_PER_TEAM}).`;
    p.team = team;
    this.changed();
    return null;
  }

  updateSettings(id, s) {
    if (id !== this.hostId || this.phase !== 'lobby') return 'Só o dono da sala pode mudar as configurações.';
    const next = sanitizeSettings(s, this.settings);
    if (next.format === 'teams' && this.players.size > MAX_PER_TEAM * 2) return 'Há jogadores demais para o modo em times.';
    if (next.format === 'teams' && this.settings.format !== 'teams') {
      // reequilibra ao voltar para times
      [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).forEach((p, i) => { p.team = i % 2 ? 'B' : 'A'; });
    }
    this.settings = next;
    this.changed();
    return null;
  }

  startError() {
    const n = this.connectedCount;
    if (this.settings.format === 'teams') {
      const a = [...this.players.values()].filter((p) => p.team === 'A' && p.connected).length;
      const b = [...this.players.values()].filter((p) => p.team === 'B' && p.connected).length;
      if (!a || !b) return 'Cada time precisa ter pelo menos 1 jogador.';
      if (a > MAX_PER_TEAM || b > MAX_PER_TEAM) return `Máximo de ${MAX_PER_TEAM} jogadores por time.`;
    } else if (n < 2) return 'São necessários pelo menos 2 jogadores.';
    return null;
  }

  start(id, rawQuestions) {
    if (id !== this.hostId) return 'Só o dono da sala pode começar.';
    if (this.phase !== 'lobby' && this.phase !== 'finished') return 'A partida já está em andamento.';
    const err = this.startError();
    if (err) return err;
    const qs = (Array.isArray(rawQuestions) ? rawQuestions : []).slice(0, 30).map(sanitizeQuestion).filter(Boolean);
    if (qs.length < 3) return 'Não há músicas suficientes para essas categorias.';
    // remove quem saiu e zera o placar
    for (const p of [...this.players.values()]) {
      if (!p.connected) this.players.delete(p.id);
      else Object.assign(p, { score: 0, correct: 0, streak: 0, bestStreak: 0 });
    }
    this.questions = qs;
    this.round = -1;
    this.lastReveal = null;
    this.nextRound();
    return null;
  }

  nextRound() {
    this.cancelTimer();
    this.round++;
    if (this.round >= this.questions.length) {
      this.phase = 'finished';
      this.phaseEndsAt = 0;
      this.changed();
      return;
    }
    this.answers = new Map();
    this.phase = 'countdown';
    this.phaseEndsAt = this.now() + COUNTDOWN_MS;
    this.timer = this.schedule(() => this.beginQuestion(), COUNTDOWN_MS);
    this.changed();
  }

  beginQuestion() {
    this.cancelTimer();
    this.phase = 'question';
    this.questionStartedAt = this.now();
    const total = this.settings.timeSec * 1000;
    this.phaseEndsAt = this.questionStartedAt + total;
    this.timer = this.schedule(() => this.endQuestion(), total + GRACE_MS);
    this.changed();
  }

  answer(id, round, optionId) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'question' || round !== this.round || this.answers.has(id)) return;
    const total = this.settings.timeSec * 1000;
    const timeMs = Math.min(total, Math.max(0, this.now() - this.questionStartedAt));
    this.answers.set(id, { optionId: String(optionId), timeMs });
    if (this.allAnswered()) this.endQuestion();
    else this.changed();
  }

  allAnswered() {
    const active = [...this.players.values()].filter((p) => p.connected);
    return active.length > 0 && active.every((p) => this.answers.has(p.id));
  }

  endQuestion() {
    if (this.phase !== 'question') return;
    this.cancelTimer();
    const q = this.questions[this.round];
    const total = this.settings.timeSec * 1000;
    const results = {};
    for (const p of this.players.values()) {
      const a = this.answers.get(p.id);
      const correct = !!a && a.optionId === q.answerId;
      const points = correct ? pointsFor(a.timeMs, total) : 0;
      if (correct) {
        p.correct++;
        p.streak++;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
      } else p.streak = 0;
      p.score += points;
      results[p.id] = { optionId: a?.optionId ?? null, correct, points, timeMs: a?.timeMs ?? null };
    }
    this.lastReveal = { round: this.round, answerId: q.answerId, track: q.track, results };
    this.phase = 'reveal';
    this.phaseEndsAt = this.now() + REVEAL_MS;
    this.timer = this.schedule(() => this.nextRound(), REVEAL_MS);
    this.changed();
  }

  backToLobby(id) {
    if (id !== this.hostId || this.phase !== 'finished') return;
    this.phase = 'lobby';
    for (const p of [...this.players.values()]) if (!p.connected) this.players.delete(p.id);
    this.changed();
  }

  cancelTimer() {
    if (this.timer) this.cancel(this.timer);
    this.timer = null;
  }

  dispose() {
    this.cancelTimer();
  }

  changed() {
    this.onChange(this);
  }

  teamScores() {
    const s = { A: 0, B: 0 };
    for (const p of this.players.values()) s[p.team] += p.score;
    return s;
  }

  /** Estado público da sala (sem a resposta certa enquanto a pergunta está aberta). */
  snapshot() {
    const q = this.round >= 0 ? this.questions[this.round] : null;
    const showQuestion = q && (this.phase === 'countdown' || this.phase === 'question' || this.phase === 'reveal');
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      phase: this.phase,
      round: this.round,
      totalRounds: this.questions.length || this.settings.rounds,
      remainingMs: this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - this.now()) : 0,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(({ id, name, avatar, team, connected, score, correct, bestStreak }) => ({ id, name, avatar, team, connected, score, correct, bestStreak })),
      teamScores: this.teamScores(),
      answered: [...this.answers.keys()],
      question: showQuestion ? { previewUrl: q.previewUrl, snippetStart: q.snippetStart, options: q.options } : null,
      reveal: this.phase === 'reveal' || this.phase === 'finished' ? this.lastReveal : null,
    };
  }
}

export class Lobby {
  constructor(o = {}) {
    this.rooms = new Map();
    this.opts = o;
  }

  newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  create(onChange) {
    const code = this.newCode();
    const room = new Room({ ...this.opts, code, onChange });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code ?? '').trim().toUpperCase()) ?? null;
  }

  /** Remove salas vazias há mais de `ms`. */
  sweep(ms = 120000, now = Date.now()) {
    for (const [code, r] of this.rooms) {
      if (r.emptySince && now - r.emptySince > ms) {
        r.dispose();
        this.rooms.delete(code);
      }
    }
  }
}
