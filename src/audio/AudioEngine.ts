/**
 * Reprodutor das prévias oficiais (HTML Audio API).
 * - Carrega com tempo limite e reporta falhas reais (rede, formato, bloqueio).
 * - Toca apenas o trecho definido para a pergunta (início + duração).
 * - Nenhuma reprodução é simulada: o cronômetro do jogo só começa no evento "playing".
 */

export type AudioErrorKind = 'timeout' | 'network' | 'decode' | 'unsupported' | 'blocked' | 'unknown';

export class AudioLoadError extends Error {
  constructor(public kind: AudioErrorKind, message: string) {
    super(message);
  }
}

type Listener = () => void;

export class AudioEngine {
  private el: HTMLAudioElement;
  private snippetEnd = Infinity;
  private snippetStart = 0;
  private listeners = { playing: new Set<Listener>(), paused: new Set<Listener>() };
  private loadToken = 0;

  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.addEventListener('timeupdate', () => {
      if (this.el.currentTime >= this.snippetEnd) this.el.pause();
    });
    this.el.addEventListener('playing', () => this.listeners.playing.forEach((l) => l()));
    this.el.addEventListener('pause', () => this.listeners.paused.forEach((l) => l()));
    this.el.addEventListener('ended', () => this.listeners.paused.forEach((l) => l()));
  }

  on(ev: 'playing' | 'paused', fn: Listener): () => void {
    this.listeners[ev].add(fn);
    return () => this.listeners[ev].delete(fn);
  }

  setVolume(v: number): void {
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  get playing(): boolean {
    return !this.el.paused && !this.el.ended;
  }

  get duration(): number {
    return Number.isFinite(this.el.duration) ? this.el.duration : 30;
  }

  /** Carrega uma prévia. Rejeita com AudioLoadError em caso de falha. */
  load(url: string, timeoutMs = 10000): Promise<void> {
    const token = ++this.loadToken;
    this.el.pause();
    this.snippetEnd = Infinity;
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err?: AudioLoadError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.el.removeEventListener('canplay', onReady);
        this.el.removeEventListener('error', onError);
        if (token !== this.loadToken) return reject(new AudioLoadError('unknown', 'Carregamento substituído.'));
        if (err) reject(err);
        else resolve();
      };
      const onReady = () => done();
      const onError = () => {
        const code = this.el.error?.code;
        if (code === 2) done(new AudioLoadError('network', 'Falha de rede ao carregar a prévia.'));
        else if (code === 3) done(new AudioLoadError('decode', 'A prévia não pôde ser decodificada.'));
        else if (code === 4) done(new AudioLoadError('unsupported', 'Prévia indisponível ou formato não suportado.'));
        else done(new AudioLoadError('unknown', 'Erro desconhecido ao carregar a prévia.'));
      };
      const timer = setTimeout(
        () => done(new AudioLoadError('timeout', 'A prévia demorou demais para carregar.')),
        timeoutMs,
      );
      this.el.addEventListener('canplay', onReady);
      this.el.addEventListener('error', onError);
      this.el.src = url;
      this.el.load();
    });
  }

  /** Define o trecho e toca a partir do início dele. */
  async playSnippet(start: number, duration: number): Promise<void> {
    const dur = this.duration;
    this.snippetStart = Math.max(0, Math.min(start, Math.max(0, dur - duration - 0.25)));
    this.snippetEnd = this.snippetStart + duration;
    try {
      this.el.currentTime = this.snippetStart;
    } catch {
      /* alguns navegadores só permitem seek após metadata — já garantido por canplay */
    }
    await this.playRaw();
  }

  /** Altera a duração do trecho atual (modo Misterioso: "ouvir mais"). */
  async extendSnippet(duration: number): Promise<void> {
    this.snippetEnd = this.snippetStart + duration;
    this.el.currentTime = this.snippetStart;
    await this.playRaw();
  }

  /** Botão play/pause. Ao terminar o trecho, toca novamente do começo do trecho. */
  async toggle(): Promise<void> {
    if (this.playing) {
      this.el.pause();
      return;
    }
    if (this.el.currentTime >= this.snippetEnd - 0.05) this.el.currentTime = this.snippetStart;
    await this.playRaw();
  }

  private async playRaw(): Promise<void> {
    try {
      await this.el.play();
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError') throw new AudioLoadError('blocked', 'O navegador bloqueou a reprodução automática.');
      if (name === 'AbortError') return;
      throw new AudioLoadError('unknown', 'Não foi possível reproduzir a prévia.');
    }
  }

  stop(): void {
    this.loadToken++;
    this.el.pause();
    this.snippetEnd = Infinity;
  }

  /** Para tudo e libera a fonte (ao sair da tela de jogo). */
  dispose(): void {
    this.stop();
    this.el.removeAttribute('src');
    this.el.load();
    this.listeners.playing.clear();
    this.listeners.paused.clear();
  }
}
