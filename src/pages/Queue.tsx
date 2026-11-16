import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Play, Plus, RotateCcw, Shuffle, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { hasPlayedQualifying } from '../championship/championship';
import { Badge, Button, Chip, Empty, PageHeader, Segmented, useConfirm } from '../components/ui';
import { Avatar } from '../components/visuals';
import { CATEGORIES } from '../data/artists';
import { buildConfig } from '../game/config';
import { useStore } from '../state/AppStore';
import type { ModeId, QueueItem } from '../types';
import { cx, shuffle } from '../utils';
import { champConfig } from './Championship';
import { addPlayer } from './Identify';

const QUEUE_MODES: { value: ModeId; label: string }[] = [
  { value: 'classic', label: 'Clássico' },
  { value: 'lightning', label: 'Relâmpago' },
  { value: 'hardcore', label: 'Hardcore' },
  { value: 'infinite', label: 'Infinito' },
  { value: 'mysterious', label: 'Misterioso' },
];

export function QueuePage() {
  const { data, update, go, toast } = useStore();
  const confirm = useConfirm();
  const [mode, setMode] = useState<ModeId>('classic');
  const [newName, setNewName] = useState('');
  const q = data.queue;
  const champ = q.championshipId ? data.championships.find((c) => c.id === q.championshipId) : undefined;
  const items = q.items.filter((i) => data.players.some((p) => p.id === i.playerId));
  const player = (id: string) => data.players.find((p) => p.id === id)!;
  const next = items.find((i) => !i.played);
  const setItems = (fn: (items: QueueItem[]) => QueueItem[], action?: string) =>
    update((d) => ({ ...d, queue: { ...d.queue, items: fn(d.queue.items) } }), action ? { action } : undefined);

  const add = (id: string) => {
    if (items.some((i) => i.playerId === id)) { toast(`${player(id).name} já está na fila.`, 'info'); return; }
    if (champ && !champ.participantIds.includes(id)) { toast('Este jogador não está inscrito no campeonato.', 'error'); return; }
    setItems((it) => [...it, { playerId: id, played: false }]);
  };
  const addNew = () => {
    const r = addPlayer(data, newName, 'mic');
    if ('error' in r) { toast(r.error, 'error'); return; }
    if (r.created) update((d) => ({ ...d, players: [...d.players, r.player] }), { action: 'Novo participante', details: r.player.name });
    setNewName('');
    if (!items.some((i) => i.playerId === r.player.id)) setItems((it) => [...it, { playerId: r.player.id, played: false }]);
  };
  const move = (idx: number, dir: -1 | 1) => setItems((it) => {
    const a = it.slice();
    const j = idx + dir;
    if (j < 0 || j >= a.length) return a;
    [a[idx], a[j]] = [a[j], a[idx]];
    return a;
  });
  const draw = () => {
    setItems((it) => [...shuffle(it.filter((i) => !i.played)), ...it.filter((i) => i.played)], 'Ordem da fila sorteada');
    toast('Ordem sorteada!', 'success');
  };
  const callNext = () => {
    if (!next) return;
    if (champ) {
      if (hasPlayedQualifying(champ, next.playerId)) {
        setItems((it) => it.map((i) => (i.playerId === next.playerId ? { ...i, played: true } : i)));
        toast(`${player(next.playerId).name} já jogou nesta fase — marcado como concluído.`, 'info');
        return;
      }
      go({ name: 'game', launch: { config: champConfig(champ, 'classificatoria', champ.qualifying.questionIds, data.settings), playerIds: [next.playerId], context: { kind: 'champ-qual', championshipId: champ.id } } });
      return;
    }
    const cats = data.settings.enabledCategories.length < CATEGORIES.length ? data.settings.enabledCategories : [];
    const config = buildConfig(mode, data.settings, { categories: cats, artists: [], extra: 'random' });
    go({ name: 'game', launch: { config, playerIds: [next.playerId], context: { kind: 'queue' } } });
  };
  const clear = async () => {
    if (!(await confirm({ title: 'Limpar a fila?', message: 'Remove todos da fila (nenhum resultado é apagado).', confirmLabel: 'Limpar' }))) return;
    update((d) => ({ ...d, queue: { items: [] } }), { action: 'Fila limpa' });
  };

  return (
    <div>
      <PageHeader
        title="Fila de participantes"
        subtitle="Organize quem joga, sorteie a ordem e chame o próximo. Cada participante joga uma vez por rodada."
        actions={<>
          <Button icon={<Shuffle size={16} />} onClick={draw} disabled={items.filter((i) => !i.played).length < 2}>Sortear ordem</Button>
          <Button icon={<RotateCcw size={16} />} disabled={champ !== undefined || !items.some((i) => i.played)} onClick={() => setItems((it) => it.map((i) => ({ ...i, played: false })), 'Nova rodada da fila')}>Nova rodada</Button>
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={clear} disabled={!items.length}>Limpar</Button>
        </>}
      />
      {champ && (
        <div className="glass mb-6 flex items-center gap-3 border-gold/25 p-4">
          <Trophy className="text-gold" />
          <div className="flex-1 text-sm">Fila da classificatória de <b>{champ.name}</b>. Quem já jogou não pode jogar de novo.</div>
          <Button size="sm" onClick={() => update((d) => ({ ...d, queue: { items: [] } }), { action: 'Fila do campeonato desvinculada' })}>Desvincular</Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {next ? (
              <motion.div key={next.playerId} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="glass relative overflow-hidden p-8 text-center">
                <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />
                <div className="label">Próximo participante</div>
                <div className="mt-4 flex justify-center"><Avatar id={player(next.playerId).avatar} size={96} ring /></div>
                <div className="h-display mt-4 text-4xl">{player(next.playerId).name}</div>
                {!champ && <div className="mt-5 flex justify-center"><Segmented size="sm" value={mode} onChange={setMode} options={QUEUE_MODES} /></div>}
                <Button variant="primary" size="xl" className="mt-6" icon={<Play size={20} fill="currentColor" />} onClick={callNext}>Começar</Button>
              </motion.div>
            ) : (
              <Empty icon={<Users size={28} />} title={items.length ? 'Todos já jogaram' : 'Fila vazia'} text={items.length ? 'Inicie uma nova rodada ou adicione mais participantes.' : 'Adicione participantes abaixo.'} />
            )}
          </AnimatePresence>
          <div className="glass p-6">
            <div className="label mb-3">Adicionar à fila</div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addNew(); }}>
              <input className="input" placeholder="Nome ou apelido" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button type="submit" icon={<Plus size={16} />}>Adicionar</Button>
            </form>
            <div className="mt-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {data.players.filter((p) => !p.archived && !items.some((i) => i.playerId === p.id) && (!champ || champ.participantIds.includes(p.id))).map((p) => (
                <Chip key={p.id} active={false} onClick={() => add(p.id)}>+ {p.name}</Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="glass p-6">
          <div className="label mb-4">Ordem ({items.filter((i) => i.played).length}/{items.length} jogaram)</div>
          {items.length === 0 ? <p className="text-sm text-zinc-500">Ninguém na fila.</p> : (
            <ol className="space-y-1.5">
              {items.map((it, i) => {
                const p = player(it.playerId);
                return (
                  <motion.li layout key={it.playerId} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', next?.playerId === it.playerId ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-white/[0.02]', it.played && 'opacity-50')}>
                    <span className="w-6 text-center text-sm font-bold text-zinc-500">{i + 1}</span>
                    <Avatar id={p.avatar} size={30} />
                    <span className={cx('flex-1 truncate font-medium', it.played && 'line-through')}>{p.name}</span>
                    {it.played ? <Badge tone="green"><Check size={12} /> jogou</Badge> : next?.playerId === it.playerId ? <Badge tone="accent">próximo</Badge> : null}
                    <button className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
                    <button className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-20" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={15} /></button>
                    {!champ && <button className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white" onClick={() => setItems((x) => x.map((y) => (y.playerId === it.playerId ? { ...y, played: !y.played } : y)))} aria-label="Alternar jogou"><Check size={15} /></button>}
                    <button className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-300" onClick={() => setItems((x) => x.filter((y) => y.playerId !== it.playerId))} aria-label="Remover da fila"><Trash2 size={15} /></button>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
