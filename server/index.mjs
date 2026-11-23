/**
 * Servidor do jogo: entrega o site (pasta dist) e o modo online (WebSocket em /ws).
 *   PORT=3000 node server/index.mjs
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { WebSocketServer } from 'ws';
import { cleanName, Lobby } from './rooms.mjs';

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('Site ainda não foi gerado (rode npm run build).');
    return;
  }
  const ext = extname(file);
  const headers = {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=3600',
  };
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && (ext === '.html' || ext === '.json' || ext === '.js');
  if (gzip) headers['content-encoding'] = 'gzip';
  res.writeHead(200, headers);
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
}

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const lobby = new Lobby();
  const server = createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
  /** @type {Map<string, Set<import('ws').WebSocket>>} sockets por sala */
  const members = new Map();

  const send = (ws, msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const broadcast = (room) => {
    const state = room.snapshot();
    for (const ws of members.get(room.code) ?? []) send(ws, { type: 'state', state });
  };

  wss.on('connection', (ws) => {
    /** @type {{id:string|null, name:string|null, avatar:string, room:any}} */
    const me = { id: null, name: null, avatar: 'headphones', room: null };
    ws.me = me;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const leaveRoom = (hard) => {
      if (!me.room) return;
      members.get(me.room.code)?.delete(ws);
      if (hard) me.room.leave(me.id);
      else me.room.disconnect(me.id);
      me.room = null;
    };
    const enter = (room) => {
      const err = room.canJoin(me.id);
      if (err) return send(ws, { type: 'error', message: err });
      leaveRoom(true);
      me.room = room;
      if (!members.has(room.code)) members.set(room.code, new Set());
      // derruba conexões antigas do mesmo jogador (outra aba / reconexão)
      for (const other of [...members.get(room.code)]) {
        if (other.me?.id !== me.id || other === ws) continue;
        members.get(room.code).delete(other);
        other.me.room = null; // a conexão antiga não deve tirar o jogador da sala ao fechar
        other.close(4000, 'Conectado em outra aba');
      }
      members.get(room.code).add(ws);
      send(ws, { type: 'joined', code: room.code, you: me.id });
      room.join(me.id, me.name, me.avatar);
    };

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m.type !== 'string') return;
      if (m.type === 'ping') return send(ws, { type: 'pong', t: m.t });
      if (m.type === 'hello') {
        const name = cleanName(m.name);
        if (!name) return send(ws, { type: 'error', message: 'Digite um nome com pelo menos 2 letras.' });
        me.id = String(m.clientId ?? '').slice(0, 64) || `c${Math.random().toString(36).slice(2)}`;
        me.name = name;
        me.avatar = String(m.avatar ?? 'headphones').slice(0, 40);
        return send(ws, { type: 'hello', you: me.id });
      }
      if (!me.id) return send(ws, { type: 'error', message: 'Digite seu nome primeiro.' });
      const room = me.room;
      let err = null;
      switch (m.type) {
        case 'create': {
          const r = lobby.create(broadcast);
          enter(r);
          if (m.settings) r.updateSettings(me.id, m.settings);
          return;
        }
        case 'join': {
          const r = lobby.get(m.code);
          if (!r) return send(ws, { type: 'error', message: 'Sala não encontrada. Confira o código.' });
          return enter(r);
        }
        case 'leave':
          leaveRoom(true);
          return send(ws, { type: 'left' });
        case 'team': err = room?.setTeam(me.id, m.team); break;
        case 'settings': err = room?.updateSettings(me.id, m.settings); break;
        case 'start': err = room?.start(me.id, m.questions); break;
        case 'answer': room?.answer(me.id, m.round, m.optionId); break;
        case 'lobby': room?.backToLobby(me.id); break;
        default: break;
      }
      if (err) send(ws, { type: 'error', message: err });
    });

    ws.on('close', () => leaveRoom(false));
  });

  // mantém conexões vivas (o Render derruba conexões ociosas) e limpa salas vazias
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
    lobby.sweep();
  }, 25000);
  wss.on('close', () => clearInterval(interval));

  return new Promise((ok) => server.listen(port, () => ok({ server, wss, lobby, port: server.address().port })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(({ port }) => console.log(`Adivinhe a Música rodando na porta ${port}`));
}
