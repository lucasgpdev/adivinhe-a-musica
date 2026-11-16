/** Exportação e importação de dados em JSON, com validação e mesclagem segura. */
import type { AppData, MatchRecord, Player } from '../types';

export const EXPORT_APP_ID = 'adivinhe-a-musica';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  exportVersion: number;
  schemaVersion: number;
  exportedAt: string;
  data: Pick<AppData, 'players' | 'matches' | 'achievements' | 'championships' | 'audit'>;
}

export function buildExport(data: AppData): ExportFile {
  return {
    app: EXPORT_APP_ID,
    exportVersion: EXPORT_VERSION,
    schemaVersion: data.schemaVersion,
    exportedAt: new Date().toISOString(),
    data: {
      players: data.players,
      matches: data.matches,
      achievements: data.achievements,
      championships: data.championships,
      audit: data.audit,
    },
  };
}

export interface ImportReport {
  ok: boolean;
  errors: string[];
  conflicts: string[];
  added: { players: number; matches: number; achievements: number; championships: number };
  skippedDuplicates: number;
  merged?: AppData;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function validPlayer(p: unknown): p is Player {
  return isObj(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim().length > 0;
}

function validMatch(m: unknown): m is MatchRecord {
  return (
    isObj(m) &&
    typeof m.id === 'string' &&
    typeof m.playerId === 'string' &&
    typeof m.score === 'number' && m.score >= 0 && Number.isFinite(m.score) &&
    typeof m.correct === 'number' &&
    typeof m.total === 'number' &&
    typeof m.mode === 'string' &&
    typeof m.endedAt === 'string' &&
    Array.isArray(m.answers)
  );
}

/**
 * Valida e mescla um arquivo importado nos dados atuais.
 * - Nunca apaga nem altera resultados existentes.
 * - Ignora registros com o mesmo id (duplicados).
 * - Jogadores com mesmo nome e id diferente: são unificados quando `mergeSameName` é true;
 *   caso contrário, o importado recebe o sufixo "(importado)". Em ambos os casos é informado.
 */
export function mergeImport(current: AppData, raw: unknown, mergeSameName: boolean): ImportReport {
  const rep: ImportReport = {
    ok: false, errors: [], conflicts: [], skippedDuplicates: 0,
    added: { players: 0, matches: 0, achievements: 0, championships: 0 },
  };
  if (!isObj(raw)) {
    rep.errors.push('O arquivo não contém um objeto JSON válido.');
    return rep;
  }
  if (raw.app !== EXPORT_APP_ID) rep.errors.push('Este arquivo não foi exportado pelo Adivinhe a Música.');
  if (typeof raw.exportVersion !== 'number' || raw.exportVersion > EXPORT_VERSION)
    rep.errors.push(`Versão de exportação incompatível (${String(raw.exportVersion)}). Versão suportada: ${EXPORT_VERSION}.`);
  const d = raw.data;
  if (!isObj(d)) rep.errors.push('Estrutura "data" ausente.');
  if (rep.errors.length) return rep;
  const data = d as Record<string, unknown>;
  for (const k of ['players', 'matches', 'achievements', 'championships']) {
    if (!Array.isArray(data[k])) rep.errors.push(`Campo "${k}" ausente ou inválido.`);
  }
  if (rep.errors.length) return rep;

  const merged: AppData = JSON.parse(JSON.stringify(current));
  const idMap = new Map<string, string>(); // id importado → id final

  const byId = new Map(merged.players.map((p) => [p.id, p]));
  const byName = new Map(merged.players.map((p) => [p.name.trim().toLowerCase(), p]));
  let invalid = 0;
  for (const p of data.players as unknown[]) {
    if (!validPlayer(p)) { invalid++; continue; }
    if (byId.has(p.id)) { idMap.set(p.id, p.id); rep.skippedDuplicates++; continue; }
    const same = byName.get(p.name.trim().toLowerCase());
    if (same) {
      if (mergeSameName) {
        idMap.set(p.id, same.id);
        rep.conflicts.push(`"${p.name}" já existia — resultados unificados no jogador existente.`);
        continue;
      }
      const renamed: Player = { ...p, name: `${p.name} (importado)` };
      rep.conflicts.push(`"${p.name}" já existia — importado como "${renamed.name}".`);
      merged.players.push(renamed);
      byId.set(renamed.id, renamed);
      idMap.set(p.id, p.id);
      rep.added.players++;
      continue;
    }
    const np: Player = { ...p, avatar: p.avatar ?? 'headphones', theme: p.theme ?? 'violeta', createdAt: p.createdAt ?? new Date().toISOString() };
    merged.players.push(np);
    byId.set(np.id, np);
    byName.set(np.name.trim().toLowerCase(), np);
    idMap.set(p.id, p.id);
    rep.added.players++;
  }

  const matchIds = new Set(merged.matches.map((m) => m.id));
  for (const m of data.matches as unknown[]) {
    if (!validMatch(m)) { invalid++; continue; }
    if (matchIds.has(m.id)) { rep.skippedDuplicates++; continue; }
    const pid = idMap.get(m.playerId);
    if (!pid) { invalid++; continue; }
    merged.matches.push({ ...m, playerId: pid });
    matchIds.add(m.id);
    rep.added.matches++;
  }

  const achKeys = new Set(merged.achievements.map((a) => `${a.playerId}|${a.achievementId}`));
  for (const a of data.achievements as unknown[]) {
    if (!isObj(a) || typeof a.playerId !== 'string' || typeof a.achievementId !== 'string') { invalid++; continue; }
    const pid = idMap.get(a.playerId);
    if (!pid) continue;
    const key = `${pid}|${a.achievementId}`;
    if (achKeys.has(key)) { rep.skippedDuplicates++; continue; }
    merged.achievements.push({ playerId: pid, achievementId: a.achievementId, unlockedAt: String(a.unlockedAt ?? new Date().toISOString()) });
    achKeys.add(key);
    rep.added.achievements++;
  }

  const chIds = new Set(merged.championships.map((c) => c.id));
  for (const c of data.championships as unknown[]) {
    if (!isObj(c) || typeof c.id !== 'string' || !Array.isArray(c.participantIds)) { invalid++; continue; }
    if (chIds.has(c.id)) { rep.skippedDuplicates++; continue; }
    const remap = (id: unknown) => (typeof id === 'string' ? idMap.get(id) ?? id : id);
    const copy = JSON.parse(JSON.stringify(c));
    copy.participantIds = copy.participantIds.map(remap);
    if (copy.podium) for (const k of ['first', 'second', 'third']) if (copy.podium[k]) copy.podium[k] = remap(copy.podium[k]);
    merged.championships.push(copy);
    chIds.add(c.id);
    rep.added.championships++;
  }

  if (invalid) rep.conflicts.push(`${invalid} registro(s) inválido(s) foram ignorados.`);
  merged.audit = [
    ...merged.audit,
    {
      at: new Date().toISOString(),
      action: 'Importação de dados',
      details: `+${rep.added.players} jogadores, +${rep.added.matches} partidas, +${rep.added.championships} campeonatos, ${rep.skippedDuplicates} duplicados ignorados`,
    },
  ];
  rep.ok = true;
  rep.merged = merged;
  return rep;
}
