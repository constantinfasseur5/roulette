'use strict';
/*
 * Multiplayer Roulette — server
 * Geen externe pakketten nodig: alleen Node.js (versie 18 of nieuwer).
 *   npm start      (of: node server.js)
 * Omgevingsvariabelen: PORT (3000), HOST (0.0.0.0), ALLOWED_ORIGINS (komma-gescheiden, optioneel)
 * Alleen VIRTUELE fiches. Geen echt geld.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { attach } = require('./lib/ws');
const { Game } = require('./lib/game');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_CONN_PER_IP = 60;

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

// Tijden zijn aan te passen via omgevingsvariabelen (handig voor tests).
const gameOpts = {};
if (process.env.SPIN_MS) gameOpts.spinMs = num(process.env.SPIN_MS, 7500);
if (process.env.SETTLE_MS) gameOpts.settleMs = num(process.env.SETTLE_MS, 700);
if (process.env.CLOSED_DELAY_MS) gameOpts.closedDelayMs = num(process.env.CLOSED_DELAY_MS, 1500);
if (process.env.RESULT_PAUSE_MS) gameOpts.resultPauseMs = num(process.env.RESULT_PAUSE_MS, 9000);
if (process.env.RECONNECT_MS) gameOpts.reconnectMs = num(process.env.RECONNECT_MS, 120000);
if (process.env.HOST_GRACE_MS) gameOpts.hostGraceMs = num(process.env.HOST_GRACE_MS, 60000);
if (process.env.EMPTY_ROOM_MS) gameOpts.emptyRoomMs = num(process.env.EMPTY_ROOM_MS, 600000);
if (process.env.BET_TIME_MIN) gameOpts.betTimeMin = num(process.env.BET_TIME_MIN, 15);

// Alleen voor de testsuite: vaste uitslagen, bv. ROULETTE_TEST_RESULTS="17,0,37".
// Zonder deze variabele wordt altijd crypto.randomInt gebruikt.
if (process.env.ROULETTE_TEST_RESULTS) {
  const queue = process.env.ROULETTE_TEST_RESULTS.split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
  const original = require('./lib/game').DEFAULTS.nextResult;
  gameOpts.nextResult = (variant) => (queue.length ? queue.shift() : original(variant));
}

const game = new Game(gameOpts);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (pathname.includes('\0')) { res.writeHead(400); return res.end('Bad request'); }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`ok rooms=${game.rooms.size}`);
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Niet gevonden');
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, Object.assign({
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    }, SECURITY_HEADERS));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

const perIp = new Map();
const wss = attach(server, {
  path: '/ws',
  maxPayload: 4096,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()),
  onConnection(conn, req) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    conn.ip = fwd || req.socket.remoteAddress || '?';
    const n = (perIp.get(conn.ip) || 0) + 1;
    if (n > MAX_CONN_PER_IP) return false;
    perIp.set(conn.ip, n);

    conn.on('message', (raw) => {
      try { game.handle(conn, raw); } catch (e) { console.error('handle error:', e); }
    });
    conn.on('close', () => {
      const left = (perIp.get(conn.ip) || 1) - 1;
      if (left <= 0) perIp.delete(conn.ip); else perIp.set(conn.ip, left);
      try { game.onClose(conn); } catch (e) { console.error('close error:', e); }
    });
  },
});

server.listen(PORT, HOST, () => {
  console.log(`Roulette draait op http://localhost:${PORT}  (alleen virtuele fiches)`);
});

function shutdown() {
  console.log('Afsluiten...');
  game.shutdown();
  wss.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server, game };
