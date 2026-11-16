/**
 * Cliente da iTunes Search API (Apple) — fonte oficial e gratuita de metadados
 * e prévias de 30s licenciadas pela Apple para divulgação das músicas.
 * Usa JSONP para funcionar mesmo quando o jogo é aberto direto do disco (file://).
 * Respeita o limite público (~20 chamadas/minuto) espaçando as requisições.
 */

export interface ItunesTrack {
  wrapperType: string;
  kind?: string;
  trackId: number;
  artistId: number;
  artistName: string;
  trackName: string;
  trackCensoredName?: string;
  collectionName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackExplicitness?: 'explicit' | 'cleaned' | 'notExplicit';
}

export interface ItunesResponse {
  resultCount: number;
  results: ItunesTrack[];
}

const BASE = 'https://itunes.apple.com';
/** Intervalo entre consultas. Pode ser ajustado para diagnóstico via localStorage "adm:itunes-interval-ms". */
function minInterval(): number {
  try {
    const v = Number(localStorage.getItem('adm:itunes-interval-ms'));
    if (Number.isFinite(v) && v >= 0 && v <= 10000 && localStorage.getItem('adm:itunes-interval-ms') !== null) return v;
  } catch {
    /* ignore */
  }
  return 3200;
}
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

declare global {
  interface Window {
    [key: `__adm_cb_${string}`]: ((data: unknown) => void) | undefined;
  }
}

function jsonp<T>(url: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__adm_cb_${Math.random().toString(36).slice(2)}` as const;
    const script = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      window[name] = undefined;
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado ao consultar a Apple Music.'));
    }, timeoutMs);
    window[name] = (data: unknown) => {
      cleanup();
      resolve(data as T);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Sem conexão com a Apple Music.'));
    };
    script.referrerPolicy = 'no-referrer';
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    document.head.appendChild(script);
  });
}

/** Enfileira chamadas respeitando o intervalo mínimo. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, lastCall + minInterval() - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

export function searchSongsByArtist(name: string, country = 'BR'): Promise<ItunesResponse> {
  const q = new URLSearchParams({
    term: name, country, media: 'music', entity: 'song', attribute: 'artistTerm', limit: '200', explicit: 'Yes',
  });
  return throttled(() => jsonp<ItunesResponse>(`${BASE}/search?${q.toString()}`));
}

export function lookupArtistSongs(appleArtistId: number, country = 'BR'): Promise<ItunesResponse> {
  const q = new URLSearchParams({ id: String(appleArtistId), country, entity: 'song', limit: '200' });
  return throttled(() => jsonp<ItunesResponse>(`${BASE}/lookup?${q.toString()}`));
}

/** Teste rápido de conectividade com a Apple (usado no painel). */
export async function pingApple(): Promise<boolean> {
  try {
    const q = new URLSearchParams({ term: 'Matuê', country: 'BR', entity: 'song', limit: '1' });
    const r = await throttled(() => jsonp<ItunesResponse>(`${BASE}/search?${q.toString()}`, 8000));
    return typeof r.resultCount === 'number';
  } catch {
    return false;
  }
}
