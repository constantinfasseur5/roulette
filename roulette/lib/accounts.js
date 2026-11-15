'use strict';
/*
 * accounts.js — accounts (gebruikersnaam + wachtwoord) zonder externe pakketten.
 *
 * - Wachtwoorden worden nooit bewaard: alleen een scrypt-hash met eigen salt.
 * - Een login geeft een lange, willekeurige sessiesleutel; de server bewaart alleen de SHA-256 ervan.
 * - Opslag ("store"): Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, gratis, via HTTPS)
 *   of anders een JSON-bestand (data/accounts.json). Dat bestand verdwijnt op hosts met een tijdelijk
 *   bestandssysteem (zoals de gratis Render), dus gebruik daar Upstash.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const RESERVED = /^(host|admin|moderator|system|server|kijker\d*|watcher\d*)$/i;
const SESSION_TTL = 30 * 24 * 3600; // seconden

// ---------------------------------------------------------------- opslag
class MemoryStore {
  constructor() { this.m = new Map(); }
  async get(k) {
    const e = this.m.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.m.delete(k); return null; }
    return e.v;
  }
  async set(k, v, ttl) { this.m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }); this.changed(); }
  async setnx(k, v, ttl) { if ((await this.get(k)) !== null) return false; await this.set(k, v, ttl); return true; }
  async del(k) { this.m.delete(k); this.changed(); }
  changed() { /* voor FileStore */ }
}

class FileStore extends MemoryStore {
  constructor(file) {
    super();
    this.file = file;
    this.timer = null;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [k, e] of Object.entries(raw)) this.m.set(k, e);
    } catch (e) { /* nog geen bestand */ }
  }
  changed() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 200);
    this.timer.unref();
  }
  flush() {
    try {
      const now = Date.now();
      const out = {};
      for (const [k, e] of this.m) if (!e.exp || e.exp > now) out[k] = e;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('Accounts opslaan mislukt:', e.message); }
  }
}

class UpstashStore {
  constructor(url, token) { this.url = url.replace(/\/+$/, ''); this.token = token; }
  async cmd(args) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error || `Upstash ${res.status}`);
    return j.result;
  }
  async get(k) { const r = await this.cmd(['GET', k]); return r == null ? null : JSON.parse(r); }
  async set(k, v, ttl) { await this.cmd(['SET', k, JSON.stringify(v)].concat(ttl ? ['EX', ttl] : [])); }
  async setnx(k, v, ttl) { return (await this.cmd(['SET', k, JSON.stringify(v), 'NX'].concat(ttl ? ['EX', ttl] : []))) === 'OK'; }
  async del(k) { await this.cmd(['DEL', k]); }
}

function makeStore(env, dataDir) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { kind: 'upstash', store: new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN) };
  }
  return { kind: 'file', store: new FileStore(env.ACCOUNTS_FILE || path.join(dataDir, 'accounts.json')) };
}

// ---------------------------------------------------------------- accounts
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

class Accounts {
  constructor(store) {
    this.store = store;
    this.ipFails = new Map();   // ip -> {n, reset}
    this.pairFails = new Map(); // ip|naam -> {n, reset}
    this.regLog = new Map();    // ip -> {n, reset}
    const t = setInterval(() => this.sweep(), 60000); t.unref();
  }

  sweep() {
    const now = Date.now();
    for (const m of [this.ipFails, this.pairFails, this.regLog]) for (const [k, e] of m) if (e.reset < now) m.delete(k);
  }

  bump(map, key, windowMs) {
    const now = Date.now();
    let e = map.get(key);
    if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; map.set(key, e); }
    e.n += 1;
    return e.n;
  }
  count(map, key) { const e = map.get(key); return e && e.reset > Date.now() ? e.n : 0; }

  async hash(password, salt) { return (await scrypt(String(password), salt, 64)).toString('hex'); }

  /** Maak een nieuwe sessiesleutel voor een gebruiker. */
  async startSession(rec) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.store.set('sess:' + sha(token), { user: rec.name, lower: rec.lower }, SESSION_TTL);
    return token;
  }

  async register(ip, username, password) {
    const name = String(username == null ? '' : username).trim();
    const pw = String(password == null ? '' : password);
    if (!NAME_RE.test(name) || RESERVED.test(name)) return fail('Gebruikersnaam: 3-16 tekens, alleen letters, cijfers en _ (en niet "host" of "admin").', 'username');
    if (pw.length < 6 || pw.length > 100) return fail('Wachtwoord: minstens 6 tekens.', 'password');
    if (this.bump(this.regLog, ip, 3600000) > 8) return fail('Te veel nieuwe accounts vanaf dit adres. Probeer het later opnieuw.', 'throttle');
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const rec = { name, lower: name.toLowerCase(), salt, hash: await this.hash(pw, salt), created: Date.now() };
      const ok = await this.store.setnx('acct:' + rec.lower, rec);
      if (!ok) return fail('Die gebruikersnaam bestaat al.', 'taken');
      return { ok: true, name: rec.name, token: await this.startSession(rec) };
    } catch (e) {
      console.error('register:', e.message);
      return fail('Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw.', 'storage');
    }
  }

  async login(ip, username, password) {
    const name = String(username == null ? '' : username).trim().slice(0, 40);
    const lower = name.toLowerCase();
    const pw = String(password == null ? '' : password).slice(0, 100);
    const pair = ip + '|' + lower;
    if (this.count(this.ipFails, ip) >= 12 || this.count(this.pairFails, pair) >= 6) {
      return fail('Te veel pogingen. Probeer het over een paar minuten opnieuw.', 'throttle');
    }
    try {
      const rec = NAME_RE.test(name) ? await this.store.get('acct:' + lower) : null;
      // altijd een hash berekenen, zodat "onbekende gebruiker" niet sneller antwoordt
      const salt = rec ? rec.salt : '00000000000000000000000000000000';
      const h = Buffer.from(await this.hash(pw, salt), 'hex');
      const good = rec && crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
      if (!good) {
        this.bump(this.ipFails, ip, 600000);
        this.bump(this.pairFails, pair, 600000);
        return fail('Onbekende gebruikersnaam of fout wachtwoord.', 'badlogin');
      }
      this.pairFails.delete(pair);
      return { ok: true, name: rec.name, token: await this.startSession(rec) };
    } catch (e) {
      console.error('login:', e.message);
      return fail('Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw.', 'storage');
    }
  }

  /** Controleer een bewaarde sessiesleutel. Geeft de gebruikersnaam of null. */
  async check(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
    try {
      const s = await this.store.get('sess:' + sha(token));
      if (!s) return null;
      const rec = await this.store.get('acct:' + s.lower);
      return rec ? rec.name : null;
    } catch (e) { return null; }
  }

  async logout(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return;
    try { await this.store.del('sess:' + sha(token)); } catch (e) { /* niets */ }
  }
}

function fail(msg, code) { return { ok: false, msg, code }; }

module.exports = { Accounts, makeStore, MemoryStore, FileStore, UpstashStore, NAME_RE };
