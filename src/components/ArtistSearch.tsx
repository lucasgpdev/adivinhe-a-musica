import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ARTISTS, CATEGORIES } from '../data/artists';
import type { Track } from '../types';
import { cx, normalize } from '../utils';

const SHOW_WITHOUT_QUERY = 24;

/**
 * Lupa para pesquisar cantores/artistas e escolher de quais vão ser as músicas.
 * Nenhum selecionado = todos.
 */
export function ArtistSearch({
  tracks, selected, onChange, disabled,
}: { tracks: Track[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tracks) m[t.artistId] = (m[t.artistId] ?? 0) + 1;
    return m;
  }, [tracks]);
  const available = useMemo(
    () => ARTISTS.filter((a) => (counts[a.id] ?? 0) > 0).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0)),
    [counts],
  );
  const q = normalize(query.trim());
  const results = useMemo(() => {
    if (!q) return available.slice(0, SHOW_WITHOUT_QUERY);
    return available.filter((a) => {
      const names = [a.name, ...(a.aliases ?? [])].map(normalize);
      const genres = a.categories.map((c) => normalize(CATEGORIES.find((x) => x.id === c)?.name ?? ''));
      return names.some((n) => n.includes(q)) || genres.some((g) => g.includes(q));
    });
  }, [available, q]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const byId = (id: string) => ARTISTS.find((a) => a.id === id);

  return (
    <div className={cx(disabled && 'pointer-events-none opacity-60')}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="input pl-9 pr-9" placeholder="Pesquisar cantor ou artista…" value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar cantor ou artista"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-400">Só músicas de:</span>
          {selected.map((id) => (
            <button key={id} type="button" onClick={() => toggle(id)} className="flex items-center gap-1 rounded-full border border-accent/60 bg-accent/20 px-2.5 py-1 text-xs font-medium">
              {byId(id)?.name ?? id} <X size={12} />
            </button>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-xs text-zinc-400 underline hover:text-white">limpar</button>
        </div>
      )}

      <div className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {results.map((a) => (
          <button
            key={a.id} type="button" onClick={() => toggle(a.id)}
            className={cx('rounded-full border px-2.5 py-1 text-xs transition', selected.includes(a.id) ? 'border-accent/60 bg-accent/20 text-white' : 'border-white/10 text-zinc-300 hover:border-white/25')}
          >
            {a.name} <span className="text-[10px] opacity-60">{counts[a.id]}</span>
          </button>
        ))}
        {!results.length && <p className="py-2 text-sm text-zinc-500">Nenhum artista encontrado para “{query}”.</p>}
      </div>
      {!q && available.length > SHOW_WITHOUT_QUERY && (
        <p className="mt-2 text-xs text-zinc-500">Mostrando os {SHOW_WITHOUT_QUERY} com mais músicas — use a lupa para achar os outros {available.length - SHOW_WITHOUT_QUERY}.</p>
      )}
    </div>
  );
}
