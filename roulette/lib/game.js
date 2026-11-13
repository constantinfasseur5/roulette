'use strict';
/*
 * Spellogica van de multiplayer roulette.
 * De server is de enige bron van waarheid: saldo's, inzetten, timers, uitslag en uitbetalingen.
 * De client stuurt alleen verzoeken ("ik zet 10 op rood") en toont wat de server zegt.
 * Alleen VIRTUELE fiches. Er is geen geld, geen betaling, geen echte inzet.
 */
const crypto = require('crypto');
const Rules = require('../public/rules.js');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // zonder I, O, 0, 1
const CODE_LEN = 5;
const MAX_CHIPS = 1e9;

const DEFAULTS = {
  maxPlayers: 12,
  maxWatchers: 30,
  maxRooms: 300,
  betTimeMin: 15,               // seconden; alleen in tests lager
  reconnectMs: 2 * 60 * 1000,   // zo lang mag je weg zijn met behoud van saldo
  hostGraceMs: 60 * 1000,       // daarna gaat de Host-rol naar iemand anders
  emptyRoomMs: 10 * 60 * 1000,  // lege kamers verdwijnen na 10 min
  spinMs: 7500,                 // duur van de wielanimatie
  settleMs: 700,                // extra wachttijd voor uitbetaling na de animatie
  closedDelayMs: 1500,          // pauze tussen "inzetten gesloten" en draaien (auto-modus)
  resultPauseMs: 9000,          // pauze tussen uitslag en volgende ronde (auto-modus)
  // Kiest de uitslag. Test-hook: de testsuite kan dit vervangen door een vaste reeks.
  nextResult: (variant) => {
    const wheel = Rules.VARIANTS[variant].wheel;
    return wheel[crypto.randomInt(wheel.length)];
  },
};

const DEFAULT_SETTINGS = {
  variant: 'european',
  betTime: 30,
  startChips: 1000,
  minBet: 1,
  maxBet: 500,
  auto: true,
  hostPlays: true,
  locked: false,
  chat: true,
  watch: true,      // meekijkers toegestaan (alleen kijken, niet inzetten of chatten)
  showBets: true,   // inzetten van anderen zichtbaar op de tafel
  rebuyBonus: 0,
};

const LIMITS = {
  betTime: [15, 120],
  startChips: [10, 1000000],
  minBet: [1, 100000],
  maxBet: [1, 1000000],
  rebuyBonus: [0, 1000000],
};

// ---------- hulpfuncties ----------
const ctrlRe = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

const newStats = () => ({ rounds: 0, wins: 0, losses: 0, staked: 0, net: 0, bestWin: 0, worstLoss: 0, streak: 0, low: null, kinds: {} });

// Prestaties (zeldzaam, ongeveer 8). De titels zijn Nederlands; de website vertaalt ze.
const ACH_TITLES = {
  first_win: 'Eerste winst', streak3: 'Hot streak', straight: 'Voltreffer', allin: 'Alles op één kaart',
  comeback: 'Terug uit de put', jackpot: 'Jackpot', veteran: 'Doorzetter', king: 'Koning van de tafel',
};
const cleanAvatar = (v) => (typeof v === 'string' && Rules.AVATARS.includes(v) ? v : '');
const cleanColor = (v) => (typeof v === 'string' && Rules.COLORS.includes(v) ? v : '');

function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFKC').replace(ctrlRe, '').replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
}

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFKC').replace(ctrlRe, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function genCode() {
  let c = '';
  for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return c;
}

const cleanKey = (v) => String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const sumBets = (m) => { let s = 0; for (const a of m.values()) s += a; return s; };

class Game {
  constructor(opts = {}) {
    this.o = Object.assign({}, DEFAULTS, opts);
    this.rooms = new Map();
    this.watchKeys = new Map(); // kijk-sleutel -> kamer
    this.joinLog = new Map(); // ip -> { n, reset }
    this.sweeper = setInterval(() => this.sweep(), 30000);
    this.sweeper.unref();
  }

  // ======================================================================
  // Communicatie
  // ======================================================================
  send(conn, obj) {
    try { conn.send(JSON.stringify(obj)); } catch (e) { /* verbinding weg */ }
  }

  err(conn, msg, code) {
    this.send(conn, { t: 'error', msg, code: code || null });
  }

  toRoom(room, obj) {
    const s = JSON.stringify(obj);
    for (const p of room.players.values()) {
      if (p.conn) { try { p.conn.send(s); } catch (e) { /* weg */ } }
    }
    for (const w of room.watchers.values()) {
      if (w.conn) { try { w.conn.send(s); } catch (e) { /* weg */ } }
    }
  }

  /** Korte melding voor iedereen (toast) + regel in de chatlog. */
  note(room, text, kind) {
    this.toRoom(room, { t: 'toast', text, kind: kind || 'info' });
    this.pushChat(room, { sys: true, text, ts: Date.now() });
  }

  pushChat(room, m) {
    room.chatLog.push(m);
    if (room.chatLog.length > 60) room.chatLog.shift();
    this.toRoom(room, Object.assign({ t: 'chat' }, m));
  }

  // ======================================================================
  // Rate limiting
  // ======================================================================
  allow(conn) {
    const now = Date.now();
    const b = conn.bucket || (conn.bucket = { tokens: 40, last: now });
    b.tokens = Math.min(40, b.tokens + (now - b.last) * 0.02); // 20 berichten/s
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  allowChat(conn) {
    const now = Date.now();
    const b = conn.chatBucket || (conn.chatBucket = { tokens: 5, last: now });
    b.tokens = Math.min(5, b.tokens + (now - b.last) / 1500); // 1 bericht per 1,5 s, burst 5
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  joinAllowed(conn) {
    const ip = conn.ip || '?';
    const now = Date.now();
    let e = this.joinLog.get(ip);
    if (!e || e.reset < now) { e = { n: 0, reset: now + 60000 }; this.joinLog.set(ip, e); }
    e.n += 1;
    return e.n <= 60;
  }

  // ======================================================================
  // Binnenkomende berichten
  // ======================================================================
  handle(conn, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return this.err(conn, 'Ongeldig bericht.'); }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

    if (!this.allow(conn)) {
      conn.strikes = (conn.strikes || 0) + 1;
      if (conn.strikes === 1) this.err(conn, 'Rustig aan, je stuurt te snel.', 'ratelimit');
      if (conn.strikes > 200) conn.close(1008, 'rate limit');
      return;
    }

    switch (msg.t) {
      case 'create': return this.create(conn, msg);
      case 'join': return this.join(conn, msg);
      case 'resume': return this.resume(conn, msg);
      case 'ping': return this.send(conn, { t: 'pong', now: Date.now() });
    }

    const ctx = conn.ctx;
    if (!ctx) return this.err(conn, 'Je zit niet in een kamer.', 'nojoin');
    const { room, player } = ctx;
    room.lastActive = Date.now();
    if (player.watcher && msg.t !== 'pstats' && msg.t !== 'leave') return this.err(conn, 'Je kijkt alleen mee.', 'watcher');

    switch (msg.t) {
      // ---- spelersacties ----
      case 'bet': return this.cmdBet(conn, room, player, msg);
      case 'undo': return this.cmdUndo(conn, room, player);
      case 'clear': return this.cmdClear(conn, room, player);
      case 'repeat': return this.cmdRepeat(conn, room, player);
      case 'double': return this.cmdDouble(conn, room, player);
      case 'chat': return this.cmdChat(conn, room, player, msg);
      case 'profile': return this.cmdProfile(conn, room, player, msg);
      case 'pstats': return this.cmdPStats(conn, room, msg);
      case 'leave': return this.cmdLeave(conn, room, player);
    }

    // ---- alleen Host ----
    const hostCmds = ['start', 'closeBets', 'spin', 'forceNext', 'extend', 'settings', 'pause', 'kick', 'ban', 'chips', 'resetPlayer', 'resetAll', 'mute', 'transfer', 'closeRoom', 'newWatchKey'];
    if (!hostCmds.includes(msg.t)) return this.err(conn, 'Onbekende actie.');
    if (room.hostId !== player.id) return this.err(conn, 'Alleen de Host mag dit.', 'nothost');

    switch (msg.t) {
      case 'start': return this.cmdStart(conn, room);
      case 'closeBets': return this.cmdCloseBets(conn, room);
      case 'spin': return this.cmdSpin(conn, room);
      case 'forceNext': return this.cmdForceNext(conn, room, msg);
      case 'extend': return this.cmdExtend(conn, room, msg);
      case 'settings': return this.cmdSettings(conn, room, player, msg);
      case 'pause': return this.cmdPause(conn, room, !!msg.value);
      case 'kick': return this.cmdKick(conn, room, player, msg, false);
      case 'ban': return this.cmdKick(conn, room, player, msg, true);
      case 'chips': return this.cmdChips(conn, room, msg);
      case 'resetPlayer': return this.cmdResetPlayer(conn, room, msg);
      case 'resetAll': return this.cmdResetAll(conn, room);
      case 'mute': return this.cmdMute(conn, room, msg);
      case 'transfer': return this.cmdTransfer(conn, room, player, msg);
      case 'closeRoom': return this.cmdCloseRoom(conn, room, player);
      case 'newWatchKey': return this.cmdNewWatchKey(conn, room);
    }
  }

  // ======================================================================
  // Kamer maken / joinen / terugkeren
  // ======================================================================
  newPlayer(room, name, prof) {
    const used = new Set([...room.players.values()].map((x) => x.color));
    const free = Rules.COLORS.find((c) => !used.has(c));
    const p = {
      id: crypto.randomBytes(4).toString('hex'),
      token: crypto.randomBytes(16).toString('hex'),
      name,
      joinedAt: Date.now(),
      conn: null,
      connected: false,
      offlineSince: null,
      chips: room.settings.startChips,
      bets: new Map(),       // key -> totaal bedrag
      placements: [],        // voor "ongedaan maken": [{key, amount}]
      prevBets: [],          // inzetten van de vorige ronde: [[key, amount]]
      lastNet: null,
      avatar: cleanAvatar(prof && prof.avatar),
      color: cleanColor(prof && prof.color) || free || Rules.COLORS[room.players.size % Rules.COLORS.length],
      stats: newStats(),
      ach: [],               // behaalde prestaties (blijven bewaard zolang de kamer bestaat)
      rankDelta: null,       // +n = n plaatsen omhoog na de laatste ronde
      sitOut: false,
      spectator: false,
      muted: false,
      removeTimer: null,
    };
    room.players.set(p.id, p);
    return p;
  }

  create(conn, msg) {
    if (conn.ctx) return this.err(conn, 'Je zit al in een kamer.');
    if (!this.joinAllowed(conn)) return this.err(conn, 'Te veel pogingen. Wacht even.');
    const name = cleanName(msg.name);
    if (!name) return this.err(conn, 'Kies een bijnaam (1-16 tekens).', 'name');
    if (this.rooms.size >= this.o.maxRooms) return this.err(conn, 'De server zit vol. Probeer het later opnieuw.');

    let code;
    do { code = genCode(); } while (this.rooms.has(code));

    const room = {
      code,
      createdAt: Date.now(),
      lastActive: Date.now(),
      emptySince: null,
      hostId: null,
      players: new Map(),
      watchers: new Map(),   // meekijkers: geen speler, tellen niet mee in de limiet van 12
      settings: Object.assign({}, DEFAULT_SETTINGS),
      phase: 'lobby', // lobby | betting | closed | spinning | results
      roundNo: 0,
      endsAt: null,
      paused: false,
      timer: null, timerFn: null, timerLeft: 0, timerStart: 0,
      spinTimer: null,
      spin: null,
      spins: [],       // nieuwste eerst, max 200
      forceNext: null, // getal dat de Host voor de volgende draai koos (of null = willekeurig)
      lastResult: null,
      chatLog: [],
      bannedTokens: new Set(),
      bannedNames: new Set(),
      flushTimer: null,
      hostTimer: null,
    };
    // geheime sleutel voor de kijk-link: los van de kamercode, zodat kijkers de code nooit te zien krijgen
    do { room.watchKey = crypto.randomBytes(9).toString('base64url'); } while (this.watchKeys.has(room.watchKey));
    this.watchKeys.set(room.watchKey, room);
    this.rooms.set(code, room);
    const p = this.newPlayer(room, name, msg);
    room.hostId = p.id;
    this.attach(room, p, conn, false);
  }

  join(conn, msg) {
    if (conn.ctx) return this.err(conn, 'Je zit al in een kamer.');
    if (!this.joinAllowed(conn)) return this.err(conn, 'Te veel pogingen. Wacht even.');
    // Kijken kan alleen met de kijk-sleutel (niet met de kamercode)
    if (msg.watchKey != null) return this.joinByWatchKey(conn, msg);
    if (msg.watch === true) return this.err(conn, 'Meekijken kan alleen met een kijk-link van de Host.', 'watchkey');

    const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const room = this.rooms.get(code);
    if (!room) {
      conn.joinFails = (conn.joinFails || 0) + 1;
      if (conn.joinFails > 12) return conn.close(1008, 'te veel pogingen');
      return this.err(conn, 'Kamer niet gevonden. Controleer de code.', 'noroom');
    }

    const token = typeof msg.token === 'string' ? msg.token.slice(0, 64) : '';
    if (token) {
      const existing = [...room.players.values()].find((p) => p.token === token);
      if (existing) return this.attach(room, existing, conn, true);
    }

    const name = cleanName(msg.name);
    if (!name) return this.err(conn, 'Kies een bijnaam (1-16 tekens).', 'name');
    if (room.bannedNames.has(name.toLowerCase()) || (token && room.bannedTokens.has(token))) {
      return this.err(conn, 'Je bent verbannen uit deze kamer.', 'banned');
    }
    if (room.settings.locked) return this.err(conn, 'De kamer is vergrendeld door de Host.', 'locked');
    if (room.players.size >= this.o.maxPlayers) return this.err(conn, `De kamer is vol (max. ${this.o.maxPlayers} spelers).`, 'full');
    const lower = name.toLowerCase();
    for (const p of room.players.values()) {
      if (p.name.toLowerCase() === lower) return this.err(conn, 'Die bijnaam is al in gebruik in deze kamer.', 'name');
    }

    const p = this.newPlayer(room, name, msg);
    p.sitOut = room.phase === 'betting' || room.phase === 'closed' || room.phase === 'spinning';
    this.attach(room, p, conn, false);
    this.note(room, `${p.name} doet mee.`, 'join');
  }

  resume(conn, msg) {
    if (conn.ctx) return;
    const token = typeof msg.token === 'string' ? msg.token.slice(0, 64) : '';
    let room, p = null;
    if (msg.key != null) {            // kijker: terugkeren via de kijk-sleutel
      room = this.watchKeys.get(cleanKey(msg.key));
      p = room && token ? [...room.watchers.values()].find((x) => x.token === token) : null;
    } else {                          // speler: terugkeren via de kamercode
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      room = this.rooms.get(code);
      p = room && token ? [...room.players.values()].find((x) => x.token === token) : null;
    }
    if (!p) return this.send(conn, { t: 'resumeFailed' });
    if (p.watcher) return this.attachWatcher(room, p, conn, true);
    this.attach(room, p, conn, true);
    this.toRoom(room, { t: 'toast', text: `${p.name} is terug.`, kind: 'join' });
  }

  attach(room, p, conn, resumed) {
    if (p.conn && p.conn !== conn) {
      const old = p.conn;
      old.ctx = null;
      this.send(old, { t: 'replaced' });
      try { old.close(4001, 'replaced'); } catch (e) { /* weg */ }
    }
    p.conn = conn;
    p.connected = true;
    p.offlineSince = null;
    clearTimeout(p.removeTimer);
    p.removeTimer = null;
    conn.ctx = { room, player: p };
    room.emptySince = null;
    if (room.hostId === p.id && room.hostTimer) { clearTimeout(room.hostTimer); room.hostTimer = null; }

    this.send(conn, {
      t: 'welcome', id: p.id, token: p.token, code: room.code, name: p.name,
      chatLog: room.chatLog.slice(-40), resumed: !!resumed,
    });
    this.touch(room, true);
  }

  // ---- meekijkers ----
  joinByWatchKey(conn, msg) {
    const room = this.watchKeys.get(cleanKey(msg.watchKey));
    if (!room) {
      conn.joinFails = (conn.joinFails || 0) + 1;
      if (conn.joinFails > 12) return conn.close(1008, 'te veel pogingen');
      return this.err(conn, 'Deze kijk-link werkt niet (meer). Vraag de Host om een nieuwe.', 'nowatchkey');
    }
    const token = typeof msg.token === 'string' ? msg.token.slice(0, 64) : '';
    const w = token ? [...room.watchers.values()].find((x) => x.token === token) : null;
    if (w) return this.attachWatcher(room, w, conn, true);
    this.joinWatcher(conn, room, token);
  }

  joinWatcher(conn, room, token) {
    if (token && room.bannedTokens.has(token)) return this.err(conn, 'Je bent verbannen uit deze kamer.', 'banned');
    if (!room.settings.watch) return this.err(conn, 'Meekijken staat uit in deze kamer.', 'nowatch');
    // (vergrendeld houdt alleen nieuwe spelers tegen, kijkers mogen wel)
    if (room.watchers.size >= this.o.maxWatchers) return this.err(conn, `Er kijken al genoeg mensen mee (max. ${this.o.maxWatchers}).`, 'full');
    room.watcherSeq = (room.watcherSeq || 0) + 1;
    const w = {
      id: crypto.randomBytes(4).toString('hex'), token: crypto.randomBytes(16).toString('hex'),
      name: `Kijker ${room.watcherSeq}`, watcher: true, joinedAt: Date.now(),
      conn: null, connected: false, removeTimer: null,
      // velden die stateFor() van een speler verwacht (een kijker heeft er niets van)
      chips: 0, bets: new Map(), placements: [], prevBets: [], lastNet: null, sitOut: false, spectator: true, muted: false,
    };
    room.watchers.set(w.id, w);
    this.attachWatcher(room, w, conn, false);
  }

  attachWatcher(room, w, conn, resumed) {
    if (w.conn && w.conn !== conn) {
      const old = w.conn;
      old.ctx = null;
      this.send(old, { t: 'replaced' });
      try { old.close(4001, 'replaced'); } catch (e) { /* weg */ }
    }
    w.conn = conn;
    w.connected = true;
    clearTimeout(w.removeTimer);
    w.removeTimer = null;
    conn.ctx = { room, player: w };
    this.send(conn, {
      t: 'welcome', id: w.id, token: w.token, code: null, key: room.watchKey, name: w.name, watcher: true,
      chatLog: room.chatLog.slice(-40), resumed: !!resumed,
    });
    this.touch(room, true);
  }

  removeWatcher(room, w) {
    clearTimeout(w.removeTimer);
    w.removeTimer = null;
    if (w.conn) { w.conn.ctx = null; w.conn = null; }
    w.connected = false;
    room.watchers.delete(w.id);
    this.touch(room);
  }

  /** Alle kijkers gaan naar het startscherm (meekijken uitgezet, of nieuwe kijk-link). */
  dropWatchers(room, msg) {
    for (const w of [...room.watchers.values()]) {
      if (w.conn) this.send(w.conn, { t: 'kicked', ban: false, msg: msg || 'De Host heeft meekijken uitgezet.' });
      this.removeWatcher(room, w);
    }
  }

  onClose(conn) {
    const ctx = conn.ctx;
    if (!ctx) return;
    conn.ctx = null;
    const { room, player: p } = ctx;
    if (p.conn !== conn) return;
    if (p.watcher) {
      p.conn = null;
      p.connected = false;
      p.removeTimer = setTimeout(() => this.removeWatcher(room, p), this.o.reconnectMs);
      return this.touch(room);
    }
    p.conn = null;
    p.connected = false;
    p.offlineSince = Date.now();
    p.removeTimer = setTimeout(() => this.removePlayer(room, p, 'timeout'), this.o.reconnectMs);
    if (room.hostId === p.id) room.hostTimer = setTimeout(() => this.hostGrace(room), this.o.hostGraceMs);
    if (![...room.players.values()].some((x) => x.connected)) room.emptySince = Date.now();
    this.touch(room);
  }

  // ======================================================================
  // Spelers verwijderen / Host overdragen
  // ======================================================================
  removePlayer(room, p, reason) {
    if (!room.players.has(p.id)) return;
    clearTimeout(p.removeTimer);
    p.removeTimer = null;
    if (p.conn) { p.conn.ctx = null; p.conn = null; }
    p.connected = false;
    room.players.delete(p.id);

    if (room.players.size === 0) return this.destroy(room);

    const wasHost = room.hostId === p.id;
    if (reason === 'leave') this.note(room, `${p.name} heeft de kamer verlaten.`, 'leave');
    else if (reason === 'timeout') this.note(room, `${p.name} is te lang weggeweest en is uit de kamer gehaald.`, 'leave');
    else if (reason === 'kick') this.note(room, `${p.name} is uit de kamer gezet.`, 'kick');
    else if (reason === 'ban') this.note(room, `${p.name} is verbannen.`, 'kick');

    if (wasHost) this.transferHost(room, null, 'De Host is weg.');
    this.touch(room);
  }

  /** Dragen over aan toId, of (null) aan de speler die het langst in de kamer zit en online is. */
  transferHost(room, toId, why) {
    const old = room.players.get(room.hostId);
    let target = toId ? room.players.get(toId) : null;
    if (!target) {
      const cands = [...room.players.values()].filter((p) => p.id !== room.hostId);
      const online = cands.filter((p) => p.connected);
      const pool = online.length ? online : cands;
      pool.sort((a, b) => a.joinedAt - b.joinedAt);
      target = pool[0] || null;
    }
    if (!target) return false;
    if (room.hostTimer) { clearTimeout(room.hostTimer); room.hostTimer = null; }
    room.hostId = target.id;
    room.forceNext = null; // een gekozen getal hoort bij de vorige Host
    room.settings.hostPlays = true;
    if (old) old.spectator = false;
    target.spectator = false;
    this.note(room, `${why ? why + ' ' : ''}${target.name} is nu de Host.`, 'host');
    this.touch(room);
    return true;
  }

  hostGrace(room) {
    room.hostTimer = null;
    const host = room.players.get(room.hostId);
    if (!host || host.connected) return;
    if (!this.transferHost(room, null, 'De Host is 60 seconden weg.')) {
      room.hostTimer = setTimeout(() => this.hostGrace(room), this.o.hostGraceMs);
    }
  }

  destroy(room) {
    clearTimeout(room.timer);
    clearTimeout(room.spinTimer);
    clearTimeout(room.flushTimer);
    clearTimeout(room.hostTimer);
    for (const p of room.players.values()) {
      clearTimeout(p.removeTimer);
      if (p.conn) { p.conn.ctx = null; }
    }
    for (const w of room.watchers.values()) {
      clearTimeout(w.removeTimer);
      if (w.conn) { w.conn.ctx = null; }
    }
    this.rooms.delete(room.code);
    if (this.watchKeys.get(room.watchKey) === room) this.watchKeys.delete(room.watchKey);
  }

  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (room.emptySince && now - room.emptySince > this.o.emptyRoomMs) this.destroy(room);
    }
    for (const [ip, e] of this.joinLog) if (e.reset < now) this.joinLog.delete(ip);
  }

  shutdown() {
    clearInterval(this.sweeper);
    for (const room of [...this.rooms.values()]) this.destroy(room);
  }

  // ======================================================================
  // Timers (pauzeerbaar)
  // ======================================================================
  arm(room, ms, fn) {
    this.disarm(room);
    room.timerFn = fn;
    room.timerLeft = ms;
    room.timerStart = Date.now();
    if (room.phase === 'betting') room.endsAt = room.timerStart + ms;
    room.timer = setTimeout(() => {
      room.timer = null;
      const f = room.timerFn;
      room.timerFn = null;
      if (f) f();
    }, ms);
  }

  disarm(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.timerFn = null;
  }

  freeze(room) {
    if (!room.timer) return;
    clearTimeout(room.timer);
    room.timer = null;
    room.timerLeft = Math.max(0, room.timerLeft - (Date.now() - room.timerStart));
  }

  thaw(room) {
    if (room.timerFn && !room.timer) this.arm(room, room.timerLeft, room.timerFn);
  }

  /** Auto-modus: zet het volgende stapje in gang als dat nog niet gebeurd is. */
  autoContinue(room) {
    if (!room.settings.auto || room.paused || room.timerFn) return;
    if (room.phase === 'closed') this.arm(room, this.o.closedDelayMs, () => this.spin(room));
    else if (room.phase === 'results') this.arm(room, this.o.resultPauseMs, () => this.startRound(room, true));
  }

  // ======================================================================
  // Rondeverloop
  // ======================================================================
  anyConnected(room) {
    for (const p of room.players.values()) if (p.connected) return true;
    return false;
  }

  unstake(p) {
    for (const a of p.bets.values()) p.chips += a;
    p.bets.clear();
    p.placements.length = 0;
  }

  /** Geeft een foutmelding (string) terug, of null als de ronde gestart is. */
  startRound(room, fromAuto) {
    if (room.phase !== 'lobby' && room.phase !== 'results') return 'Er loopt al een ronde.';
    if (room.paused) return 'Het spel is gepauzeerd. Hervat eerst.';
    if (fromAuto && !this.anyConnected(room)) return null; // niemand kijkt: wacht
    this.disarm(room);
    room.roundNo += 1;
    room.phase = 'betting';
    room.lastResult = room.lastResult; // blijft zichtbaar in de geschiedenis
    for (const p of room.players.values()) {
      p.bets.clear();
      p.placements.length = 0;
      p.lastNet = null;
      p.rankDelta = null;
      p.sitOut = false;
    }
    const ms = room.settings.betTime * 1000;
    this.arm(room, ms, () => this.closeBets(room));
    this.toRoom(room, { t: 'toast', text: `Ronde ${room.roundNo}: zet je inzetten!`, kind: 'round' });
    this.touch(room, true);
    return null;
  }

  closeBets(room) {
    if (room.phase !== 'betting') return 'De inzetten zijn niet open.';
    this.disarm(room);
    room.phase = 'closed';
    room.endsAt = null;
    this.toRoom(room, { t: 'toast', text: 'Rien ne va plus: inzetten gesloten.', kind: 'round' });
    this.autoContinue(room);
    this.touch(room, true);
    return null;
  }

  spin(room) {
    if (room.phase === 'betting') this.closeBets(room);
    if (room.phase !== 'closed') return 'Er kan nu niet gedraaid worden.';
    this.disarm(room);
    room.phase = 'spinning';
    const variant = room.settings.variant;
    // Door de Host gekozen getal (geldt één keer).
    const wanted = room.forceNext;
    room.forceNext = null;
    const forced = wanted != null && Rules.VARIANTS[variant].wheel.includes(wanted);
    const result = forced ? wanted : this.o.nextResult(variant);
    room.spin = { result, variant, startedAt: Date.now(), duration: this.o.spinMs };
    room.spinTimer = setTimeout(() => this.finishSpin(room), this.o.spinMs + this.o.settleMs);
    this.toRoom(room, { t: 'spin', result, label: Rules.label(result), variant, duration: this.o.spinMs, round: room.roundNo });
    this.touch(room, true);
    return null;
  }

  finishSpin(room) {
    room.spinTimer = null;
    if (room.phase !== 'spinning' || !room.spin) return;
    const { result, variant } = room.spin;
    const defs = Rules.buildBets(variant);
    const rows = [];
    const rankBefore = this.ranks(room);
    const gained = [];   // nieuwe prestaties in deze ronde: [{ p, id }]
    const start = room.settings.startChips;

    for (const p of room.players.values()) {
      p.lastNet = null;
      if (p.bets.size === 0) continue;
      const allIn = p.chips === 0;   // alles staat in de pot
      let stake = 0;
      let returned = 0;
      for (const [k, a] of p.bets) {
        stake += a;
        returned += Rules.payout(defs[k], a, result);
      }
      p.chips = Math.min(MAX_CHIPS, p.chips + returned);
      p.lastNet = returned - stake;
      p.prevBets = [...p.bets];
      this.recordStats(p, stake, returned - stake);
      this.checkAchievements(p, { stake, net: returned - stake, allIn, result, start }, gained);
      rows.push({ id: p.id, name: p.name, stake, returned, net: returned - stake });
    }

    room.spins.unshift(result);
    if (room.spins.length > 200) room.spins.length = 200;
    room.lastResult = { round: room.roundNo, result };
    room.spin = null;
    room.phase = 'results';

    this.toRoom(room, {
      t: 'result', round: room.roundNo, result, label: Rules.label(result), color: Rules.colorOf(result), rows,
    });

    // Optionele herstart-bonus voor spelers die blut zijn
    const bonus = room.settings.rebuyBonus;
    if (bonus > 0) {
      for (const p of room.players.values()) {
        if (p.chips === 0 && !p.spectator) {
          p.chips = bonus;
          if (p.conn) this.send(p.conn, { t: 'toast', text: `Herstart-bonus: +${bonus} fiches!`, kind: 'bonus' });
        }
      }
    }

    const rankAfter = this.ranks(room);
    for (const p of room.players.values()) {
      p.rankDelta = rankBefore.has(p.id) && rankAfter.has(p.id) ? rankBefore.get(p.id) - rankAfter.get(p.id) : null;
    }

    // Koning van de tafel: nummer 1 na ronde 20 (minstens 2 spelers in de ranglijst)
    if (room.roundNo >= 20 && rankAfter.size >= 2) {
      const topId = [...rankAfter].find(([, r]) => r === 1)[0];
      const top = room.players.get(topId);
      if (top && !top.ach.includes('king')) { top.ach.push('king'); gained.push({ p: top, id: 'king' }); }
    }
    for (const { p, id } of gained) this.note(room, `🏅 ${p.name} behaalde: ${ACH_TITLES[id]}!`, 'ach');

    this.autoContinue(room);
    this.touch(room, true);
  }

  /** Prestaties na een ronde waarin de speler inzette. Alleen nieuwe worden toegevoegd en gemeld. */
  checkAchievements(p, c, gained) {
    const st = p.stats;
    st.low = st.low == null ? p.chips : Math.min(st.low, p.chips);
    const give = (id) => { if (!p.ach.includes(id)) { p.ach.push(id); gained.push({ p, id }); } };
    if (c.net > 0) give('first_win');
    if (st.streak >= 3) give('streak3');
    if (p.bets.has('straight:' + c.result)) give('straight');
    if (c.allIn && c.net > 0 && c.stake >= Math.max(50, c.start / 4)) give('allin');
    if (c.net >= Math.max(c.start, 500)) give('jackpot');
    if (st.rounds >= 10) give('veteran');
    if (st.low <= c.start * 0.1 && p.chips >= c.start) give('comeback');
  }

  /** Stand van zaken: speler-id → plaats (1 = rijkste). Toeschouwers doen niet mee. */
  ranks(room) {
    const list = [...room.players.values()].filter((p) => !p.spectator)
      .sort((a, b) => b.chips - a.chips || a.joinedAt - b.joinedAt);
    return new Map(list.map((p, i) => [p.id, i + 1]));
  }

  recordStats(p, stake, net) {
    const st = p.stats;
    st.rounds += 1; st.staked += stake; st.net += net;
    if (net > 0) { st.wins += 1; st.streak += 1; st.bestWin = Math.max(st.bestWin, net); }
    else if (net < 0) { st.losses += 1; st.streak = 0; st.worstLoss = Math.max(st.worstLoss, -net); }
    const seen = new Set();
    for (const k of p.bets.keys()) {
      const kind = k.split(':')[0];
      if (!seen.has(kind)) { seen.add(kind); st.kinds[kind] = (st.kinds[kind] || 0) + 1; }
    }
  }

  // ======================================================================
  // Spelersacties
  // ======================================================================
  /** Probeert een fiche te plaatsen. Geeft een foutmelding of null. */
  tryPlace(room, p, key, amount) {
    const s = room.settings;
    if (room.phase !== 'betting') return 'De inzetten zijn niet open.';
    if (room.paused) return 'Het spel is gepauzeerd.';
    if (room.endsAt && Date.now() > room.endsAt + 150) return 'Te laat, de inzetten sluiten.';
    if (p.spectator) return 'Je bent toeschouwer en kunt niet inzetten.';
    if (p.sitOut) return 'Je doet mee vanaf de volgende ronde.';
    if (!isInt(amount) || amount <= 0 || amount > MAX_CHIPS) return 'Ongeldig bedrag.';
    if (typeof key !== 'string' || key.length > 40) return 'Ongeldige inzet.';
    const def = Rules.buildBets(s.variant)[key];
    if (!def) return 'Ongeldige inzet.';
    if (amount < s.minBet) return `De minimale inzet is ${s.minBet}.`;
    const cur = p.bets.get(key) || 0;
    if (cur + amount > s.maxBet) return `De maximale inzet per vak is ${s.maxBet}.`;
    if (amount > p.chips) return 'Je hebt niet genoeg fiches.';
    if (p.placements.length >= 300) return 'Je hebt te veel inzetten geplaatst.';
    p.chips -= amount;
    p.bets.set(key, cur + amount);
    p.placements.push({ key, amount });
    return null;
  }

  canEditBets(room, p) {
    if (room.phase !== 'betting') return 'De inzetten zijn niet open.';
    if (room.paused) return 'Het spel is gepauzeerd.';
    if (p.spectator || p.sitOut) return 'Je kunt nu niet inzetten.';
    return null;
  }

  cmdBet(conn, room, p, msg) {
    const e = this.tryPlace(room, p, msg.key, msg.amount);
    if (e) return this.err(conn, e, 'bet');
    this.touch(room);
  }

  cmdUndo(conn, room, p) {
    const e = this.canEditBets(room, p);
    if (e) return this.err(conn, e, 'bet');
    const last = p.placements.pop();
    if (!last) return;
    p.chips += last.amount;
    const left = (p.bets.get(last.key) || 0) - last.amount;
    if (left > 0) p.bets.set(last.key, left); else p.bets.delete(last.key);
    this.touch(room);
  }

  cmdClear(conn, room, p) {
    const e = this.canEditBets(room, p);
    if (e) return this.err(conn, e, 'bet');
    this.unstake(p);
    this.touch(room);
  }

  cmdRepeat(conn, room, p) {
    const e = this.canEditBets(room, p);
    if (e) return this.err(conn, e, 'bet');
    if (p.bets.size) return this.err(conn, 'Wis eerst je huidige inzetten.', 'bet');
    if (!p.prevBets.length) return this.err(conn, 'Er zijn geen vorige inzetten.', 'bet');
    let placed = 0;
    for (const [key, amount] of p.prevBets) if (!this.tryPlace(room, p, key, amount)) placed += 1;
    if (!placed) return this.err(conn, 'Je kunt de vorige inzetten nu niet herhalen (saldo of limieten).', 'bet');
    this.touch(room);
  }

  cmdDouble(conn, room, p) {
    const e = this.canEditBets(room, p);
    if (e) return this.err(conn, e, 'bet');
    if (!p.bets.size) return this.err(conn, 'Je hebt nog niets ingezet.', 'bet');
    if (sumBets(p.bets) > p.chips) return this.err(conn, 'Niet genoeg fiches om te verdubbelen.', 'bet');
    for (const a of p.bets.values()) {
      if (a * 2 > room.settings.maxBet) return this.err(conn, `Verdubbelen kan niet: max. ${room.settings.maxBet} per vak.`, 'bet');
    }
    for (const [key, cur] of [...p.bets]) this.tryPlace(room, p, key, cur);
    this.touch(room);
  }

  cmdChat(conn, room, p, msg) {
    if (!room.settings.chat) return this.err(conn, 'De chat staat uit.', 'chat');
    if (p.muted) return this.err(conn, 'Je bent gedempt door de Host.', 'chat');
    if (!this.allowChat(conn)) return this.err(conn, 'Niet zo snel typen.', 'chat');
    const text = cleanText(msg.text, 200);
    if (!text) return;
    this.pushChat(room, { id: p.id, name: p.name, host: room.hostId === p.id, text, ts: Date.now() });
  }

  cmdLeave(conn, room, p) {
    if (p.watcher) { this.removeWatcher(room, p); return this.send(conn, { t: 'left' }); }
    this.removePlayer(room, p, 'leave');
    this.send(conn, { t: 'left' });
  }

  // ======================================================================
  // Host-acties
  // ======================================================================
  cmdStart(conn, room) {
    const e = this.startRound(room, false);
    if (e) this.err(conn, e);
  }

  cmdCloseBets(conn, room) {
    if (room.paused) return this.err(conn, 'Het spel is gepauzeerd. Hervat eerst.');
    const e = this.closeBets(room);
    if (e) this.err(conn, e);
  }

  cmdSpin(conn, room) {
    if (room.paused) return this.err(conn, 'Het spel is gepauzeerd. Hervat eerst.');
    const e = this.spin(room);
    if (e) this.err(conn, e);
  }

  /** Eigen avatar en/of kleur wijzigen (alleen waarden uit de vaste lijsten). */
  cmdProfile(conn, room, player, msg) {
    if ('avatar' in msg) player.avatar = cleanAvatar(msg.avatar);
    if ('color' in msg) { const c = cleanColor(msg.color); if (c) player.color = c; }
    this.touch(room);
  }

  /** Statistieken van één speler opvragen (voor iedereen in de kamer). */
  cmdPStats(conn, room, msg) {
    const p = room.players.get(String(msg.id));
    if (!p) return;
    const st = p.stats;
    const fav = Object.entries(st.kinds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([kind, count]) => ({ kind, count }));
    this.send(conn, {
      t: 'pstats', id: p.id, name: p.name, avatar: p.avatar, color: p.color, chips: p.chips,
      rounds: st.rounds, wins: st.wins, losses: st.losses, staked: st.staked, net: st.net,
      bestWin: st.bestWin, worstLoss: st.worstLoss, fav, ach: p.ach.slice(),
    });
  }

  /** Host kiest het getal van de volgende draai (value: getal, of null = weer willekeurig). */
  cmdForceNext(conn, room, msg) {
    if (room.phase === 'spinning') return this.err(conn, 'Je kunt nu geen getal kiezen.');
    if (msg.value == null || msg.value === '') {
      room.forceNext = null;
    } else {
      const n = msg.value;
      if (!isInt(n) || !Rules.VARIANTS[room.settings.variant].wheel.includes(n)) return this.err(conn, 'Dat getal bestaat niet in deze variant.');
      room.forceNext = n;
    }
    this.touch(room);
  }

  cmdExtend(conn, room, msg) {
    if (room.phase !== 'betting' || room.paused) return this.err(conn, 'Je kunt de tijd nu niet verlengen.');
    const sec = isInt(msg.sec) ? Math.max(5, Math.min(60, msg.sec)) : 10;
    const left = Math.max(0, room.endsAt - Date.now()) + sec * 1000;
    if (left > 180000) return this.err(conn, 'Maximaal 3 minuten inzettijd.');
    this.arm(room, left, () => this.closeBets(room));
    this.toRoom(room, { t: 'toast', text: `De Host geeft ${sec} seconden extra.`, kind: 'round' });
    this.touch(room, true);
  }

  cmdPause(conn, room, value) {
    if (value === room.paused) return;
    if (value) {
      room.paused = true;
      if (room.phase === 'betting' || room.phase === 'closed' || room.phase === 'results') {
        this.freeze(room);
        room.endsAt = null;
      }
      this.note(room, 'De Host heeft het spel gepauzeerd.', 'pause');
    } else {
      room.paused = false;
      if (room.timerFn) {
        this.thaw(room); // arm() zet endsAt weer goed tijdens 'betting'
      } else {
        this.autoContinue(room);
      }
      this.note(room, 'Het spel gaat verder.', 'pause');
    }
    this.touch(room, true);
  }

  cmdSettings(conn, room, host, msg) {
    const S = msg.settings;
    if (!S || typeof S !== 'object') return;
    const s = room.settings;
    const between = room.phase === 'lobby' || room.phase === 'results';
    const next = Object.assign({}, s);
    const changes = [];

    const num = (name) => {
      if (!(name in S)) return null;
      const v = S[name];
      const [lo0, hi] = LIMITS[name];
      const lo = name === 'betTime' ? this.o.betTimeMin : lo0;
      if (!isInt(v) || v < lo || v > hi) { this.err(conn, `Ongeldige waarde voor ${name} (${lo}-${hi}).`); return false; }
      next[name] = v;
      return true;
    };

    if ('variant' in S) {
      if (typeof S.variant !== 'string' || !Object.prototype.hasOwnProperty.call(Rules.VARIANTS, S.variant)) return this.err(conn, 'Onbekende variant.');
      if (!between && S.variant !== s.variant) return this.err(conn, 'De variant kun je alleen tussen rondes wijzigen.');
      next.variant = S.variant;
    }
    for (const name of ['betTime', 'startChips', 'minBet', 'maxBet', 'rebuyBonus']) {
      if (num(name) === false) return;
    }
    if ((next.minBet !== s.minBet || next.maxBet !== s.maxBet) && !between) {
      return this.err(conn, 'Min/max inzet kun je alleen tussen rondes wijzigen.');
    }
    if (next.minBet > next.maxBet) return this.err(conn, 'De minimale inzet mag niet hoger zijn dan de maximale.');
    for (const name of ['auto', 'hostPlays', 'locked', 'chat', 'watch', 'showBets']) {
      if (name in S) {
        if (typeof S[name] !== 'boolean') return this.err(conn, `Ongeldige waarde voor ${name}.`);
        next[name] = S[name];
      }
    }

    const names = { variant: 'variant', betTime: 'inzettijd', startChips: 'startfiches', minBet: 'min. inzet', maxBet: 'max. inzet', rebuyBonus: 'herstart-bonus', auto: 'automatisch', hostPlays: 'host speelt mee', locked: 'vergrendeld', chat: 'chat', watch: 'meekijkers', showBets: 'inzetten zichtbaar' };
    for (const k of Object.keys(next)) if (next[k] !== s[k]) changes.push(k);
    if (!changes.length) return;

    Object.assign(room.settings, next);

    if (changes.includes('hostPlays')) {
      host.spectator = !next.hostPlays;
      if (host.spectator) this.unstake(host);
    }
    if (changes.includes('watch') && !next.watch) this.dropWatchers(room);
    if (changes.includes('auto')) {
      if (next.auto) this.autoContinue(room);
      else if (room.phase === 'closed' || room.phase === 'results') this.disarm(room);
    }
    if (changes.includes('variant')) {
      room.forceNext = null; // gekozen getal hoort bij het vorige wiel
      // Oude inzetten kunnen vakjes hebben die niet meer bestaan (00): opruimen.
      for (const p of room.players.values()) { p.prevBets = p.prevBets.filter(([k]) => Rules.buildBets(next.variant)[k]); }
    }

    const readable = changes.map((k) => {
      const v = room.settings[k];
      if (k === 'variant') return `variant: ${Rules.VARIANTS[v].name}`;
      if (typeof v === 'boolean') return `${names[k]}: ${v ? 'aan' : 'uit'}`;
      return `${names[k]}: ${v}`;
    });
    this.note(room, `Host wijzigde: ${readable.join(', ')}.`, 'settings');
    this.touch(room, true);
  }

  cmdKick(conn, room, host, msg, ban) {
    const t = room.players.get(String(msg.id));
    if (!t) return this.err(conn, 'Speler niet gevonden.');
    if (t.id === host.id) return this.err(conn, 'Je kunt jezelf niet verwijderen.');
    if (ban) { room.bannedTokens.add(t.token); room.bannedNames.add(t.name.toLowerCase()); }
    if (t.conn) {
      this.send(t.conn, { t: 'kicked', ban, msg: ban ? 'Je bent verbannen uit deze kamer.' : 'Je bent uit de kamer gezet door de Host.' });
    }
    this.removePlayer(room, t, ban ? 'ban' : 'kick');
  }

  cmdChips(conn, room, msg) {
    const t = room.players.get(String(msg.id));
    if (!t) return this.err(conn, 'Speler niet gevonden.');
    const amount = msg.amount;
    if (!isInt(amount) || Math.abs(amount) > 10000000) return this.err(conn, 'Ongeldig aantal fiches.');
    if (msg.mode === 'set') {
      if (room.phase === 'spinning') return this.err(conn, 'Wacht tot het wiel stilstaat.');
      if (amount < 0) return this.err(conn, 'Ongeldig aantal fiches.');
      this.unstake(t);
      t.chips = Math.min(MAX_CHIPS, amount);
      this.note(room, `Host zette het saldo van ${t.name} op ${t.chips}.`, 'chips');
    } else {
      t.chips = Math.max(0, Math.min(MAX_CHIPS, t.chips + amount));
      this.note(room, `Host ${amount >= 0 ? 'gaf' : 'nam'} ${Math.abs(amount)} fiches ${amount >= 0 ? 'aan' : 'van'} ${t.name}.`, 'chips');
    }
    this.touch(room, true);
  }

  cmdResetPlayer(conn, room, msg) {
    const t = room.players.get(String(msg.id));
    if (!t) return this.err(conn, 'Speler niet gevonden.');
    if (room.phase === 'spinning') return this.err(conn, 'Wacht tot het wiel stilstaat.');
    this.unstake(t);
    t.chips = room.settings.startChips;
    t.lastNet = null;
    t.rankDelta = null;
    t.stats = newStats();
    this.note(room, `Host zette ${t.name} terug naar ${t.chips} fiches.`, 'chips');
    this.touch(room, true);
  }

  cmdResetAll(conn, room) {
    if (room.phase === 'spinning') return this.err(conn, 'Wacht tot het wiel stilstaat.');
    for (const p of room.players.values()) {
      this.unstake(p);
      p.chips = room.settings.startChips;
      p.lastNet = null;
      p.rankDelta = null;
      p.stats = newStats();
    }
    this.note(room, `Iedereen is teruggezet naar ${room.settings.startChips} fiches.`, 'chips');
    this.touch(room, true);
  }

  cmdMute(conn, room, msg) {
    const t = room.players.get(String(msg.id));
    if (!t) return this.err(conn, 'Speler niet gevonden.');
    t.muted = !!msg.value;
    this.note(room, `${t.name} is ${t.muted ? 'gedempt' : 'niet meer gedempt'}.`, 'chat');
    this.touch(room, true);
  }

  cmdTransfer(conn, room, host, msg) {
    const t = room.players.get(String(msg.id));
    if (!t || t.id === host.id) return this.err(conn, 'Kies een andere speler.');
    this.transferHost(room, t.id, '');
  }

  /** Host maakt een nieuwe kijk-link: de oude werkt niet meer en alle kijkers worden weggestuurd. */
  cmdNewWatchKey(conn, room) {
    this.watchKeys.delete(room.watchKey);
    do { room.watchKey = crypto.randomBytes(9).toString('base64url'); } while (this.watchKeys.has(room.watchKey));
    this.watchKeys.set(room.watchKey, room);
    this.dropWatchers(room, 'De Host heeft een nieuwe kijk-link gemaakt. De oude link werkt niet meer.');
    this.touch(room, true);
  }

  cmdCloseRoom(conn, room, host) {
    this.toRoom(room, { t: 'roomClosed', msg: `${host.name} heeft de kamer gesloten.` });
    this.destroy(room);
  }

  // ======================================================================
  // State naar de clients
  // ======================================================================
  touch(room, now) {
    if (now) {
      clearTimeout(room.flushTimer);
      room.flushTimer = null;
      return this.flush(room);
    }
    if (room.flushTimer) return;
    room.flushTimer = setTimeout(() => { room.flushTimer = null; this.flush(room); }, 40);
  }

  flush(room) {
    if (!this.rooms.has(room.code)) return;
    for (const p of room.players.values()) if (p.conn) this.send(p.conn, this.stateFor(room, p));
    for (const w of room.watchers.values()) if (w.conn) this.send(w.conn, this.stateFor(room, w));
  }

  stats(room) {
    const spins = room.spins;
    const wheel = Rules.VARIANTS[room.settings.variant].wheel;
    const counts = new Map();
    for (const n of spins.slice(0, 100)) counts.set(n, (counts.get(n) || 0) + 1);
    const firstIdx = (n) => { const i = spins.indexOf(n); return i < 0 ? spins.length : i; };
    const hot = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || firstIdx(a[0]) - firstIdx(b[0]))
      .slice(0, 3)
      .map(([n, c]) => ({ n, c }));
    const cold = wheel
      .map((n) => ({ n, g: firstIdx(n) }))
      .sort((a, b) => b.g - a.g || a.n - b.n)
      .slice(0, 3);
    const recent = spins.slice(0, 20);
    return {
      total: spins.length,
      hot,
      cold,
      red: recent.filter((n) => Rules.colorOf(n) === 'red').length,
      black: recent.filter((n) => Rules.colorOf(n) === 'black').length,
      green: recent.filter((n) => Rules.colorOf(n) === 'green').length,
    };
  }

  stateFor(room, me) {
    const now = Date.now();
    const showStake = room.phase !== 'results'; // na de uitbetaling staat niets meer "in de pot"
    const ranks = this.ranks(room);
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        staked: showStake ? sumBets(p.bets) : 0,
        connected: p.connected,
        host: p.id === room.hostId,
        spectator: p.spectator,
        muted: p.muted,
        sitOut: p.sitOut,
        net: p.lastNet,
        avatar: p.avatar,
        color: p.color,
        rank: ranks.get(p.id) || null,
        rankDelta: p.rankDelta,
        rounds: p.stats.rounds,
        wins: p.stats.wins,
      }));

    return {
      t: 'state',
      now,
      room: {
        code: me.watcher ? null : room.code,   // kijkers krijgen de kamercode nooit te zien
        watchKey: me.id === room.hostId ? room.watchKey : undefined,   // alleen de Host kent de kijk-sleutel
        phase: room.phase,
        round: room.roundNo,
        paused: room.paused,
        endsAt: room.paused ? null : room.endsAt,
        timeLeft: room.paused && room.phase === 'betting' ? room.timerLeft : null,
        hostId: room.hostId,
        watchers: [...room.watchers.values()].filter((w) => w.connected).length,
        settings: room.settings,
        history: room.spins.slice(0, 20),
        stats: this.stats(room),
        lastResult: room.lastResult,
        spin: room.spin ? { result: room.spin.result, variant: room.spin.variant, startedAt: room.spin.startedAt, duration: room.spin.duration } : null,
      },
      players,
      // inzetten van de andere spelers (alleen als de Host dat toestaat)
      others: room.settings.showBets
        ? [...room.players.values()].filter((p) => p.id !== me.id && p.bets.size).map((p) => ({ id: p.id, bets: Object.fromEntries(p.bets) }))
        : [],
      me: {
        id: me.id,
        chips: me.chips,
        staked: showStake ? sumBets(me.bets) : 0,
        bets: Object.fromEntries(me.bets),
        canUndo: me.placements.length > 0,
        hasPrev: me.prevBets.length > 0,
        sitOut: me.sitOut,
        spectator: me.spectator,
        watcher: !!me.watcher,
        muted: me.muted,
        host: me.id === room.hostId,
        net: me.lastNet,
        // alleen de Host ziet zijn eigen keuze vóór de draai; anderen krijgen niets
        forceNext: me.id === room.hostId ? room.forceNext : null,
      },
    };
  }
}

module.exports = { Game, DEFAULTS, DEFAULT_SETTINGS, cleanName, cleanText };
