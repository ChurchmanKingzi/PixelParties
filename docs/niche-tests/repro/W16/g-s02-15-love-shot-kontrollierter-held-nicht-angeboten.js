'use strict';
// W16g · S02-15 (Teil 1): Love Shot „choose a Hero your opponent controls“ — ein Gegnerheld, den ICH (dauerhaft) kontrolliere, wird nicht angeboten;
// die übrigen Gegnerhelden schon. (Teil 2 — ein vom Gegner kontrollierter Held MEINER Spalte — ist offen, Stufe 4: der Nachguss ist spaltenweise gebaut.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30 });
  await t.engine.actionTakeHeroPermanently(0, 1, 0);
  let offered = null;
  t.targetFn = (valid, cfg) => { if (/Love Shot/.test((cfg && cfg.title) || '')) offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return null; };
  const r = await t.play(0, 'Love Shot', { hero: 0 });
  R.check('Love Shot gespielt', r === true, r);
  R.check('von mir kontrollierter Gegnerheld (1:0) wird NICHT angeboten', !!offered && !offered.includes('1:0'), offered);
  R.check('die übrigen Gegnerhelden (1:1, 1:2) werden angeboten', !!offered && offered.includes('1:1') && offered.includes('1:2'), offered);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
