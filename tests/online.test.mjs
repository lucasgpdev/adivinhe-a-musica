// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { pointsFor, Room } from '../server/rooms.mjs';
import { startServer } from '../server/index.mjs';

const q = (i) => ({
  previewUrl: `https://audio.example/${i}.m4a`,
  snippetStart: 0,
  options: [{ id: `a${i}`, title: `Certa ${i}` }, { id: `b${i}`, title: 'Errada' }, { id: `c${i}`, title: 'X' }, { id: `d${i}`, title: 'Y' }],
  answerId: `a${i}`,
  track: { title: `Certa ${i}`, artistName: 'Artista' },
});

/** Relógio e agenda falsos para testar a sala sem esperar. */
function fakeClock() {
  let t = 0;
  let jobs = [];
  return {
    now: () => t,
    schedule: (fn, ms) => { const j = { fn, at: t + ms }; jobs.push(j); return j; },
    cancel: (j) => { jobs = jobs.filter((x) => x !== j); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = jobs.filter((j) => j.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        jobs = jobs.filter((j) => j !== due);
        t = due.at;
        due.fn();
      }
      t = end;
    },
  };
}

describe('sala online (lógica)', () => {
  it('times 2v2: pontos somam por time e a resposta só aparece na revelação', () => {
    const c = fakeClock();
    const r = new Room({ code: 'TEST', ...c });
    ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => { c.advance(1); r.join(id, `Jog ${i}`, 'headphones'); });
    expect(r.hostId).toBe('p1');
    expect(r.snapshot().players.map((p) => p.team)).toEqual(['A', 'B', 'A', 'B']);
    expect(r.settings.timeSec).toBe(20); // padrão novo: música mais longa
    expect(r.settings.explicit).toBe(true);
    r.updateSettings('p1', { timeSec: 15 });
    expect(r.start('p2', [q(1), q(2), q(3)])).toMatch(/dono/);
    expect(r.start('p1', [q(1), q(2), q(3)])).toBeNull();
    expect(r.phase).toBe('countdown');
    expect(JSON.stringify(r.snapshot())).not.toContain('answerId');
    c.advance(3500);
    expect(r.phase).toBe('question');
    c.advance(1000);
    r.answer('p1', 0, 'a1'); // A acerta rápido
    r.answer('p2', 0, 'b1'); // B erra
    r.answer('p3', 0, 'a1');
    expect(r.phase).toBe('question');
    r.answer('p4', 0, 'a1');
    expect(r.phase).toBe('reveal'); // todos responderam
    const s = r.snapshot();
    expect(s.reveal.answerId).toBe('a1');
    expect(s.reveal.results.p2.correct).toBe(false);
    expect(s.teamScores.A).toBe(2 * pointsFor(1000, 15000));
    expect(s.teamScores.B).toBe(pointsFor(1000, 15000));
    c.advance(5500 + 3500 + 15600); // ninguém responde a 2ª
    expect(r.phase).toBe('reveal');
    c.advance(5500 + 3500 + 15600 + 5500);
    expect(r.phase).toBe('finished');
  });

  it('limites: 4 por time, 8 no todos contra todos, mínimo para começar', () => {
    const c = fakeClock();
    const r = new Room({ code: 'T2', ...c });
    r.join('h', 'Host', 'x');
    expect(r.start('h', [q(1), q(2), q(3)])).toMatch(/pelo menos 1/);
    for (let i = 0; i < 7; i++) r.join(`p${i}`, `P${i}`, 'x');
    expect(r.canJoin('extra')).toMatch(/cheia/);
    expect(r.setTeam('h', 'B')).toMatch(/completo/);
    expect(r.updateSettings('h', { format: 'ffa' })).toBeNull();
    expect(r.canJoin('extra')).toMatch(/cheia/); // 8 é o máximo também no FFA
    const r2 = new Room({ code: 'T3', ...c });
    r2.join('h', 'Host', 'x');
    r2.updateSettings('h', { format: 'ffa' });
    expect(r2.start('h', [q(1), q(2), q(3)])).toMatch(/2 jogadores/);
  });

  it('dono que sai passa a sala para o próximo; quem cai no meio pode voltar', () => {
    const c = fakeClock();
    const r = new Room({ code: 'T4', ...c });
    r.join('a', 'Ana', 'x'); c.advance(1); r.join('b', 'Bia', 'x'); c.advance(1); r.join('c', 'Caio', 'x');
    r.start('a', [q(1), q(2), q(3)]);
    r.disconnect('a');
    expect(r.hostId).toBe('b');
    expect(r.players.get('a').connected).toBe(false);
    expect(r.canJoin('a')).toBeNull(); // pode reconectar no meio da partida
    expect(r.canJoin('z')).toMatch(/começou/);
    r.join('a', 'Ana', 'x');
    expect(r.players.get('a').connected).toBe(true);
  });
});

describe('servidor online (WebSocket de verdade)', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(0); });
  afterAll(() => new Promise((ok) => { srv.wss.close(); srv.server.close(ok); }));

  function client(name, id) {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
    const inbox = [];
    const waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      inbox.push(m);
      for (const w of [...waiters]) if (w.test(m)) { waiters.splice(waiters.indexOf(w), 1); w.ok(m); }
    });
    const c = {
      ws,
      send: (m) => ws.send(JSON.stringify(m)),
      wait: (test, ms = 3000) => new Promise((ok, fail) => {
        const hit = inbox.find(test);
        if (hit) { inbox.splice(inbox.indexOf(hit), 1); return ok(hit); }
        const t = setTimeout(() => fail(new Error(`timeout esperando mensagem (${name})`)), ms);
        waiters.push({ test, ok: (m) => { clearTimeout(t); inbox.splice(inbox.indexOf(m), 1); ok(m); } });
      }),
      ready: new Promise((ok) => ws.on('open', ok)).then(() => { c.send({ type: 'hello', name, clientId: id }); return c.wait((m) => m.type === 'hello'); }),
    };
    return c;
  }

  it('cria sala, amigo entra pelo código, troca de time e começa', async () => {
    const host = client('Lucas', 'id-lucas');
    const friend = client('Pedro', 'id-pedro');
    await Promise.all([host.ready, friend.ready]);
    host.send({ type: 'create', settings: { format: 'teams', rounds: 5, timeSec: 10 } });
    const joined = await host.wait((m) => m.type === 'joined');
    expect(joined.code).toMatch(/^[A-Z0-9]{4}$/);

    friend.send({ type: 'join', code: 'ZZZZ' });
    expect((await friend.wait((m) => m.type === 'error')).message).toMatch(/não encontrada/);
    friend.send({ type: 'join', code: joined.code.toLowerCase() });
    await friend.wait((m) => m.type === 'joined');
    const st = await host.wait((m) => m.type === 'state' && m.state.players.length === 2);
    expect(st.state.players.map((p) => [p.name, p.team])).toEqual([['Lucas', 'A'], ['Pedro', 'B']]);
    expect(st.state.settings.timeSec).toBe(10);

    friend.send({ type: 'start', questions: [q(1), q(2), q(3)] });
    expect((await friend.wait((m) => m.type === 'error')).message).toMatch(/dono/);

    host.send({ type: 'start', questions: [q(1), q(2), q(3)] });
    const cd = await friend.wait((m) => m.type === 'state' && m.state.phase === 'countdown');
    expect(cd.state.question.previewUrl).toContain('1.m4a');
    expect(JSON.stringify(cd.state)).not.toContain('answerId');

    // nome inválido
    const bad = client('x', 'id-x');
    await new Promise((ok) => bad.ws.on('open', ok));
    bad.send({ type: 'hello', name: ' ' });
    expect((await bad.wait((m) => m.type === 'error')).message).toMatch(/nome/);
    bad.ws.close();
    host.ws.close();
    friend.ws.close();
  });
});

describe('chat da sala', () => {
  it('time só vê mensagens do próprio time; todos veem as gerais; anti-flood', () => {
    let t = 0;
    const r = new Room({ code: 'CH', now: () => t, schedule: () => null, cancel: () => {} });
    r.join('a', 'Ana', 'x'); t++; r.join('b', 'Bia', 'x'); t++; r.join('c', 'Caio', 'x');
    // a=A, b=B, c=A
    const geral = r.chat('b', '  boa sorte  ', 'all').msg;
    expect(geral.text).toBe('boa sorte');
    const time = r.chat('a', 'vamos ganhar', 'team').msg;
    expect(time.scope).toBe('team');
    expect(r.canSee('c', time)).toBe(true);
    expect(r.canSee('b', time)).toBe(false);
    expect(r.chatFor('b').map((m) => m.text)).toEqual(['boa sorte']);
    expect(r.chatFor('c').map((m) => m.text)).toEqual(['boa sorte', 'vamos ganhar']);
    expect(r.chat('a', 'x'.repeat(500), 'all').msg.text).toHaveLength(200);
    expect(r.chat('a', '   ', 'all').msg).toBeUndefined();
    for (let i = 0; i < 3; i++) r.chat('a', `msg ${i}`, 'all');
    expect(r.chat('a', 'flood', 'all').error).toMatch(/rápido/);
    t += 7000;
    expect(r.chat('a', 'de novo', 'all').msg).toBeTruthy();
    // no todos contra todos, "team" vira mensagem geral
    r.updateSettings('a', { format: 'ffa' });
    expect(r.chat('c', 'ffa', 'team').msg.scope).toBe('all');
  });

  it('filtro de artistas nas configurações', () => {
    const r = new Room({ code: 'AR', now: () => 0, schedule: () => null, cancel: () => {} });
    r.join('a', 'Ana', 'x');
    r.updateSettings('a', { artists: ['mc-tuto', 'mc-tuto', 'dj-arana', 7] });
    expect(r.snapshot().settings.artists).toEqual(['mc-tuto', 'dj-arana']);
  });
});
