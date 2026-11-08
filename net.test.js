'use strict';
// Echte server + echte WebSockets: handshake, framing, grote berichten, Origin-controle, statische bestanden.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const { group, ok, eq, sleep } = require('./harness');

const PORT = 3900 + Math.floor(Math.random() * 90);

function get(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const c = { ws, msgs: [], closeCode: null };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onclose = (e) => { c.closeCode = e.code; };
  c.ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.wait = async (pred, ms = 2000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const m = c.msgs.find(pred); if (m) return m; await sleep(15); }
    return null;
  };
  return c;
}

async function run() {
  if (typeof WebSocket === 'undefined') { console.log('\n(netwerktest overgeslagen: Node 22+ nodig voor de ingebouwde WebSocket-client)'); return; }

  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: '127.0.0.1', SPIN_MS: '300', SETTLE_MS: '100', ROULETTE_TEST_RESULTS: '17' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50 && !/draait op/.test(log); i++) await sleep(100);

  try {
    group('HTTP: statische bestanden en beveiliging');
    const idx = await get('/');
    ok(idx.status === 200 && /Roulette Royale/.test(idx.body), 'startpagina wordt geserveerd');
    ok(/default-src 'self'/.test(idx.headers['content-security-policy'] || ''), 'Content-Security-Policy header aanwezig');
    ok(idx.headers['x-content-type-options'] === 'nosniff', 'nosniff header aanwezig');
    eq((await get('/app.js')).status, 200, 'app.js bereikbaar');
    eq((await get('/rules.js')).status, 200, 'rules.js bereikbaar (gedeeld met server)');
    eq((await get('/health')).body.slice(0, 2), 'ok', '/health antwoordt ok');
    eq((await get('/nietbestaand.html')).status, 404, '404 voor onbekende bestanden');
    const trav = await new Promise((res) => {
      const s = net.connect(PORT, '127.0.0.1', () => s.write('GET /../server.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let d = ''; s.on('data', (x) => { d += x; }); s.on('close', () => res(d));
    });
    ok(!/require\('http'\)/.test(trav), 'path traversal (/../server.js) lekt geen broncode');
    const enc = await get('/%2e%2e/server.js');
    ok(enc.status !== 200 || !/require\('http'\)/.test(enc.body), 'gecodeerde path traversal geblokkeerd');

    group('WebSocket: handshake en spel');
    const a = client(); await a.ready;
    a.send({ t: 'create', name: 'Alice' });
    const w = await a.wait((m) => m.t === 'welcome');
    ok(w && /^[A-HJ-NP-Z2-9]{5}$/.test(w.code), `kamer gemaakt via echte WebSocket (${w && w.code})`);
    const b = client(); await b.ready;
    b.send({ t: 'join', code: w.code, name: 'Bob' });
    ok(await b.wait((m) => m.t === 'welcome'), 'tweede speler joint');
    const st = await a.wait((m) => m.t === 'state' && m.players.length === 2);
    ok(st, 'Host ziet 2 spelers in de state');

    a.send({ t: 'settings', settings: { auto: false } });
    a.send({ t: 'start' });
    await a.wait((m) => m.t === 'state' && m.room.phase === 'betting');
    b.send({ t: 'bet', key: 'straight:17', amount: 10 });
    a.send({ t: 'spin' });
    const spin = await b.wait((m) => m.t === 'spin');
    ok(spin && spin.result === 17 && spin.duration === 300, 'spin-bericht met uitslag en duur bij alle spelers');
    const res = await b.wait((m) => m.t === 'result');
    ok(res && res.rows.find((r) => r.name === 'Bob').net === 350, 'uitbetaling via echte WebSocket: +350');

    group('WebSocket: robuustheid');
    const big = client(); await big.ready;
    big.ws.send('x'.repeat(5000));
    await sleep(300);
    ok(big.closeCode === 1009, `te groot bericht sluit de verbinding (code ${big.closeCode})`);

    const bin = client(); await bin.ready;
    bin.ws.send(new Uint8Array([1, 2, 3]));
    await sleep(300);
    ok(bin.closeCode === 1003, `binair bericht wordt geweigerd (code ${bin.closeCode})`);

    // Origin van een andere site: moet geweigerd worden (cross-site WebSocket hijacking)
    const evil = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', Origin: 'http://evil.example',
      } });
      req.on('response', (r) => resolve(r.statusCode));
      req.on('upgrade', () => resolve(101));
      req.on('error', () => resolve(0));
      req.end();
    });
    eq(evil, 403, 'WebSocket vanaf vreemde Origin wordt geweigerd (403)');

    const badPath = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, path: '/andere', headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      } });
      req.on('response', (r) => resolve(r.statusCode));
      req.on('upgrade', () => resolve(101));
      req.on('error', () => resolve(0));
      req.end();
    });
    eq(badPath, 404, 'WebSocket op een onbekend pad wordt geweigerd');

    // Handmatig gefragmenteerd bericht + ping, met een ruwe socket (controleert onze frame-parser)
    const raw = await new Promise((resolve) => {
      const s = net.connect(PORT, '127.0.0.1', () => {
        s.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n');
      });
      let phase = 0; let buf = Buffer.alloc(0);
      const frame = (fin, op, payload) => {
        const mask = Buffer.from([1, 2, 3, 4]);
        const body = Buffer.from(payload).map((x, i) => x ^ mask[i & 3]);
        return Buffer.concat([Buffer.from([(fin ? 0x80 : 0) | op, 0x80 | body.length]), mask, body]);
      };
      s.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        if (phase === 0 && buf.includes('\r\n\r\n')) {
          phase = 1;
          const json = JSON.stringify({ t: 'ping' });
          const mid = 5;
          s.write(frame(false, 1, json.slice(0, mid)));
          setTimeout(() => s.write(frame(true, 0, json.slice(mid))), 50);
        }
        if (phase === 1 && buf.toString().includes('"pong"')) { phase = 2; resolve(true); s.destroy(); }
      });
      setTimeout(() => resolve(false), 2500);
    });
    ok(raw, 'gefragmenteerd bericht (2 frames) wordt correct samengevoegd');

    // Reconnect over een echte verbinding
    const tokenA = w.token;
    a.ws.close();
    await sleep(150);
    const a2 = client(); await a2.ready;
    a2.send({ t: 'resume', code: w.code, token: tokenA });
    const back = await a2.wait((m) => m.t === 'welcome');
    ok(back && back.resumed && back.id === w.id, 'terugkeren met sessie-token via echte WebSocket');
    const st2 = await a2.wait((m) => m.t === 'state');
    ok(st2 && st2.me.host, 'Host is nog steeds Host na terugkeren');
    a2.ws.close(); b.ws.close();
  } finally {
    srv.kill('SIGTERM');
    await sleep(200);
  }
}

module.exports = { run };
