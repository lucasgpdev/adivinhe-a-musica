import { motion } from 'framer-motion';
import { ArrowRight, Lock, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, PageHeader } from '../components/ui';
import { Avatar } from '../components/visuals';
import { AVATARS } from '../data/cosmetics';
import { personalStats } from '../ranking/ranking';
import { useStore, type Route } from '../state/AppStore';
import type { AppData, Player } from '../types';
import { cx, fmtNumber, uid } from '../utils';

export const NAME_MAX = 24;

/** Valida e cria (ou reaproveita) um jogador. Retorna o id ou uma mensagem de erro. */
export function addPlayer(
  data: AppData, rawName: string, avatar: string,
): { player: Player; created: boolean } | { error: string } {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'Digite um nome ou apelido.' };
  if (name.length < 2) return { error: 'O nome precisa ter pelo menos 2 caracteres.' };
  if (name.length > NAME_MAX) return { error: `Use no máximo ${NAME_MAX} caracteres.` };
  const existing = data.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return { player: existing, created: false };
  return { player: { id: uid('p'), name, avatar, theme: 'violeta', createdAt: new Date().toISOString() }, created: true };
}

export function IdentifyPage({ then }: { then?: Route }) {
  const { data, update, setCurrentPlayer, go, toast } = useStore();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('headphones');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const players = useMemo(
    () => data.players.filter((p) => !p.archived && p.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [data.players, query],
  );

  const choose = (id: string) => {
    setCurrentPlayer(id);
    go(then ?? { name: 'home' });
  };

  const create = () => {
    const r = addPlayer(data, name, avatar);
    if ('error' in r) { setError(r.error); return; }
    if (r.created) {
      update((d) => ({ ...d, players: [...d.players, r.player], settings: { ...d.settings, lastPlayerId: r.player.id } }), { action: 'Novo participante', details: r.player.name });
      toast(`Bem-vindo(a), ${r.player.name}!`, 'success');
      go(then ?? { name: 'home' });
    } else {
      if (r.player.archived) { setError('Este nome pertence a um participante arquivado. Peça ao professor para restaurá-lo.'); return; }
      toast(`"${r.player.name}" já estava cadastrado — entrando com esse jogador.`, 'info');
      choose(r.player.id);
    }
  };

  const free = AVATARS.filter((a) => !a.unlock);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Quem vai jogar?" subtitle="Digite seu nome ou apelido. Não é preciso e-mail nem senha — os dados ficam só neste computador." />
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-6">
          <div className="label mb-3 flex items-center gap-2"><UserPlus size={14} /> Novo participante</div>
          <form onSubmit={(e) => { e.preventDefault(); create(); }}>
            <input
              className={cx('input text-lg', error && 'border-red-400/60')} placeholder="Nome ou apelido" value={name} maxLength={NAME_MAX + 4}
              onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus aria-label="Nome ou apelido"
            />
            {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
            <div className="label mb-2 mt-5">Avatar</div>
            <div className="flex flex-wrap gap-2">
              {free.map((a) => (
                <button type="button" key={a.id} onClick={() => setAvatar(a.id)} className={cx('rounded-full p-0.5 transition', avatar === a.id ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100')}>
                  <Avatar id={a.id} size={44} />
                </button>
              ))}
              {AVATARS.filter((a) => a.unlock).slice(0, 3).map((a) => (
                <span key={a.id} title="Desbloqueie com conquistas" className="relative rounded-full p-0.5 opacity-25">
                  <Avatar id={a.id} size={44} /><Lock size={14} className="absolute bottom-0 right-0" />
                </span>
              ))}
            </div>
            <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" icon={<ArrowRight size={18} />}>Continuar</Button>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass flex max-h-[520px] flex-col p-6">
          <div className="label mb-3">Jogadores cadastrados ({data.players.filter((p) => !p.archived).length})</div>
          {data.players.length > 6 && (
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-3.5 text-zinc-500" />
              <input className="input pl-9" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          <div className="-mx-2 flex-1 space-y-1 overflow-y-auto px-2">
            {players.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">Nenhum jogador ainda. Seja o primeiro!</p>}
            {players.map((p) => {
              const st = personalStats(p.id, data.matches);
              return (
                <button key={p.id} onClick={() => choose(p.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]">
                  <Avatar id={p.avatar} size={36} />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-500">{st.matches} partidas · recorde {fmtNumber(st.best)}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
