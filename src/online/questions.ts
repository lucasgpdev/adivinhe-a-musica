import { buildOptions } from '../game/session';
import { filterPool } from '../services/catalog';
import type { CategoryId, Difficulty, Track } from '../types';
import { normalize, shuffle } from '../utils';

export interface OnlineQuestion {
  previewUrl: string;
  snippetStart: number;
  options: { id: string; title: string }[];
  answerId: string;
  track: { title: string; artistName: string; artworkUrl?: string; year?: number; storeUrl?: string };
}

/**
 * Monta as perguntas de uma partida online (feito no navegador do dono da sala).
 * Mistura dificuldades 1–3 e evita repetir o mesmo título.
 */
export function buildOnlineQuestions(
  tracks: Track[], categories: CategoryId[], rounds: number, rng: () => number = Math.random, artists: string[] = [],
  opts: { explicit?: boolean; timeSec?: number } = {},
): OnlineQuestion[] {
  const pool = filterPool(tracks, { categories, artists, extra: 'random', explicit: opts.explicit }, new Date());
  const all = filterPool(tracks, { categories: [], artists: [], extra: 'random', explicit: opts.explicit }, new Date());
  // a prévia da Apple tem 30s: começa cedo o bastante para tocar o tempo todo da pergunta
  const timeSec = opts.timeSec ?? 15;
  const startFor = (d: number) => (d === 1 || timeSec >= 25 ? 0 : Math.floor(rng() * Math.max(1, Math.min(10, 30 - timeSec))));
  const used = new Set<string>();
  const out: OnlineQuestion[] = [];
  for (const t of shuffle(pool, rng)) {
    if (out.length >= rounds) break;
    const key = normalize(t.displayTitle);
    if (used.has(key) || t.difficulty > 3) continue;
    const d = (1 + Math.floor(rng() * 3)) as Difficulty;
    // alternativas do mesmo gênero escolhido (ou de todo o catálogo se faltar)
    const opts = buildOptions(t, pool.length >= 20 ? pool : all, d, rng) ?? buildOptions(t, all, d, rng);
    if (!opts) continue;
    used.add(key);
    out.push({
      previewUrl: t.previewUrl,
      snippetStart: startFor(d),
      options: opts.map((o) => ({ id: o.id, title: o.displayTitle })),
      answerId: t.id,
      track: { title: t.title, artistName: t.artistName, artworkUrl: t.artworkUrl, year: t.year, storeUrl: t.storeUrl },
    });
  }
  // se faltar música "fácil/média", completa com as difíceis
  if (out.length < rounds) {
    for (const t of shuffle(pool, rng)) {
      if (out.length >= rounds) break;
      const key = normalize(t.displayTitle);
      if (used.has(key)) continue;
      const opts = buildOptions(t, all, 2, rng);
      if (!opts) continue;
      used.add(key);
      out.push({
        previewUrl: t.previewUrl, snippetStart: startFor(2),
        options: opts.map((o) => ({ id: o.id, title: o.displayTitle })), answerId: t.id,
        track: { title: t.title, artistName: t.artistName, artworkUrl: t.artworkUrl, year: t.year, storeUrl: t.storeUrl },
      });
    }
  }
  return out;
}
