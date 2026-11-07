/* Roulette Royale — client. Alleen virtuele fiches. De server beslist alles; dit toont en stuurt verzoeken. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = (n) => Number(n).toLocaleString('nl-BE');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  /** Maakt een element. Tekst gaat altijd via textContent/TextNode, dus nooit als HTML. */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === false || v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  }

  const store = {
    get(area, k) { try { return JSON.parse(window[area].getItem(k)); } catch (e) { return null; } },
    set(area, k, v) { try { window[area].setItem(k, JSON.stringify(v)); } catch (e) { /* niet beschikbaar */ } },
    del(area, k) { try { window[area].removeItem(k); } catch (e) { /* niet beschikbaar */ } },
  };

  const colorName = (n) => Rules.colorOf(n);
  const tier = (a) => (a >= 500 ? 't500' : a >= 100 ? 't100' : a >= 25 ? 't25' : a >= 10 ? 't10' : a >= 5 ? 't5' : 't1');
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n));

  // ------------------------------------------------------------------ geluid (Web Audio, geen bestanden)
  const Sound = {
    ctx: null,
    on: store.get('localStorage', 'roulette.sound') !== false,
    init() {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type, vol, delay, slideTo) {
      if (!this.on || !this.ctx) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    chip() { this.tone(1100, 0.05, 'triangle', 0.07); this.tone(1650, 0.04, 'triangle', 0.05, 0.03); },
    tick() { this.tone(1500 + Math.random() * 500, 0.018, 'square', 0.02); },
    count() { this.tone(700, 0.07, 'square', 0.035); },
    ping() { this.tone(880, 0.09, 'sine', 0.05); },
    bell() { this.tone(660, 0.5, 'sine', 0.06); this.tone(990, 0.4, 'sine', 0.04, 0.02); },
    win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, i * 0.09)); },
    lose() { this.tone(240, 0.4, 'sawtooth', 0.04, 0, 110); },
  };

  // ------------------------------------------------------------------ toestand
  const S = {
    ws: null, open: false, joined: false, me: null, st: null, offset: 0,
    chip: 5, chat: [], retry: 0, noReconnect: false, queue: [],
    orient: null, model: null, modelKey: '', spinRound: null, pending: null, shownRound: 0,
    lastCountSec: -1,
  };

  // ------------------------------------------------------------------ verbinding
  function send(obj) {
    if (S.ws && S.open) { S.ws.send(JSON.stringify(obj)); return true; }
    return false;
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    S.ws = ws;
    ws.onopen = () => {
      S.open = true; S.retry = 0;
      $('#conn-banner').hidden = true;
      const ses = store.get('sessionStorage', 'roulette.session');
      if (ses && !S.noReconnect) send({ t: 'resume', code: ses.code, token: ses.token });
      while (S.queue.length) send(S.queue.shift());
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      onMsg(m);
    };
    ws.onclose = () => {
      S.open = false;
      if (S.noReconnect) return;
      if (S.joined) $('#conn-banner').hidden = false;
      S.retry += 1;
      setTimeout(connect, Math.min(8000, 700 * S.retry));
    };
    ws.onerror = () => { /* onclose volgt */ };
  }

  function request(obj) { if (!send(obj)) S.queue.push(obj); }

  function onMsg(m) {
    switch (m.t) {
      case 'welcome': return onWelcome(m);
      case 'state': return onState(m);
      case 'chat': S.chat.push(m); if (S.chat.length > 80) S.chat.shift(); renderChat(); if (!m.sys && S.me && m.id !== S.me.id) Sound.ping(); return;
      case 'toast': return toast(m.text, m.kind);
      case 'spin': return onSpin(m);
      case 'result': return onResult(m);
      case 'error':
        if (S.joined) toast(m.msg, 'error'); else showStartError(m.msg);
        return;
      case 'kicked': return leaveToStart(m.msg || 'Je bent uit de kamer gezet.');
      case 'roomClosed': return leaveToStart(m.msg || 'De kamer is gesloten.');
      case 'left': return leaveToStart('');
      case 'resumeFailed':
        store.del('sessionStorage', 'roulette.session');
        if (S.joined) leaveToStart('De verbinding met de kamer is verlopen. Join opnieuw.');
        return;
      case 'replaced':
        S.noReconnect = true;
        leaveToStart('Je sessie is in een ander venster geopend. Herlaad deze pagina om hier verder te spelen.', true);
        return;
    }
  }

  function onWelcome(m) {
    S.me = { id: m.id, token: m.token, code: m.code, name: m.name };
    store.set('sessionStorage', 'roulette.session', { code: m.code, token: m.token, name: m.name });
    store.set('localStorage', 'roulette.last', { code: m.code, token: m.token, name: m.name, ts: Date.now() });
    store.set('localStorage', 'roulette.name', m.name);
    S.chat = m.chatLog || [];
    S.joined = true;
    S.shownRound = 0;
    $('#view-start').hidden = true;
    $('#view-game').hidden = false;
    $('#room-code').textContent = m.code;
    document.title = `Roulette ${m.code}`;
    renderChat(true);
    try { history.replaceState(null, '', `?room=${m.code}`); } catch (e) { /* niets */ }
  }

  function leaveToStart(msg, keepBlocked) {
    S.joined = false; S.me = null; S.st = null; S.pending = null; S.spinRound = null;
    store.del('sessionStorage', 'roulette.session');
    if (!keepBlocked) store.del('localStorage', 'roulette.last');
    $('#view-game').hidden = true;
    $('#view-start').hidden = false;
    $('#result-banner').hidden = true;
    $('#conn-banner').hidden = true;
    document.title = 'Roulette Royale';
    showStartError(msg || '');
    renderRejoin();
    Wheel.last = null;
    Wheel.anim = null;
  }

  function showStartError(t) { $('#start-error').textContent = t || ''; }

  // ------------------------------------------------------------------ toasts
  function toast(text, kind) {
    const box = $('#toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const el = h('div', { class: 'toast ' + (kind || ''), text });
    box.append(el);
    setTimeout(() => el.remove(), kind === 'error' ? 4500 : 3400);
  }

  // ------------------------------------------------------------------ state-verwerking
  function onState(m) {
    const prevPhase = S.st && S.st.room.phase;
    S.offset = m.now - Date.now();
    S.st = m;
    const r = m.room;

    if (!Wheel.face || Wheel.variant !== r.settings.variant) Wheel.build(r.settings.variant);
    if (r.lastResult && !Wheel.last && !Wheel.anim) Wheel.last = { result: r.lastResult.result, variant: r.settings.variant };
    if (r.spin && S.spinRound !== r.round) { // binnengekomen midden in een spin (of refresh)
      startSpin(r.spin.result, r.spin.variant, r.spin.duration, clamp(m.now - r.spin.startedAt, 0, r.spin.duration), r.round);
    }
    if (r.phase === 'betting' && prevPhase !== 'betting') {
      $('#result-banner').hidden = true;
      Sound.bell();
    }
    renderAll();
  }

  function renderAll() {
    renderTopbar();
    renderMe();
    renderHistory();
    renderChips();
    renderPlayers();
    renderHost();
    ensureTable();
    renderBets();
    updateTimer();
  }

  const PHASES = {
    lobby: 'Wachten op de Host', betting: 'Inzetten open', closed: 'Inzetten gesloten', spinning: 'Het wiel draait…', results: 'Uitslag',
  };

  function renderTopbar() {
    const r = S.st.room;
    $('#phase-label').textContent = r.paused ? '⏸ Gepauzeerd' : PHASES[r.phase] + (r.round ? ` · ronde ${r.round}` : '');
    $('#pause-badge').hidden = !r.paused;
    $('#btn-sound').textContent = Sound.on ? '🔊' : '🔇';
  }

  function renderMe() {
    const me = S.st.me;
    $('#my-chips').textContent = fmt(me.chips);
    $('#my-staked').textContent = me.staked ? `+ ${fmt(me.staked)} ingezet` : '';
    const r = S.st.room;
    let hint = '';
    if (me.spectator) hint = 'Je bent toeschouwer (croupier).';
    else if (me.sitOut && r.phase !== 'lobby' && r.phase !== 'results') hint = 'Je doet mee vanaf de volgende ronde.';
    else if (me.chips === 0 && !me.staked) hint = 'Geen fiches meer. Vraag de Host om fiches.';
    else if (r.phase === 'lobby') hint = me.host ? 'Start een ronde in het Host-paneel.' : 'De Host start zo de eerste ronde.';
    else if (r.phase === 'betting') hint = r.paused ? 'Gepauzeerd door de Host.' : 'Kies een fiche en klik op de tafel.';
    else if (r.phase === 'closed') hint = 'Rien ne va plus…';
    else if (r.phase === 'results' && me.net != null) hint = me.net >= 0 ? `Vorige ronde: +${fmt(me.net)}` : `Vorige ronde: ${fmt(me.net)}`;
    $('#hint').textContent = hint;
  }

  function renderHistory() {
    const r = S.st.room;
    const hist = $('#history');
    hist.replaceChildren(...r.history.map((n) => h('span', { class: 'hist-n ' + colorName(n), text: Rules.label(n) })));
    if (!r.history.length) hist.append(h('span', { class: 'tags', text: 'Nog geen uitslagen.' }));

    const st = r.stats;
    const hc = $('#hotcold');
    hc.replaceChildren();
    if (st.total >= 5) {
      const mini = (n, extra) => h('span', { class: 'mini ' + colorName(n), text: Rules.label(n) + (extra || '') });
      hc.append(
        h('div', { class: 'row' }, '🔥 Hot:', st.hot.map((x) => mini(x.n, ` ×${x.c}`))),
        h('div', { class: 'row' }, '❄ Koud:', st.cold.map((x) => mini(x.n, x.g >= st.total ? ' nooit' : ` ${x.g}×`))),
        h('div', { class: 'row' }, `Laatste 20: ${st.red} rood · ${st.black} zwart · ${st.green} groen`),
      );
    }
  }

  // ------------------------------------------------------------------ timer
  function updateTimer() {
    if (!S.st) return;
    const r = S.st.room;
    const el = $('#timer');
    let left = null;
    if (r.phase === 'betting') left = r.paused ? r.timeLeft : r.endsAt - (Date.now() + S.offset);
    if (left == null) { el.textContent = ''; el.classList.remove('urgent'); return; }
    const sec = Math.max(0, Math.ceil(left / 1000));
    el.textContent = sec + 's';
    const urgent = sec <= 5 && !r.paused;
    el.classList.toggle('urgent', urgent);
    if (urgent && sec > 0 && sec !== S.lastCountSec) Sound.count();
    S.lastCountSec = sec;
  }
  setInterval(updateTimer, 200);

  // ------------------------------------------------------------------ fiches kiezen + acties
  function renderChips() {
    const st = S.st, s = st.room.settings, me = st.me;
    const row = $('#chip-row');
    const usable = Rules.CHIPS.filter((c) => c >= s.minBet && c <= s.maxBet);
    if (!usable.includes(S.chip)) S.chip = usable.includes(5) ? 5 : (usable[0] || Rules.CHIPS[0]);
    row.replaceChildren(...Rules.CHIPS.map((c) => {
      const ok = usable.includes(c);
      return h('button', {
        class: `chipbtn ${tier(c)}${c === S.chip ? ' sel' : ''}`, disabled: !ok, 'aria-label': `Fiche ${c}`, 'aria-pressed': c === S.chip ? 'true' : 'false',
        onclick: () => { S.chip = c; Sound.init(); Sound.chip(); renderChips(); },
      }, String(c));
    }));
    const can = !betBlock();
    $('#btn-undo').disabled = !can || !me.canUndo;
    $('#btn-clear').disabled = !can || !Object.keys(me.bets).length;
    $('#btn-repeat').disabled = !can || !me.hasPrev || Object.keys(me.bets).length > 0;
    $('#btn-double').disabled = !can || !Object.keys(me.bets).length;
    $('#table').classList.toggle('locked', !can);
  }

  /** Waarom kan je nu niet inzetten? (tekst) of null als het wel kan. */
  function betBlock() {
    const st = S.st; if (!st) return 'Niet verbonden.';
    const r = st.room, me = st.me;
    if (r.phase !== 'betting') return r.phase === 'lobby' ? 'De Host moet eerst een ronde starten.' : 'De inzetten zijn niet open.';
    if (r.paused) return 'Het spel is gepauzeerd.';
    if (me.spectator) return 'Je bent toeschouwer.';
    if (me.sitOut) return 'Je doet mee vanaf de volgende ronde.';
    return null;
  }

  function placeBet(key) {
    Sound.init();
    const block = betBlock();
    if (block) return toast(block, 'warn');
    const me = S.st.me;
    if (S.chip > me.chips) return toast('Niet genoeg fiches voor deze fiche.', 'warn');
    Sound.chip();
    send({ t: 'bet', key, amount: S.chip });
  }

  // ------------------------------------------------------------------ speeltafel
  /*
   * Het raster rekent in halve vakjes ("units"): een nummervakje is 2×2 units.
   * Horizontaal (breed scherm): 28 kolommen × 10 rijen. Verticaal (smal scherm): 10 kolommen × 28 rijen.
   * Straat-as s = 0..12 (rijen van drie), lijn-as λ = 0..3 (0 = buitenrand).
   */
  function buildModel(variant, orient) {
    const HZ = orient === 'H';
    const C = HZ ? 28 : 10, R = HZ ? 10 : 28;
    const defs = Rules.buildBets(variant);
    const cells = [], spots = [], pos = {};

    const pt = (sF, lam) => (HZ ? { x: 2 + 2 * sF, y: 6 - 2 * lam } : { x: 4 + 2 * lam, y: 2 + 2 * sF });
    const rect = (x0, y0, x1, y1) => ({ col: x0 + 1, row: y0 + 1, cs: x1 - x0, rs: y1 - y0 });
    const box = (sa, sb, la, lb) => (HZ ? rect(2 + 2 * sa, 6 - 2 * lb, 2 + 2 * sb, 6 - 2 * la) : rect(4 + 2 * la, 2 + 2 * sa, 4 + 2 * lb, 2 + 2 * sb));
    const center = (r) => ({ x: r.col - 1 + r.cs / 2, y: r.row - 1 + r.rs / 2 });
    const addCell = (key, label, r, cls, nums, extra) => {
      cells.push(Object.assign({ key, label, r, cls, nums }, extra || {}));
      pos[key] = center(r);
    };

    // nullen
    const us = variant === 'american';
    if (!us) addCell('straight:0', '0', HZ ? rect(0, 0, 2, 6) : rect(4, 0, 10, 2), 'green', [0], { n: 0 });
    else if (HZ) {
      addCell('straight:37', '00', rect(0, 0, 2, 3), 'green', [37], { n: 37 });
      addCell('straight:0', '0', rect(0, 3, 2, 6), 'green', [0], { n: 0 });
    } else {
      addCell('straight:0', '0', rect(4, 0, 7, 2), 'green', [0], { n: 0 });
      addCell('straight:37', '00', rect(7, 0, 10, 2), 'green', [37], { n: 37 });
    }

    // nummers 1-36
    for (let n = 1; n <= 36; n++) {
      const s = Math.floor((n - 1) / 3), l = (n - 1) % 3;
      addCell('straight:' + n, String(n), box(s, s + 1, l, l + 1), colorName(n), [n], { n });
    }
    // kolommen (2:1)
    for (let c = 1; c <= 3; c++) {
      const l = c - 1;
      addCell('column:' + c, '2:1', HZ ? rect(26, 6 - 2 * (l + 1), 28, 6 - 2 * l) : rect(4 + 2 * l, 26, 4 + 2 * (l + 1), 28), 'out', defs['column:' + c].nums);
    }
    // dozijnen
    const dozenLabel = ['1e 12', '2e 12', '3e 12'];
    for (let d = 0; d < 3; d++) {
      addCell('dozen:' + (d + 1), dozenLabel[d], HZ ? rect(2 + 8 * d, 6, 10 + 8 * d, 8) : rect(2, 2 + 8 * d, 4, 10 + 8 * d), 'out', defs['dozen:' + (d + 1)].nums);
    }
    // buiteninzetten 1:1
    const outside = [['low', '1-18'], ['even', 'EVEN'], ['red', ''], ['black', ''], ['odd', 'ONEVEN'], ['high', '19-36']];
    outside.forEach(([key, label], i) => {
      const r = HZ ? rect(2 + 4 * i, 8, 6 + 4 * i, 10) : rect(0, 2 + 4 * i, 2, 6 + 4 * i);
      addCell(key, label, r, 'out', defs[key].nums, key === 'red' || key === 'black' ? { diamond: key } : {});
    });

    // hotspots voor inzetten tussen vakjes
    const addSpot = (key, p) => { spots.push({ key, x: p.x, y: p.y, nums: defs[key].nums }); pos[key] = p; };
    for (const d of Object.values(defs)) {
      const n = d.nums;
      if (d.kind === 'split') {
        const [a, b] = n;
        if (a === 0 || b === 37) {
          if (!us) addSpot(d.key, pt(0, b - 1 + 0.5));
          else if (d.key === 'split:0-1') addSpot(d.key, pt(0, 0.5));
          else if (d.key === 'split:0-2') addSpot(d.key, pt(0, 1.25));
          else if (d.key === 'split:2-37') addSpot(d.key, pt(0, 1.75));
          else if (d.key === 'split:3-37') addSpot(d.key, pt(0, 2.5));
          else addSpot(d.key, HZ ? { x: 1, y: 3 } : { x: 7, y: 1 }); // 0-00
        } else {
          const s = Math.floor((a - 1) / 3), l = (a - 1) % 3;
          addSpot(d.key, b === a + 1 ? pt(s + 0.5, l + 1) : pt(s + 1, l + 0.5));
        }
      } else if (d.kind === 'street') {
        addSpot(d.key, pt(Math.floor((n[0] - 1) / 3) + 0.5, 0));
      } else if (d.kind === 'corner') {
        if (n[0] === 0) addSpot(d.key, pt(0, 0));
        else addSpot(d.key, pt(Math.floor((n[0] - 1) / 3) + 1, ((n[0] - 1) % 3) + 1));
      } else if (d.kind === 'sixline') {
        addSpot(d.key, pt(Math.floor((n[0] - 1) / 3) + 1, 0));
      }
    }
    return { C, R, cells, spots, pos, HZ };
  }

  function ensureTable() {
    const wrap = $('#table-wrap');
    const w = wrap.clientWidth - (parseFloat(getComputedStyle(wrap).paddingLeft) * 2 || 0);
    const orient = w < 600 ? 'V' : 'H';
    const key = S.st.room.settings.variant + orient;
    if (key !== S.modelKey) {
      S.modelKey = key;
      S.model = buildModel(S.st.room.settings.variant, orient);
      drawTable();
    }
    sizeTable(w);
  }

  function sizeTable(w) {
    if (!S.model || !w) return;
    const ux = w / S.model.C;
    const uy = S.model.HZ ? clamp(ux * 0.86, 20, 30) : clamp(ux * 0.62, 20, 27);
    const t = $('#table');
    t.style.setProperty('--u', uy.toFixed(1) + 'px');
    const cellMin = Math.min(2 * ux, 2 * uy);
    t.style.setProperty('--hs', clamp(cellMin * 0.5, 18, 30).toFixed(1) + 'px');
    t.style.setProperty('--chip', clamp(cellMin * 0.62, 26, 38).toFixed(1) + 'px');
  }

  function drawTable() {
    const m = S.model;
    const t = $('#table');
    t.replaceChildren();
    t.style.gridTemplateColumns = `repeat(${m.C}, 1fr)`;
    t.style.gridTemplateRows = `repeat(${m.R}, var(--u))`;

    const hover = (nums, on) => {
      for (const c of t.querySelectorAll('.cell[data-n]')) c.classList.toggle('hl', on && nums.includes(Number(c.dataset.n)));
    };
    for (const c of m.cells) {
      const el = h('div', {
        class: 'cell ' + c.cls, role: 'button', tabindex: '0', 'data-key': c.key, 'aria-label': c.diamond ? (c.diamond === 'red' ? 'Rood' : 'Zwart') : c.label,
        onclick: () => placeBet(c.key),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placeBet(c.key); } },
        onpointerenter: () => hover(c.nums, true),
        onpointerleave: () => hover(c.nums, false),
      }, c.diamond ? h('span', { class: 'diamond ' + c.diamond }) : c.label);
      if (c.n != null) el.dataset.n = c.n;
      el.style.gridColumn = `${c.r.col} / span ${c.r.cs}`;
      el.style.gridRow = `${c.r.row} / span ${c.r.rs}`;
      t.append(el);
    }
    const ov = h('div', { class: 'overlay', id: 'overlay' });
    for (const s of m.spots) {
      const el = h('div', {
        class: 'spot', role: 'button', tabindex: '-1', 'data-key': s.key, title: s.key.split(':')[0],
        onclick: () => placeBet(s.key),
        onpointerenter: () => hover(s.nums, true),
        onpointerleave: () => hover(s.nums, false),
      });
      el.style.left = (s.x / m.C * 100) + '%';
      el.style.top = (s.y / m.R * 100) + '%';
      ov.append(el);
    }
    const chips = h('div', { class: 'overlay', id: 'chips-layer', style: 'z-index:8' });
    t.append(ov, chips);
  }

  function renderBets() {
    const layer = $('#chips-layer');
    if (!layer || !S.model) return;
    const r = S.st.room, bets = S.st.me.bets;
    const res = r.phase === 'results' && r.lastResult ? r.lastResult.result : null;
    const defs = Rules.buildBets(r.settings.variant);
    layer.replaceChildren();
    for (const [key, amount] of Object.entries(bets)) {
      const p = S.model.pos[key];
      if (!p) continue;
      let cls = 'chip-on ' + tier(amount);
      if (res != null && defs[key]) cls += defs[key].nums.includes(res) ? ' won' : ' lost';
      const el = h('div', { class: cls, text: short(amount) });
      el.style.left = (p.x / S.model.C * 100) + '%';
      el.style.top = (p.y / S.model.R * 100) + '%';
      layer.append(el);
    }
    for (const c of $('#table').querySelectorAll('.cell[data-n]')) c.classList.toggle('win', res != null && Number(c.dataset.n) === res);
  }

  new ResizeObserver(() => { if (S.st && S.joined) ensureTable(); }).observe($('#table-wrap'));

  // ------------------------------------------------------------------ wiel
  const Wheel = {
    cv: $('#wheel'), ctx: null, css: 300, dpr: 1, bowl: null, face: null, variant: null,
    angle: 0, anim: null, last: null, lastT: 0, tickIdx: -1, lastTick: 0,

    resize() {
      const wrap = $('#wheel-wrap');
      const css = clamp(Math.floor(wrap.clientWidth || 300), 200, 380);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (css === this.css && dpr === this.dpr && this.ctx) return;
      this.css = css; this.dpr = dpr;
      this.cv.width = this.cv.height = Math.round(css * dpr);
      this.cv.style.width = this.cv.style.height = css + 'px';
      this.ctx = this.cv.getContext('2d');
      if (this.variant) this.build(this.variant);
    },

    build(variant) {
      this.variant = variant;
      if (!this.ctx) this.resize();
      const px = this.cv.width, R = px / 2;
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = px; return c; };
      const wheel = Rules.VARIANTS[variant].wheel, N = wheel.length, w = TAU / N;

      // schaal (statisch)
      const bowl = mk(), g = bowl.getContext('2d');
      let gr = g.createRadialGradient(R, R, R * 0.5, R, R, R);
      gr.addColorStop(0, '#3d2314'); gr.addColorStop(0.7, '#25140a'); gr.addColorStop(1, '#110905');
      g.fillStyle = gr; g.beginPath(); g.arc(R, R, R * 0.995, 0, TAU); g.fill();
      g.strokeStyle = '#d6b25e'; g.lineWidth = R * 0.03; g.beginPath(); g.arc(R, R, R * 0.97, 0, TAU); g.stroke();
      gr = g.createRadialGradient(R, R, R * 0.78, R, R, R * 0.95);
      gr.addColorStop(0, '#0b0603'); gr.addColorStop(0.55, '#2d1a0d'); gr.addColorStop(1, '#150b06');
      g.fillStyle = gr; g.beginPath(); g.arc(R, R, R * 0.95, 0, TAU); g.arc(R, R, R * 0.79, 0, TAU, true); g.fill();
      g.fillStyle = '#d6b25e';
      for (let i = 0; i < 8; i++) {
        g.save(); g.translate(R, R); g.rotate(i * TAU / 8 + TAU / 16); g.translate(0, -R * 0.87);
        g.rotate(Math.PI / 4); g.fillRect(-R * 0.018, -R * 0.018, R * 0.036, R * 0.036); g.restore();
      }

      // draaiende schijf
      const face = mk(), f = face.getContext('2d');
      for (let i = 0; i < N; i++) {
        const a0 = i * w - w / 2 - Math.PI / 2, a1 = a0 + w;
        f.beginPath(); f.arc(R, R, R * 0.8, a0, a1); f.arc(R, R, R * 0.6, a1, a0, true); f.closePath();
        const col = colorName(wheel[i]);
        f.fillStyle = col === 'red' ? '#b3202a' : col === 'black' ? '#151515' : '#0f7b4a'; f.fill();
        f.strokeStyle = 'rgba(214,178,94,.9)'; f.lineWidth = Math.max(1, R * 0.006); f.stroke();
        f.save(); f.translate(R, R); f.rotate(i * w); f.translate(0, -R * 0.705);
        f.fillStyle = '#fff'; f.font = `700 ${R * 0.072}px system-ui, sans-serif`; f.textAlign = 'center'; f.textBaseline = 'middle';
        f.fillText(Rules.label(wheel[i]), 0, 0); f.restore();
      }
      f.strokeStyle = '#d6b25e'; f.lineWidth = R * 0.02; f.beginPath(); f.arc(R, R, R * 0.8, 0, TAU); f.stroke();
      gr = f.createRadialGradient(R, R, R * 0.05, R, R, R * 0.6);
      gr.addColorStop(0, '#d9b45a'); gr.addColorStop(0.5, '#7b5521'); gr.addColorStop(1, '#2b1a0a');
      f.fillStyle = gr; f.beginPath(); f.arc(R, R, R * 0.595, 0, TAU); f.fill();
      f.strokeStyle = 'rgba(243,220,153,.85)'; f.lineWidth = R * 0.022; f.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        f.beginPath(); f.moveTo(R + Math.cos(i * Math.PI / 2) * R * 0.17, R + Math.sin(i * Math.PI / 2) * R * 0.17);
        f.lineTo(R + Math.cos(i * Math.PI / 2) * R * 0.5, R + Math.sin(i * Math.PI / 2) * R * 0.5); f.stroke();
        f.fillStyle = '#f3dc99'; f.beginPath(); f.arc(R + Math.cos(i * Math.PI / 2) * R * 0.5, R + Math.sin(i * Math.PI / 2) * R * 0.5, R * 0.035, 0, TAU); f.fill();
      }
      gr = f.createRadialGradient(R * 0.95, R * 0.92, 1, R, R, R * 0.17);
      gr.addColorStop(0, '#fff2c4'); gr.addColorStop(1, '#a9812c');
      f.fillStyle = gr; f.beginPath(); f.arc(R, R, R * 0.15, 0, TAU); f.fill();

      this.bowl = bowl; this.face = face;
    },

    start(a) { // a: {result, variant, duration, elapsed}
      if (this.variant !== a.variant) this.build(a.variant);
      const wheel = Rules.VARIANTS[a.variant].wheel;
      const N = wheel.length;
      this.anim = {
        result: a.result, variant: a.variant, duration: a.duration, k: wheel.indexOf(a.result), N, w: TAU / N,
        start: performance.now() - a.elapsed, w0: this.angle, wTot: TAU * 2.2, L: TAU * 6, done: false,
      };
      this.last = null;
      this.tickIdx = -1;
    },

    frame(now) {
      if (!this.ctx || !this.bowl) return;
      const dt = Math.min(0.05, (now - (this.lastT || now)) / 1000);
      this.lastT = now;
      const px = this.cv.width, R = px / 2, ctx = this.ctx;
      let ballA = null, ballR = 0.705, showHub = false;

      const a = this.anim;
      if (a && !a.done) {
        const p = clamp((now - a.start) / a.duration, 0, 1);
        this.angle = a.w0 + a.wTot * (1 - Math.pow(1 - p, 2));
        const eb = 1 - Math.pow(1 - p, 2.4);
        const final = a.w0 + a.wTot + a.k * a.w;
        const free = final + a.L * (1 - eb);
        const pocketNow = this.angle + a.k * a.w;
        let d = pocketNow - free; d -= TAU * Math.round(d / TAU);
        ballA = free + d * smooth(0.84, 1, p);
        ballR = lerp(0.9, 0.705, smooth(0.7, 0.93, p));
        if (p > 0.8 && p < 0.97) ballR += Math.sin((p - 0.8) * 60) * 0.012 * (1 - (p - 0.8) / 0.17);
        const rel = (((ballA - this.angle) % TAU) + TAU) % TAU;
        const idx = Math.floor(rel / a.w + 0.5) % a.N;
        if (idx !== this.tickIdx) {
          if (now - this.lastTick > 45 && p < 0.97) Sound.tick();
          this.lastTick = now; this.tickIdx = idx;
        }
        if (p >= 1) { a.done = true; this.last = { result: a.result, variant: a.variant }; onSpinDone(); }
      } else {
        this.angle += dt * 0.1;
        if (this.last && this.last.variant === this.variant) {
          const k = Rules.VARIANTS[this.variant].wheel.indexOf(this.last.result);
          if (k >= 0) { ballA = this.angle + k * (TAU / Rules.VARIANTS[this.variant].wheel.length); showHub = true; }
        }
      }

      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(this.bowl, 0, 0);
      ctx.save(); ctx.translate(R, R); ctx.rotate(this.angle); ctx.drawImage(this.face, -R, -R); ctx.restore();

      if (showHub && this.last) { // laatste uitslag in het hart van het wiel
        const col = colorName(this.last.result);
        ctx.fillStyle = col === 'red' ? '#b3202a' : col === 'black' ? '#151515' : '#0f7b4a';
        ctx.beginPath(); ctx.arc(R, R, R * 0.11, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#f3dc99'; ctx.lineWidth = R * 0.016; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${R * 0.105}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Rules.label(this.last.result), R, R + R * 0.005);
      }
      if (ballA != null) {
        const bx = R + Math.sin(ballA) * ballR * R, by = R - Math.cos(ballA) * ballR * R, br = R * 0.03;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = R * 0.03; ctx.shadowOffsetY = R * 0.012;
        const bg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
        bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#bfc4c8');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.restore();
      }
    },
  };

  function loop(now) {
    if (S.joined) Wheel.frame(now);
    requestAnimationFrame(loop);
  }

  new ResizeObserver(() => { if (S.joined) Wheel.resize(); }).observe($('#wheel-wrap'));

  function startSpin(result, variant, duration, elapsed, round) {
    S.spinRound = round;
    $('#result-banner').hidden = true;
    Wheel.start({ result, variant, duration, elapsed });
  }

  function onSpin(m) {
    startSpin(m.result, m.variant, m.duration, 0, m.round);
  }

  function onResult(m) {
    S.pending = m;
    if (!Wheel.anim || Wheel.anim.done) showResult();
  }

  function onSpinDone() { if (S.pending) showResult(); }

  function showResult() {
    const m = S.pending; S.pending = null;
    if (!m || m.round === S.shownRound || !S.me) return;
    S.shownRound = m.round;
    const mine = m.rows.find((r) => r.id === S.me.id);
    const ban = $('#result-banner');
    ban.replaceChildren(
      h('span', { class: 'num ' + m.color, text: m.label }),
      h('span', { class: 'txt' },
        h('span', { text: `${{ red: 'Rood', black: 'Zwart', green: 'Groen' }[m.color]} ${m.label}` }),
        mine ? h('span', { class: 'net ' + (mine.net >= 0 ? 'plus' : 'minus'), text: (mine.net >= 0 ? '+' : '') + fmt(mine.net) }) : h('span', { text: 'Geen inzet' })),
    );
    ban.hidden = false;
    if (mine) { if (mine.net > 0) Sound.win(); else if (mine.net < 0) Sound.lose(); }
    if (S.st) renderBets();
  }

  // ------------------------------------------------------------------ spelerslijst
  function hue(name) { let x = 0; for (const c of name) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }

  function renderPlayers() {
    const st = S.st;
    const box = $('#players');
    $('#player-count').textContent = `(${st.players.length}/12)`;
    const iAmHost = st.me.host;
    box.replaceChildren(...st.players.map((p) => {
      const tags = [];
      if (p.host) tags.push('👑 Host');
      if (p.spectator) tags.push('toeschouwer');
      if (!p.connected) tags.push('offline');
      if (p.muted) tags.push('gedempt');
      if (p.sitOut && !p.spectator) tags.push('wacht');
      if (p.chips === 0 && !p.staked && !p.spectator) tags.push('blut');
      const av = h('span', { class: 'avatar', text: p.name.slice(0, 1).toUpperCase() });
      av.style.background = `hsl(${hue(p.name)} 45% 32%)`;
      return h('div', { class: 'player' + (p.id === st.me.id ? ' me' : '') + (p.connected ? '' : ' off') },
        av,
        h('div', { class: 'pname' }, h('b', { text: p.name + (p.id === st.me.id ? ' (jij)' : '') }), h('span', { class: 'tags', text: tags.join(' · ') })),
        h('div', { class: 'pbal' }, h('b', { text: fmt(p.chips) }),
          p.staked ? h('small', { text: `+${fmt(p.staked)} in` }) : (p.net != null ? h('small', { class: 'pnet ' + (p.net >= 0 ? 'plus' : 'minus'), text: (p.net >= 0 ? '+' : '') + fmt(p.net) }) : null)),
        iAmHost && p.id !== st.me.id ? h('button', { class: 'btn small iconbtn', title: 'Speler beheren', 'aria-label': `Beheer ${p.name}`, onclick: () => openPlayerModal(p.id) }, '⚙') : h('span'),
      );
    }));
  }

  // ------------------------------------------------------------------ chat
  function renderChat(force) {
    const box = $('#chat-log');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.replaceChildren(...S.chat.slice(-60).map((m) => (m.sys
      ? h('div', { class: 'chat-line sys', text: m.text })
      : h('div', { class: 'chat-line' }, h('span', { class: 'who', text: (m.host ? '👑 ' : '') + m.name + ': ' }), m.text))));
    if (near || force) box.scrollTop = box.scrollHeight;
  }

  // ------------------------------------------------------------------ host-paneel
  const hostUI = {};
  function buildHost() {
    const p = $('#host-panel');
    const btn = (label, cls, fn) => h('button', { class: 'btn small ' + (cls || ''), onclick: fn }, label);
    const toggle = (key, label) => {
      const input = h('input', { type: 'checkbox', onchange: (e) => send({ t: 'settings', settings: { [key]: e.target.checked } }) });
      hostUI[key] = input;
      return h('label', { class: 'toggle' }, h('span', { text: label }), input);
    };
    const num = (key, label, min, max) => {
      const input = h('input', { type: 'number', inputmode: 'numeric', min, max, step: '1', onchange: (e) => {
        const v = Number(e.target.value);
        if (!Number.isInteger(v)) { toast('Vul een geheel getal in.', 'error'); return; }
        send({ t: 'settings', settings: { [key]: v } });
      } });
      hostUI[key] = input;
      return h('label', null, label, input);
    };
    const sel = h('select', { onchange: (e) => send({ t: 'settings', settings: { variant: e.target.value } }) },
      h('option', { value: 'european', text: 'Europees (0)' }), h('option', { value: 'american', text: 'Amerikaans (0 + 00)' }));
    hostUI.variant = sel;

    hostUI.start = btn('▶ Start ronde', 'gold', () => send({ t: 'start' }));
    hostUI.close = btn('Sluit inzetten', '', () => send({ t: 'closeBets' }));
    hostUI.spin = btn('🎡 Draai wiel', '', () => send({ t: 'spin' }));
    hostUI.extend = btn('+10 seconden', '', () => send({ t: 'extend', sec: 10 }));
    hostUI.pause = btn('⏸ Pauzeer', '', () => send({ t: 'pause', value: !S.st.room.paused }));

    p.replaceChildren(
      h('h2', { text: '👑 Host-paneel' }),
      h('div', { class: 'host-grid' }, hostUI.start, hostUI.close, hostUI.spin, hostUI.extend, hostUI.pause),
      toggle('auto', 'Automatisch (rondes lopen vanzelf)'),
      toggle('hostPlays', 'Ik speel zelf mee'),
      toggle('chat', 'Chat aan'),
      toggle('locked', 'Kamer vergrendeld'),
      h('div', { class: 'host-sub', text: 'Instellingen' }),
      h('div', { class: 'num-grid' },
        num('betTime', 'Inzettijd (sec)', 15, 120), num('startChips', 'Startfiches', 10, 1000000),
        num('minBet', 'Min. inzet per vak', 1, 100000), num('maxBet', 'Max. inzet per vak', 1, 1000000),
        num('rebuyBonus', 'Herstart-bonus (0 = uit)', 0, 1000000), h('label', null, 'Variant', sel)),
      h('div', { class: 'host-sub', text: 'Kamer' }),
      h('div', { class: 'host-grid' },
        btn('Kopieer code', '', () => copy(S.me.code, 'Code gekopieerd')),
        btn('Kopieer link', '', () => copy(inviteLink(), 'Link gekopieerd')),
        btn('Iedereen resetten', '', () => { if (confirm('Alle spelers terugzetten naar het startsaldo? Lopende inzetten worden teruggegeven.')) send({ t: 'resetAll' }); }),
        btn('Kamer sluiten', 'danger', () => { if (confirm('De kamer voor iedereen sluiten?')) send({ t: 'closeRoom' }); })),
      h('p', { class: 'tags', text: 'Tip: klik op ⚙ bij een speler om fiches te geven, te dempen, te kicken of de Host-rol over te dragen.' }),
    );
    hostUI.built = true;
  }

  function renderHost() {
    const p = $('#host-panel');
    const st = S.st;
    p.hidden = !st.me.host;
    if (!st.me.host) { hostUI.built = false; return; }
    if (!hostUI.built) buildHost();
    const r = st.room, s = r.settings, paused = r.paused;
    hostUI.start.disabled = !((r.phase === 'lobby' || r.phase === 'results') && !paused);
    hostUI.close.disabled = !(r.phase === 'betting' && !paused);
    hostUI.spin.disabled = !((r.phase === 'betting' || r.phase === 'closed') && !paused);
    hostUI.extend.disabled = !(r.phase === 'betting' && !paused);
    hostUI.pause.textContent = paused ? '▶ Hervat' : '⏸ Pauzeer';
    const between = r.phase === 'lobby' || r.phase === 'results';
    for (const k of ['auto', 'chat', 'locked']) hostUI[k].checked = !!s[k];
    hostUI.hostPlays.checked = !!s.hostPlays;
    for (const k of ['betTime', 'startChips', 'minBet', 'maxBet', 'rebuyBonus']) {
      if (document.activeElement !== hostUI[k]) hostUI[k].value = s[k];
    }
    hostUI.minBet.disabled = !between; hostUI.maxBet.disabled = !between;
    hostUI.variant.disabled = !between;
    if (document.activeElement !== hostUI.variant) hostUI.variant.value = s.variant;
  }

  function openPlayerModal(id) {
    const p = S.st.players.find((x) => x.id === id);
    if (!p) return;
    const modal = $('#modal');
    const close = () => { modal.hidden = true; modal.replaceChildren(); };
    const act = (obj, closeAfter) => () => { send(obj); if (closeAfter) close(); };
    const setInput = h('input', { type: 'number', min: 0, step: 1, placeholder: 'Saldo instellen…', inputmode: 'numeric' });
    modal.replaceChildren(h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Beheer ${p.name}` },
      h('h3', { text: p.name }),
      h('div', { class: 'sub', text: `${fmt(p.chips)} fiches${p.connected ? '' : ' · offline'}` }),
      h('div', { class: 'modal-grid' },
        h('button', { class: 'btn small', onclick: act({ t: 'chips', id, mode: 'add', amount: 100 }) }, '+100'),
        h('button', { class: 'btn small', onclick: act({ t: 'chips', id, mode: 'add', amount: 500 }) }, '+500'),
        h('button', { class: 'btn small', onclick: act({ t: 'chips', id, mode: 'add', amount: -100 }) }, '−100'),
        h('button', { class: 'btn small', onclick: act({ t: 'chips', id, mode: 'add', amount: -500 }) }, '−500')),
      h('div', { class: 'set-row' }, setInput, h('button', { class: 'btn small gold', onclick: () => {
        const v = Number(setInput.value);
        if (setInput.value === '' || !Number.isInteger(v) || v < 0) return toast('Vul een geheel getal ≥ 0 in.', 'error');
        send({ t: 'chips', id, mode: 'set', amount: v }); close();
      } }, 'Zet')),
      h('div', { class: 'modal-grid' },
        h('button', { class: 'btn small', onclick: act({ t: 'resetPlayer', id }, true) }, 'Reset naar start'),
        h('button', { class: 'btn small', onclick: act({ t: 'mute', id, value: !p.muted }, true) }, p.muted ? 'Dempen opheffen' : 'Dempen'),
        h('button', { class: 'btn small', onclick: () => { if (confirm(`${p.name} Host maken?`)) { send({ t: 'transfer', id }); close(); } } }, '👑 Host maken'),
        h('button', { class: 'btn small danger', onclick: () => { if (confirm(`${p.name} uit de kamer zetten?`)) { send({ t: 'kick', id }); close(); } } }, 'Kick'),
        h('button', { class: 'btn small danger', onclick: () => { if (confirm(`${p.name} verbannen?`)) { send({ t: 'ban', id }); close(); } } }, 'Ban'),
        h('button', { class: 'btn small ghost', onclick: close }, 'Sluiten')),
    ));
    modal.hidden = false;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = $('#modal'); m.hidden = true; m.replaceChildren(); } });

  // ------------------------------------------------------------------ kopiëren
  const inviteLink = () => `${location.origin}${location.pathname}?room=${S.me.code}`;
  function copy(text, okMsg) {
    const done = () => toast(okMsg, 'info');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast(`Kopieer handmatig: ${text}`, 'warn'); }
    ta.remove();
  }

  // ------------------------------------------------------------------ startscherm
  function renderRejoin() {
    const last = store.get('localStorage', 'roulette.last');
    const b = $('#btn-rejoin');
    if (last && Date.now() - last.ts < 2 * 60 * 1000 * 60 && !S.joined) {
      b.hidden = false;
      b.textContent = `Terug naar kamer ${last.code} als ${last.name}`;
      b.onclick = () => { S.noReconnect = false; Sound.init(); request({ t: 'resume', code: last.code, token: last.token }); };
    } else b.hidden = true;
  }

  function getName() { return $('#inp-name').value.trim(); }
  $('#btn-create').addEventListener('click', () => {
    Sound.init(); S.noReconnect = false; showStartError('');
    if (!getName()) return showStartError('Kies eerst een bijnaam.');
    request({ t: 'create', name: getName() });
  });
  $('#btn-join').addEventListener('click', () => {
    Sound.init(); S.noReconnect = false; showStartError('');
    const code = $('#inp-code').value.trim().toUpperCase();
    if (!getName()) return showStartError('Kies eerst een bijnaam.');
    if (code.length !== 5) return showStartError('Een kamercode heeft 5 tekens.');
    request({ t: 'join', code, name: getName() });
  });
  $('#inp-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  for (const id of ['#inp-name', '#inp-code']) {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') (($('#inp-code').value ? $('#btn-join') : $('#btn-create'))).click(); });
  }

  // ------------------------------------------------------------------ overige knoppen
  $('#btn-code').addEventListener('click', () => S.me && copy(S.me.code, 'Code gekopieerd'));
  $('#btn-link').addEventListener('click', () => S.me && copy(inviteLink(), 'Link gekopieerd'));
  $('#btn-sound').addEventListener('click', () => {
    Sound.on = !Sound.on; Sound.init(); store.set('localStorage', 'roulette.sound', Sound.on);
    $('#btn-sound').textContent = Sound.on ? '🔊' : '🔇';
    if (Sound.on) Sound.chip();
  });
  $('#btn-leave').addEventListener('click', () => { if (confirm('De kamer verlaten?')) send({ t: 'leave' }); });
  $('#btn-undo').addEventListener('click', () => send({ t: 'undo' }));
  $('#btn-clear').addEventListener('click', () => send({ t: 'clear' }));
  $('#btn-repeat').addEventListener('click', () => send({ t: 'repeat' }));
  $('#btn-double').addEventListener('click', () => send({ t: 'double' }));
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chat-input');
    const text = inp.value.trim();
    if (!text) return;
    send({ t: 'chat', text });
    inp.value = '';
  });

  // Geluid mag pas starten na een klik of toets (browserregel)
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => Sound.init(), { once: true, capture: true });

  // ------------------------------------------------------------------ start
  (function init() {
    const params = new URLSearchParams(location.search);
    const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (room) $('#inp-code').value = room;
    const name = store.get('localStorage', 'roulette.name');
    if (typeof name === 'string') $('#inp-name').value = name;
    if (store.get('sessionStorage', 'roulette.session')) {
      // we proberen terug te keren; het startscherm blijft zichtbaar tot de server antwoordt
    }
    renderRejoin();
    Wheel.resize();
    connect();
    requestAnimationFrame(loop);
    (room && name ? $('#btn-join') : $('#inp-name')).focus?.();
  })();
})();
