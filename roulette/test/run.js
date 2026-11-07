'use strict';
const { summary } = require('./harness');
(async () => {
  await require('./logic.test').run();
  try { await require('./net.test').run(); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  process.exit(summary() ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
