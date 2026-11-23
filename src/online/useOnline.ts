import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategoryId } from '../types';
import type { OnlineQuestion } from './questions';

export type Format = 'teams' | 'ffa';
export type Team = 'A' | 'B';

export interface RoomSettings {
  format: Format;
  categories: CategoryId[];
  rounds: number;
  timeSec: number;
}

export interface OnlinePlayer {
  id: string;
  name: string;
  avatar: string;
  team: Team;
  connected: boolean;
  score: number;
  correct: number;
  bestStreak: number;
}

export interface RevealInfo {
  round: number;
  answerId: string;
  track: OnlineQuestion['track'];
  results: Record<string, { optionId: string | null; correct: boolean; points: number; timeMs: number | null }>;
}

export interface RoomState {
  code: string;
  hostId: string | null;
  settings: RoomSettings;
  phase: 'lobby' | 'countdown' | 'question' | 'reveal' | 'finished';
  round: number;
  totalRounds: number;
  remainingMs: number;
  players: OnlinePlayer[];
  teamScores: Record<Team, number>;
  answered: string[];
  question: { previewUrl: string; snippetStart: number; options: { id: string; title: string }[] } | null;
  reveal: RevealInfo | null;
}

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

const ID_KEY = 'adm:online-id';
const PROFILE_KEY = 'adm:online-profile';
const ROOM_KEY = 'adm:online-room';

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function onlineClientId(): string {
  const s = storage();
  let id = s?.getItem(ID_KEY) ?? null;
  if (!id) {
    id = `c${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    s?.setItem(ID_KEY, id);
  }
  return id;
}

export function loadProfile(): { name: string; avatar: string } | null {
  try { return JSON.parse(storage()?.getItem(PROFILE_KEY) ?? 'null'); } catch { return null; }
}
export function saveProfile(p: { name: string; avatar: string }): void {
  storage()?.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function onlineAvailable(): boolean {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

/**
 * Conexão com o servidor do modo online. Reconecta sozinha e volta para a
 * mesma sala se a internet cair ou a página for recarregada.
 */
export function useOnline(profile: { name: string; avatar: string } | null) {
  const [status, setStatus] = useState<ConnStatus>('idle');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const queue = useRef<object[]>([]);
  const ready = useRef(false);
  const closing = useRef(false);
  const retries = useRef(0);
  const rejoining = useRef(false);
  const profRef = useRef(profile);
  profRef.current = profile;
  const meId = useRef(onlineClientId());

  const rawSend = (m: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && ready.current) ws.send(JSON.stringify(m));
    else queue.current.push(m);
  };

  const connect = useCallback(() => {
    const p = profRef.current;
    if (!p || !onlineAvailable()) return;
    closing.current = false;
    setStatus(retries.current ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ready.current = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', name: p.name, avatar: p.avatar, clientId: meId.current }));
    ws.onmessage = (ev) => {
      let m: { type: string; [k: string]: unknown };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      switch (m.type) {
        case 'hello': {
          ready.current = true;
          retries.current = 0;
          setStatus('online');
          const saved = storage()?.getItem(ROOM_KEY);
          if (saved && !queue.current.some((x) => 'type' in x && ((x as { type: string }).type === 'join' || (x as { type: string }).type === 'create'))) {
            rejoining.current = true;
            ws.send(JSON.stringify({ type: 'join', code: saved }));
          }
          for (const q of queue.current.splice(0)) ws.send(JSON.stringify(q));
          break;
        }
        case 'joined':
          storage()?.setItem(ROOM_KEY, String(m.code));
          rejoining.current = false;
          setError(null);
          break;
        case 'state':
          setRoom(m.state as RoomState);
          setReceivedAt(Date.now());
          break;
        case 'left':
          storage()?.removeItem(ROOM_KEY);
          setRoom(null);
          break;
        case 'error': {
          // sala antiga não existe mais (servidor reiniciou): esquece em silêncio
          if (rejoining.current) {
            rejoining.current = false;
            storage()?.removeItem(ROOM_KEY);
            setRoom(null);
            break;
          }
          setError(String(m.message));
          break;
        }
      }
    };
    ws.onclose = (ev) => {
      if (wsRef.current !== ws) return; // conexão antiga substituída
      ready.current = false;
      if (closing.current) { setStatus('idle'); return; }
      if (ev.code === 4000) { setStatus('offline'); setError('Você abriu o jogo em outra aba. Continue por lá.'); return; }
      retries.current++;
      setStatus('reconnecting');
      setTimeout(connect, Math.min(8000, 800 * retries.current));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile && !wsRef.current) connect();
  }, [profile, connect]);

  useEffect(() => () => {
    closing.current = true;
    wsRef.current?.close();
  }, []);

  const send = useCallback((m: object) => { setError(null); rawSend(m); }, []);

  return {
    status,
    room,
    receivedAt,
    error,
    clearError: () => setError(null),
    me: meId.current,
    create: (settings: RoomSettings) => send({ type: 'create', settings }),
    join: (code: string) => send({ type: 'join', code: code.trim().toUpperCase() }),
    leave: () => { storage()?.removeItem(ROOM_KEY); send({ type: 'leave' }); setRoom(null); },
    setTeam: (team: Team) => send({ type: 'team', team }),
    updateSettings: (settings: Partial<RoomSettings>) => send({ type: 'settings', settings }),
    start: (questions: OnlineQuestion[]) => send({ type: 'start', questions }),
    answer: (round: number, optionId: string) => send({ type: 'answer', round, optionId }),
    backToLobby: () => send({ type: 'lobby' }),
    /** Atualiza nome/avatar: reconecta com o novo perfil. */
    reconnect: () => { closing.current = true; wsRef.current?.close(); wsRef.current = null; retries.current = 0; setTimeout(connect, 50); },
  };
}
