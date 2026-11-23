import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { computePlayerStats, evaluateAchievements } from '../achievements/achievements';
import { setSfxEnabled } from '../audio/sfx';
import { THEME_BY_ID } from '../data/cosmetics';
import type { SessionConfig, Session } from '../game/session';
import { toMatchRecords } from '../game/session';
import { previousBest, topPlayerId } from '../ranking/ranking';
import { EMPTY_CATALOG, usableTracks } from '../services/catalog';
import { createBackup, loadCatalog, loadData, requestPersistence, saveCatalog, saveData } from '../storage/db';
import type { AppData, Catalog, CategoryId, MatchRecord, ModeId, Player, Track } from '../types';
import { migrate } from './defaults';

// ─── Rotas ───────────────────────────────────────────────────

export type LaunchContext =
  | { kind: 'normal' }
  | { kind: 'queue' }
  | { kind: 'champ-qual'; championshipId: string }
  | { kind: 'champ-bout'; championshipId: string; boutId: string };

export interface GameLaunch {
  config: SessionConfig;
  playerIds: string[];
  context: LaunchContext;
}

export interface GameResultInfo {
  records: MatchRecord[];
  launch: GameLaunch;
  reason: Session['finishedReason'];
  newAchievements: Record<string, string[]>;
  newRecord: Record<string, boolean>;
  championshipNote?: string;
}

export type Route =
  | { name: 'home' }
  | { name: 'identify'; then?: Route }
  | { name: 'setup'; mode: ModeId; playerIds?: string[]; context?: LaunchContext; category?: CategoryId }
  | { name: 'game'; launch: GameLaunch }
  | { name: 'result'; result: GameResultInfo }
  | { name: 'ranking' }
  | { name: 'hall' }
  | { name: 'online'; code?: string }
  | { name: 'achievements' }
  | { name: 'profile' };


export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error' | 'achievement';
  achievementId?: string;
}

interface Store {
  ready: boolean;
  data: AppData;
  catalog: Catalog;
  tracks: Track[];
  route: Route;
  routeId: number;
  go: (r: Route) => void;
  update: (fn: (d: AppData) => AppData, audit?: { action: string; details?: string }) => void;
  updateCatalog: (fn: (c: Catalog) => Catalog) => void;
  /** Catálogo mais recente (evita usar uma cópia desatualizada em operações assíncronas). */
  getCatalog: () => Catalog;
  currentPlayer: Player | null;
  setCurrentPlayer: (id: string | null) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind'], achievementId?: string) => void;
  dismissToast: (id: number) => void;
  backup: (reason: string) => Promise<void>;
  finishGame: (session: Session, launch: GameLaunch) => GameResultInfo;
  replaceAll: (d: AppData, reason: string) => Promise<void>;
  /** Situação do catálogo baixado do servidor. */
  catalogStatus: 'loading' | 'ready' | 'unavailable';
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store ausente');
  return s;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(() => migrate(undefined));
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [route, setRoute] = useState<Route>(() => {
    // link de convite: ...?sala=K7Q2
    try {
      const code = new URLSearchParams(location.search).get('sala');
      if (code) return { name: 'online', code: code.toUpperCase().slice(0, 4) };
    } catch { /* ignore */ }
    return { name: 'home' };
  });
  const [catalogStatus, setCatalogStatus] = useState<Store['catalogStatus']>('loading');
  const [routeId, setRouteId] = useState(0);
  const go = useCallback((r: Route) => {
    setRoute(r);
    setRouteId((i) => i + 1);
    window.scrollTo({ top: 0 });
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dataRef = useRef(data);
  const catRef = useRef(catalog);
  const toastId = useRef(0);

  useEffect(() => {
    (async () => {
      const [d, c] = await Promise.all([loadData(), loadCatalog()]);
      const m = migrate(d);
      dataRef.current = m;
      setData(m);
      if (c) {
        const cc = { ...EMPTY_CATALOG, ...c };
        catRef.current = cc;
        setCatalog(cc);
      }
      void requestPersistence();
      setReady(true);
      // Catálogo pronto gerado no servidor (substitui o painel do professor)
      try {
        const res = await fetch('./catalog.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        const remote = (await res.json()) as Catalog;
        const local = catRef.current;
        if (remote.tracks?.length && (!local.syncedAt || !local.tracks.length || (remote.syncedAt ?? '') > local.syncedAt)) {
          const next = { ...EMPTY_CATALOG, ...remote, excluded: local.excluded, failures: {} };
          catRef.current = next;
          setCatalog(next);
          void saveCatalog(next);
        }
        setCatalogStatus('ready');
      } catch {
        setCatalogStatus(catRef.current.tracks.length ? 'ready' : 'unavailable');
      }
    })();
  }, []);

  const persist = useCallback((d: AppData) => {
    dataRef.current = d;
    setData(d);
    saveData(d).catch(() => {
      setToasts((t) => [...t, { id: ++toastId.current, text: 'Falha ao salvar os dados localmente.', kind: 'error' }]);
    });
  }, []);

  const update = useCallback<Store['update']>((fn, audit) => {
    let next = fn(dataRef.current);
    if (audit) next = { ...next, audit: [...next.audit, { at: new Date().toISOString(), ...audit }].slice(-500) };
    persist(next);
  }, [persist]);

  const updateCatalog = useCallback((fn: (c: Catalog) => Catalog) => {
    const next = fn(catRef.current);
    catRef.current = next;
    setCatalog(next);
    void saveCatalog(next);
  }, []);

  const getCatalog = useCallback(() => catRef.current, []);

  const toast = useCallback<Store['toast']>((text, kind = 'info', achievementId) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind, achievementId }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'achievement' ? 5200 : 3800);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const backup = useCallback(async (reason: string) => {
    await createBackup(reason, dataRef.current);
  }, []);

  const replaceAll = useCallback(async (d: AppData, reason: string) => {
    await createBackup(`Antes de: ${reason}`, dataRef.current);
    persist(migrate(d));
  }, [persist]);

  const currentPlayer = useMemo(
    () => data.players.find((p) => p.id === data.settings.lastPlayerId && !p.archived) ?? null,
    [data.players, data.settings.lastPlayerId],
  );

  const setCurrentPlayer = useCallback((id: string | null) => {
    update((d) => ({ ...d, settings: { ...d.settings, lastPlayerId: id } }));
  }, [update]);

  const tracks = useMemo(() => usableTracks(catalog), [catalog]);

  // Tema visual do jogador atual + efeitos sonoros
  useEffect(() => {
    const t = THEME_BY_ID[currentPlayer?.theme ?? 'violeta'] ?? THEME_BY_ID.violeta;
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-soft', t.soft);
    r.setProperty('--accent-deep', t.deep);
  }, [currentPlayer?.theme]);
  useEffect(() => setSfxEnabled(data.settings.sfx), [data.settings.sfx]);
  useEffect(() => {
    document.documentElement.classList.toggle('presenter', data.settings.presenter);
    document.documentElement.classList.toggle('no-fx', !data.settings.effects);
  }, [data.settings.presenter, data.settings.effects]);

  /** Registra o fim de uma partida: histórico, campeonato, fila, conquistas. */
  const finishGame = useCallback<Store['finishGame']>((session, launch) => {
    const d0 = dataRef.current;
    const records = toMatchRecords(session);
    const newRecord: Record<string, boolean> = {};
    for (const r of records) {
      const prev = previousBest(r.playerId, r.mode, d0.matches);
      newRecord[r.playerId] = r.ranked && r.score > 0 && r.score > prev && d0.matches.some((m) => m.playerId === r.playerId && m.mode === r.mode);
    }
    let d: AppData = { ...d0, matches: [...d0.matches, ...records] };

    // Conquistas
    const top = topPlayerId(d.matches, d.players);
    const newAchievements: Record<string, string[]> = {};
    const unlocks = [...d.achievements];
    for (const r of records) {
      const stats = computePlayerStats(r.playerId, d.matches, d.championships, top);
      const fresh = evaluateAchievements(r.playerId, stats, unlocks);
      newAchievements[r.playerId] = fresh;
      for (const a of fresh) unlocks.push({ playerId: r.playerId, achievementId: a, unlockedAt: new Date().toISOString() });
    }
    d = { ...d, achievements: unlocks };
    persist(d);
    return { records, launch, reason: session.finishedReason, newAchievements, newRecord };
  }, [persist]);

  const value: Store = {
    ready, data, catalog, tracks, route, routeId, go, update, updateCatalog, getCatalog, currentPlayer, setCurrentPlayer,
    toasts, toast, dismissToast, backup, finishGame, replaceAll, catalogStatus,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
