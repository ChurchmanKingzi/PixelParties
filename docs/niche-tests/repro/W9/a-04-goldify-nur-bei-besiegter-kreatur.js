'use strict';
// W9a · Q4 (A01-pollution-26) · Al, 15.10.2026: „Nein!“ – Goldify liefert Gold und Zusatzaktion NUR, wenn die gewählte Kreatur tatsächlich besiegt wurde.
// Erwartet: (1) Kreatur Lv1 besiegt → +5 Gold, Zusatzaktion (Phase bleibt 3). (2) Kreatur überlebt per Schutz (Golden Wings / Warrior of Teocuilatl)
//   → weder Gold noch Zusatzaktion (Phase endet = die Aktion ist verbraucht), Token bezahlt, Karte in der Ablage.
const H = require('../../lib/h.js');
const tgt = () => (v) => [v.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0).id];
(async () => {
  const R = H.runner();
  // (1) Kontrolle: besiegt
  let t = await H.fresh({ hand: [['Goldify', 'Fireball'], []] });
  t.put(1, 0, 0, 'Soul Shard Ba');
  t.targetFn = tgt(); t.policy.confirm = true;
  let g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(1) Ba besiegt', !t.find('Soul Shard Ba', 'support'), 'Ba lebt');
  R.check('(1) +5 Gold', t.gs.players[0].gold === g0 + 5, [g0, t.gs.players[0].gold]);
  R.check('(1) Zusatzaktion: Action Phase bleibt', t.gs.currentPhase === 3, t.gs.currentPhase);
  // (2a) Golden Wings
  t = await H.fresh({ hand: [['Goldify', 'Fireball'], ['Golden Wings']] });
  t.put(1, 0, 0, 'Soul Shard Ba'); t.grantFor(1, 0, 'Golden Wings');
  t.targetFn = tgt(); t.policy.confirm = true;
  g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(2a) Ba überlebt', !!t.find('Soul Shard Ba', 'support'), 'Ba tot – Aufbau greift nicht');
  R.check('(2a) kein Gold', t.gs.players[0].gold === g0, [g0, t.gs.players[0].gold]);
  R.check('(2a) keine Zusatzaktion (Phase 3 verlassen)', t.gs.currentPhase !== 3, t.gs.currentPhase);
  R.check('(2a) Goldify in der Ablage, Token bezahlt', t.pile(0, 'discardPile').includes('Goldify') && t.inst(c => c.name === 'Pollution Token' && c.owner === 0).length === 1, t.pile(0, 'discardPile'));
  R.check('(2a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  // (2b) Warrior of Teocuilatl
  t = await H.fresh({ hand: [['Goldify', 'Fireball'], []] });
  t.putArea(1, 'Doom Clock').counters.doom = 5;
  t.put(1, 0, 0, 'Soul Shard Ba'); t.put(1, 0, 1, 'Warrior of Teocuilatl');
  t.targetFn = tgt(); t.policy.confirm = true;
  g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(2b) Ba überlebt', !!t.find('Soul Shard Ba', 'support'), 'Ba tot – Aufbau greift nicht');
  R.check('(2b) kein Gold', t.gs.players[0].gold === g0, [g0, t.gs.players[0].gold]);
  R.check('(2b) keine Zusatzaktion', t.gs.currentPhase !== 3, t.gs.currentPhase);
  R.finish();
})();
