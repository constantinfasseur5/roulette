'use strict';
/*
 * Minimale WebSocket-server (RFC 6455) zonder externe pakketten.
 * Ondersteunt: tekstberichten, fragmentatie, ping/pong, close, maximale berichtgrootte,
 * Origin-controle en een heartbeat die dode verbindingen opruimt.
 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WSConn extends EventEmitter {
  constructor(socket, maxPayload) {
    super();
    this.socket = socket;
    this.maxPayload = maxPayload;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.fragOp = 0;
    this.fragLen = 0;
    this.alive = true;
    this.closing = false;
    this.closedEmitted = false;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._emitClose());
    socket.on('end', () => socket.end());
    socket.on('error', () => this._emitClose());
  }

  get open() {
    return !this.closing && !this.socket.destroyed && this.socket.writable;
  }

  send(text) {
    if (!this.open) return;
    this._frame(0x1, Buffer.from(String(text), 'utf8'));
  }

  ping() {
    if (this.open) this._frame(0x9, Buffer.alloc(0));
  }

  close(code = 1000, reason = '') {
    if (this.closing) return;
    this.closing = true;
    try {
      const r = Buffer.from(String(reason).slice(0, 100), 'utf8');
      const payload = Buffer.alloc(2 + r.length);
      payload.writeUInt16BE(code, 0);
      r.copy(payload, 2);
      this._frame(0x8, payload, true);
      this.socket.end();
    } catch (e) { /* al weg */ }
    const t = setTimeout(() => this.terminate(), 2000);
    t.unref();
  }

  terminate() {
    this.closing = true;
    try { this.socket.destroy(); } catch (e) { /* niets */ }
    this._emitClose();
  }

  _emitClose() {
    if (this.closedEmitted) return;
    this.closedEmitted = true;
    this.closing = true;
    this.emit('close');
  }

  _frame(opcode, payload, force) {
    if (!force && !this.open) return;
    if (this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }
    this.socket.write(len ? Buffer.concat([header, payload]) : header);
  }

  _fail(code, reason) {
    this.close(code, reason || 'protocol error');
    this.buf = Buffer.alloc(0);
  }

  _onData(chunk) {
    if (this.closing) return;
    this.alive = true;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;

    while (!this.closing) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const rsv = b[0] & 0x70;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;

      if (rsv) return this._fail(1002, 'rsv bits');
      if (!masked) return this._fail(1002, 'unmasked frame');

      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        if (b.readUInt32BE(2) !== 0) return this._fail(1009, 'too big');
        len = b.readUInt32BE(6);
        off = 10;
      }
      if (len > this.maxPayload) return this._fail(1009, 'message too big');
      if (b.length < off + 4 + len) return; // wachten op de rest

      const mask = b.subarray(off, off + 4);
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = b[off + 4 + i] ^ mask[i & 3];
      this.buf = b.subarray(off + 4 + len);

      this._onFrame(fin, opcode, payload);
    }
  }

  _onFrame(fin, opcode, payload) {
    if (opcode >= 0x8) { // controleframes
      if (!fin || payload.length > 125) return this._fail(1002, 'bad control frame');
      if (opcode === 0x8) {
        const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
        return this.close(code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000);
      }
      if (opcode === 0x9) return this._frame(0xa, payload);
      if (opcode === 0xa) return; // pong: alive is al gezet
      return this._fail(1002, 'unknown opcode');
    }

    if (opcode === 0x0) { // vervolg van een gefragmenteerd bericht
      if (!this.fragOp) return this._fail(1002, 'unexpected continuation');
      this.fragLen += payload.length;
      if (this.fragLen > this.maxPayload) return this._fail(1009, 'message too big');
      this.frags.push(payload);
      if (fin) {
        const full = Buffer.concat(this.frags);
        const op = this.fragOp;
        this.frags = [];
        this.fragOp = 0;
        this.fragLen = 0;
        this._deliver(op, full);
      }
      return;
    }

    if (opcode === 0x1 || opcode === 0x2) {
      if (this.fragOp) return this._fail(1002, 'expected continuation');
      if (fin) return this._deliver(opcode, payload);
      this.fragOp = opcode;
      this.frags = [payload];
      this.fragLen = payload.length;
      return;
    }
    this._fail(1002, 'unknown opcode');
  }

  _deliver(opcode, buf) {
    if (opcode === 0x2) return this.close(1003, 'binary not supported');
    this.emit('message', buf.toString('utf8'));
  }
}

/**
 * Hang een WebSocket-endpoint aan een bestaande http-server.
 * opts: { path, maxPayload, allowedOrigins:[], onConnection(conn, req) -> false om te weigeren }
 */
function attach(server, opts) {
  const path = opts.path || '/ws';
  const maxPayload = opts.maxPayload || 4096;
  const allowed = (opts.allowedOrigins || []).filter(Boolean);
  const conns = new Set();

  server.on('upgrade', (req, socket, head) => {
    const reject = (status, text) => {
      try { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch (e) { /* weg */ }
      socket.destroy();
    };

    let pathname = '';
    try { pathname = new URL(req.url, 'http://x').pathname; } catch (e) { return reject(400, 'Bad Request'); }
    if (pathname !== path) return reject(404, 'Not Found');

    const key = req.headers['sec-websocket-key'];
    if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
      return reject(400, 'Bad Request');
    }

    // Origin-controle tegen cross-site WebSocket hijacking
    const origin = req.headers.origin;
    if (origin) {
      let ok = false;
      try { ok = new URL(origin).host === req.headers.host; } catch (e) { ok = false; }
      if (!ok && allowed.includes(origin)) ok = true;
      if (!ok) return reject(403, 'Forbidden');
    }

    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    socket.setTimeout(0);

    const conn = new WSConn(socket, maxPayload);
    conns.add(conn);
    conn.on('close', () => conns.delete(conn));

    if (opts.onConnection && opts.onConnection(conn, req) === false) {
      conn.close(1013, 'try again later');
      return;
    }
    if (head && head.length) conn._onData(head);
  });

  // Heartbeat: elke 25s ping; wie niet reageert vliegt eruit
  const hb = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.terminate(); continue; }
      c.alive = false;
      c.ping();
    }
  }, opts.heartbeatMs || 25000);
  hb.unref();

  return { connections: conns, stop() { clearInterval(hb); for (const c of conns) c.terminate(); } };
}

module.exports = { attach, WSConn };
