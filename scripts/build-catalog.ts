/**
 * Gera dist/catalog.json com as músicas verificadas de todos os artistas,
 * usando a mesma verificação do jogo (services/catalog.ts).
 *
 * Roda no build do Render (variável RENDER definida) ou com BUILD_CATALOG=1.
 * Em builds locais é pulado — o jogo continua podendo sincronizar pelo navegador.
 *
 *   BUILD_CATALOG=1 npx tsx scripts/build-catalog.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ARTIST_BY_ID, ARTISTS, CATEGORY_GENRES } from '../src/data/artists';
import { applyFeatured, FEATURED_SONGS } from '../src/data/featured';
import { EMPTY_CATALOG, markHits, processArtistResults } from '../src/services/catalog';
import type { ItunesResponse, ItunesTrack } from '../src/services/itunes';
import type { Catalog, Track } from '../src/types';

const OUT = resolve(process.argv[2] ?? 'dist/catalog.json');
const INTERVAL_MS = Number(process.env.CATALOG_INTERVAL_MS ?? 3100);

if (!process.env.RENDER && !process.env.BUILD_CATALOG) {
  console.log('[catálogo] build local: pulando (use BUILD_CATALOG=1 para gerar).');
  process.exit(0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(name: string, byArtist = true, country = 'BR'): Promise<ItunesTrack[]> {
  const q = new URLSearchParams({
    term: name, country, media: 'music', entity: 'song', limit: '200', explicit: 'Yes',
  });
  if (byArtist) q.set('attribute', 'artistTerm');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?${q}`, { signal: AbortSignal.timeout(20000) });
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        const wait = 15000 * (attempt + 1);
        console.log(`[catálogo]   Apple respondeu ${res.status}, aguardando ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as ItunesResponse).results;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(5000);
    }
  }
  throw new Error('Apple indisponível');
}

const rawExplicitness: Record<string, number> = {};
let usExplicit = 0;

async function get(url: string): Promise<ItunesTrack[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as ItunesResponse).results;
}

/** Diagnóstico: de onde a Apple devolve as versões explícitas? */
async function diagnoseExplicit() {
  const dist = (rs: ItunesTrack[]) => {
    const d: Record<string, number> = {};
    for (const r of rs) if (r.wrapperType === 'track') d[r.trackExplicitness ?? '?'] = (d[r.trackExplicitness ?? '?'] ?? 0) + 1;
    return JSON.stringify(d);
  };
  try {
    const probe = await get('https://itunes.apple.com/search?term=MC+Ryan+SP&country=BR&entity=song&limit=5');
    const id = probe.find((r) => /ryan/i.test(r.artistName))?.artistId;
    console.log(`[diagnóstico] artistId MC Ryan SP = ${id}`);
    const urls: Record<string, string> = {
      'lookup BR': `https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200&country=BR`,
      'lookup US': `https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200&country=US`,
      'lookup BR explicit=Yes': `https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200&country=BR&explicit=Yes`,
      'search musicTrack': 'https://itunes.apple.com/search?term=MC+Ryan+SP&country=BR&media=music&entity=musicTrack&limit=200&explicit=Yes',
      'search sem explicit': 'https://itunes.apple.com/search?term=MC+Ryan+SP&country=BR&media=music&entity=song&limit=200',
      'album lookup': `https://itunes.apple.com/lookup?id=${id}&entity=album&limit=50&country=BR`,
    };
    for (const [k, u] of Object.entries(urls)) {
      await sleep(INTERVAL_MS);
      const rs = await get(u);
      const albums = rs.filter((r) => (r as unknown as { collectionExplicitness?: string }).collectionExplicitness);
      const adist: Record<string, number> = {};
      for (const a of albums) { const e = (a as unknown as { collectionExplicitness: string }).collectionExplicitness; adist[e] = (adist[e] ?? 0) + 1; }
      console.log(`[diagnóstico] ${k}: faixas ${dist(rs)} · álbuns ${JSON.stringify(adist)}`);
    }
  } catch (e) {
    console.log(`[diagnóstico] erro: ${(e as Error).message}`);
  }
}

async function main() {
  const started = Date.now();
  await diagnoseExplicit();
  const artists: Catalog['artists'] = {};
  let tracks: Track[] = [];
  for (const [i, a] of ARTISTS.entries()) {
    if (i > 0) await sleep(INTERVAL_MS);
    try {
      const results = await search(a.name);
      for (const r0 of results) {
        if (r0.wrapperType !== 'track') continue;
        const k = r0.trackExplicitness ?? 'sem-classificacao';
        rawExplicitness[k] = (rawExplicitness[k] ?? 0) + 1;
      }
      // A loja do Brasil pode não devolver versões explícitas: busca o original na loja dos EUA
      // (mesmos IDs de artista e de faixa; as prévias tocam em qualquer país).
      const EXPLICIT_GENRES = ['funk', 'funk-pesado', 'trap', 'rap'];
      if (!results.some((x) => x.trackExplicitness === 'explicit') && a.categories.some((c) => EXPLICIT_GENRES.includes(c))) {
        await sleep(INTERVAL_MS);
        try {
          const us = (await search(a.name, true, 'US')).filter((x) => x.trackExplicitness === 'explicit');
          usExplicit += us.length;
          results.push(...us);
        } catch { /* segue só com o Brasil */ }
      }
      let r = processArtistResults(a, results, undefined);
      if (r.status.status === 'pendente' && r.status.candidates?.length) {
        // Sem professor para confirmar: escolhe o perfil (mesmo nome) do gênero certo com mais músicas.
        const pick = r.status.candidates.find((c) => c.genres.some((g) => a.categories.some((cat) => CATEGORY_GENRES[cat].test(g))));
        if (pick) r = processArtistResults(a, results, [pick.appleArtistId]);
      }
      artists[a.id] = r.status;
      tracks = tracks.concat(r.tracks);
      console.log(`[catálogo] ${i + 1}/${ARTISTS.length} ${a.name}: ${r.tracks.length} músicas (${r.status.status})`);
    } catch (e) {
      console.log(`[catálogo] ${i + 1}/${ARTISTS.length} ${a.name}: erro — ${(e as Error).message}`);
    }
  }
  const uniq = new Map<number, Track>();
  for (const t of tracks) if (!uniq.has(t.trackId)) uniq.set(t.trackId, t);
  let all = markHits([...uniq.values()]);

  // Músicas em destaque: se não vieram na busca do artista, procura pelo título.
  for (const f of FEATURED_SONGS) {
    const a = ARTIST_BY_ID[f.artistId];
    if (!a) continue;
    const found = applyFeatured(all, [f]);
    if (found.missing.length) {
      await sleep(INTERVAL_MS);
      try {
        const results = (await search(`${a.name} ${f.title}`, false));
        const confirmed = artists[a.id]?.appleArtistId ? [artists[a.id].appleArtistId!] : undefined;
        const extra = processArtistResults(a, results, confirmed).tracks.filter((t) => !all.some((x) => x.trackId === t.trackId));
        all = all.concat(markHits(extra));
      } catch (e) {
        console.log(`[catálogo] destaque "${f.title}": erro — ${(e as Error).message}`);
      }
    }
    const r = applyFeatured(all, [f]);
    all = r.tracks;
    console.log(`[catálogo] destaque ${a.name} - "${f.title}": ${r.missing.length ? 'NÃO encontrada (sem prévia oficial)' : 'ok'}`);
  }

  const catalog: Catalog = { ...EMPTY_CATALOG, syncedAt: new Date().toISOString(), artists, tracks: all };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(catalog));
  console.log(`[catálogo] classificação da Apple (bruto): ${JSON.stringify(rawExplicitness)}`);
  console.log(`[catálogo] explícitas vindas da loja dos EUA: ${usExplicit}`);
  console.log(`[catálogo] versões explícitas no catálogo: ${all.filter((t) => t.explicitness === 'explicit').length}`);
  const perCat: Record<string, number> = {};
  for (const t of catalog.tracks) for (const c of t.categories) perCat[c] = (perCat[c] ?? 0) + 1;
  console.log(`[catálogo] por gênero: ${Object.entries(perCat).map(([c, n]) => `${c}=${n}`).join(' ')}`);
  console.log(`[catálogo] ${catalog.tracks.length} músicas em ${Math.round((Date.now() - started) / 1000)}s → ${OUT}`);
}

main().catch((e) => {
  // Nunca derruba o build: sem catálogo o jogo ainda permite sincronizar pelo navegador.
  console.error('[catálogo] falhou:', e);
  process.exit(0);
});
