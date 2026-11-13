'use strict';
// Test van regels + spellogica, zonder netwerk (nepverbindingen).
const { group, ok, eq, sleep } = require('./harness');
const Rules = require('../public/rules.js');
const { Game } = require('../lib/game');

class Fake {
  constructor(name) {
    this.name = name;
    this.msgs = [];
    this.closed = false;
    this.ctx = null;
    this.ip = '9.9.' + ((Fake.n = (Fake.n || 0) + 1) % 250) + '.9';
    this.id = null;
    this.token = null;
    this.code = null;
  }
  send(s) {
    const m = JSON.parse(s);
    this.msgs.push(m);
    if (m.t === 'welcome') { this.id = m.id; this.token = m.token; this.code = m.code; }
    if (m.t === 'state') this.state = m;
  }
  close() { this.closed = true; }
  last(t) { for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i].t === t) return this.msgs[i]; return null; }
  errs() { return this.msgs.filter((m) => m.t === 'error').map((m) => m.msg); }
  lastErr() { const e = this.msgs.filter((m) => m.t === 'error'); return e.length ? e[e.length - 1] : null; }
  clear() { this.msgs.length = 0; }
}

async function run() {
  // ------------------------------------------------------------------
  group('Regels: aantallen inzetten');
  const eu = Rules.buildBets('european');
  const us = Rules.buildBets('american');
  const count = (defs, kind) => Object.values(defs).filter((d) => d.kind === kind).length;
  eq(count(eu, 'straight'), 37, 'Europees: 37 enkele nummers');
  eq(count(us, 'straight'), 38, 'Amerikaans: 38 enkele nummers (0 en 00)');
  eq(count(eu, 'split'), 60, 'Europees: 60 splits');
  eq(count(us, 'split'), 62, 'Amerikaans: 62 splits (57 + 0-1, 0-2, 2-00, 3-00, 0-00)');
  eq(count(eu, 'street'), 12, '12 streets');
  eq(count(eu, 'corner'), 23, 'Europees: 22 corners + eerste vier');
  eq(count(us, 'corner'), 22, 'Amerikaans: 22 corners');
  eq(count(eu, 'sixline'), 11, '11 six lines');
  eq(count(eu, 'column'), 3, '3 kolommen');
  eq(count(eu, 'dozen'), 3, '3 dozijnen');
  ok(eu['straight:37'] === undefined && us['straight:37'], '00 bestaat alleen Amerikaans');
  ok(eu['corner:0-1-2-3'] && !us['corner:0-1-2-3'], 'eerste vier alleen Europees');

  group('Regels: uitbetalingsverhoudingen');
  eq(eu['straight:17'].ratio, 35, 'straight 35:1');
  eq(eu['split:17-18'].ratio, 17, 'split 17:1');
  eq(eu['street:16-17-18'].ratio, 11, 'street 11:1');
  eq(eu['corner:16-17-19-20'].ratio, 8, 'corner 8:1');
  eq(eu['sixline:16-17-18-19-20-21'].ratio, 5, 'sixline 5:1');
  eq(eu['column:2'].ratio, 2, 'kolom 2:1');
  eq(eu['dozen:3'].ratio, 2, 'dozijn 2:1');
  for (const k of ['red', 'black', 'even', 'odd', 'low', 'high']) eq(eu[k].ratio, 1, `${k} 1:1`);

  group('Regels: dekking en nul');
  eq(eu['column:1'].nums.slice(0, 4), [1, 4, 7, 10], 'kolom 1 = 1,4,7,...');
  eq(eu['column:3'].nums.slice(-2), [33, 36], 'kolom 3 eindigt op 36');
  eq(eu['dozen:2'].nums, [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], 'dozijn 2 = 13..24');
  for (const k of ['red', 'black', 'even', 'odd', 'low', 'high', 'column:1', 'dozen:1']) {
    ok(!eu[k].nums.includes(0) && !us[k].nums.includes(37), `${k} verliest bij 0 en 00`);
  }
  eq(eu.red.nums.length + eu.black.nums.length, 36, 'rood + zwart = 36 nummers');
  eq(Rules.payout(eu['straight:17'], 10, 17), 360, 'payout: 10 op 17 bij 17 = 360 terug');
  eq(Rules.payout(eu['straight:17'], 10, 18), 0, 'payout: verlies = 0');
  eq(Rules.payout(eu['red'], 20, 1), 40, 'payout: rood 20 bij 1 = 40 terug');
  eq(Rules.payout(undefined, 20, 1), 0, 'payout: onbekende inzet = 0');

  group('Regels: wielen');
  const W = Rules.VARIANTS;
  eq(W.european.wheel.length, 37, 'Europees wiel heeft 37 vakjes');
  eq(W.american.wheel.length, 38, 'Amerikaans wiel heeft 38 vakjes');
  eq(new Set(W.european.wheel).size, 37, 'Europees: alle vakjes uniek');
  eq(new Set(W.american.wheel).size, 38, 'Amerikaans: alle vakjes uniek');
  eq([...W.european.wheel].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i), 'Europees bevat 0..36');
  eq([...W.american.wheel].sort((a, b) => a - b), Array.from({ length: 38 }, (_, i) => i), 'Amerikaans bevat 0..37');
  eq([Rules.colorOf(0), Rules.colorOf(37), Rules.colorOf(1), Rules.colorOf(2)], ['green', 'green', 'red', 'black'], 'kleuren');
  eq(Rules.label(37), '00', 'label 00');

  // ------------------------------------------------------------------
  const results = [];
  const game = new Game({
    spinMs: 40, settleMs: 20, closedDelayMs: 20, resultPauseMs: 60,
    reconnectMs: 500, hostGraceMs: 120, emptyRoomMs: 60, betTimeMin: 1,
    nextResult: () => (results.length ? results.shift() : 5),
  });
  const send = (c, m) => game.handle(c, JSON.stringify(m));
  const flush = async () => { await sleep(70); };
  const room = () => game.rooms.get(H.code);
  const me = (c) => c.state.players.find((p) => p.id === c.id);

  group('Kamer maken en joinen');
  const H = new Fake('Hanna');
  send(H, { t: 'create', name: '  Han<>na  ' });
  ok(H.code && /^[A-HJ-NP-Z2-9]{5}$/.test(H.code), `kamercode heeft 5 tekens zonder I/O/0/1 (${H.code})`);
  eq(H.last('welcome').name, 'Hanna', 'bijnaam wordt gesaneerd (spaties en <> weg)');
  ok(H.state && H.state.room.hostId === H.id && H.state.me.host, 'maker is Host');
  eq(H.state.room.settings.startChips, 1000, 'standaard 1000 startfiches');

  const A = new Fake('Ali');
  const B = new Fake('Bo');
  const C = new Fake('Cy');
  send(A, { t: 'join', code: H.code.toLowerCase(), name: 'Ali' });
  ok(A.id, 'join met kleine letters in code werkt');
  send(B, { t: 'join', code: H.code, name: 'Bo' });
  send(C, { t: 'join', code: H.code, name: 'Cy' });
  const dup = new Fake('dup');
  send(dup, { t: 'join', code: H.code, name: 'bO' });
  ok(/in gebruik/.test(dup.lastErr().msg), 'dubbele bijnaam (ook hoofdletters anders) geweigerd');
  send(dup, { t: 'join', code: 'ZZZZZ', name: 'Dup' });
  eq(dup.lastErr().code, 'noroom', 'onbekende kamercode geweigerd');
  send(dup, { t: 'join', code: H.code, name: '   ' });
  ok(dup.lastErr().code === 'name', 'lege bijnaam geweigerd');
  send(dup, { t: 'join', code: H.code, name: 'x'.repeat(40) });
  eq(dup.last('welcome').name.length, 16, 'bijnaam wordt afgekapt op 16 tekens');
  send(dup, { t: 'leave' });
  await flush();
  eq(room().players.size, 4, 'vier spelers in de kamer');

  group('Rechten: alleen de Host');
  for (const t of ['start', 'closeBets', 'spin', 'pause', 'resetAll', 'closeRoom']) {
    A.clear();
    send(A, { t });
    eq(A.lastErr() && A.lastErr().code, 'nothost', `speler mag "${t}" niet`);
  }
  A.clear();
  send(A, { t: 'settings', settings: { betTime: 99 } });
  eq(A.lastErr() && A.lastErr().code, 'nothost', 'speler mag instellingen niet wijzigen');
  send(A, { t: 'kick', id: B.id });
  send(A, { t: 'chips', id: A.id, mode: 'add', amount: 100000 });
  eq(room().players.size, 4, 'speler kan niemand kicken');
  eq(room().players.get(A.id).chips, 1000, 'speler kan zichzelf geen fiches geven');

  group('Instellingen valideren');
  send(H, { t: 'settings', settings: { auto: false } });
  eq(room().settings.auto, false, 'Host zet automatisch uit');
  H.clear();
  send(H, { t: 'settings', settings: { betTime: 100000 } });
  ok(H.lastErr(), 'inzettijd buiten bereik geweigerd');
  H.clear();
  send(H, { t: 'settings', settings: { minBet: 50, maxBet: 10 } });
  ok(H.lastErr() && /minimale/.test(H.lastErr().msg), 'min > max geweigerd');
  H.clear();
  send(H, { t: 'settings', settings: { variant: 'martian' } });
  ok(H.lastErr(), 'onbekende variant geweigerd');
  H.clear();
  send(H, { t: 'settings', settings: { betTime: '30' } });
  ok(H.lastErr(), 'tekst als getal geweigerd');
  send(H, { t: 'settings', settings: { betTime: 20, minBet: 2, maxBet: 300 } });
  eq([room().settings.betTime, room().settings.minBet, room().settings.maxBet], [20, 2, 300], 'geldige instellingen werken');
  send(H, { t: 'settings', settings: { minBet: 1, maxBet: 500 } });

  group('Inzetten vóór de ronde');
  A.clear();
  send(A, { t: 'bet', key: 'red', amount: 10 });
  ok(/niet open/.test(A.lastErr().msg), 'inzetten in de lobby kan niet');

  group('Ronde 1: uitbetalingen (uitslag 17)');
  results.push(17);
  send(H, { t: 'start' });
  eq(room().phase, 'betting', 'ronde gestart');
  ok(H.state.room.endsAt > Date.now(), 'er is een aftelklok (endsAt)');

  // Ongeldige inzetten
  const bad = async (c, m, rx, label) => {
    c.clear();
    send(c, m);
    ok(c.lastErr() && rx.test(c.lastErr().msg), label);
  };
  await bad(A, { t: 'bet', key: 'straight:99', amount: 5 }, /Ongeldige inzet/, 'onbestaand vak geweigerd');
  await bad(A, { t: 'bet', key: 'split:1-5', amount: 5 }, /Ongeldige inzet/, 'niet-aangrenzende split geweigerd');
  await bad(A, { t: 'bet', key: '__proto__', amount: 5 }, /Ongeldige inzet/, '__proto__ als sleutel geweigerd');
  await bad(A, { t: 'bet', key: 'constructor', amount: 5 }, /Ongeldige inzet/, 'constructor als sleutel geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: 0 }, /Ongeldig bedrag/, 'bedrag 0 geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: -5 }, /Ongeldig bedrag/, 'negatief bedrag geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: 1.5 }, /Ongeldig bedrag/, 'kommagetal geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: '10' }, /Ongeldig bedrag/, 'tekst als bedrag geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: null }, /Ongeldig bedrag/, 'null als bedrag geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: 1e12 }, /Ongeldig bedrag/, 'absurd bedrag geweigerd');
  await bad(A, { t: 'bet', key: 'red', amount: 501 }, /maximale inzet/, 'boven max. per vak geweigerd');
  await bad(A, { t: 'bet', key: { a: 1 }, amount: 5 }, /Ongeldige inzet/, 'object als sleutel geweigerd');
  eq(room().players.get(A.id).chips, 1000, 'mislukte inzetten kosten niets');

  // Echte inzetten
  send(A, { t: 'bet', key: 'straight:17', amount: 10 });
  send(B, { t: 'bet', key: 'red', amount: 20 });
  send(C, { t: 'bet', key: 'black', amount: 50 });
  send(C, { t: 'bet', key: 'dozen:2', amount: 10 });
  send(H, { t: 'bet', key: 'split:17-18', amount: 4 });
  send(H, { t: 'bet', key: 'street:16-17-18', amount: 6 });
  send(H, { t: 'bet', key: 'corner:16-17-19-20', amount: 8 });
  send(H, { t: 'bet', key: 'sixline:16-17-18-19-20-21', amount: 10 });
  send(H, { t: 'bet', key: 'column:2', amount: 10 });
  send(H, { t: 'bet', key: 'low', amount: 20 });
  send(H, { t: 'bet', key: 'odd', amount: 10 });
  send(H, { t: 'bet', key: 'even', amount: 10 });
  send(H, { t: 'bet', key: 'high', amount: 10 });
  await flush();
  eq(room().players.get(A.id).chips, 990, 'saldo gaat omlaag bij inzet');
  eq(A.state.me.bets, { 'straight:17': 10 }, 'speler ziet eigen inzetten');
  eq(room().players.get(H.id).chips, 1000 - 88, 'Host: 88 ingezet');

  // Undo / bijzetten / saldo-grens
  send(A, { t: 'bet', key: 'straight:17', amount: 5 });
  send(A, { t: 'undo' });
  eq([room().players.get(A.id).chips, room().players.get(A.id).bets.get('straight:17')], [990, 10], 'ongedaan maken geeft laatste fiche terug');
  send(A, { t: 'bet', key: 'high', amount: 500 });
  A.clear();
  send(A, { t: 'bet', key: 'low', amount: 500 });
  ok(A.lastErr() && /niet genoeg/.test(A.lastErr().msg), 'meer inzetten dan saldo geweigerd (490 over, 500 gevraagd)');
  send(A, { t: 'clear' });
  eq([room().players.get(A.id).chips, room().players.get(A.id).bets.size], [1000, 0], 'alles wissen geeft alle fiches terug');
  send(A, { t: 'bet', key: 'straight:17', amount: 10 });

  // Min inzet
  send(H, { t: 'settings', settings: { minBet: 5 } });
  ok(room().settings.minBet === 1, 'min/max inzet mag niet midden in een ronde');

  // Pauze tijdens inzetten
  send(H, { t: 'pause', value: true });
  await flush();
  ok(H.state.room.paused && H.state.room.timeLeft > 0 && H.state.room.endsAt === null, 'pauze bevriest de klok (timeLeft i.p.v. endsAt)');
  A.clear();
  send(A, { t: 'bet', key: 'red', amount: 5 });
  ok(/gepauzeerd/.test(A.lastErr().msg), 'tijdens pauze kan niemand inzetten');
  H.clear();
  send(H, { t: 'spin' });
  ok(/gepauzeerd/.test(H.lastErr().msg), 'tijdens pauze kan ook de Host niet draaien');
  const left = room().timerLeft;
  await sleep(120);
  ok(room().timerLeft === left && room().phase === 'betting', 'klok loopt niet door tijdens pauze');
  send(H, { t: 'pause', value: false });
  await flush();
  ok(!H.state.room.paused && H.state.room.endsAt > Date.now(), 'hervatten zet de klok weer in gang');

  // Extend
  const before = H.state.room.endsAt;
  send(H, { t: 'extend', sec: 10 });
  await flush();
  ok(H.state.room.endsAt >= before + 9000, '+10 seconden verlengt de klok');

  // Draaien
  C.clear();
  send(H, { t: 'spin' });
  eq(room().phase, 'spinning', 'Host kan het wiel meteen laten draaien (sluit inzetten)');
  const spinMsg = C.last('spin');
  ok(spinMsg && spinMsg.result === 17 && spinMsg.label === '17' && spinMsg.duration === 40, 'alle spelers krijgen uitslag + duur');
  A.clear();
  send(A, { t: 'bet', key: 'red', amount: 5 });
  ok(/niet open/.test(A.lastErr().msg), 'tijdens het draaien kan niet meer worden ingezet');
  ok(A.state.room.spin && A.state.me.chips === 990, 'saldo wijzigt pas ná de animatie (tijdens het draaien nog 990)');
  await sleep(120);
  eq(room().phase, 'results', 'na de animatie: uitslag');
  const res = C.last('result');
  ok(res && res.result === 17 && res.color === 'black', 'result-bericht: 17 zwart');
  const row = (name) => res.rows.find((r) => r.name === name);
  eq(row('Ali'), { id: A.id, name: 'Ali', stake: 10, returned: 360, net: 350 }, 'Ali: 10 op 17 → +350');
  eq(row('Bo').net, -20, 'Bo: rood 20 verliest');
  eq(row('Cy'), { id: C.id, name: 'Cy', stake: 60, returned: 130, net: 70 }, 'Cy: zwart 50 + dozijn 10 → +70');
  eq(row('Hanna'), { id: H.id, name: 'Hanna', stake: 88, returned: 366, net: 278 }, 'Host: split/street/corner/sixline/kolom/laag/oneven → +278');
  eq(room().players.get(A.id).chips, 1350, 'Ali saldo 1350');
  eq(room().players.get(B.id).chips, 980, 'Bo saldo 980');
  eq(room().players.get(C.id).chips, 1070, 'Cy saldo 1070');
  eq(room().players.get(H.id).chips, 1278, 'Host saldo 1278');
  eq(H.state.room.history, [17], 'geschiedenis bevat 17');
  eq(H.state.room.stats.black, 1, 'statistiek telt 1× zwart');
  eq(room().paused, false, 'niet gepauzeerd');
  ok(room().timerFn === null, 'auto uit: er start geen nieuwe ronde vanzelf');

  group('Ronde 2: nul, herhalen, verdubbelen, toeschouwer (uitslag 0)');
  results.push(0);
  send(H, { t: 'settings', settings: { hostPlays: false } });
  ok(room().players.get(H.id).spectator, 'Host kan croupier (toeschouwer) worden');
  send(H, { t: 'start' });
  await flush();
  H.clear();
  send(H, { t: 'bet', key: 'red', amount: 5 });
  ok(/toeschouwer/.test(H.lastErr().msg), 'toeschouwer kan niet inzetten');
  send(A, { t: 'repeat' });
  eq([...room().players.get(A.id).bets], [['straight:17', 10]], 'Herhaal vorige inzetten (Ali)');
  A.clear();
  send(A, { t: 'repeat' });
  ok(/Wis eerst/.test(A.lastErr().msg), 'herhalen met bestaande inzetten wordt geweigerd');
  send(B, { t: 'bet', key: 'straight:0', amount: 10 });
  send(B, { t: 'bet', key: 'red', amount: 20 });
  send(C, { t: 'bet', key: 'black', amount: 10 });
  send(C, { t: 'double' });
  eq(room().players.get(C.id).bets.get('black'), 20, 'Verdubbel maakt 10 → 20');
  eq(room().players.get(C.id).chips, 1050, 'Verdubbel kost 10 extra');
  send(C, { t: 'clear' });
  send(C, { t: 'bet', key: 'even', amount: 30 });
  C.clear();
  send(C, { t: 'bet', key: 'even', amount: 480 });
  ok(/maximale/.test(C.lastErr().msg), 'max. per vak telt het totaal (30 + 480 > 500)');
  C.clear();
  send(C, { t: 'double' });
  eq(room().players.get(C.id).bets.get('even'), 60, 'verdubbelen na wissen werkt weer');
  send(C, { t: 'undo' });
  eq(room().players.get(C.id).bets.get('even'), 30, 'undo na verdubbelen herstelt 30');
  // Late join: speelt pas volgende ronde mee
  const L = new Fake('Late');
  send(L, { t: 'join', code: H.code, name: 'Late' });
  await flush();
  ok(L.state.me.sitOut, 'late joiner doet pas volgende ronde mee');
  L.clear();
  send(L, { t: 'bet', key: 'red', amount: 5 });
  ok(/volgende ronde/.test(L.lastErr().msg), 'late joiner kan niet inzetten');

  // Handmatig draaien: eerst sluiten
  send(H, { t: 'closeBets' });
  eq(room().phase, 'closed', 'Host sluit inzetten');
  await sleep(100);
  eq(room().phase, 'closed', 'auto uit: wacht op de Host (draait niet vanzelf)');
  send(H, { t: 'spin' });
  await sleep(120);
  eq(room().phase, 'results', 'uitslag na handmatig draaien');
  const r2 = C.last('result');
  eq(r2.result, 0, 'uitslag 0');
  eq(r2.color, 'green', '0 is groen');
  const row2 = (name) => r2.rows.find((r) => r.name === name);
  eq(row2('Ali').net, -10, 'Ali verliest 10 op 17');
  eq(row2('Bo').net, 350 - 20, 'Bo: straight 0 wint (+350), rood 20 verliest');
  eq(row2('Cy').net, -30, 'Cy: even verliest bij 0');
  ok(!row2('Hanna'), 'toeschouwer-Host heeft geen inzetten');
  eq(room().players.get(B.id).chips, 980 + 330, 'Bo saldo 1310');
  eq(room().players.get(A.id).chips, 1340, 'Ali saldo 1340');
  eq(H.state.room.history, [0, 17], 'geschiedenis: nieuwste eerst');

  group('Amerikaanse variant (uitslag 00)');
  send(H, { t: 'settings', settings: { variant: 'american' } });
  eq(room().settings.variant, 'american', 'variant tussen rondes wijzigen kan');
  send(H, { t: 'settings', settings: { hostPlays: true } });
  results.push(37);
  send(H, { t: 'start' });
  H.clear();
  send(H, { t: 'settings', settings: { variant: 'european' } });
  ok(/tussen rondes/.test(H.lastErr().msg), 'variant midden in de ronde wijzigen mag niet');
  await bad(A, { t: 'bet', key: 'corner:0-1-2-3', amount: 5 }, /Ongeldige inzet/, 'Amerikaans: eerste vier bestaat niet');
  send(A, { t: 'bet', key: 'straight:37', amount: 10 });
  send(A, { t: 'bet', key: 'red', amount: 20 });
  send(B, { t: 'bet', key: 'split:3-37', amount: 10 });
  send(B, { t: 'bet', key: 'straight:0', amount: 10 });
  send(H, { t: 'bet', key: 'split:0-37', amount: 10 });
  await bad(H, { t: 'bet', key: 'split:0-3', amount: 5 }, /Ongeldige inzet/, 'Amerikaans: split 0-3 bestaat niet');
  send(H, { t: 'spin' });
  await sleep(120);
  const r3 = A.last('result');
  eq([r3.result, r3.label, r3.color], [37, '00', 'green'], 'uitslag 00 (groen)');
  const row3 = (name) => r3.rows.find((r) => r.name === name);
  eq(row3('Ali').net, 350 - 20, 'Ali: straight 00 wint, rood verliest');
  eq(row3('Bo').net, 170 - 10, 'Bo: split 3-00 wint 17:1, straight 0 verliest');
  eq(row3('Hanna').net, 170, 'Host: split 0-00 wint');

  group('Kick, ban, vergrendelen, dempen, fiches');
  const D = new Fake('Dee');
  send(D, { t: 'join', code: H.code, name: 'Dee' });
  send(H, { t: 'kick', id: D.id });
  ok(D.last('kicked') && !D.last('kicked').ban, 'Dee wordt gekickt');
  ok(!room().players.has(D.id) && D.ctx === null, 'Dee is uit de kamer');
  send(D, { t: 'join', code: H.code, name: 'Dee' });
  ok(D.id !== null && room().players.size >= 5, 'gekickte speler mag opnieuw joinen');
  send(H, { t: 'ban', id: D.id });
  ok(D.last('kicked').ban, 'Dee wordt verbannen');
  const D2 = new Fake('Dee2');
  send(D2, { t: 'join', code: H.code, name: 'dee' });
  eq(D2.lastErr().code, 'banned', 'verbannen bijnaam kan niet opnieuw joinen');
  H.clear();
  send(H, { t: 'kick', id: H.id });
  ok(H.lastErr(), 'Host kan zichzelf niet kicken');

  send(H, { t: 'settings', settings: { locked: true } });
  const E = new Fake('Eve');
  send(E, { t: 'join', code: H.code, name: 'Eve' });
  eq(E.lastErr().code, 'locked', 'vergrendelde kamer weigert nieuwe spelers');
  send(H, { t: 'settings', settings: { locked: false } });
  send(E, { t: 'join', code: H.code, name: 'Eve' });
  ok(E.id, 'ontgrendeld: joinen werkt weer');

  send(E, { t: 'chat', text: '<img src=x onerror=alert(1)> hoi' });
  const chatMsg = A.last('chat');
  ok(chatMsg && chatMsg.name === 'Eve' && chatMsg.text.includes('<img'), 'chat wordt doorgegeven (de browser escapet het)');
  send(H, { t: 'mute', id: E.id, value: true });
  E.clear();
  send(E, { t: 'chat', text: 'nog een' });
  eq(E.lastErr().code, 'chat', 'gedempte speler kan niet chatten');
  send(H, { t: 'mute', id: E.id, value: false });
  send(H, { t: 'settings', settings: { chat: false } });
  E.clear();
  send(E, { t: 'chat', text: 'nog een' });
  ok(/chat staat uit/.test(E.lastErr().msg), 'Host kan de chat uitzetten');
  send(H, { t: 'settings', settings: { chat: true } });
  for (let i = 0; i < 8; i++) send(E, { t: 'chat', text: 'spam ' + i });
  ok(E.errs().some((m) => /snel/.test(m)), 'chat-spam wordt afgeremd');

  const eveChips = () => room().players.get(E.id).chips;
  const startEve = eveChips();
  send(H, { t: 'chips', id: E.id, mode: 'add', amount: 500 });
  eq(eveChips(), startEve + 500, 'Host geeft 500 fiches');
  send(H, { t: 'chips', id: E.id, mode: 'add', amount: -999999 });
  eq(eveChips(), 0, 'afnemen gaat nooit onder 0');
  send(H, { t: 'chips', id: E.id, mode: 'set', amount: 777 });
  eq(eveChips(), 777, 'saldo instellen');
  H.clear();
  send(H, { t: 'chips', id: E.id, mode: 'add', amount: 'veel' });
  ok(H.lastErr(), 'ongeldig aantal fiches geweigerd');
  send(H, { t: 'resetPlayer', id: E.id });
  eq(eveChips(), 1000, 'reset speler naar startsaldo');
  send(H, { t: 'resetAll' });
  ok([...room().players.values()].every((p) => p.chips === 1000), 'reset iedereen naar startsaldo');

  group('Spelers zonder fiches + herstart-bonus');
  send(H, { t: 'chips', id: E.id, mode: 'set', amount: 0 });
  send(H, { t: 'settings', settings: { rebuyBonus: 250 } });
  results.push(5);
  send(H, { t: 'start' });
  E.clear();
  send(E, { t: 'bet', key: 'red', amount: 5 });
  ok(/niet genoeg/.test(E.lastErr().msg), 'speler met 0 fiches kan niet inzetten');
  send(A, { t: 'bet', key: 'straight:5', amount: 1000 }); // max 500 → mislukt
  send(A, { t: 'bet', key: 'straight:5', amount: 500 });
  send(A, { t: 'bet', key: 'straight:6', amount: 500 });
  eq(room().players.get(A.id).chips, 0, 'Ali zet alles in');
  send(H, { t: 'spin' });
  await sleep(120);
  eq(room().players.get(A.id).chips, 18000, 'Ali: 500 op 5 wint 35:1 → 18000 terug, 500 op 6 verloren');
  ok(room().players.get(E.id).chips === 250, 'blut gespeelde speler krijgt herstart-bonus');
  send(H, { t: 'settings', settings: { rebuyBonus: 0 } });

  group('Host kiest het getal');
  await sleep(2000); // rate-limit-budget van de Host-verbinding aanvullen (20 berichten/s)
  A.clear();
  send(A, { t: 'forceNext', value: 7 });
  eq(A.lastErr() && A.lastErr().code, 'nothost', 'speler mag geen getal kiezen');
  if (room().settings.variant !== 'european') send(H, { t: 'settings', settings: { variant: 'european' } });
  eq(room().settings.variant, 'european', 'test start op het Europese wiel');
  if (room().phase !== 'betting') send(H, { t: 'start' });
  eq(room().phase, 'betting', 'nieuwe ronde loopt (inzetten open)');
  H.clear();
  send(H, { t: 'forceNext', value: 99 });
  ok(/bestaat niet/.test(H.lastErr().msg), 'getal buiten het wiel wordt geweigerd');
  H.clear();
  send(H, { t: 'forceNext', value: 37 });
  ok(/bestaat niet/.test(H.lastErr().msg), '00 kan niet op het Europese wiel');
  H.clear();
  send(H, { t: 'forceNext', value: 'zeven' });
  ok(H.lastErr(), 'geen getal wordt geweigerd');
  send(H, { t: 'forceNext', value: 23 });
  await flush();
  eq(H.state.me.forceNext, 23, 'Host ziet zijn eigen keuze in de status');
  eq(A.state.me.forceNext, null, 'andere spelers krijgen de keuze niet vooraf te zien');
  results.push(9); // het toeval zou 9 geven; de Host-keuze wint
  C.clear();
  send(H, { t: 'spin' });
  const fSpin = C.last('spin');
  ok(fSpin && fSpin.result === 23, 'spin-bericht: 23');
  ok(!C.msgs.some((m) => m.t === 'toast' && /Host/.test(m.text)), 'er gaat geen melding over de Host-keuze naar de spelers');
  ok(fSpin.forced === undefined, 'spin-bericht bevat geen extra markering');
  eq(room().forceNext, null, 'keuze geldt maar één keer');
  H.clear();
  send(H, { t: 'forceNext', value: 4 });
  ok(/geen getal kiezen/.test(H.lastErr().msg), 'tijdens het draaien kan het getal niet meer wijzigen');
  await sleep(120);
  const fRes = C.last('result');
  ok(fRes && fRes.result === 23 && fRes.forced === undefined, 'result-bericht: 23, zonder markering');
  eq(A.state.room.history[0], 23, 'uitslagenlijst: 23');
  ok(A.state.room.historyForced === undefined, 'uitslagenlijst bevat geen aparte markering');
  ok(A.state.room.lastResult.forced === undefined, 'lastResult bevat geen markering');
  // Volgende ronde weer gewoon willekeurig
  send(H, { t: 'start' });
  send(H, { t: 'spin' });
  await sleep(120);
  eq(C.last('result').result, 9, 'volgende draai is weer willekeurig (9)');
  // Variant wijzigen wist de keuze; 00 kan dan wel
  send(H, { t: 'forceNext', value: 5 });
  send(H, { t: 'settings', settings: { variant: 'american' } });
  eq(room().forceNext, null, 'variant wijzigen wist de gekozen waarde');
  send(H, { t: 'forceNext', value: 37 });
  eq(room().forceNext, 37, 'op het Amerikaanse wiel kan 00 wel');
  H.clear();
  send(H, { t: 'forceNext', value: null });
  eq(room().forceNext, null, 'null = weer willekeurig');
  send(H, { t: 'settings', settings: { variant: 'european' } });

  group('Pakket 1: avatars, kleuren, stats, ranglijst');
  await sleep(2000); // rate-limit-budget aanvullen
  const COLORS = Rules.COLORS, AVATARS = Rules.AVATARS;
  const P1 = (id) => room().players.get(id);
  ok(AVATARS.length === 24 && COLORS.length === 8 && new Set(AVATARS).size === 24 && new Set(COLORS).size === 8, 'lijsten: 24 unieke avatars, 8 unieke kleuren');
  const defCols = [H, A, B, C].map((c) => P1(c.id).color);
  ok(defCols.every((c) => COLORS.includes(c)) && new Set(defCols).size === 4, 'spelers zonder keuze krijgen elk een eigen standaardkleur');
  ok([H, A, B, C].every((c) => P1(c.id).avatar === ''), 'standaard geen avatar (beginletter)');

  const Pro = new Fake('Pro');
  send(Pro, { t: 'join', code: H.code, name: 'Pro', avatar: AVATARS[3], color: COLORS[6] });
  eq([P1(Pro.id).avatar, P1(Pro.id).color], [AVATARS[3], COLORS[6]], 'join met avatar + kleur wordt overgenomen');
  const Bad = new Fake('Bad');
  send(Bad, { t: 'join', code: H.code, name: 'Bad', avatar: '<script>alert(1)</script>', color: 'red; background:url(x)' });
  eq(P1(Bad.id).avatar, '', 'ongeldige avatar wordt genegeerd (geen vrije tekst)');
  ok(COLORS.includes(P1(Bad.id).color), 'ongeldige kleur wordt vervangen door een standaardkleur');
  send(Bad, { t: 'leave' });

  send(A, { t: 'profile', avatar: AVATARS[20], color: COLORS[5] });
  eq([P1(A.id).avatar, P1(A.id).color], [AVATARS[20], COLORS[5]], 'profile-bericht wijzigt avatar + kleur');
  await flush();
  const seenA = B.state.players.find((p) => p.id === A.id);
  eq([seenA.avatar, seenA.color], [AVATARS[20], COLORS[5]], 'andere spelers zien de nieuwe avatar + kleur');
  send(A, { t: 'profile', color: 'zwart' });
  eq(P1(A.id).color, COLORS[5], 'ongeldige kleur laat de oude staan');
  send(A, { t: 'profile', avatar: 'x'.repeat(50) });
  eq(P1(A.id).avatar, '', 'ongeldige avatar wist de avatar (terug naar beginletter)');
  send(A, { t: 'profile', avatar: AVATARS[1] });

  // Ronde met bekende uitslag: stats + rangen
  if (room().phase !== 'betting') send(H, { t: 'start' });
  eq(room().phase, 'betting', 'ronde loopt');
  const a0 = JSON.parse(JSON.stringify(P1(A.id).stats));
  eq([a0.rounds >= 0, P1(Pro.id).stats.rounds], [true, 0], 'nieuwe speler heeft lege stats');
  results.push(7); // rood
  send(A, { t: 'bet', key: 'straight:7', amount: 10 });
  send(A, { t: 'bet', key: 'black', amount: 5 });
  send(Pro, { t: 'bet', key: 'red', amount: 5 });
  send(Pro, { t: 'bet', key: 'column:1', amount: 20 }); // 7 zit in kolom 1
  send(H, { t: 'spin' });
  await sleep(150);
  const sa = P1(A.id).stats;
  eq([sa.rounds, sa.wins, sa.staked, sa.net], [a0.rounds + 1, a0.wins + 1, a0.staked + 15, a0.net + 345], 'stats van Ali: ronde, winst, ingezet, resultaat');
  ok(sa.bestWin >= 345, 'stats: grootste winst bijgewerkt');
  eq([sa.kinds.straight - (a0.kinds.straight || 0), sa.kinds.black - (a0.kinds.black || 0)], [1, 1], 'stats: soort inzetten geteld (1× per ronde)');
  const sp = P1(Pro.id).stats;
  eq([sp.rounds, sp.wins, sp.staked, sp.net, sp.bestWin, sp.worstLoss], [1, 1, 25, 5 * 2 - 5 + 20 * 3 - 20, 45, 0], 'stats van Pro: rood 1:1 + kolom 2:1 gewonnen');

  B.clear();
  send(B, { t: 'pstats', id: Pro.id });
  const ps = B.last('pstats');
  ok(ps && ps.name === 'Pro' && ps.rounds === 1 && ps.wins === 1 && ps.net === 45, 'pstats: iedereen kan stats van een speler opvragen');
  eq(ps.fav.map((f) => f.kind).sort(), ['column', 'red'], 'pstats: favoriete soorten');
  ok(!('token' in ps) && !('bets' in ps), 'pstats lekt geen token of inzetten');
  B.clear();
  send(B, { t: 'pstats', id: 'bestaatniet' });
  ok(!B.last('pstats') && !B.lastErr(), 'pstats voor onbekende speler: stil genegeerd');

  const ranked = B.state.players.filter((p) => p.rank);
  eq(ranked.map((p) => p.rank).sort((x, y) => x - y), ranked.map((_, i) => i + 1), 'rangen zijn 1..n zonder dubbelen');
  const top = ranked.find((p) => p.rank === 1);
  ok(ranked.every((p) => p.chips <= top.chips), 'rang 1 heeft de meeste fiches');
  eq(ranked.reduce((n, p) => n + (p.rankDelta || 0), 0), 0, 'plaatsverandering telt op tot 0 (alleen wisselen van plek)');
  ok(B.state.players.filter((p) => p.spectator).every((p) => p.rank === null), 'toeschouwers staan niet in de ranglijst');
  ok(B.state.players.every((p) => typeof p.rounds === 'number' && typeof p.wins === 'number'), 'state bevat rondes/winst voor de ranglijst');

  send(H, { t: 'resetPlayer', id: Pro.id });
  eq([P1(Pro.id).stats.rounds, P1(Pro.id).stats.net, P1(Pro.id).rankDelta], [0, 0, null], 'Host reset speler: ook de stats beginnen opnieuw');
  send(Pro, { t: 'leave' });
  await flush();

  group('Inzetten van anderen zichtbaar');
  await sleep(2000);
  send(H, { t: 'settings', settings: { auto: false } });
  if (room().phase !== 'betting') { send(H, { t: 'start' }); }
  await flush();
  send(A, { t: 'bet', key: 'red', amount: 5 });
  await flush();
  const seenByB = B.state.others.find((o) => o.id === A.id);
  ok(seenByB && seenByB.bets.red === 5, 'andere spelers zien waarop A inzet');
  ok(!A.state.others.some((o) => o.id === A.id), 'je ziet jezelf niet dubbel in "others"');
  ok(JSON.stringify(B.state.others).indexOf('token') < 0, 'others bevat alleen id + inzetten');
  send(H, { t: 'settings', settings: { showBets: false } });
  await flush();
  eq(B.state.others, [], 'Host zet zichtbaarheid uit: niemand ziet andermans inzetten');
  ok(B.state.me.bets && A.state.me.bets.red === 5, 'je eigen inzetten blijven zichtbaar');
  send(H, { t: 'settings', settings: { showBets: 'ja' } });
  eq(room().settings.showBets, false, 'alleen true/false geldt');
  send(H, { t: 'settings', settings: { showBets: true } });
  await flush();
  ok(B.state.others.length >= 1, 'weer aan: inzetten zichtbaar');
  send(A, { t: 'undo' }); await flush();
  send(H, { t: 'spin' }); await sleep(400);   // ronde afmaken; automatisch blijft uit, zoals voorheen

  group('Pakket 2: meekijkers');
  await sleep(2000); // rate-limit-budget aanvullen
  const nPl = room().players.size;
  const KEY = H.state.room.watchKey;
  ok(typeof KEY === 'string' && KEY.length >= 12 && !KEY.includes(H.code), 'de Host kent een geheime kijk-sleutel (los van de kamercode)');
  ok(!A.state.room.watchKey && !B.state.room.watchKey, 'gewone spelers krijgen de kijk-sleutel niet te zien');
  const noKey = new Fake('NoKey');
  send(noKey, { t: 'join', code: H.code, watch: true });
  eq(noKey.lastErr().code, 'watchkey', 'meekijken met alleen de kamercode wordt geweigerd');
  send(noKey, { t: 'join', watchKey: 'verkeerdeSleutel' });
  eq(noKey.lastErr().code, 'nowatchkey', 'verkeerde kijk-sleutel wordt geweigerd');
  send(noKey, { t: 'join', watchKey: H.code });
  eq(noKey.lastErr().code, 'nowatchkey', 'de kamercode werkt niet als kijk-sleutel');
  const W1 = new Fake('W1');
  send(W1, { t: 'join', watchKey: KEY });
  const wel = W1.last('welcome');
  ok(wel && wel.watcher === true && /^Kijker \d+$/.test(wel.name), 'join met kijk-sleutel: welkom als kijker, zonder bijnaam');
  ok(wel.code === null && wel.key === KEY, 'welkom bevat geen kamercode');
  ok(!room().players.has(W1.id) && room().watchers.has(W1.id) && room().players.size === nPl, 'kijker is geen speler en neemt geen plek in');
  await flush();
  ok(W1.state && W1.state.me.watcher === true && W1.state.players.length === nPl, 'kijker krijgt state; spelerslijst zonder kijkers');
  ok(!W1.state.me.forceNext && !W1.state.me.host && W1.state.room.code === null && !W1.state.room.watchKey, 'kijker krijgt geen Host-gegevens en geen kamercode in de state');
  eq(H.state.room.watchers, 1, 'state toont het aantal kijkers (1)');

  const chatBefore = room().chatLog.length, chipsA = P1(A.id).chips;
  const blocked = [];
  for (const m of [{ t: 'bet', key: 'red', amount: 5 }, { t: 'chat', text: 'hoi' }, { t: 'start' }, { t: 'spin' }, { t: 'settings', settings: { chat: false } },
    { t: 'chips', id: A.id, amount: 100, mode: 'set' }, { t: 'kick', id: A.id }, { t: 'forceNext', value: 3 }, { t: 'profile', color: COLORS[0] }, { t: 'resetAll' }, { t: 'closeRoom' }]) {
    W1.clear(); send(W1, m);
    if (!W1.lastErr() || W1.lastErr().code !== 'watcher') blocked.push(m.t);
  }
  eq(blocked, [], 'een kijker kan niets doen (inzetten, chatten, Host-acties, profiel): overal fout "watcher"');
  ok(room().chatLog.length === chatBefore && room().settings.chat === true && P1(A.id).chips === chipsA && game.rooms.has(H.code), 'en er is dus niets veranderd');
  W1.clear(); send(W1, { t: 'pstats', id: A.id });
  ok(W1.last('pstats') && Array.isArray(W1.last('pstats').ach), 'statistieken bekijken mag wel (met prestaties)');
  W1.clear(); send(A, { t: 'chat', text: 'hallo kijker' });
  ok(W1.msgs.some((m) => m.t === 'chat' && m.text === 'hallo kijker'), 'kijker ontvangt de chat');
  await flush();
  ok(!W1.msgs.some((m) => JSON.stringify(m).includes(H.code)), 'niets wat een kijker ontvangt bevat de kamercode');
  send(W1, { t: 'join', code: H.code, name: 'Sluipert' });
  ok(/al in een kamer/.test(W1.lastErr().msg) && !room().players.has(W1.id), 'kijker kan niet alsnog als speler "joinen"');

  send(H, { t: 'settings', settings: { locked: true } });
  const W2 = new Fake('W2');
  send(W2, { t: 'join', watchKey: KEY });
  ok(W2.last('welcome') && W2.last('welcome').watcher, 'vergrendelde kamer: kijken mag nog wel (alleen nieuwe spelers worden tegengehouden)');
  const lockedJoin = new Fake('Lj'); send(lockedJoin, { t: 'join', code: H.code, name: 'Laat' });
  eq(lockedJoin.lastErr().code, 'locked', 'vergrendelde kamer houdt nieuwe spelers nog steeds tegen');
  send(H, { t: 'settings', settings: { locked: false } });
  const maxW = game.o.maxWatchers; game.o.maxWatchers = 2;
  const W3 = new Fake('W3');
  send(W3, { t: 'join', watchKey: KEY });
  ok(W2.last('welcome') && W3.lastErr() && W3.lastErr().code === 'full', 'maximum aantal kijkers wordt bewaakt');
  game.o.maxWatchers = maxW;

  send(H, { t: 'settings', settings: { watch: 'nee' } });
  eq(room().settings.watch, true, 'watch accepteert alleen true/false');
  send(A, { t: 'settings', settings: { watch: false } });
  eq(room().settings.watch, true, 'alleen de Host mag meekijken uitzetten');

  const tok2 = W2.token; game.onClose(W2); await flush();
  const W2b = new Fake('W2b');
  send(W2b, { t: 'resume', key: KEY, token: tok2 });
  ok(W2b.last('welcome') && W2b.last('welcome').watcher === true && W2b.id === W2.id, 'kijker kan terugkeren met zijn token (zelfde kijker)');
  await flush();
  eq(H.state.room.watchers, 2, 'na terugkeren: nog steeds 2 kijkers (geen dubbele)');
  send(W2b, { t: 'leave' });
  ok(W2b.last('left') && !room().watchers.has(W2.id), 'kijker kan de kamer verlaten');

  const W2c = new Fake('W2c');
  send(W2c, { t: 'resume', code: H.code, token: tok2 });
  ok(W2c.last('resumeFailed'), 'een kijker-token werkt niet via de kamercode');
  const W5 = new Fake('W5');
  send(W5, { t: 'join', watchKey: KEY });
  game.onClose(W5);
  await sleep(800);
  ok(!room().watchers.has(W5.id), 'kijker die niet terugkomt wordt na de wachttijd opgeruimd');

  send(H, { t: 'settings', settings: { watch: false } });
  ok(W1.last('kicked') && room().watchers.size === 0, 'Host zet meekijken uit: kijkers worden weggestuurd');
  const W4 = new Fake('W4');
  send(W4, { t: 'join', watchKey: KEY });
  eq(W4.lastErr().code, 'nowatch', 'nieuwe kijkers worden geweigerd zolang het uit staat');
  send(H, { t: 'settings', settings: { watch: true } });
  await flush();
  eq(room().settings.watch, true, 'meekijken weer aan');
  eq(H.state.room.watchKey, KEY, 'aan/uit zetten verandert de kijk-sleutel niet');

  const W6 = new Fake('W6');
  send(W6, { t: 'join', watchKey: KEY });
  ok(W6.last('welcome'), 'nog een kijker');
  send(A, { t: 'newWatchKey' });
  eq(A.lastErr().code, 'nothost', 'alleen de Host kan een nieuwe kijk-link maken');
  send(H, { t: 'newWatchKey' });
  await flush();
  const KEY2 = H.state.room.watchKey;
  ok(KEY2 && KEY2 !== KEY, 'Host krijgt een nieuwe kijk-sleutel');
  ok(W6.last('kicked') && room().watchers.size === 0, 'bestaande kijkers worden weggestuurd');
  const W7 = new Fake('W7'); send(W7, { t: 'join', watchKey: KEY });
  eq(W7.lastErr().code, 'nowatchkey', 'de oude kijk-link werkt niet meer');
  send(W7, { t: 'join', watchKey: KEY2 });
  ok(W7.last('welcome') && W7.last('welcome').watcher, 'de nieuwe kijk-link werkt');
  send(W7, { t: 'leave' });

  group('Pakket 2: prestaties');
  await sleep(1000);
  const AH = new Fake('AchHost'), AP = new Fake('Pia'), AQ = new Fake('Quinn'), AC = new Fake('Cleo'), WA = new Fake('Kijk');
  send(AH, { t: 'create', name: 'AchHost' });
  const AR = () => game.rooms.get(AH.code);
  const ap = () => AR().players.get(AP.id), aq = () => AR().players.get(AQ.id), ac = () => AR().players.get(AC.id);
  send(AP, { t: 'join', code: AH.code, name: 'Pia' });
  send(AQ, { t: 'join', code: AH.code, name: 'Quinn' });
  send(WA, { t: 'join', watchKey: AH.state.room.watchKey });
  send(AH, { t: 'settings', settings: { maxBet: 5000, auto: false } });
  const rnd = async (num, bets) => {
    send(AH, { t: 'start' });
    results.push(num);
    for (const [c, k, a] of bets) send(c, { t: 'bet', key: k, amount: a });
    send(AH, { t: 'spin' });
    await sleep(260);
  };
  const feed = (c, re) => c.msgs.filter((m) => m.t === 'toast' && m.kind === 'ach' && re.test(m.text)).length;

  await rnd(7, [[AP, 'red', 10], [AQ, 'black', 10]]);
  eq(ap().ach, ['first_win'], 'eerste gewonnen ronde: "Eerste winst"');
  eq(aq().ach, [], 'verliezer krijgt niets');
  eq([feed(AH, /Pia behaalde: Eerste winst!/), feed(WA, /Pia behaalde: Eerste winst!/)], [1, 1], 'iedereen (ook de kijker) krijgt de melding');
  ok(AR().chatLog.some((m) => m.sys && /🏅 Pia behaalde: Eerste winst!/.test(m.text)), 'melding staat ook in de chat');
  await rnd(7, [[AP, 'straight:7', 10]]);
  ok(ap().ach.includes('straight'), 'Voltreffer: gewonnen met een enkel nummer');
  await rnd(7, [[AP, 'red', 10]]);
  ok(ap().ach.includes('streak3') && ap().stats.streak === 3, 'Hot streak: 3 gewonnen rondes op rij');
  eq(AR().chatLog.filter((m) => /Eerste winst/.test(m.text)).length, 1, 'geen dubbele meldingen voor dezelfde prestatie');
  ok(!ap().ach.includes('king') && !ap().ach.includes('veteran') && !ap().ach.includes('jackpot'), 'nog geen Koning/Doorzetter/Jackpot');
  await rnd(7, [[AP, 'black', 10]]);
  eq(ap().stats.streak, 0, 'verlies zet de reeks terug op 0');
  for (let i = 0; i < 6; i++) await rnd(7, [[AP, 'red', 10]]);
  ok(ap().stats.rounds === 10 && ap().ach.includes('veteran'), 'Doorzetter: 10 rondes gespeeld');

  send(AC, { t: 'join', code: AH.code, name: 'Cleo' });
  const allQ = aq().chips;
  await rnd(7, [[AP, 'straight:7', 50], [AQ, 'red', allQ], [AC, 'black', 1000]]);
  ok(ap().ach.includes('jackpot') && !aq().ach.includes('jackpot'), 'Jackpot: minstens je startbedrag winnen in één ronde');
  ok(aq().ach.includes('allin') && !ap().ach.includes('allin'), 'Alles op één kaart: alle fiches ingezet én gewonnen');
  eq(ac().chips, 0, 'Cleo verloor alles');
  ok(!ac().ach.includes('comeback'), 'nog geen comeback');
  send(AH, { t: 'chips', id: AC.id, amount: 950 });
  await rnd(7, [[AC, 'red', 50]]);
  ok(ac().chips >= 1000 && ac().ach.includes('comeback'), 'Terug uit de put: weer op het startbedrag na bijna alles kwijt');

  AQ.clear(); send(AQ, { t: 'pstats', id: AP.id });
  eq(AQ.last('pstats').ach, ap().ach, 'pstats geeft de prestaties van de speler mee');
  ok(AQ.last('pstats').ach !== ap().ach, 'pstats geeft een kopie (geen levende lijst)');

  AR().roundNo = 18;
  await rnd(7, [[AQ, 'red', 10]]);   // ronde 19: nog geen koning
  ok(!aq().ach.includes('king') && !ap().ach.includes('king'), 'ronde 19: nog geen Koning van de tafel');
  await rnd(7, [[AP, 'red', 10]]);   // ronde 20
  ok(AR().roundNo === 20, 'ronde 20 bereikt');
  const kings = [...AR().players.values()].filter((p) => p.ach.includes('king'));
  eq(kings.length, 1, 'precies één Koning van de tafel');
  const ranks20 = game.ranks(AR());
  eq(ranks20.get(kings[0].id), 1, 'de koning staat op nummer 1');
  await rnd(7, [[AP, 'red', 10]]);   // ronde 21
  eq(AR().chatLog.filter((m) => /Koning van de tafel/.test(m.text)).length, 1, 'Koning wordt maar één keer gemeld');

  const achP = [...ap().ach];
  send(AH, { t: 'resetPlayer', id: AP.id });
  eq([ap().ach, ap().stats.rounds, ap().stats.streak], [achP, 0, 0], 'Host reset speler: stats weg, prestaties blijven');
  send(AH, { t: 'resetAll' });
  ok(aq().ach.includes('allin') && ac().ach.includes('comeback'), 'ook na "Iedereen resetten" blijven prestaties staan');
  eq(new Set(ap().ach).size, ap().ach.length, 'nergens dubbele prestaties');
  send(AH, { t: 'closeRoom' });
  ok(!game.rooms.has(AH.code), 'extra kamer opgeruimd');

  group('Terugkeren (reconnect)');
  const Bn = B.token;
  const chipsB = room().players.get(B.id).chips;
  game.onClose(B);
  await flush();
  ok(!A.state.players.find((p) => p.id === B.id).connected, 'Bo staat als offline in de lijst');
  const B2 = new Fake('Bo2');
  send(B2, { t: 'resume', code: H.code, token: Bn });
  ok(B2.last('welcome') && B2.last('welcome').resumed && B2.id === B.id, 'resume geeft dezelfde speler terug');
  eq(room().players.get(B.id).chips, chipsB, 'zelfde saldo na terugkeren');
  const bad2 = new Fake('x');
  send(bad2, { t: 'resume', code: H.code, token: 'nepnepnep' });
  ok(bad2.last('resumeFailed'), 'resume met fout token faalt');
  const B3 = new Fake('Bo3');
  send(B3, { t: 'resume', code: H.code, token: Bn });
  ok(B2.last('replaced') && B3.id === B.id, 'tweede apparaat neemt de sessie over, eerste krijgt "replaced"');
  game.onClose(B2); // oude verbinding sluit later: mag B3 niet offline zetten
  await flush();
  ok(room().players.get(B.id).connected, 'sluiten van de oude verbinding zet de nieuwe niet offline');

  const G = new Fake('Gone');
  send(G, { t: 'join', code: H.code, name: 'Gone' });
  game.onClose(G);
  await sleep(600);
  ok(![...room().players.values()].some((p) => p.name === 'Gone'), 'na 2 min (hier 500 ms) offline wordt de speler verwijderd');

  group('Host weg: automatische overdracht');
  send(H, { t: 'transfer', id: A.id });
  eq(room().hostId, A.id, 'Host draagt over aan Ali');
  ok(!room().players.get(H.id).spectator && !room().players.get(A.id).spectator, 'na overdracht spelen iedereen mee');
  H.clear();
  send(H, { t: 'start' });
  eq(H.lastErr().code, 'nothost', 'oude Host heeft geen rechten meer');
  game.onClose(A); // Ali (Host) valt weg
  await sleep(60);
  eq(room().hostId, A.id, 'binnen de wachttijd blijft Ali Host');
  await sleep(120);
  eq(room().hostId, H.id, 'na de wachttijd: speler die het langst in de kamer zit (Hanna) is Host');
  ok(H.msgs.some((m) => m.t === 'toast' && /nu de Host/.test(m.text)), 'iedereen krijgt een melding');
  const A2 = new Fake('Ali2');
  send(A2, { t: 'resume', code: H.code, token: A.token });
  ok(A2.id === A.id && room().hostId === H.id, 'Ali komt terug als gewone speler');

  group('Auto-modus: ronde na ronde');
  await sleep(2000); // rate-limit-budget aanvullen
  send(H, { t: 'settings', settings: { auto: true, betTime: 1 } });
  eq(room().settings.betTime, 1, 'inzettijd 1 s (testmodus)');
  const r0 = room().roundNo;
  send(H, { t: 'start' }); // (een fout hier is ok: aanzetten van auto start al een ronde)
  await sleep(3200);
  ok(room().roundNo >= r0 + 2, `rondes lopen vanzelf door: ronde ${r0} → ${room().roundNo}`);
  send(H, { t: 'pause', value: true });
  const rp = room().roundNo;
  await sleep(1800);
  ok(room().roundNo === rp, 'pauze stopt de automatische rondes');
  send(H, { t: 'pause', value: false });
  await sleep(1800);
  ok(room().roundNo > rp, 'hervatten laat de rondes weer doorlopen');
  send(H, { t: 'settings', settings: { auto: false } });
  await sleep(2500);
  const stopped = room().roundNo;
  await sleep(1500);
  ok(room().roundNo === stopped, 'automatisch uit: rondes stoppen');

  group('Ban op IP-adres + unban');
  await sleep(2000);
  const BX = new Fake('Bandiet'); BX.ip = '5.5.5.5';
  send(BX, { t: 'join', code: H.code, name: 'Bandiet' });
  ok(BX.last('welcome'), 'Bandiet joint');
  send(H, { t: 'ban', id: BX.id });
  ok(BX.last('kicked') && BX.last('kicked').ban === true, 'Bandiet wordt verbannen');
  const BY = new Fake('Ander'); BY.ip = '5.5.5.5';
  send(BY, { t: 'join', code: H.code, name: 'HeelAndereNaam' });
  eq(BY.lastErr() && BY.lastErr().code, 'banned', 'zelfde IP, andere naam en nieuwe sessie: geweigerd');
  const BZ = new Fake('Zelfde'); BZ.ip = '6.6.6.6';
  send(BZ, { t: 'join', code: H.code, name: 'Bandiet' });
  eq(BZ.lastErr() && BZ.lastErr().code, 'banned', 'andere IP maar dezelfde bijnaam: ook geweigerd');
  const BW = new Fake('Kijkende'); BW.ip = '5.5.5.5';
  send(BW, { t: 'join', watchKey: H.state.room.watchKey });
  eq(BW.lastErr() && BW.lastErr().code, 'banned', 'verbannen IP kan ook niet meekijken');
  await flush();
  const nBans = H.state.bans.length;
  const entry = H.state.bans.find((b) => b.name === 'Bandiet');
  ok(entry && !JSON.stringify(H.state).includes('5.5.5.5'), 'Host ziet de banlijst (zonder IP-adressen)');
  const member = [...room().players.values()].find((p) => p.conn && p.id !== H.id).conn;
  ok(member.state.bans === undefined && !JSON.stringify(member.state).includes('5.5.5.5'), 'andere spelers zien de banlijst en IP’s niet');
  const banId = entry.id;
  send(member, { t: 'unban', id: banId });
  eq(member.lastErr().code, 'nothost', 'alleen de Host kan een ban opheffen');
  send(H, { t: 'unban', id: 99999 });
  ok(/bestaat niet/.test(H.lastErr().msg), 'onbekende ban geeft een fout');
  send(H, { t: 'unban', id: banId });
  await flush();
  eq(H.state.bans.length, nBans - 1, 'ban opgeheven: weg uit de lijst');
  send(BY, { t: 'join', code: H.code, name: 'HeelAndereNaam' });
  ok(BY.last('welcome'), 'na unban kan hetzelfde IP weer joinen');
  send(BY, { t: 'leave' });
  const L1 = new Fake('Lokaal1'); L1.ip = '127.0.0.1';
  send(L1, { t: 'join', code: H.code, name: 'Lokaal1' });
  send(H, { t: 'ban', id: L1.id });
  const L2 = new Fake('Lokaal2'); L2.ip = '127.0.0.1';
  send(L2, { t: 'join', code: H.code, name: 'Lokaal2' });
  ok(L2.last('welcome'), 'lokale adressen (127.0.0.1) worden niet op IP verbannen (testen met tabbladen)');
  send(L2, { t: 'leave' });
  send(H, { t: 'unban', id: H.state.bans ? room().bans[0].id : 0 });

  group('Kamer sluiten en opruimen');
  const pl = [...room().players.values()].filter((p) => p.conn);
  const conns = pl.map((p) => p.conn);
  send(H, { t: 'closeRoom' });
  ok(!game.rooms.has(H.code), 'kamer is verwijderd');
  ok(conns.every((c) => c.last('roomClosed')), 'iedereen krijgt "roomClosed"');
  send(A2, { t: 'join', code: H.code, name: 'Nieuw' });
  eq(A2.lastErr().code, 'noroom', 'gesloten kamer is niet meer te joinen');

  const T = new Fake('Temp');
  send(T, { t: 'create', name: 'Temp' });
  const tcode = T.code;
  game.onClose(T);
  await sleep(100);
  game.sweep();
  ok(!game.rooms.has(tcode), 'lege kamers worden opgeruimd');

  group('Robuustheid');
  const X = new Fake('X');
  game.handle(X, 'dit is geen json');
  ok(X.lastErr(), 'kapotte JSON wordt netjes afgehandeld');
  game.handle(X, JSON.stringify([1, 2, 3]));
  game.handle(X, JSON.stringify({ t: 42 }));
  game.handle(X, JSON.stringify(null));
  send(X, { t: 'bet', key: 'red', amount: 5 });
  ok(X.lastErr() && X.lastErr().code === 'nojoin', 'acties buiten een kamer worden geweigerd');
  for (let i = 0; i < 300; i++) send(X, { t: 'ping' });
  ok(X.errs().some((m) => /te snel/.test(m)), 'rate limiting grijpt in bij spam');
  const Y = new Fake('Y');
  send(Y, { t: 'create', name: 'Een' });
  send(Y, { t: 'create', name: 'Twee' });
  ok(Y.lastErr() && /al in een kamer/.test(Y.lastErr().msg), 'twee kamers tegelijk maken wordt geweigerd');

  game.shutdown();
}

module.exports = { run };
if (require.main === module) {
  run().then(() => require('./harness').summary() || process.exit(1));
}
