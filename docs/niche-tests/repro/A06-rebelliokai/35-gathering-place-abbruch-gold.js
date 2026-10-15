'use strict';
// A06-rebelliokai-35 · War Council Gathering Place: der Effekt wird nur angeboten, wenn der Ratgeber-Effekt ein legales Ziel hat
// Kartentext: „Whenever a player summons a "War Counselor" Creature, they may spend 8 Gold to immediately have it use its active effect."
// ENTSCHIEDEN (Al, Welle 10, Q46: „Der Effekt sollte gar nicht erst angeboten werden, wenn er kein legales Ziel hat!“): ohne legales Ziel kein Angebot, keine Zahlung (kein Gold weg).
// (Umgestellt: vorher wurde der Goldverlust nach abgebrochener Zielwahl beanstandet; der freiwillige Abbruch eines vorhandenen Ziels ist NICHT Gegenstand der Entscheidung.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CENS = 'Censpartan War Counselor', MINO = 'Minocrete War Counselor', HARP = 'Harpthenean War Counselor';
  const gefragt = (t) => t.prompts.some(p => /War Council Gathering Place/.test(JSON.stringify(p.d)));
  // (1) Censpartan: zwei gegnerische Kreaturen, aber keine wählbar → kein Angebot
  let t = await H.fresh({ hand: [[CENS], []] });
  t.putArea(0, 'War Council Gathering Place');
  let a = t.put(1, 0, 0, H.INERT.creature), b = t.put(1, 0, 1, H.INERT.creature);
  a.counters.untargetable_all = 1; b.counters.untargetable_all = 1;
  t.policy.confirm = true;
  let g0 = t.gs.players[0].gold;
  let r = await t.play(0, CENS, { hero: 0, slot: 0 });
  R.check('(1) Censpartan beschworen (Aufbau)', r === true && t.zone(0, 0, 0) === CENS, { r, z: t.zone(0, 0, 0) });
  R.check('(1) kein wählbares Ziel: kein Angebot', !gefragt(t), t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
  R.check('(1) kein wählbares Ziel: kein Gold weg', t.gs.players[0].gold === g0, { g0, g: t.gs.players[0].gold });
  // (1b) Kontrolle: wählbare Ziele → Angebot und Zahlung
  t = await H.fresh({ hand: [[CENS], []] });
  t.putArea(0, 'War Council Gathering Place');
  t.put(1, 0, 0, H.INERT.creature); t.put(1, 0, 1, H.INERT.creature);
  t.policy.confirm = true;
  t.targetFn = (valid) => valid.slice(0, 1).map(v => v.id);
  g0 = t.gs.players[0].gold;
  r = await t.play(0, CENS, { hero: 0, slot: 0 });
  R.check('(1b) Kontrolle: mit wählbaren Zielen wird angeboten', gefragt(t), t.prompts.map(p => p.d.type));
  R.check('(1b) Kontrolle: 8 Gold bezahlt', t.gs.players[0].gold === g0 - 8, { g0, g: t.gs.players[0].gold });
  // (2) Minocrete: das einzige geschädigte Ziel ist nicht wählbar → kein Angebot
  t = await H.fresh({ hand: [[MINO], []] });
  t.putArea(0, 'War Council Gathering Place');
  a = t.put(1, 0, 0, H.INERT.big);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Quelle', owner: 0, heroIdx: 0 }, a, 50, 'creature', { sourceOwner: 0 }));
  a.counters.untargetable_all = 1;
  t.policy.confirm = true;
  g0 = t.gs.players[0].gold;
  r = await t.play(0, MINO, { hero: 0, slot: 0 });
  R.check('(2) Minocrete: einziges geschädigtes Ziel unwählbar → kein Angebot, kein Gold weg', !gefragt(t) && t.gs.players[0].gold === g0, { gefragt: gefragt(t), g0, g: t.gs.players[0].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
