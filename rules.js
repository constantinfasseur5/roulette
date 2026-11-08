/*
 * rules.js — de regels van de roulette.
 * Wordt door de SERVER (uitbetalingen, validatie) én de BROWSER (tafel tekenen) gebruikt,
 * zodat beide altijd exact hetzelfde over inzetten denken.
 *
 * Nummers: 0..36, en 37 = "00" (alleen Amerikaanse variant).
 * Een inzet heeft een sleutel (key), bv. "straight:17", "split:1-2", "red", "dozen:2".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  // Volgorde van de vakjes op het wiel (kloksgewijs, beginnend bij 0)
  const WHEEL_EU = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const WHEEL_US = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

  const VARIANTS = {
    european: { name: 'Europees', wheel: WHEEL_EU },
    american: { name: 'Amerikaans', wheel: WHEEL_US },
  };

  const CHIPS = [1, 5, 10, 25, 100, 500];
  // Keuzes voor het spelersprofiel (de server accepteert alleen waarden uit deze lijsten)
  const AVATARS = ['😀', '😎', '🤠', '🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐲', '👻', '🤖', '👽', '🎩', '👑', '💎', '🍀', '🔥', '⭐', '🎲', '🃏', '🍒', '🚀'];
  const COLORS = ['#c0392b', '#e67e22', '#d4ac0d', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d63a8e'];

  const label = (n) => (n === 37 ? '00' : String(n));
  const colorOf = (n) => (n === 0 || n === 37 ? 'green' : RED.has(n) ? 'red' : 'black');
  const key = (kind, nums) => kind + ':' + nums.join('-');

  const cache = {};

  /** Alle geldige inzetten voor een variant: { key: {key, kind, nums, ratio} } */
  function buildBets(variant) {
    if (variant !== 'american') variant = 'european';
    if (cache[variant]) return cache[variant];

    const us = variant === 'american';
    const bets = Object.create(null);
    const add = (k, kind, nums, ratio) => {
      bets[k] = Object.freeze({ key: k, kind, nums: Object.freeze(nums), ratio });
    };
    const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

    // Enkel nummer 35:1
    add(key('straight', [0]), 'straight', [0], 35);
    if (us) add(key('straight', [37]), 'straight', [37], 35);
    for (let n = 1; n <= 36; n++) add(key('straight', [n]), 'straight', [n], 35);

    // Split 17:1 (twee aangrenzende nummers)
    for (let n = 1; n <= 36; n++) {
      if (n % 3 !== 0) add(key('split', [n, n + 1]), 'split', [n, n + 1], 17); // boven/onder elkaar
      if (n + 3 <= 36) add(key('split', [n, n + 3]), 'split', [n, n + 3], 17); // naast elkaar
    }
    const zeroSplits = us ? [[0, 1], [0, 2], [2, 37], [3, 37], [0, 37]] : [[0, 1], [0, 2], [0, 3]];
    zeroSplits.forEach((p) => add(key('split', p), 'split', p, 17));

    // Street 11:1 (rij van drie)
    for (let s = 0; s < 12; s++) add(key('street', [3 * s + 1, 3 * s + 2, 3 * s + 3]), 'street', [3 * s + 1, 3 * s + 2, 3 * s + 3], 11);

    // Corner 8:1 (vier nummers in een vierkant) + "eerste vier" 0-1-2-3 (alleen Europees)
    for (let n = 1; n <= 32; n++) {
      if (n % 3 !== 0) add(key('corner', [n, n + 1, n + 3, n + 4]), 'corner', [n, n + 1, n + 3, n + 4], 8);
    }
    if (!us) add(key('corner', [0, 1, 2, 3]), 'corner', [0, 1, 2, 3], 8);

    // Six line 5:1 (twee rijen)
    for (let s = 0; s < 11; s++) add(key('sixline', range(3 * s + 1, 3 * s + 6)), 'sixline', range(3 * s + 1, 3 * s + 6), 5);

    // Kolommen en dozijnen 2:1
    for (let c = 1; c <= 3; c++) {
      const nums = [];
      for (let n = c; n <= 36; n += 3) nums.push(n);
      add('column:' + c, 'column', nums, 2);
    }
    for (let d = 1; d <= 3; d++) add('dozen:' + d, 'dozen', range((d - 1) * 12 + 1, d * 12), 2);

    // Buiteninzetten 1:1 (verliezen bij 0 / 00 omdat die er niet in zitten)
    const all = range(1, 36);
    add('red', 'red', all.filter((n) => RED.has(n)), 1);
    add('black', 'black', all.filter((n) => !RED.has(n)), 1);
    add('even', 'even', all.filter((n) => n % 2 === 0), 1);
    add('odd', 'odd', all.filter((n) => n % 2 === 1), 1);
    add('low', 'low', range(1, 18), 1);
    add('high', 'high', range(19, 36), 1);

    cache[variant] = Object.freeze(bets);
    return cache[variant];
  }

  /** Wat krijgt de speler terug (inzet + winst) voor deze inzet bij deze uitslag? 0 bij verlies. */
  function payout(def, amount, result) {
    return def && def.nums.includes(result) ? amount * (def.ratio + 1) : 0;
  }

  return { RED, VARIANTS, CHIPS, AVATARS, COLORS, label, colorOf, buildBets, payout };
});
